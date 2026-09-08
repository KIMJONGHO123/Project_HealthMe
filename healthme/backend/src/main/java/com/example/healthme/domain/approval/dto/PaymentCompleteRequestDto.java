package com.example.healthme.domain.approval.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PaymentCompleteRequestDto {

    @NotBlank
    @JsonAlias("imp_uid")
    private String impUid;

    @NotBlank
    @JsonAlias("merchant_uid")
    private String merchantUid;
}
