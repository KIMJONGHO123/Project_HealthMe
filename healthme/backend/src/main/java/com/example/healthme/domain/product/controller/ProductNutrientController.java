package com.example.healthme.domain.product.controller;

import com.example.healthme.domain.product.entity.ProductNutrient;
import com.example.healthme.domain.product.repository.ProductNutrientRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;


@RestController
@RequestMapping("/healthme/nutrients")
@CrossOrigin(origins = "${app.frontend-url}")
public class ProductNutrientController {

    private final ProductNutrientRepository nutrientRepository;

    public ProductNutrientController(ProductNutrientRepository nutrientRepository) {
        this.nutrientRepository = nutrientRepository;
    }

//    @GetMapping("/{productId}")
//    public ResponseEntity<ProductNutrient> getNutrientByProductId(@PathVariable Long productId) {
//        Optional<ProductNutrient> optional = nutrientRepository.findByProductId(productId);
//        if (optional.isPresent()) {
//            return ResponseEntity.ok(optional.get());
//        } else {
//            return ResponseEntity.notFound().build();
//        }
//    }

    public List<ProductNutrient> getNutrientsByProductId(@PathVariable Long productId) {
        System.out.println(nutrientRepository.findByProductStore_ProductId(productId));
        return nutrientRepository.findByProductStore_ProductId(productId);
    }
}
