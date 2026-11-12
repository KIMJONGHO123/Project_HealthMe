package com.example.healthme.domain.approval.service;

/** 보정 배치에서 PENDING 주문 1건을 처리한 결과 */
public enum PaymentRecoveryResult {
    /** PortOne 결제 완료 확인 후 PAID로 확정 */
    RECOVERED_PAID,
    /** 결제는 완료됐지만 주문과 맞지 않아(금액·재고 등) 자동 환불 */
    CANCELLED,
    /** 자동 환불까지 실패해 수동 확인 필요 */
    REVIEW_REQUIRED,
    /** PortOne에 결제 완료 건이 없고 만료 시간이 지나 미결제 주문으로 정리 */
    EXPIRED,
    /** PortOne에 결제 완료 건이 아직 없음. 다음 실행에서 다시 확인 */
    NOT_PAID_YET,
    /** 다른 경로(완료 요청 등)가 먼저 처리해 더 할 일이 없음 */
    ALREADY_PROCESSED,
    /** PortOne 조회 오류나 내부 예외로 이번 실행에서 처리하지 못함. 주문은 PENDING 유지, 다음 실행에서 재시도 */
    RETRY_LATER
}
