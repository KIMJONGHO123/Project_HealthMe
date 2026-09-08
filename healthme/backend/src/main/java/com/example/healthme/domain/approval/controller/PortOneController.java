package com.example.healthme.domain.approval.controller;

import com.example.healthme.domain.approval.dto.PaymentCompleteRequestDto;
import com.example.healthme.domain.approval.dto.PaymentCompleteResponseDto;
import com.example.healthme.domain.approval.dto.PaymentPrepareRequestDto;
import com.example.healthme.domain.approval.dto.PaymentPrepareResponseDto;
import com.example.healthme.domain.approval.service.ApprovalService;
import com.example.healthme.domain.approval.service.PaymentValidationException;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/healthme/payments")
@RequiredArgsConstructor
public class PortOneController {

    private final ApprovalService approvalService;

    @PostMapping("/prepare")
    public ResponseEntity<?> preparePayment(
            @Valid @RequestBody PaymentPrepareRequestDto requestDto,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        try {
            PaymentPrepareResponseDto responseDto =
                    approvalService.preparePayment(requestDto, requireUserId(userDetails));
            return ResponseEntity.ok(responseDto);
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(e.getMessage());
        }
    }

    @PostMapping("/complete")
    public ResponseEntity<?> completePayment(
            @Valid @RequestBody PaymentCompleteRequestDto requestDto,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        try {
            PaymentCompleteResponseDto responseDto =
                    approvalService.completePayment(requestDto, requireUserId(userDetails));
            return ResponseEntity.ok(responseDto);
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (PaymentValidationException | IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(e.getMessage());
        }
    }

    private String requireUserId(UserDetails userDetails) {
        if (userDetails == null) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }
        return userDetails.getUsername();
    }
}
