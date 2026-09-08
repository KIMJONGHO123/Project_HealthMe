package com.example.healthme.domain.approval.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class PaymentPrepareResponseDto {

    private Long orderId;
    private String merchantUid;
    private int amount;
    private String orderName;
}
