package com.example.healthme.domain.approval.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class PortOnePaymentDto {

    private String impUid;
    private String merchantUid;
    private String status;
    private int amount;
    private String currency;
    private LocalDateTime paidAt;

    public boolean isPaid() {
        return "paid".equals(status);
    }
}
