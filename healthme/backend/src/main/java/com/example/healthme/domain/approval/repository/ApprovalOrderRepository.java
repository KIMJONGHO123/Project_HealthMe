package com.example.healthme.domain.approval.repository;

import com.example.healthme.domain.approval.entity.ApprovalOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ApprovalOrderRepository extends JpaRepository<ApprovalOrder, Long> {
    List<ApprovalOrder> findByUserid(String userid);

    List<ApprovalOrder> findByUseridAndStatus(String userid, String status);

    Optional<ApprovalOrder> findByMerchantUid(String merchantUid);

    boolean existsByMerchantUid(String merchantUid);

    boolean existsByPaymentImpUid(String paymentImpUid);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from ApprovalOrder o where o.merchantUid = :merchantUid")
    Optional<ApprovalOrder> findByMerchantUidForUpdate(@Param("merchantUid") String merchantUid);
}
