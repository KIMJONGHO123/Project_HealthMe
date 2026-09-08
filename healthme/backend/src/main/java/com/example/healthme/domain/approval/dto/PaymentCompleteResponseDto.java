package com.example.healthme.domain.approval.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class PaymentCompleteResponseDto {

    private boolean success;
    private String message;
    private Long orderId;
    private String merchantUid;
    private String status;
    private int paidAmount;
}
