package com.example.healthme.domain.approval.controller;

import com.example.healthme.domain.approval.service.ApprovalCartItemService;
import com.example.healthme.domain.shoppingcart.entity.ShoppingCartItem;
import com.example.healthme.global.config.auth.principal.PrincipalDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/shopping-cart")
@RequiredArgsConstructor
public class ApprovalCartItemController {

    private final ApprovalCartItemService approvalCartItemService;

    // 사용자 장바구니 아이템 전체 조회
    @GetMapping("/{userid}")
    public ResponseEntity<List<ShoppingCartItem>> getCartItemsByUserid(@PathVariable String userid,
                                                                       @AuthenticationPrincipal PrincipalDetails principalDetails) {
        verifyUserAccess(userid, principalDetails);
        List<ShoppingCartItem> approvalCartItems = approvalCartItemService.getCartItemsByUserid(userid);
        return ResponseEntity.ok(approvalCartItems);
    }

    // 장바구니 아이템 추가
    @PostMapping
    public ResponseEntity<ShoppingCartItem> addCartItem(@RequestBody ShoppingCartItem approvalCartItem,
                                                        @AuthenticationPrincipal PrincipalDetails principalDetails) {
        if (approvalCartItem.getUser() != null && approvalCartItem.getUser().getUserid() != null) {
            verifyUserAccess(approvalCartItem.getUser().getUserid(), principalDetails);
        }
        ShoppingCartItem savedItem = approvalCartItemService.saveCartItem(approvalCartItem);
        return ResponseEntity.ok(savedItem);
    }

    // 사용자 장바구니 아이템 전체 삭제
    @DeleteMapping("/{userid}")
    public ResponseEntity<Void> deleteCartItemsByUserid(@PathVariable String userid,
                                                        @AuthenticationPrincipal PrincipalDetails principalDetails) {
        verifyUserAccess(userid, principalDetails);
        approvalCartItemService.deleteCartItemsByUserid(userid);
        return ResponseEntity.noContent().build();
    }

    private void verifyUserAccess(String userid, PrincipalDetails principalDetails) {
        if (principalDetails == null) {
            throw new AccessDeniedException("로그인이 필요합니다.");
        }

        if (isAdmin(principalDetails)) {
            return;
        }

        if (!principalDetails.getUserDto().getUserid().equals(userid)) {
            throw new AccessDeniedException("본인 장바구니만 접근할 수 있습니다.");
        }
    }

    private boolean isAdmin(PrincipalDetails principalDetails) {
        return "ROLE_ADMIN".equals(principalDetails.getUserDto().getRole());
    }
}
