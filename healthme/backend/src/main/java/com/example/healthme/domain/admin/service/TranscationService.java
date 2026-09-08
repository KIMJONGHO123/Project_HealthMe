package com.example.healthme.domain.admin.service;

import com.example.healthme.domain.admin.dto.TranscationStatusDto;
import com.example.healthme.domain.admin.repository.TranscationRepository;
import com.example.healthme.domain.approval.dto.ApprovalOrderResponseDto;
import com.example.healthme.domain.approval.entity.ApprovalOrder;
import com.example.healthme.domain.approval.entity.ApprovalOrderItem;
import com.example.healthme.domain.approval.service.ApprovalService;
import com.example.healthme.domain.approval.service.PortOneClient;
import com.example.healthme.domain.product.entity.ProductStore;
import com.example.healthme.domain.product.repository.ProductStoreRepository;
import com.example.healthme.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TranscationService {

    private final TranscationRepository transcationRepository;
    private final ProductStoreRepository productStoreRepository;
    private final UserRepository userRepository;
    private final PortOneClient portOneClient;

    // 전체 가져오기
    public Page<ApprovalOrderResponseDto> selectAll(int page, int size) {
        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "orderDate"));
        return transcationRepository.findAll(pageable)
                .map(ApprovalOrderResponseDto::fromEntity);
    }

    // 이름으로 검색
    public Page<ApprovalOrderResponseDto> selectByUserName(String searchText,
                                                           int page,
                                                           int size) {
        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "orderDate"));

        return transcationRepository
                .findByUseridContaining(searchText, pageable)
                .map(ApprovalOrderResponseDto::fromEntity);
    }

    // 수정
    @Transactional
    public boolean updateTranscation(TranscationStatusDto dto) {
        Optional<ApprovalOrder> opt = transcationRepository.findById(dto.getOrderId());
        if (opt.isEmpty()) return false;

        ApprovalOrder order = opt.get();
        if (!ApprovalService.STATUS_PAID.equals(order.getStatus())) {
            throw new IllegalStateException("결제 완료된 주문만 처리할 수 있습니다.");
        }

        if (dto.isCanceled()) {
            cancelPaidOrder(order);
            return true;
        }

        if (dto.isCompleted()) {
            order.setCompleted(true);
        }

        transcationRepository.save(order);
        return true;
    }

    // 환불 / 반품 요청 처리
    @Transactional
    public boolean refundOrReturn(TranscationStatusDto dto, String type) {
        Optional<ApprovalOrder> opt = transcationRepository.findById(dto.getOrderId());
        if (opt.isEmpty()) return false;

        ApprovalOrder order = opt.get();
        if (!ApprovalService.STATUS_PAID.equals(order.getStatus())) {
            throw new IllegalStateException("결제 완료된 주문만 환불/반품 처리할 수 있습니다.");
        }

        if ("환불".equals(type)) {
            order.setRefundRequested(dto.isRefundRequested());
        } else if ("반품".equals(type)) {
            order.setReturnRequested(dto.isReturnRequested());
        }
        transcationRepository.save(order);
        return true;
    }

    private void cancelPaidOrder(ApprovalOrder order) {
        if (order.getPaymentImpUid() == null || order.getPaymentImpUid().isBlank()) {
            throw new IllegalStateException("결제번호가 없어 PortOne 결제 취소를 진행할 수 없습니다.");
        }

        portOneClient.cancelPayment(order.getPaymentImpUid(), "관리자 주문 취소");

        restoreOrderStock(order);
        restoreUserPurchaseAmount(order);

        order.setStatus(ApprovalService.STATUS_CANCELLED);
        order.setCanceled(true);
        order.setCompleted(false);
        transcationRepository.save(order);
    }

    private void restoreOrderStock(ApprovalOrder order) {
        for (ApprovalOrderItem item : order.getApprovalOrderItems()) {
            ProductStore product = productStoreRepository.findByProductIdForUpdate(item.getProductId())
                    .orElseThrow(() -> new IllegalStateException("상품을 찾을 수 없습니다: " + item.getProductId()));
            product.setAmount(product.getAmount() + item.getQuantity());
            product.setSales_count(Math.max(0, product.getSales_count() - item.getQuantity()));
        }
    }

    private void restoreUserPurchaseAmount(ApprovalOrder order) {
        userRepository.findByUserid(order.getUserid()).ifPresent(user ->
                user.setTotalPurchaseAmount(Math.max(0, user.getTotalPurchaseAmount() - order.getTotalPrice()))
        );
    }
}
