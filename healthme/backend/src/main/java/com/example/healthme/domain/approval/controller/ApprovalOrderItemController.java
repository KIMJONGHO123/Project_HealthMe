package com.example.healthme.domain.approval.controller;

import com.example.healthme.domain.approval.entity.ApprovalOrderItem;
import com.example.healthme.domain.approval.entity.ApprovalOrder;
import com.example.healthme.domain.approval.service.ApprovalOrderItemService;
import com.example.healthme.domain.approval.service.ApprovalOrderService;
import com.example.healthme.global.config.auth.principal.PrincipalDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/order-items")
@RequiredArgsConstructor
public class ApprovalOrderItemController {

    private final ApprovalOrderItemService approvalOrderItemService;
    private final ApprovalOrderService approvalOrderService;

    // 특정 주문의 주문 아이템 조회
    @GetMapping("/{orderId}")
    public ResponseEntity<List<ApprovalOrderItem>> getOrderItemsByOrderId(@PathVariable Long orderId,
                                                                          @AuthenticationPrincipal PrincipalDetails principalDetails) {
        ApprovalOrder order = approvalOrderService.getOrderById(orderId);
        if (order == null) {
            return ResponseEntity.notFound().build();
        }
        verifyUserAccess(order.getUserid(), principalDetails);

        List<ApprovalOrderItem> items = approvalOrderItemService.getOrderItemsByOrderId(orderId);
        return ResponseEntity.ok(items);
    }

    // 주문 아이템 저장
    @PostMapping
    public ResponseEntity<ApprovalOrderItem> addOrderItem(@RequestBody ApprovalOrderItem approvalOrderItem,
                                                          @AuthenticationPrincipal PrincipalDetails principalDetails) {
        if (approvalOrderItem.getOrder() == null || approvalOrderItem.getOrder().getOrderId() == null) {
            throw new AccessDeniedException("주문 정보가 필요합니다.");
        }

        ApprovalOrder order = approvalOrderService.getOrderById(approvalOrderItem.getOrder().getOrderId());
        if (order == null) {
            return ResponseEntity.notFound().build();
        }
        verifyUserAccess(order.getUserid(), principalDetails);
        approvalOrderItem.setOrder(order);

        ApprovalOrderItem savedItem = approvalOrderItemService.saveOrderItem(approvalOrderItem);
        return ResponseEntity.ok(savedItem);
    }

    private void verifyUserAccess(String userid, PrincipalDetails principalDetails) {
        if (principalDetails == null) {
            throw new AccessDeniedException("로그인이 필요합니다.");
        }

        if (isAdmin(principalDetails)) {
            return;
        }

        if (!principalDetails.getUserDto().getUserid().equals(userid)) {
            throw new AccessDeniedException("본인 주문만 조회할 수 있습니다.");
        }
    }

    private boolean isAdmin(PrincipalDetails principalDetails) {
        return "ROLE_ADMIN".equals(principalDetails.getUserDto().getRole());
    }
}
