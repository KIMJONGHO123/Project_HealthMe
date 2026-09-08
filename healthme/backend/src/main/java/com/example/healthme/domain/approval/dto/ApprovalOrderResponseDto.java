package com.example.healthme.domain.approval.dto;

import com.example.healthme.domain.approval.entity.ApprovalOrder;
import com.example.healthme.domain.mypage.entity.Address;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
public class ApprovalOrderResponseDto {
    private Long orderId;
    private String userid;
    private LocalDateTime orderDate;
    private String status;
    private String paymentMethod;
    private int totalPrice;
    private String merchantUid;
    private String paymentImpUid;
    private Integer paidAmount;
    private LocalDateTime paidAt;
    private boolean isCanceled;
    private boolean isCompleted;
    private boolean refundRequested;
    private boolean returnRequested;

    @JsonIgnore
    private Address address; // 그대로 포함 (Embedded)
    private List<ApprovalOrderItemDto> items;

    public static ApprovalOrderResponseDto fromEntity(ApprovalOrder order) {
        ApprovalOrderResponseDto dto = new ApprovalOrderResponseDto();
        dto.setOrderId(order.getOrderId());
        dto.setUserid(order.getUserid());
        dto.setOrderDate(order.getOrderDate());
        dto.setStatus(order.getStatus());
        dto.setPaymentMethod(order.getPaymentMethod());
        dto.setTotalPrice(order.getTotalPrice());
        dto.setMerchantUid(order.getMerchantUid());
        dto.setPaymentImpUid(order.getPaymentImpUid());
        dto.setPaidAmount(order.getPaidAmount());
        dto.setPaidAt(order.getPaidAt());
        dto.setCanceled(order.isCanceled());
        dto.setCompleted(order.isCompleted());
        dto.setRefundRequested(order.isRefundRequested());
        dto.setReturnRequested(order.isReturnRequested());
        dto.setAddress(order.getAddress());

        dto.setItems(order.getApprovalOrderItems().stream()
                .map(ApprovalOrderItemDto::fromEntity)
                .collect(Collectors.toList()));
        return dto;
    }
}
