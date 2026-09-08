import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
} from "@mui/material";
import axios from "axios";
import { apiUrl } from "config/api";

export default function ProductUpdate({
  open,
  onClose,
  product,
  updatesucess,
}) {
  const [form, setForm] = useState({
    product_id: null,
    category: "",
    name: "",
    price: 0,
    salprice: 0,
    amount: 0,
    description: "",
    imageUrl: null, // 프론트 내부 변수도 camelCase 로
    nutrient: {
      protein: "",
      iron: "",
      vitaminD: "",
      calcium: "",
      dietaryFiber: "",
      magnesium: "",
      potassium: "",
      biotin: "",
      zinc: "",
      arginine: "",
    },
  });

  const [imageFile, setImageFile] = useState(null);

  // 초기값 설정
  useEffect(() => {
    if (product) {
      setForm({
        product_id: product.product_id ?? null,
        category: product.category ?? "",
        name: product.name ?? "",
        price: product.price ?? 0,
        salprice: product.salprice ?? 0,
        amount: product.amount ?? 0,
        description: product.description ?? "",
        imageUrl: product.imageUrl ?? "",
        nutrient: {
          protein: product.protein ?? "",
          iron: product.iron ?? "",
          vitaminD: product.vitamin_d ?? "",
          calcium: product.calcium ?? "",
          dietaryFiber: product.dietary_fiber ?? "",
          magnesium: product.magnesium ?? "",
          potassium: product.potassium ?? "",
          biotin: product.biotin ?? "",
          zinc: product.zinc ?? "",
          arginine: product.arginine ?? "",
        },
      });
    }
  }, [product, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name in form.nutrient) {
      setForm((prev) => ({
        ...prev,
        nutrient: { ...prev.nutrient, [name]: value },
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async () => {
    const fd = new FormData();

    // 기본 필드
    fd.append("product_id", form.product_id);
    fd.append("category", form.category);
    fd.append("name", form.name); // DTO: name
    fd.append("price", form.price); // DTO: price
    fd.append("salprice", form.salprice); // DTO: salprice
    fd.append("amount", form.amount);
    fd.append("description", form.description);

    // 파일
    if (imageFile) fd.append("imageUrl", imageFile); // DTO: imageUrl

    // 영양소 (camel → camel 그대로)
    Object.entries(form.nutrient).forEach(([key, val]) => {
      fd.append(key, val);
    });

    try {
      await axios.put(apiUrl(`/product/${form.product_id}`), fd, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      onClose();
      updatesucess();
    } catch (err) {
      console.error("수정 실패", err);
      window.alert("수정 실패!");
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>상품 수정</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
      >
        <TextField
          label="카테고리"
          name="category"
          value={form.category}
          onChange={handleChange}
        />
        <TextField
          label="상품명"
          name="name"
          value={form.name}
          onChange={handleChange}
        />
        <TextField
          label="정가"
          name="price"
          type="number"
          value={form.price}
          onChange={handleChange}
        />
        <TextField
          label="할인가"
          name="salprice"
          type="number"
          value={form.salprice}
          onChange={handleChange}
        />
        <TextField
          label="수량"
          name="amount"
          type="number"
          value={form.amount}
          onChange={handleChange}
        />
        <TextField
          label="제품 설명"
          name="description"
          value={form.description}
          onChange={handleChange}
        />

        {/* 영양 성분 */}
        {Object.entries(form.nutrient).map(([key, val]) => (
          <TextField
            key={key}
            label={key}
            name={key}
            value={val}
            onChange={handleChange}
          />
        ))}

        <Button variant="contained" component="label">
          썸네일 이미지 업로드
          <input
            type="file"
            hidden
            onChange={(e) => setImageFile(e.target.files[0])}
          />
        </Button>

        <Button variant="outlined" onClick={onClose}>
          취소
        </Button>
        <Button variant="contained" onClick={handleSubmit}>
          수정
        </Button>
      </DialogContent>
    </Dialog>
  );
}
