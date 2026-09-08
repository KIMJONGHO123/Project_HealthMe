package com.example.healthme.domain.approval.controller;

import com.example.healthme.domain.approval.dto.ApprovalOrderRequestDto;
import com.example.healthme.domain.approval.dto.ApprovalOrderResponseDto;
import com.example.healthme.domain.approval.entity.ApprovalOrder;
import com.example.healthme.domain.approval.service.ApprovalOrderService;
import com.example.healthme.global.config.auth.principal.PrincipalDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class ApprovalOrderController {

    private final ApprovalOrderService approvalOrderService;

    // 주문 생성
    @PostMapping
    public ResponseEntity<Map<String, Object>> createOrder(@RequestBody ApprovalOrderRequestDto dto,
                                                           @AuthenticationPrincipal PrincipalDetails principalDetails) {
        verifyUserAccess(dto.getUserid(), principalDetails);
        approvalOrderService.createOrder(dto);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "주문이 성공적으로 접수되었습니다.");

        return ResponseEntity.ok(response);
    }

    // 사용자별 주문 목록 조회
    @GetMapping("/{userid}")
    public ResponseEntity<List<ApprovalOrderResponseDto>> getOrdersByUserid(@PathVariable String userid,
                                                                            @AuthenticationPrincipal PrincipalDetails principalDetails) {
        verifyUserAccess(userid, principalDetails);
        List<ApprovalOrder> orders = approvalOrderService.getOrdersByUserid(userid);

        List<ApprovalOrderResponseDto> responseDtos = orders.stream()
                .map(ApprovalOrderResponseDto::fromEntity)
                .collect(Collectors.toList());

        return ResponseEntity.ok(responseDtos);
    }

    // 주문 상세 조회
    @GetMapping("/detail/{orderId}")
    public ResponseEntity<ApprovalOrderResponseDto> getOrderById(@PathVariable Long orderId,
                                                                 @AuthenticationPrincipal PrincipalDetails principalDetails) {
        ApprovalOrder order = approvalOrderService.getOrderById(orderId);
        if (order == null) {
            return ResponseEntity.notFound().build();
        }
        verifyUserAccess(order.getUserid(), principalDetails);

        return ResponseEntity.ok(ApprovalOrderResponseDto.fromEntity(order));
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
