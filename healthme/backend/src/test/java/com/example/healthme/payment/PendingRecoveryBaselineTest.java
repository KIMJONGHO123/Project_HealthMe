package com.example.healthme.payment;

import com.example.healthme.domain.approval.controller.PortOneController;
import com.example.healthme.domain.approval.dto.PortOnePaymentDto;
import com.example.healthme.domain.approval.entity.ApprovalOrder;
import com.example.healthme.domain.approval.repository.ApprovalCartItemRepository;
import com.example.healthme.domain.approval.repository.ApprovalOrderRepository;
import com.example.healthme.domain.approval.service.ApprovalService;
import com.example.healthme.domain.approval.service.PortOneClient;
import com.example.healthme.domain.mypage.entity.Address;
import com.example.healthme.domain.mypage.repository.AddressRepository;
import com.example.healthme.domain.product.entity.ProductStore;
import com.example.healthme.domain.product.repository.ProductStoreRepository;
import com.example.healthme.domain.shoppingcart.entity.ShoppingCartItem;
import com.example.healthme.domain.user.entity.User;
import com.example.healthme.domain.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.MethodParameter;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * 개선 전 기준선: PortOne에서는 결제가 완료됐지만 HealthMe 주문이 PAID가 되지 못하는 경우,
 * 현재 코드에 이를 복구하는 경로(웹훅, 보정 배치)가 없음을 재현한다.
 *
 * 결제 완료 주문 100건 중 30건에 장애 3종을 10건씩 주입한다.
 * - 완료 요청 미도달: 결제 후 브라우저 종료·네트워크 단절 (complete API 미호출)
 * - PortOne 재조회 오류: complete 요청 중 결제 조회 실패
 * - PAID 처리 중 내부 예외: 재고·누적금액 반영 후 장바구니 정리 단계에서 DB 접근 예외
 */
@DataJpaTest(properties = {
        "spring.config.location=optional:classpath:/payment-test-isolated.properties",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.jpa.show-sql=false"
}, showSql = false)
@ContextConfiguration(classes = PendingRecoveryBaselineTest.Config.class)
@Import(ApprovalService.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PendingRecoveryBaselineTest {

    @SpringBootConfiguration
    @EntityScan("com.example.healthme.domain")
    @EnableJpaRepositories(basePackages = {
            "com.example.healthme.domain.approval.repository",
            "com.example.healthme.domain.user.repository",
            "com.example.healthme.domain.mypage.repository",
            "com.example.healthme.domain.product.repository"
    })
    static class Config {
    }

    private static final int TOTAL_ORDERS = 100;
    private static final int FAULTS_PER_TYPE = 10;
    private static final int NORMAL_ORDERS = TOTAL_ORDERS - FAULTS_PER_TYPE * 3;
    private static final int INITIAL_STOCK = 1_000;
    private static final int EXPECTED_AMOUNT = 9_700; // 판매가 10,000원 - 새싹 등급 3%

    enum Scenario {
        NORMAL("정상 완료 요청"),
        COMPLETE_NOT_DELIVERED("완료 요청 미도달"),
        PORTONE_LOOKUP_ERROR("PortOne 재조회 오류"),
        INTERNAL_ERROR_ON_PAID("PAID 처리 중 내부 예외");

        final String label;

        Scenario(String label) {
            this.label = label;
        }
    }

    record PaidOrder(Scenario scenario, Long orderId, String merchantUid, String impUid, String response) {
    }

    @Autowired ApprovalService service;
    @Autowired ApprovalOrderRepository orders;
    @Autowired UserRepository users;
    @Autowired AddressRepository addresses;
    @Autowired ProductStoreRepository products;
    @MockitoBean PortOneClient portOne;
    @MockitoSpyBean ApprovalCartItemRepository carts;

    private final ObjectMapper json = new ObjectMapper();
    private final Map<String, PortOnePaymentDto> portOneLedger = new HashMap<>();
    private final Set<String> lookupFailures = new HashSet<>();
    private final LocalDateTime paidAt = LocalDateTime.of(2026, 11, 11, 12, 0);

    private MockMvc mvc;
    private User user;
    private ProductStore product;

    @BeforeEach
    void setUp() {
        user = users.save(User.builder().userid("pending-" + UUID.randomUUID())
                .username("test").grade("새싹").totalPurchaseAmount(0).build());
        addresses.save(Address.builder().user(user).recipient("test").zip("00000")
                .address("test address").recipientPhone("010-0000-0000").isDefault(true).build());
        product = products.save(ProductStore.builder().name("test product").price(10_000)
                .salprice(10_000).amount(INITIAL_STOCK).sales_count(0).imageUrl("test.png").build());
        carts.save(ShoppingCartItem.builder().user(user).product(product).quantity(1).build());

        UserDetails principal = org.springframework.security.core.userdetails.User
                .withUsername(user.getUserid()).password("unused").roles("USER").build();
        mvc = MockMvcBuilders.standaloneSetup(new PortOneController(service))
                .setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                    public boolean supportsParameter(MethodParameter p) {
                        return p.getParameterType() == UserDetails.class;
                    }

                    public Object resolveArgument(MethodParameter p, ModelAndViewContainer m,
                                                  NativeWebRequest w, WebDataBinderFactory b) {
                        return principal;
                    }
                }).build();

        // 모의 PortOne: 결제 원장에 있는 결제를 그대로 돌려주고, 지정된 결제번호만 조회 오류를 낸다.
        doAnswer(invocation -> {
            String impUid = invocation.getArgument(0);
            if (lookupFailures.contains(impUid)) {
                throw new IllegalStateException("fixture: PortOne lookup timeout");
            }
            PortOnePaymentDto payment = portOneLedger.get(impUid);
            if (payment == null) {
                throw new IllegalStateException("fixture: unknown payment " + impUid);
            }
            return payment;
        }).when(portOne).getPayment(anyString());
    }

    @AfterEach
    void tearDown() {
        reset(carts, portOne);
    }

    @Test
    void paidAtPortOneButPendingOrdersAreNeverRecovered() throws Exception {
        List<PaidOrder> paidOrders = new ArrayList<>();

        for (int i = 0; i < NORMAL_ORDERS; i++) {
            paidOrders.add(payAndComplete(Scenario.NORMAL));
        }
        for (int i = 0; i < FAULTS_PER_TYPE; i++) {
            paidOrders.add(payAndComplete(Scenario.COMPLETE_NOT_DELIVERED));
        }
        for (int i = 0; i < FAULTS_PER_TYPE; i++) {
            paidOrders.add(payAndComplete(Scenario.PORTONE_LOOKUP_ERROR));
        }
        doThrow(new DataAccessResourceFailureException("fixture: DB connection lost while clearing cart"))
                .when(carts).deleteAll(anyIterable());
        for (int i = 0; i < FAULTS_PER_TYPE; i++) {
            paidOrders.add(payAndComplete(Scenario.INTERNAL_ERROR_ON_PAID));
        }
        reset(carts);

        // 시나리오별 PortOne 상태와 DB 주문 상태 집계
        Map<Scenario, Map<String, Integer>> statusByScenario = new LinkedHashMap<>();
        Map<Scenario, Map<String, Integer>> responseByScenario = new LinkedHashMap<>();
        int mismatched = 0;
        for (PaidOrder paid : paidOrders) {
            ApprovalOrder order = orders.findById(paid.orderId()).orElseThrow();
            assertThat(portOneLedger.get(paid.impUid()).isPaid()).isTrue();
            statusByScenario.computeIfAbsent(paid.scenario(), k -> new LinkedHashMap<>())
                    .merge(order.getStatus(), 1, Integer::sum);
            responseByScenario.computeIfAbsent(paid.scenario(), k -> new LinkedHashMap<>())
                    .merge(paid.response(), 1, Integer::sum);
            if (!ApprovalService.STATUS_PAID.equals(order.getStatus())) {
                mismatched++;
                assertThat(order.getStatus()).isEqualTo(ApprovalService.STATUS_PENDING);
                assertThat(order.getPaymentImpUid()).isNull();
                assertThat(order.getPaidAmount()).isNull();
            }
        }

        ProductStore stock = products.findById(product.getProductId()).orElseThrow();
        int purchaseAmount = users.findById(user.getId()).orElseThrow().getTotalPurchaseAmount();

        // 개선 전 기준선 단언
        assertThat(paidOrders).hasSize(TOTAL_ORDERS);
        assertThat(statusByScenario.get(Scenario.NORMAL)).containsExactlyEntriesOf(Map.of("PAID", NORMAL_ORDERS));
        assertThat(statusByScenario.get(Scenario.COMPLETE_NOT_DELIVERED)).containsExactlyEntriesOf(Map.of("PENDING", FAULTS_PER_TYPE));
        assertThat(statusByScenario.get(Scenario.PORTONE_LOOKUP_ERROR)).containsExactlyEntriesOf(Map.of("PENDING", FAULTS_PER_TYPE));
        assertThat(statusByScenario.get(Scenario.INTERNAL_ERROR_ON_PAID)).containsExactlyEntriesOf(Map.of("PENDING", FAULTS_PER_TYPE));
        assertThat(mismatched).isEqualTo(FAULTS_PER_TYPE * 3);
        verify(portOne, never()).cancelPayment(anyString(), anyString());
        assertThat(stock.getAmount()).isEqualTo(INITIAL_STOCK - NORMAL_ORDERS);
        assertThat(stock.getSales_count()).isEqualTo(NORMAL_ORDERS);
        assertThat(purchaseAmount).isEqualTo(NORMAL_ORDERS * EXPECTED_AMOUNT);

        int portOnePaidTotal = TOTAL_ORDERS * EXPECTED_AMOUNT;
        System.out.println("EVIDENCE baseline commit=2560d23 orders=" + TOTAL_ORDERS
                + " faultsInjected=" + (FAULTS_PER_TYPE * 3));
        for (Scenario scenario : Scenario.values()) {
            System.out.println("EVIDENCE scenario=" + scenario + " label=" + scenario.label
                    + " http=" + responseByScenario.get(scenario)
                    + " dbStatus=" + statusByScenario.get(scenario));
        }
        System.out.println("EVIDENCE mismatch(PortOne paid, DB not PAID)=" + mismatched
                + " autoRecovered=0 cancelPaymentCalls=0");
        System.out.println("EVIDENCE stock " + INITIAL_STOCK + "->" + stock.getAmount()
                + " sales 0->" + stock.getSales_count()
                + " userPurchaseAmount 0->" + purchaseAmount
                + " portOnePaidTotal=" + portOnePaidTotal
                + " unreflectedAmount=" + (portOnePaidTotal - purchaseAmount));
    }

    /** 주문 준비 → PortOne 결제 완료 → 시나리오에 따라 완료 요청 처리 */
    private PaidOrder payAndComplete(Scenario scenario) throws Exception {
        var prepareResponse = mvc.perform(post("/healthme/payments/prepare")
                        .contentType("application/json")
                        .content("{\"items\":[{\"productId\":" + product.getProductId() + ",\"quantity\":1}]}"))
                .andReturn().getResponse();
        assertThat(prepareResponse.getStatus()).isEqualTo(200);
        var prepared = json.readTree(prepareResponse.getContentAsString());
        String merchantUid = prepared.path("merchantUid").asText();
        Long orderId = prepared.path("orderId").asLong();
        assertThat(prepared.path("amount").asInt()).isEqualTo(EXPECTED_AMOUNT);

        // 사용자가 PortOne 결제창에서 결제 완료: 이 시점에 돈이 빠져나간다.
        String impUid = "imp_" + UUID.randomUUID();
        portOneLedger.put(impUid, PortOnePaymentDto.builder().impUid(impUid).merchantUid(merchantUid)
                .status("paid").amount(EXPECTED_AMOUNT).currency("KRW").paidAt(paidAt).build());

        if (scenario == Scenario.COMPLETE_NOT_DELIVERED) {
            return new PaidOrder(scenario, orderId, merchantUid, impUid, "complete 요청 없음");
        }
        if (scenario == Scenario.PORTONE_LOOKUP_ERROR) {
            lookupFailures.add(impUid);
        }

        String body = "{\"impUid\":\"" + impUid + "\",\"merchantUid\":\"" + merchantUid + "\"}";
        String response;
        try {
            int status = mvc.perform(post("/healthme/payments/complete")
                    .contentType("application/json").content(body)).andReturn().getResponse().getStatus();
            response = "HTTP " + status;
        } catch (Exception unhandled) {
            // 컨트롤러가 처리하지 않는 예외: 실제 서버에서는 HTTP 500으로 응답된다.
            response = "처리되지 않은 예외(HTTP 500)";
        }
        return new PaidOrder(scenario, orderId, merchantUid, impUid, response);
    }
}
