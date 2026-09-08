package com.example.healthme.domain.product.controller;

import com.example.healthme.domain.product.dto.ProductWithNutrientDto;
import com.example.healthme.domain.product.service.ProductStoreService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RequiredArgsConstructor
@RestController
@RequestMapping("/healthme/products/details")
@CrossOrigin(origins = "${app.frontend-url}")
public class ProductDetailController {

    private final ProductStoreService productStoreService;

    @GetMapping("/{productId}")
    public ResponseEntity<ProductWithNutrientDto> getDetail(@PathVariable Long productId) {
        ProductWithNutrientDto dto = productStoreService.getProductDetail(productId);
        return ResponseEntity.ok(dto);
    }

}

