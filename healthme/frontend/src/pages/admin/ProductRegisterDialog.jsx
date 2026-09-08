import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Button,
  Box,
} from "@mui/material";
import axios from "axios";
import { apiUrl } from "config/api";

export default function ProductRegisterDialog({ open, onClose, onSubmit }) {
  const [registCategory, setregistCategory] = useState("");
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState(0);
  const [salePrice, setSalePrice] = useState(0); // 추가
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [image_url, setImage_url] = useState(null);

  const [nutrients, setNutrients] = useState({
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
  });

  useEffect(() => {
    if (open) {
      setregistCategory("");
      setProductName("");
      setPrice(0);
      setSalePrice(0); // 초기화
      setAmount(0);
      setDescription("");
      setImage_url(null);
      setNutrients({
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
      });
    }
  }, [open]);

  const AddProduct = async () => {
    const foamData = new FormData();
    foamData.append("category", registCategory);
    foamData.append("productName", productName);
    foamData.append("productPrice", Number(price));
    foamData.append("salePrice", Number(salePrice)); // 추가
    foamData.append("amount", Number(amount));
    foamData.append("description", description);
    foamData.append("image_url", image_url);

    for (const key in nutrients) {
      foamData.append(key, nutrients[key]);
    }

    try {
      await axios.post(apiUrl("/product/insert/data"), foamData, {
        withCredentials: true,
      });
      onSubmit();
      onClose();
    } catch (error) {
      window.alert("등록되지 않았습니다.");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>상품 등록</DialogTitle>
      <DialogContent dividers>
        <Box
          component="form"
          sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
        >
          <TextField
            select
            label="카테고리"
            required
            fullWidth
            value={registCategory}
            onChange={(e) => setregistCategory(e.target.value)}
          >
            <MenuItem value="건강식품">건강식품</MenuItem>
            <MenuItem value="유제품">유제품</MenuItem>
            <MenuItem value="축산물">축산물</MenuItem>
            <MenuItem value="농산물">농산물</MenuItem>
            <MenuItem value="수산물">수산물</MenuItem>
          </TextField>

          <TextField
            label="제품명"
            required
            fullWidth
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />

          <TextField
            label="가격"
            type="number"
            required
            fullWidth
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />

          <TextField
            label="할인 가격"
            type="number"
            required
            fullWidth
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
          />

          <TextField
            label="수량"
            type="number"
            required
            fullWidth
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <TextField
            label="제품 상세 설명"
            multiline
            rows={4}
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {Object.entries(nutrients).map(([key, value]) => (
            <TextField
              key={key}
              label={key}
              fullWidth
              value={value}
              onChange={(e) =>
                setNutrients((prev) => ({ ...prev, [key]: e.target.value }))
              }
            />
          ))}

          <Button variant="contained" component="label">
            이미지 업로드
            <input
              type="file"
              hidden
              onChange={(e) => setImage_url(e.target.files[0])}
            />
          </Button>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="secondary">
          취소
        </Button>
        <Button onClick={AddProduct} variant="contained" color="primary">
          등록
        </Button>
      </DialogActions>
    </Dialog>
  );
}
