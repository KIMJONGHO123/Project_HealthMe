package com.example.healthme.domain.approval.repository;

import com.example.healthme.domain.shoppingcart.entity.ShoppingCartItem;
import com.example.healthme.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApprovalCartItemRepository extends JpaRepository<ShoppingCartItem, Long> {
    List<ShoppingCartItem> findByUserUserid(String userid);

    void deleteByUser(User user);

    List<ShoppingCartItem> findByUserAndProduct_ProductIdIn(User user, List<Long> productIds);
}
