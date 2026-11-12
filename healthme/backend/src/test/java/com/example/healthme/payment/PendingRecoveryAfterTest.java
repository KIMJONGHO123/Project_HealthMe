package com.example.healthme.payment;

import com.example.healthme.domain.approval.controller.PortOneController;
import com.example.healthme.domain.approval.dto.PortOnePaymentDto;
import com.example.healthme.domain.approval.entity.ApprovalOrder;
import com.example.healthme.domain.approval.repository.ApprovalCartItemRepository;
import com.example.healthme.domain.approval.repository.ApprovalOrderRepository;
import com.example.healthme.domain.approval.service.ApprovalService;
import com.example.healthme.domain.approval.service.PaymentRecoveryResult;
import com.example.healthme.domain.approval.service.PaymentRecoveryScheduler;
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
import org.springframework.test.annotation.DirtiesContext;
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
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * 개선 후: PendingRecoveryBaselineTest와 같은 조건(결제 완료 100건, 장애 3종 30건)에서
 * 보정 배치가 PENDING 주문을 PAID로 복구하고, 중복 반영이 없는지 확인한다.
 */
@DataJpaTest(properties = {
        "spring.config.location=optional:classpath:/payment-test-isolated.properties",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.jpa.show-sql=false"
}, showSql = false)
@ContextConfiguration(classes = PendingRecoveryAfterTest.Config.class)
@Import({ApprovalService.class, PaymentRecoveryScheduler.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
// 배치는 DB 전체의 PENDING 주문을 대상으로 하므로, 테스트마다 새 H2 DB를 사용해 서로의 주문이 섞이지 않게 한다.
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class PendingRecoveryAfterTest {

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
        INTERNAL_ERROR_ON_PAID("PAID 처리 중 내부 예외"),
        NOT_PAID("결제하지 않음");

        final String label;

        Scenario(String label) {
            this.label = label;
        }
    }

    record PaidOrder(Scenario scenario, Long orderId, String merchantUid, String impUid, String response) {
    }

    @Autowired ApprovalService service;
    @Autowired PaymentRecoveryScheduler recoveryBatch;
    @Autowired ApprovalOrderRepository orders;
    @Autowired UserRepository users;
    @Autowired AddressRepository addresses;
    @Autowired ProductStoreRepository products;
    @MockitoBean PortOneClient portOne;
    @MockitoSpyBean ApprovalCartItemRepository carts;

    private final ObjectMapper json = new ObjectMapper();
    private final Map<String, PortOnePaymentDto> ledgerByImpUid = new HashMap<>();
    private final Map<String, PortOnePaymentDto> ledgerByMerchantUid = new HashMap<>();
    private final Set<String> lookupFailures = new HashSet<>();
    private final LocalDateTime paidAt = LocalDateTime.of(2026, 11, 12, 12, 0);

    private MockMvc mvc;
    private User user;
    private ProductStore product;

    @BeforeEach
    void setUp() {
        user = users.save(User.builder().userid("recovery-" + UUID.randomUUID())
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

        // 모의 PortOne 결제 원장: 결제번호 조회(완료 요청), 주문번호 조회(보정 배치)
        doAnswer(invocation -> {
            String impUid = invocation.getArgument(0);
            if (lookupFailures.contains(impUid)) {
                throw new IllegalStateException("fixture: PortOne lookup timeout");
            }
            PortOnePaymentDto payment = ledgerByImpUid.get(impUid);
            if (payment == null) {
                throw new IllegalStateException("fixture: unknown payment " + impUid);
            }
            return payment;
        }).when(portOne).getPayment(anyString());
        doAnswer(invocation -> {
            String merchantUid = invocation.getArgument(0);
            PortOnePaymentDto payment = ledgerByMerchantUid.get(merchantUid);
            if (payment != null && lookupFailures.contains(payment.getImpUid())) {
                throw new IllegalStateException("fixture: PortOne lookup timeout");
            }
            return Optional.ofNullable(payment);
        }).when(portOne).findPaidPaymentByMerchantUid(anyString());
    }

    @AfterEach
    void tearDown() {
        reset(carts, portOne);
    }

    @Test
    void paidButPendingOrdersAreRecoveredByBatchWithoutDuplicates() throws Exception {
        List<PaidOrder> paidOrders = runBaselineScenario();

        // 배치 실행 전: 개선 전 기준선과 같은 상태인지 확인
        assertThat(countMismatched(paidOrders)).isEqualTo(FAULTS_PER_TYPE * 3);
        assertThat(stock().getAmount()).isEqualTo(INITIAL_STOCK - NORMAL_ORDERS);

        // 장애 해소(PortOne 조회 정상화) 후 10분 뒤 보정 배치 1회 실행
        lookupFailures.clear();
        Map<PaymentRecoveryResult, Integer> firstRun = recoveryBatch.recoverPendingPayments(LocalDateTime.now().plusMinutes(10));

        Map<Scenario, Map<String, Integer>> statusByScenario = statusByScenario(paidOrders);
        int mismatched = countMismatched(paidOrders);
        int purchaseAmount = purchaseAmount();

        assertThat(firstRun).containsExactlyEntriesOf(Map.of(PaymentRecoveryResult.RECOVERED_PAID, FAULTS_PER_TYPE * 3));
        assertThat(mismatched).isZero();
        for (Scenario scenario : List.of(Scenario.NORMAL, Scenario.COMPLETE_NOT_DELIVERED,
                Scenario.PORTONE_LOOKUP_ERROR, Scenario.INTERNAL_ERROR_ON_PAID)) {
            int expected = scenario == Scenario.NORMAL ? NORMAL_ORDERS : FAULTS_PER_TYPE;
            assertThat(statusByScenario.get(scenario)).containsExactlyEntriesOf(Map.of("PAID", expected));
        }
        for (PaidOrder paid : paidOrders) {
            ApprovalOrder order = orders.findById(paid.orderId()).orElseThrow();
            assertThat(order.getPaymentImpUid()).isEqualTo(paid.impUid());
            assertThat(order.getPaidAmount()).isEqualTo(EXPECTED_AMOUNT);
        }
        assertThat(stock().getAmount()).isEqualTo(INITIAL_STOCK - TOTAL_ORDERS);
        assertThat(stock().getSales_count()).isEqualTo(TOTAL_ORDERS);
        assertThat(purchaseAmount).isEqualTo(TOTAL_ORDERS * EXPECTED_AMOUNT);
        verify(portOne, never()).cancelPayment(anyString(), anyString());

        // 중복 방지 1: 배치를 다시 실행해도 대상이 없고 아무것도 바뀌지 않는다
        Map<PaymentRecoveryResult, Integer> secondRun = recoveryBatch.recoverPendingPayments(LocalDateTime.now().plusMinutes(20));
        assertThat(secondRun).isEmpty();

        // 중복 방지 2: 배치가 복구한 뒤 늦게 도착한 완료 요청은 '이미 결제 완료'로 응답하고 재반영하지 않는다
        int lateResponses = 0;
        for (PaidOrder paid : paidOrders) {
            if (paid.scenario() != Scenario.COMPLETE_NOT_DELIVERED) {
                continue;
            }
            var response = mvc.perform(post("/healthme/payments/complete").contentType("application/json")
                    .content(completeBody(paid))).andReturn().getResponse();
            assertThat(response.getStatus()).isEqualTo(200);
            assertThat(response.getContentAsString()).contains("이미 결제 완료");
            lateResponses++;
        }
        assertThat(stock().getAmount()).isEqualTo(INITIAL_STOCK - TOTAL_ORDERS);
        assertThat(stock().getSales_count()).isEqualTo(TOTAL_ORDERS);
        assertThat(purchaseAmount()).isEqualTo(TOTAL_ORDERS * EXPECTED_AMOUNT);

        int portOnePaidTotal = TOTAL_ORDERS * EXPECTED_AMOUNT;
        System.out.println("EVIDENCE after orders=" + TOTAL_ORDERS + " faultsInjected=" + (FAULTS_PER_TYPE * 3));
        System.out.println("EVIDENCE beforeBatch mismatch=" + (FAULTS_PER_TYPE * 3)
                + " stock=" + (INITIAL_STOCK - NORMAL_ORDERS));
        System.out.println("EVIDENCE batchRun1(now+10m) result=" + firstRun);
        for (Scenario scenario : List.of(Scenario.NORMAL, Scenario.COMPLETE_NOT_DELIVERED,
                Scenario.PORTONE_LOOKUP_ERROR, Scenario.INTERNAL_ERROR_ON_PAID)) {
            System.out.println("EVIDENCE scenario=" + scenario + " label=" + scenario.label
                    + " dbStatusAfterBatch=" + statusByScenario.get(scenario));
        }
        System.out.println("EVIDENCE mismatch(PortOne paid, DB not PAID)=" + mismatched + " cancelPaymentCalls=0");
        System.out.println("EVIDENCE stock " + INITIAL_STOCK + "->" + stock().getAmount()
                + " sales 0->" + stock().getSales_count()
                + " userPurchaseAmount 0->" + purchaseAmount()
                + " portOnePaidTotal=" + portOnePaidTotal
                + " unreflectedAmount=" + (portOnePaidTotal - purchaseAmount()));
        System.out.println("EVIDENCE batchRun2(now+20m) result=" + secondRun
                + " lateCompleteRequests=" + lateResponses + " -> HTTP 200 already paid, no double count");
    }

    @Test
    void lookupStillFailingStaysPendingAndRecoversOnNextRun() throws Exception {
        PaidOrder paid = payAndComplete(Scenario.PORTONE_LOOKUP_ERROR);

        Map<PaymentRecoveryResult, Integer> whileDown = recoveryBatch.recoverPendingPayments(LocalDateTime.now().plusMinutes(10));
        assertThat(whileDown).containsExactlyEntriesOf(Map.of(PaymentRecoveryResult.RETRY_LATER, 1));
        assertThat(order(paid).getStatus()).isEqualTo("PENDING");

        lookupFailures.clear();
        Map<PaymentRecoveryResult, Integer> afterRestore = recoveryBatch.recoverPendingPayments(LocalDateTime.now().plusMinutes(15));
        assertThat(afterRestore).containsExactlyEntriesOf(Map.of(PaymentRecoveryResult.RECOVERED_PAID, 1));
        assertThat(order(paid).getStatus()).isEqualTo("PAID");
        assertThat(stock().getAmount()).isEqualTo(INITIAL_STOCK - 1);
        System.out.println("EVIDENCE edge=lookupStillDown run1=" + whileDown + " run2=" + afterRestore);
    }

    @Test
    void internalErrorDuringBatchIsIsolatedPerOrderAndRetried() throws Exception {
        PaidOrder first = payAndComplete(Scenario.COMPLETE_NOT_DELIVERED);
        PaidOrder second = payAndComplete(Scenario.COMPLETE_NOT_DELIVERED);

        // 첫 번째로 처리되는 주문의 확정 중에만 DB 예외 발생 (이후 호출은 장바구니 정리를 생략: 이 테스트는 장바구니를 검증하지 않음)
        AtomicBoolean failOnce = new AtomicBoolean(true);
        doAnswer(invocation -> {
            if (failOnce.getAndSet(false)) {
                throw new DataAccessResourceFailureException("fixture: DB connection lost while clearing cart");
            }
            return null;
        }).when(carts).deleteAll(anyIterable());
        Map<PaymentRecoveryResult, Integer> run1 = recoveryBatch.recoverPendingPayments(LocalDateTime.now().plusMinutes(10));
        reset(carts);

        assertThat(run1).containsExactlyInAnyOrderEntriesOf(Map.of(
                PaymentRecoveryResult.RETRY_LATER, 1,
                PaymentRecoveryResult.RECOVERED_PAID, 1));
        assertThat(List.of(order(first).getStatus(), order(second).getStatus()))
                .containsExactlyInAnyOrder("PENDING", "PAID");
        assertThat(stock().getAmount()).isEqualTo(INITIAL_STOCK - 1);

        Map<PaymentRecoveryResult, Integer> run2 = recoveryBatch.recoverPendingPayments(LocalDateTime.now().plusMinutes(15));
        assertThat(run2).containsExactlyEntriesOf(Map.of(PaymentRecoveryResult.RECOVERED_PAID, 1));
        assertThat(order(first).getStatus()).isEqualTo("PAID");
        assertThat(order(second).getStatus()).isEqualTo("PAID");
        assertThat(stock().getAmount()).isEqualTo(INITIAL_STOCK - 2);
        assertThat(purchaseAmount()).isEqualTo(2 * EXPECTED_AMOUNT);
        System.out.println("EVIDENCE edge=internalErrorInBatch run1=" + run1 + " run2=" + run2);
    }

    @Test
    void unpaidOrdersAreLeftAloneUntilExpiryThenMarkedFailed() throws Exception {
        PaidOrder unpaid = payAndComplete(Scenario.NOT_PAID);

        assertThat(recoveryBatch.recoverPendingPayments(LocalDateTime.now())).isEmpty(); // 생성 5분 이내는 대상 아님
        Map<PaymentRecoveryResult, Integer> young = recoveryBatch.recoverPendingPayments(LocalDateTime.now().plusMinutes(10));
        assertThat(young).containsExactlyEntriesOf(Map.of(PaymentRecoveryResult.NOT_PAID_YET, 1));
        assertThat(order(unpaid).getStatus()).isEqualTo("PENDING");

        Map<PaymentRecoveryResult, Integer> expired = recoveryBatch.recoverPendingPayments(LocalDateTime.now().plusMinutes(70));
        assertThat(expired).containsExactlyEntriesOf(Map.of(PaymentRecoveryResult.EXPIRED, 1));
        assertThat(order(unpaid).getStatus()).isEqualTo("FAILED");
        assertThat(stock().getAmount()).isEqualTo(INITIAL_STOCK);
        verify(portOne, never()).cancelPayment(anyString(), anyString());
        System.out.println("EVIDENCE edge=unpaid now+0m=skip now+10m=" + young + " now+70m=" + expired);
    }

    @Test
    void paidOrderThatCannotBeFulfilledIsRefunded() throws Exception {
        PaidOrder paid = payAndComplete(Scenario.COMPLETE_NOT_DELIVERED);
        ProductStore soldOut = stock();
        soldOut.setAmount(0);
        products.save(soldOut);

        Map<PaymentRecoveryResult, Integer> run = recoveryBatch.recoverPendingPayments(LocalDateTime.now().plusMinutes(10));

        assertThat(run).containsExactlyEntriesOf(Map.of(PaymentRecoveryResult.CANCELLED, 1));
        assertThat(order(paid).getStatus()).isEqualTo("CANCELLED");
        verify(portOne).cancelPayment(eq(paid.impUid()), anyString());
        assertThat(purchaseAmount()).isZero();
        System.out.println("EVIDENCE edge=stockShortageAfterPayment run=" + run + " cancelPaymentCalls=1");
    }

    // ---------- helpers ----------

    private List<PaidOrder> runBaselineScenario() throws Exception {
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
        return paidOrders;
    }

    /** 주문 준비 → (NOT_PAID 외) PortOne 결제 완료 → 시나리오에 따라 완료 요청 처리 */
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

        if (scenario == Scenario.NOT_PAID) {
            return new PaidOrder(scenario, orderId, merchantUid, null, "결제창에서 결제하지 않음");
        }

        String impUid = "imp_" + UUID.randomUUID();
        PortOnePaymentDto payment = PortOnePaymentDto.builder().impUid(impUid).merchantUid(merchantUid)
                .status("paid").amount(EXPECTED_AMOUNT).currency("KRW").paidAt(paidAt).build();
        ledgerByImpUid.put(impUid, payment);
        ledgerByMerchantUid.put(merchantUid, payment);

        PaidOrder paid = new PaidOrder(scenario, orderId, merchantUid, impUid, "complete 요청 없음");
        if (scenario == Scenario.COMPLETE_NOT_DELIVERED) {
            return paid;
        }
        if (scenario == Scenario.PORTONE_LOOKUP_ERROR) {
            lookupFailures.add(impUid);
        }
        String response;
        try {
            int status = mvc.perform(post("/healthme/payments/complete").contentType("application/json")
                    .content(completeBody(paid))).andReturn().getResponse().getStatus();
            response = "HTTP " + status;
        } catch (Exception unhandled) {
            response = "처리되지 않은 예외(HTTP 500)";
        }
        return new PaidOrder(scenario, orderId, merchantUid, impUid, response);
    }

    private String completeBody(PaidOrder paid) {
        return "{\"impUid\":\"" + paid.impUid() + "\",\"merchantUid\":\"" + paid.merchantUid() + "\"}";
    }

    private Map<Scenario, Map<String, Integer>> statusByScenario(List<PaidOrder> paidOrders) {
        Map<Scenario, Map<String, Integer>> result = new LinkedHashMap<>();
        for (PaidOrder paid : paidOrders) {
            result.computeIfAbsent(paid.scenario(), k -> new LinkedHashMap<>())
                    .merge(order(paid).getStatus(), 1, Integer::sum);
        }
        return result;
    }

    private int countMismatched(List<PaidOrder> paidOrders) {
        int mismatched = 0;
        for (PaidOrder paid : paidOrders) {
            boolean paidAtPortOne = ledgerByImpUid.get(paid.impUid()).isPaid();
            if (paidAtPortOne && !"PAID".equals(order(paid).getStatus())) {
                mismatched++;
            }
        }
        return mismatched;
    }

    private ApprovalOrder order(PaidOrder paid) {
        return orders.findById(paid.orderId()).orElseThrow();
    }

    private ProductStore stock() {
        return products.findById(product.getProductId()).orElseThrow();
    }

    private int purchaseAmount() {
        return users.findById(user.getId()).orElseThrow().getTotalPurchaseAmount();
    }
}
