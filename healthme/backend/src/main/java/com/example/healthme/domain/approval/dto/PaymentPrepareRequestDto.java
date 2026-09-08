package com.example.healthme.domain.approval.dto;

import com.example.healthme.domain.mypage.dto.AddressUpdate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class PaymentPrepareRequestDto {

    private Long addressId;
    private AddressUpdate address;
    private String paymentMethod;

    @NotEmpty
    private List<@Valid PaymentPrepareItemDto> items;
}
