package com.example.healthme.payment;

import com.example.healthme.domain.approval.dto.PaymentCompleteRequestDto;
import com.example.healthme.domain.approval.dto.PaymentCompleteResponseDto;
import com.example.healthme.domain.approval.dto.PaymentPrepareItemDto;
import com.example.healthme.domain.approval.dto.PaymentPrepareRequestDto;
import com.example.healthme.domain.approval.dto.PaymentPrepareResponseDto;
import com.example.healthme.domain.approval.dto.PortOnePaymentDto;
import com.example.healthme.domain.approval.repository.ApprovalOrderRepository;
import com.example.healthme.domain.approval.service.ApprovalService;
import com.example.healthme.domain.approval.service.PaymentRecoveryResult;
import com.example.healthme.domain.approval.service.PaymentRecoveryScheduler;
import com.example.healthme.domain.approval.service.PortOneClient;
import com.example.healthme.domain.mypage.entity.Address;
import com.example.healthme.domain.mypage.repository.AddressRepository;
import com.example.healthme.domain.product.entity.ProductStore;
import com.example.healthme.domain.product.repository.ProductStoreRepository;
import com.example.healthme.domain.user.entity.User;
import com.example.healthme.domain.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;

/**
 * MySQL 동시성 검증: 결제 완료 후 PENDING인 주문 1건에 완료 요청 20개와 보정 배치 1개를 동시에 실행해도
 * 재고·판매량·누적 구매금액이 한 번만 반영되는지 확인한다. 이를 여러 회차 반복한다.
 *
 * 락 동작은 DB마다 다르므로 H2가 아닌 실제 MySQL의 전용 DB(healthme_test)에서 실행한다.
 * - 사전 준비: CREATE DATABASE healthme_test;
 * - 실행: 환경 변수 DB_PASSWORD(필요 시 DB_USERNAME)를 설정한 터미널에서
 *   gradlew test --tests '*PaymentRecoveryConcurrencyTest*'
 * - DB_PASSWORD가 없으면 이 테스트는 건너뛴다.
 * - 접속 주소는 healthme_test로 고정되어 있으며, 테이블은 테스트 시작 시 생성되고 종료 시 삭제된다.
 */
@EnabledIfEnvironmentVariable(named = "DB_PASSWORD", matches = ".+")
@DataJpaTest(properties = {
        "spring.config.location=optional:classpath:/payment-test-isolated.properties",
        "spring.datasource.url=jdbc:mysql://localhost:3306/healthme_test?serverTimezone=Asia/Seoul",
        "spring.datasource.username=${DB_USERNAME:root}",
        "spring.datasource.password=${DB_PASSWORD}",
        "spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver",
        "spring.datasource.hikari.maximum-pool-size=30",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.jpa.show-sql=false"
}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = PaymentRecoveryConcurrencyTest.Config.class)
@Import({ApprovalService.class, PaymentRecoveryScheduler.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PaymentRecoveryConcurrencyTest {

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

    private static final int ROUNDS = 50;
    private static final int COMPLETE_REQUESTS = 20;
    private static final int INITIAL_STOCK = 1_000;
    private static final int EXPECTED_AMOUNT = 9_700; // 판매가 10,000원 - 새싹 등급 3%

    @Autowired ApprovalService service;
    @Autowired PaymentRecoveryScheduler recoveryBatch;
    @Autowired ApprovalOrderRepository orders;
    @Autowired UserRepository users;
    @Autowired AddressRepository addresses;
    @Autowired ProductStoreRepository products;
    @MockitoBean PortOneClient portOne;

    private User user;
    private ProductStore product;

    @BeforeEach
    void setUp() {
        user = users.save(User.builder().userid("concurrency-" + UUID.randomUUID())
                .username("test").grade("새싹").totalPurchaseAmount(0).build());
        addresses.save(Address.builder().user(user).recipient("test").zip("00000")
                .address("test address").recipientPhone("010-0000-0000").isDefault(true).build());
        product = products.save(ProductStore.builder().name("test product").price(10_000)
                .salprice(10_000).amount(INITIAL_STOCK).sales_count(0).imageUrl("test.png").build());
    }

    @Test
    void completeRequestsAndRecoveryBatchRacingOnSameOrderApplyExactlyOnce() throws Exception {
        Map<String, Integer> winners = new TreeMap<>();
        Map<String, Integer> batchResults = new TreeMap<>();
        Map<String, Integer> completeResponses = new TreeMap<>();
        int errors = 0;

        ExecutorService pool = Executors.newFixedThreadPool(COMPLETE_REQUESTS + 1);
        try {
            for (int round = 1; round <= ROUNDS; round++) {
                // 1) 결제 준비 → PortOne 결제 완료, 완료 요청은 아직 도착하지 않은 PENDING 주문
                PaymentPrepareResponseDto prepared = service.preparePayment(prepareRequest(), user.getUserid());
                String merchantUid = prepared.getMerchantUid();
                String impUid = "imp_" + UUID.randomUUID();
                PortOnePaymentDto payment = PortOnePaymentDto.builder().impUid(impUid).merchantUid(merchantUid)
                        .status("paid").amount(EXPECTED_AMOUNT).currency("KRW").paidAt(LocalDateTime.now()).build();
                doReturn(payment).when(portOne).getPayment(anyString());
                doReturn(Optional.of(payment)).when(portOne).findPaidPaymentByMerchantUid(anyString());
                assertThat(orders.findByMerchantUid(merchantUid).orElseThrow().getStatus()).isEqualTo("PENDING");

                int stockBefore = stock().getAmount();
                int salesBefore = stock().getSales_count();
                int purchaseBefore = purchaseAmount();

                // 2) 완료 요청 20개 + 보정 배치 1개를 같은 순간에 출발
                CountDownLatch ready = new CountDownLatch(COMPLETE_REQUESTS + 1);
                CountDownLatch start = new CountDownLatch(1);
                List<Future<String>> completes = new ArrayList<>();
                for (int i = 0; i < COMPLETE_REQUESTS; i++) {
                    completes.add(pool.submit(raceTask(ready, start, () -> {
                        PaymentCompleteResponseDto response = service.completePayment(completeRequest(impUid, merchantUid), user.getUserid());
                        return response.getMessage();
                    })));
                }
                Future<String> batch = pool.submit(raceTask(ready, start, () -> {
                    Map<PaymentRecoveryResult, Integer> summary = recoveryBatch.recoverPendingPayments(LocalDateTime.now().plusMinutes(10));
                    return summary.isEmpty() ? "NO_TARGET" : summary.keySet().iterator().next().name();
                }));
                assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
                start.countDown();

                // 3) 결과 수집
                int confirmedByComplete = 0;
                for (Future<String> future : completes) {
                    String outcome = outcome(future);
                    completeResponses.merge(outcome, 1, Integer::sum);
                    if (outcome.startsWith("ERROR")) {
                        errors++;
                    }
                    if (outcome.equals("결제 검증이 완료되었습니다.")) {
                        confirmedByComplete++;
                    }
                }
                String batchOutcome = outcome(batch);
                batchResults.merge(batchOutcome, 1, Integer::sum);
                if (batchOutcome.startsWith("ERROR") || batchOutcome.equals("RETRY_LATER")) {
                    errors++;
                }
                boolean confirmedByBatch = batchOutcome.equals("RECOVERED_PAID");
                winners.merge(confirmedByBatch ? "보정 배치" : "완료 요청", 1, Integer::sum);

                // 4) 회차마다 정확히 한 번만 반영됐는지 확인
                assertThat(confirmedByComplete + (confirmedByBatch ? 1 : 0))
                        .as("round %d: 실제로 확정한 주체는 1개", round).isEqualTo(1);
                assertThat(orders.findByMerchantUid(merchantUid).orElseThrow().getStatus()).isEqualTo("PAID");
                assertThat(stock().getAmount()).as("round %d stock", round).isEqualTo(stockBefore - 1);
                assertThat(stock().getSales_count()).as("round %d sales", round).isEqualTo(salesBefore + 1);
                assertThat(purchaseAmount()).as("round %d purchase", round).isEqualTo(purchaseBefore + EXPECTED_AMOUNT);
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(errors).isZero();
        assertThat(stock().getAmount()).isEqualTo(INITIAL_STOCK - ROUNDS);
        assertThat(stock().getSales_count()).isEqualTo(ROUNDS);
        assertThat(purchaseAmount()).isEqualTo(ROUNDS * EXPECTED_AMOUNT);

        System.out.println("EVIDENCE mysql concurrency rounds=" + ROUNDS
                + " perRound=completeRequests " + COMPLETE_REQUESTS + " + recoveryBatch 1");
        System.out.println("EVIDENCE winner=" + winners);
        System.out.println("EVIDENCE batchResult=" + batchResults);
        System.out.println("EVIDENCE completeResponses=" + completeResponses);
        System.out.println("EVIDENCE errors=" + errors
                + " stock " + INITIAL_STOCK + "->" + stock().getAmount()
                + " sales 0->" + stock().getSales_count()
                + " userPurchaseAmount 0->" + purchaseAmount()
                + " expected=" + (ROUNDS * EXPECTED_AMOUNT));
    }

    private <T> Callable<T> raceTask(CountDownLatch ready, CountDownLatch start, Callable<T> task) {
        return () -> {
            ready.countDown();
            start.await();
            return task.call();
        };
    }

    private String outcome(Future<String> future) throws InterruptedException {
        try {
            return future.get(60, TimeUnit.SECONDS);
        } catch (Exception e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            return "ERROR " + cause.getClass().getSimpleName() + ": " + cause.getMessage();
        }
    }

    private PaymentPrepareRequestDto prepareRequest() {
        PaymentPrepareItemDto item = new PaymentPrepareItemDto();
        item.setProductId(product.getProductId());
        item.setQuantity(1);
        PaymentPrepareRequestDto request = new PaymentPrepareRequestDto();
        request.setItems(List.of(item));
        return request;
    }

    private PaymentCompleteRequestDto completeRequest(String impUid, String merchantUid) {
        PaymentCompleteRequestDto request = new PaymentCompleteRequestDto();
        request.setImpUid(impUid);
        request.setMerchantUid(merchantUid);
        return request;
    }

    private ProductStore stock() {
        return products.findById(product.getProductId()).orElseThrow();
    }

    private int purchaseAmount() {
        return users.findById(user.getId()).orElseThrow().getTotalPurchaseAmount();
    }
}
