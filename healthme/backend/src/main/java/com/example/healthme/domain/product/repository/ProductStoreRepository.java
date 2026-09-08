package com.example.healthme.domain.product.repository;

import com.example.healthme.domain.product.entity.ProductNutrient;
import com.example.healthme.domain.product.entity.ProductStore;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;


@Repository
public interface ProductStoreRepository extends JpaRepository<ProductStore, Long> {
    Optional<ProductStore> findByProductId(Long productId);

    @Query("SELECT ps FROM ProductStore ps JOIN FETCH ps.nutrients")
    List<ProductStore> findAllWithNutrients();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select ps from ProductStore ps where ps.productId = :productId")
    Optional<ProductStore> findByProductIdForUpdate(@Param("productId") Long productId);
}
