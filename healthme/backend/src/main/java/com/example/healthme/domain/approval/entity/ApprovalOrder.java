package com.example.healthme.domain.approval.entity;

import com.example.healthme.domain.mypage.entity.Address;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Getter
@Setter
@Table(name = "orders")
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class ApprovalOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long orderId;

    private String paymentMethod;    // 결제 방식
    private String userid;           // 사용자 ID
    private LocalDateTime orderDate; // 주문 일시
    private String status;           // 주문 상태 (ex: 결제완료, 배송중 등)

    private int totalPrice;          // 총 결제 금액
    @Column(nullable = false, unique = true, length = 100)
    private String merchantUid;      // 결제 전 서버가 생성해서 PortOne에 전달하는 주문번호

    @Column(unique = true, length = 100)
    private String paymentImpUid;    // 결제 검증 후 저장하는 PortOne 결제번호

    private Integer paidAmount;      // PortOne에서 확인한 실제 결제 금액
    private LocalDateTime paidAt;    // PortOne에서 확인한 결제 완료 시각

    private boolean isCanceled;       // 주문 취소 여부
    private boolean isCompleted;      // 주문 완료 여부
    private boolean refundRequested;  // 환불 요청 여부
    private boolean returnRequested;  // 반품 요청 여부

    @ManyToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "address_id")
    private Address address; // 배송지 정보

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    private List<ApprovalOrderItem> approvalOrderItems; // 주문 항목 리스트


}
