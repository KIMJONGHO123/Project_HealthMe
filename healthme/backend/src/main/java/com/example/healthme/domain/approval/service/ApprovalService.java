package com.example.healthme.domain.approval.service;

import com.example.healthme.domain.approval.dto.PaymentCompleteRequestDto;
import com.example.healthme.domain.approval.dto.PaymentCompleteResponseDto;
import com.example.healthme.domain.approval.dto.PaymentPrepareItemDto;
import com.example.healthme.domain.approval.dto.PaymentPrepareRequestDto;
import com.example.healthme.domain.approval.dto.PaymentPrepareResponseDto;
import com.example.healthme.domain.approval.dto.PortOnePaymentDto;
import com.example.healthme.domain.approval.entity.ApprovalOrder;
import com.example.healthme.domain.approval.entity.ApprovalOrderItem;
import com.example.healthme.domain.approval.repository.ApprovalCartItemRepository;
import com.example.healthme.domain.approval.repository.ApprovalOrderItemRepository;
import com.example.healthme.domain.approval.repository.ApprovalOrderRepository;
import com.example.healthme.domain.mypage.dto.AddressUpdate;
import com.example.healthme.domain.mypage.entity.Address;
import com.example.healthme.domain.mypage.repository.AddressRepository;
import com.example.healthme.domain.product.entity.ProductStore;
import com.example.healthme.domain.product.repository.ProductStoreRepository;
import com.example.healthme.domain.shoppingcart.entity.ShoppingCartItem;
import com.example.healthme.domain.user.entity.User;
import com.example.healthme.domain.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalService {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_PAID = "PAID";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_CANCELLED = "CANCELLED";
    public static final String STATUS_REVIEW_REQUIRED = "PAYMENT_REVIEW_REQUIRED";

    private static final DateTimeFormatter MERCHANT_UID_DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;

    private final ApprovalOrderRepository approvalOrderRepository;
    private final ApprovalOrderItemRepository approvalOrderItemRepository;
    private final AddressRepository addressRepository;
    private final UserRepository userRepository;
    private final ApprovalCartItemRepository approvalCartItemRepository;
    private final ProductStoreRepository productStoreRepository;
    private final PortOneClient portOneClient;

    @Transactional
    public PaymentPrepareResponseDto preparePayment(PaymentPrepareRequestDto requestDto, String userId) {
        User currentUser = findCurrentUser(userId);
        validatePrepareItems(requestDto.getItems());

        Address orderAddress = resolveOrderAddress(requestDto, currentUser);
        List<PreparedOrderItem> preparedItems = prepareOrderItems(requestDto.getItems());
        int expectedAmount = calculateExpectedAmount(preparedItems, currentUser.getGrade());
        String merchantUid = generateMerchantUid();

        ApprovalOrder approvalOrder = ApprovalOrder.builder()
                .userid(currentUser.getUserid())
                .merchantUid(merchantUid)
                .orderDate(LocalDateTime.now())
                .status(STATUS_PENDING)
                .paymentMethod(normalizePaymentMethod(requestDto.getPaymentMethod()))
                .totalPrice(expectedAmount)
                .isCanceled(false)
                .isCompleted(false)
                .refundRequested(false)
                .returnRequested(false)
                .address(orderAddress)
                .build();

        ApprovalOrder savedOrder = approvalOrderRepository.save(approvalOrder);
        List<ApprovalOrderItem> orderItems = saveOrderItems(savedOrder, preparedItems);
        savedOrder.setApprovalOrderItems(orderItems);

        // Register the server-calculated amount before opening the PortOne payment window.
        portOneClient.preparePayment(merchantUid, expectedAmount);

        return new PaymentPrepareResponseDto(
                savedOrder.getOrderId(),
                merchantUid,
                expectedAmount,
                createOrderName(orderItems)
        );
    }

    @Transactional(noRollbackFor = PaymentValidationException.class)
    public PaymentCompleteResponseDto completePayment(PaymentCompleteRequestDto requestDto, String userId) {
        User currentUser = findCurrentUser(userId);
        // TODO: 개발 확인용 로그입니다. 운영 배포 전 반드시 삭제하세요.
        log.info("[Payment complete request] userId={}, merchantUid={}, impUid={}",
                userId, requestDto.getMerchantUid(), requestDto.getImpUid());

        PortOnePaymentDto portOnePayment = portOneClient.getPayment(requestDto.getImpUid());
        // TODO: 개발 확인용 로그입니다. 운영 배포 전 반드시 삭제하세요.
        log.info("[PortOne payment lookup] impUid={}, merchantUid={}, status={}, amount={}, currency={}",
                portOnePayment.getImpUid(),
                portOnePayment.getMerchantUid(),
                portOnePayment.getStatus(),
                portOnePayment.getAmount(),
                portOnePayment.getCurrency());

        ApprovalOrder order = approvalOrderRepository.findByMerchantUidForUpdate(requestDto.getMerchantUid())
                .orElseThrow(() -> {
                    cancelPaidPaymentQuietly(portOnePayment, "No matching HealthMe order");
                    return new EntityNotFoundException("주문을 찾을 수 없습니다: " + requestDto.getMerchantUid());
                });

        if (!currentUser.getUserid().equals(order.getUserid())) {
            // TODO: 개발 확인용 로그입니다. 운영 배포 전 반드시 삭제하세요.
            log.warn("[Payment validation failed] owner mismatch. loginUser={}, orderUser={}, merchantUid={}",
                    currentUser.getUserid(), order.getUserid(), order.getMerchantUid());
            throw new PaymentValidationException("현재 사용자의 주문이 아닙니다.");
        }

        // TODO: 개발 확인용 로그입니다. 운영 배포 전 반드시 삭제하세요.
        log.info("[HealthMe order lookup] orderId={}, merchantUid={}, status={}, totalPrice={}, userId={}",
                order.getOrderId(),
                order.getMerchantUid(),
                order.getStatus(),
                order.getTotalPrice(),
                order.getUserid());

        if (STATUS_PAID.equals(order.getStatus())) {
            if (isSamePaidOrder(order, portOnePayment, currentUser)) {
                return createCompleteResponse(order, "이미 결제 완료 처리된 주문입니다.");
            }
            if (isSameMerchantUid(order, portOnePayment)) {
                cancelPaidPaymentQuietly(portOnePayment, "Order already processed");
            }
            throw new PaymentValidationException("이미 다른 결제로 처리된 주문입니다.");
        }

        try {
            validatePaymentForOrder(order, portOnePayment, requestDto, currentUser);
            confirmPaidOrder(order, portOnePayment, currentUser);
            return createCompleteResponse(order, "결제 검증이 완료되었습니다.");
        } catch (PaymentValidationException e) {
            // TODO: 개발 확인용 로그입니다. 운영 배포 전 반드시 삭제하세요.
            log.warn("[Payment validation failed] merchantUid={}, impUid={}, reason={}",
                    requestDto.getMerchantUid(), requestDto.getImpUid(), e.getMessage());
            if (isSameMerchantUid(order, portOnePayment)) {
                markInvalidPayment(order, portOnePayment, e.getMessage());
            }
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public AddressUpdate getDefaultAddressByUserId(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("ID가 " + userId + "인 사용자를 찾을 수 없습니다."));

        Address defaultAddress = addressRepository.findByUserAndIsDefault(user, true)
                .orElseThrow(() -> new EntityNotFoundException("기본 배송지를 찾을 수 없습니다."));

        return new AddressUpdate(defaultAddress);
    }

    private User findCurrentUser(String userId) {
        return userRepository.findByUserid(userId)
                .orElseThrow(() -> new EntityNotFoundException("사용자를 찾을 수 없습니다: " + userId));
    }

    private void validatePrepareItems(List<PaymentPrepareItemDto> items) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("주문 상품이 없습니다.");
        }
        for (PaymentPrepareItemDto item : items) {
            if (item.getProductId() == null || item.getQuantity() < 1) {
                throw new IllegalArgumentException("상품 ID와 수량을 확인해 주세요.");
            }
        }
    }

    private Address resolveOrderAddress(PaymentPrepareRequestDto requestDto, User currentUser) {
        if (requestDto.getAddressId() != null) {
            Address address = addressRepository.findById(requestDto.getAddressId())
                    .orElseThrow(() -> new EntityNotFoundException("배송지를 찾을 수 없습니다."));
            if (address.getUser() == null || !address.getUser().getId().equals(currentUser.getId())) {
                throw new IllegalArgumentException("현재 사용자의 배송지가 아닙니다.");
            }
            return address;
        }

        if (requestDto.getAddress() != null) {
            AddressUpdate newAddressDto = requestDto.getAddress();
            validateNewAddress(newAddressDto);
            Address newAddress = Address.builder()
                    .user(currentUser)
                    .recipient(newAddressDto.getRecipient())
                    .zip(newAddressDto.getZonecode())
                    .address(newAddressDto.getAddress())
                    .addressDetail(newAddressDto.getAddressDetail())
                    .recipientPhone(newAddressDto.getTel())
                    .isDefault(false)
                    .build();
            return addressRepository.save(newAddress);
        }

        return addressRepository.findByUserAndIsDefault(currentUser, true)
                .orElseThrow(() -> new IllegalArgumentException("기본 배송지를 찾을 수 없습니다."));
    }

    private void validateNewAddress(AddressUpdate address) {
        if (isBlank(address.getRecipient())
                || isBlank(address.getZonecode())
                || isBlank(address.getAddress())
                || isBlank(address.getTel())) {
            throw new IllegalArgumentException("배송지 필수 정보를 입력해 주세요.");
        }
    }

    private List<PreparedOrderItem> prepareOrderItems(List<PaymentPrepareItemDto> items) {
        List<PreparedOrderItem> preparedItems = new ArrayList<>();
        for (PaymentPrepareItemDto itemDto : items) {
            ProductStore product = productStoreRepository.findByProductId(itemDto.getProductId())
                    .orElseThrow(() -> new EntityNotFoundException("상품을 찾을 수 없습니다: " + itemDto.getProductId()));

            if (product.getAmount() < itemDto.getQuantity()) {
                throw new IllegalArgumentException("재고가 부족합니다: " + product.getName());
            }

            preparedItems.add(new PreparedOrderItem(product, itemDto.getQuantity()));
        }
        return preparedItems;
    }

    private int calculateExpectedAmount(List<PreparedOrderItem> preparedItems, String userGrade) {
        int saleSubtotal = preparedItems.stream()
                .mapToInt(item -> item.product().getSalprice() * item.quantity())
                .sum();
        int gradeDiscount = (int) Math.floor(saleSubtotal * getGradeDiscountRate(userGrade));
        return saleSubtotal - gradeDiscount;
    }

    private List<ApprovalOrderItem> saveOrderItems(ApprovalOrder order, List<PreparedOrderItem> preparedItems) {
        List<ApprovalOrderItem> orderItems = preparedItems.stream()
                .map(item -> {
                    ProductStore product = item.product();
                    int unitPrice = product.getSalprice();
                    int quantity = item.quantity();
                    return ApprovalOrderItem.builder()
                            .order(order)
                            .productId(product.getProductId())
                            .productName(product.getName())
                            .quantity(quantity)
                            .price(product.getPrice())
                            .discountPrice(product.getSalprice())
                            .unitPrice(unitPrice)
                            .itemTotal(unitPrice * quantity)
                            .productImageUrl(product.getImageUrl())
                            .build();
                })
                .collect(Collectors.toList());
        return approvalOrderItemRepository.saveAll(orderItems);
    }

    private void validatePaymentForOrder(
            ApprovalOrder order,
            PortOnePaymentDto portOnePayment,
            PaymentCompleteRequestDto requestDto,
            User currentUser
    ) {
        if (!requestDto.getImpUid().equals(portOnePayment.getImpUid())) {
            throw new PaymentValidationException("PortOne 결제번호가 일치하지 않습니다.");
        }
        if (!portOnePayment.isPaid()) {
            throw new PaymentValidationException("결제가 완료된 상태가 아닙니다.");
        }
        if (!requestDto.getMerchantUid().equals(portOnePayment.getMerchantUid())
                || !order.getMerchantUid().equals(portOnePayment.getMerchantUid())) {
            throw new PaymentValidationException("주문번호가 일치하지 않습니다.");
        }
        if (!currentUser.getUserid().equals(order.getUserid())) {
            throw new PaymentValidationException("현재 사용자의 주문이 아닙니다.");
        }
        if (!STATUS_PENDING.equals(order.getStatus())) {
            throw new PaymentValidationException("처리 가능한 주문 상태가 아닙니다: " + order.getStatus());
        }
        if (portOnePayment.getAmount() != order.getTotalPrice()) {
            throw new PaymentValidationException("결제 금액이 주문 금액과 일치하지 않습니다.");
        }
        if (!isBlank(portOnePayment.getCurrency()) && !"KRW".equals(portOnePayment.getCurrency())) {
            throw new PaymentValidationException("결제 통화가 KRW가 아닙니다.");
        }
        if (approvalOrderRepository.existsByPaymentImpUid(requestDto.getImpUid())) {
            throw new PaymentValidationException("이미 처리된 PortOne 결제번호입니다.");
        }
    }

    private void confirmPaidOrder(ApprovalOrder order, PortOnePaymentDto portOnePayment, User currentUser) {
        List<ProductStore> lockedProducts = lockAndValidateStock(order.getApprovalOrderItems());

        for (ApprovalOrderItem item : order.getApprovalOrderItems()) {
            ProductStore product = findLockedProduct(lockedProducts, item.getProductId());
            product.setAmount(product.getAmount() - item.getQuantity());
            product.setSales_count(product.getSales_count() + item.getQuantity());
        }

        order.setPaymentImpUid(portOnePayment.getImpUid());
        order.setPaidAmount(portOnePayment.getAmount());
        order.setPaidAt(Optional.ofNullable(portOnePayment.getPaidAt()).orElse(LocalDateTime.now()));
        order.setStatus(STATUS_PAID);
        order.setCanceled(false);

        currentUser.setTotalPurchaseAmount(currentUser.getTotalPurchaseAmount() + order.getTotalPrice());

        List<Long> productIds = order.getApprovalOrderItems().stream()
                .map(ApprovalOrderItem::getProductId)
                .toList();
        if (!productIds.isEmpty()) {
            List<ShoppingCartItem> purchasedCartItems =
                    approvalCartItemRepository.findByUserAndProduct_ProductIdIn(currentUser, productIds);
            approvalCartItemRepository.deleteAll(purchasedCartItems);
        }

        // TODO: 개발 확인용 로그입니다. 운영 배포 전 반드시 삭제하세요.
        log.info("[Payment confirmed] orderId={}, merchantUid={}, impUid={}, amount={}",
                order.getOrderId(), order.getMerchantUid(), order.getPaymentImpUid(), order.getPaidAmount());
    }

    private List<ProductStore> lockAndValidateStock(List<ApprovalOrderItem> orderItems) {
        List<ProductStore> lockedProducts = new ArrayList<>();
        for (ApprovalOrderItem item : orderItems) {
            ProductStore product = productStoreRepository.findByProductIdForUpdate(item.getProductId())
                    .orElseThrow(() -> new PaymentValidationException("상품을 찾을 수 없습니다: " + item.getProductId()));
            if (product.getAmount() < item.getQuantity()) {
                throw new PaymentValidationException("결제 후 재고가 부족해졌습니다: " + product.getName());
            }
            lockedProducts.add(product);
        }
        return lockedProducts;
    }

    private ProductStore findLockedProduct(List<ProductStore> lockedProducts, Long productId) {
        return lockedProducts.stream()
                .filter(product -> product.getProductId().equals(productId))
                .findFirst()
                .orElseThrow(() -> new PaymentValidationException("상품 잠금 정보를 찾을 수 없습니다: " + productId));
    }

    private void markInvalidPayment(ApprovalOrder order, PortOnePaymentDto portOnePayment, String reason) {
        if (portOnePayment.isPaid()) {
            if (order.getPaymentImpUid() == null
                    && !approvalOrderRepository.existsByPaymentImpUid(portOnePayment.getImpUid())) {
                order.setPaymentImpUid(portOnePayment.getImpUid());
            }
            order.setPaidAmount(portOnePayment.getAmount());
            order.setPaidAt(Optional.ofNullable(portOnePayment.getPaidAt()).orElse(LocalDateTime.now()));

            try {
                portOneClient.cancelPayment(portOnePayment.getImpUid(), reason);
                order.setStatus(STATUS_CANCELLED);
                order.setCanceled(true);
            } catch (RuntimeException cancelException) {
                order.setStatus(STATUS_REVIEW_REQUIRED);
                log.warn("PortOne auto cancel failed. merchantUid={}, impUid={}, reason={}",
                        order.getMerchantUid(), portOnePayment.getImpUid(), cancelException.getMessage());
            }
        } else {
            order.setStatus(STATUS_FAILED);
        }
    }

    private boolean isSamePaidOrder(ApprovalOrder order, PortOnePaymentDto portOnePayment, User currentUser) {
        return currentUser.getUserid().equals(order.getUserid())
                && portOnePayment.isPaid()
                && isSameMerchantUid(order, portOnePayment)
                && order.getTotalPrice() == portOnePayment.getAmount()
                && order.getPaymentImpUid() != null
                && order.getPaymentImpUid().equals(portOnePayment.getImpUid());
    }

    private boolean isSameMerchantUid(ApprovalOrder order, PortOnePaymentDto portOnePayment) {
        return order.getMerchantUid() != null && order.getMerchantUid().equals(portOnePayment.getMerchantUid());
    }

    private void cancelPaidPaymentQuietly(PortOnePaymentDto portOnePayment, String reason) {
        if (!portOnePayment.isPaid()) {
            return;
        }
        try {
            portOneClient.cancelPayment(portOnePayment.getImpUid(), reason);
        } catch (RuntimeException cancelException) {
            log.warn("PortOne auto cancel failed for impUid={}: {}",
                    portOnePayment.getImpUid(), cancelException.getMessage());
        }
    }

    private PaymentCompleteResponseDto createCompleteResponse(ApprovalOrder order, String message) {
        return new PaymentCompleteResponseDto(
                true,
                message,
                order.getOrderId(),
                order.getMerchantUid(),
                order.getStatus(),
                Optional.ofNullable(order.getPaidAmount()).orElse(order.getTotalPrice())
        );
    }

    private String generateMerchantUid() {
        String date = LocalDate.now().format(MERCHANT_UID_DATE_FORMAT);
        String merchantUid;
        do {
            String random = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            merchantUid = "healthme-" + date + "-" + random;
        } while (approvalOrderRepository.existsByMerchantUid(merchantUid));
        return merchantUid;
    }

    private String createOrderName(List<ApprovalOrderItem> orderItems) {
        if (orderItems.size() == 1) {
            return orderItems.get(0).getProductName();
        }
        return orderItems.get(0).getProductName() + " 외 " + (orderItems.size() - 1) + "건";
    }

    private String normalizePaymentMethod(String paymentMethod) {
        return isBlank(paymentMethod) ? "card" : paymentMethod;
    }

    private double getGradeDiscountRate(String grade) {
        if (isBlank(grade)) {
            return 0.03;
        }
        return switch (grade) {
            case "새싹" -> 0.03;
            case "열정" -> 0.06;
            case "우수" -> 0.09;
            case "명예" -> 0.12;
            default -> 0.0;
        };
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record PreparedOrderItem(ProductStore product, int quantity) {
    }
}
