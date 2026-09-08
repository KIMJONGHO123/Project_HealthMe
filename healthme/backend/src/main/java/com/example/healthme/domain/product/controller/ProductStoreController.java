package com.example.healthme.domain.product.controller;

import com.example.healthme.domain.product.dto.ProductWithNutrientDto;
import com.example.healthme.domain.product.entity.ProductStore;
import com.example.healthme.domain.product.repository.ProductStoreRepository;
import com.example.healthme.domain.product.service.ProductStoreService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "${app.frontend-url}")
@RestController
@RequestMapping("/healthme/products")
public class ProductStoreController {

    private final ProductStoreRepository productStoreRepository;
    private final ProductStoreService productStoreService;

    public ProductStoreController(ProductStoreRepository productStoreRepository,
                                  ProductStoreService productStoreService) {
        this.productStoreRepository = productStoreRepository;
        this.productStoreService = productStoreService;
    }

    // 단순 상품 리스트 조회
    @GetMapping
    public List<ProductStore> getAllProducts() {
        return productStoreRepository.findAll();
    }

    // 상품 + 영양정보 조회
    @GetMapping("/details")
    public List<ProductWithNutrientDto> getAllProductDetails() {
        return productStoreService.getAllProductDetails();
    }
}
