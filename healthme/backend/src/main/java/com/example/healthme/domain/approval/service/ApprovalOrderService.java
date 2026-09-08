package com.example.healthme.domain.approval.service;

import com.example.healthme.domain.approval.dto.ApprovalOrderRequestDto;
import com.example.healthme.domain.approval.entity.ApprovalOrder;
import com.example.healthme.domain.approval.entity.ApprovalOrderItem;
import com.example.healthme.domain.approval.repository.ApprovalOrderRepository;
import com.example.healthme.domain.mypage.dto.AddressUpdate;
import com.example.healthme.domain.mypage.entity.Address;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApprovalOrderService {

    private final ApprovalOrderRepository approvalOrderRepository;

    public List<ApprovalOrder> getOrdersByUserid(String userid) {
        return approvalOrderRepository.findByUserid(userid);
    }

    public ApprovalOrder saveOrder(ApprovalOrder approvalOrder) {
        return approvalOrderRepository.save(approvalOrder);
    }

    public ApprovalOrder getOrderById(Long orderId) {
        return approvalOrderRepository.findById(orderId).orElse(null);
    }

    public void createOrder(ApprovalOrderRequestDto dto) {
        // 1. 배송 정보 추출
        AddressUpdate addressDto = dto.getAddress();

        Address address = null;
        if (addressDto != null) {
            address = Address.builder()
                    .recipient(addressDto.getRecipient())
                    .zip(addressDto.getZonecode()) // 필드명: zonecode -> zip
                    .address(addressDto.getAddress())
                    .addressDetail(addressDto.getAddressDetail())
                    .recipientPhone(addressDto.getTel()) // 필드명: tel -> recipientPhone
                    .isDefault(addressDto.is_default()) // boolean getter 주의: isIs_default()
                    .build();
        }

        // 2. 주문 항목 리스트 생성
        List<ApprovalOrderItem> approvalOrderItems = dto.getItems().stream()
                .map(itemDto -> ApprovalOrderItem.builder()
                        .productId(itemDto.getProductId())
                        .productName(itemDto.getProductName())
                        .quantity(itemDto.getQuantity())
                        .unitPrice(itemDto.getPrice())
                        .itemTotal(itemDto.getQuantity() * itemDto.getPrice()) // 총 가격 계산
                        .build())
                .collect(Collectors.toList());

        // 3. 주문 객체 생성
        ApprovalOrder approvalOrder = ApprovalOrder.builder()
                .userid(dto.getUserid())
                .merchantUid("healthme-legacy-" + UUID.randomUUID().toString().replace("-", ""))
                .orderDate(LocalDateTime.now())
                .status("결제완료")
                .isCanceled(false)
                .isCompleted(false)
                .refundRequested(false)
                .returnRequested(false)
                .address(address)
                .approvalOrderItems(approvalOrderItems)
                .paymentMethod(dto.getPaymentMethod())
                .totalPrice(dto.getTotalPrice())
                .build();

        // 4. 연관관계 설정 (양방향)
        for (ApprovalOrderItem item : approvalOrderItems) {
            item.setOrder(approvalOrder);
        }

        // 5. 저장
        approvalOrderRepository.save(approvalOrder);

    }
}
