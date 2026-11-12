package com.example.healthme.domain.approval.service;

import com.example.healthme.domain.approval.entity.ApprovalOrder;
import com.example.healthme.domain.approval.repository.ApprovalOrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * 결제 보정 배치.
 * PortOne에서는 결제가 완료됐지만 완료 요청 미도달·PortOne 조회 오류·내부 예외로 PENDING에 남은 주문을
 * 주기적으로 PortOne에 재조회해 PAID로 확정하거나 자동 환불한다.
 */
@Slf4j
@Component
public class PaymentRecoveryScheduler {

    private final ApprovalOrderRepository approvalOrderRepository;
    private final ApprovalService approvalService;
    private final long minAgeMinutes;
    private final long expireMinutes;

    public PaymentRecoveryScheduler(
            ApprovalOrderRepository approvalOrderRepository,
            ApprovalService approvalService,
            @Value("${payment.recovery.min-age-minutes:5}") long minAgeMinutes,
            @Value("${payment.recovery.expire-minutes:60}") long expireMinutes
    ) {
        this.approvalOrderRepository = approvalOrderRepository;
        this.approvalService = approvalService;
        this.minAgeMinutes = minAgeMinutes;
        this.expireMinutes = expireMinutes;
    }

    @Scheduled(
            fixedDelayString = "${payment.recovery.fixed-delay-ms:300000}",
            initialDelayString = "${payment.recovery.initial-delay-ms:60000}"
    )
    public void scheduledRecovery() {
        recoverPendingPayments(LocalDateTime.now());
    }

    /**
     * @param now 기준 시각. 생성 후 min-age 분이 지난 PENDING 주문만 대상으로 한다
     *            (결제창에서 아직 결제 중인 주문과 완료 요청이 처리 중인 주문을 건드리지 않기 위함).
     */
    public Map<PaymentRecoveryResult, Integer> recoverPendingPayments(LocalDateTime now) {
        List<String> targets = approvalOrderRepository
                .findTop100ByStatusAndOrderDateBeforeOrderByOrderDateAsc(
                        ApprovalService.STATUS_PENDING, now.minusMinutes(minAgeMinutes))
                .stream()
                .map(ApprovalOrder::getMerchantUid)
                .toList();

        Map<PaymentRecoveryResult, Integer> summary = new EnumMap<>(PaymentRecoveryResult.class);
        LocalDateTime expireBefore = now.minusMinutes(expireMinutes);
        for (String merchantUid : targets) {
            PaymentRecoveryResult result;
            try {
                // 주문마다 별도 트랜잭션: 한 건의 실패가 다른 주문의 보정을 되돌리지 않는다.
                result = approvalService.recoverPendingPayment(merchantUid, expireBefore);
            } catch (RuntimeException e) {
                result = PaymentRecoveryResult.RETRY_LATER;
                log.warn("[Payment recovery retry later] merchantUid={}, reason={}", merchantUid, e.getMessage());
            }
            summary.merge(result, 1, Integer::sum);
        }

        if (!targets.isEmpty()) {
            log.info("[Payment recovery batch] targets={}, result={}", targets.size(), summary);
        }
        return summary;
    }
}
