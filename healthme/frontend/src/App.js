// src/App.js
import React, { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import axios from "axios";
import { HEALTHME_API_BASE, healthmeApiUrl } from "config/api";

import { CartProvider, useCart } from "static/js/CartContext";
import Header from "components/header";
import Footer from "components/footer";

// 결과 페이지
import ResultPage from "pages/Result/ResultPage";
// 로그인 페이지
import JoinPage from "pages/login/JoinPage";
import LoginPage from "pages/login/LoginPage";
import FindAccount from "pages/login/FindAccount";
import OAuth2RedirectHandler from "pages/login/OAuth2RedirectHandler";
// 메인 페이지
import Index from "pages/index";
// 설문 페이지
import QuestionPage from "pages/Question/QuestionPage";
// 구매 페이지
import PurchasePage from "pages/Purchase/PurchasePage";
// 추천재료 페이지
import NutritionalPage from "pages/Nutritional/NutritionalPage";
// 제품상세 페이지
import ProductDetailPage from "pages/Details/DetailsPage";
// 장바구니 페이지
import ShoppingCart from "pages/shopping cart/shopping_cart";
// 결제 페이지
import ApprovalPage from "pages/Approval/Approval";
// 관리자 페이지
import Layout from "pages/admin/Layout";
import Dashboard from "pages/admin/Dashboard";
import ProductPage from "pages/admin/ProductPage";
import TransactionPage from "pages/admin/TransactionPage";
import AdminNoticePage from "pages/admin/AdminNoticePage";

// ───── 마이페이지 영역 ─────
import MypageLayout from "pages/mypage/MypageLayout";
import UserEdit from "pages/mypage/UserEdit";
import OrderHistoryPage from "pages/mypage/OrderHistoryPage";
import AddressEditPage from "pages/mypage/AddressEditPage";

//공지사항
import Announcement from "pages/Announcement/Announcement";

// 결제 성공시 보여지는 페이지
import Complete from "pages/Complete/complete";

function AppRoutes() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");
  const { setCartItems } = useCart();

  const loginUser = JSON.parse(localStorage.getItem("loginUser"));
  const userRole = loginUser?.role;

  useEffect(() => {
    const fetchCart = async () => {
      const guestId = localStorage.getItem("guestId");
      const guestCartKey = `guestCart_${guestId}`;

      if (!loginUser) {
        const guestCart = JSON.parse(
          localStorage.getItem(guestCartKey) || "[]"
        );
        const enriched = await enrichCartItems(toCartItemList(guestCart));
        setCartItems(enriched);
      } else {
        const api = axios.create({
          baseURL: HEALTHME_API_BASE,
          withCredentials: true,
        });

        try {
          const res = await api.get(`/cart`);
          const enriched = await enrichCartItems(toCartItemList(res.data));
          setCartItems(enriched);
        } catch (error) {
          console.error("전역 장바구니 로딩 실패:", error);
        }
      }
    };

    const toCartItemList = (data) => {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.content)) return data.content;
      if (Array.isArray(data?.data)) return data.data;
      if (Array.isArray(data?.items)) return data.items;

      // TODO: 개발 확인용 로그입니다. 장바구니 API 응답 형식이 확정되면 운영 배포 전 삭제하세요.
      console.warn("[Cart API unexpected response]", data);
      return [];
    };

    const enrichCartItems = async (items) => {
      return await Promise.all(
        items.map(async (item) => {
          try {
            const { data } = await axios.get(
              healthmeApiUrl(`/products/details/${item.productId}`),
              { withCredentials: true }
            );
            return {
              ...item,
              name: data.name,
              price: data.price,
              salprice: data.salprice,
              imageUrl: data.image_url,
              amount: data.amount,
              quantity: item.quantity ?? 1,
              checked: false,
            };
          } catch (e) {
            console.warn("상품 정보 로딩 실패:", item.productId, e);
            return item;
          }
        })
      );
    };

    fetchCart();
  }, [setCartItems]);

  return (
    <>
      {!isAdmin && <Header />}

      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/question" element={<QuestionPage />} />
        <Route path="/purchase" element={<PurchasePage />} />
        <Route path="/nutritional" element={<NutritionalPage />} />
        <Route path="/details/:productId" element={<ProductDetailPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/shoppingcart" element={<ShoppingCart />} />
        <Route path="/approval" element={<ApprovalPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/find" element={<FindAccount />} />
        <Route path="/oauth2/redirect" element={<OAuth2RedirectHandler />} />

        {/* ── 관리자 영역 ── */}
        <Route
          path="/admin/*"
          element={
            userRole === "ROLE_ADMIN" ? <Layout /> : <Navigate to="/" replace />
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductPage />} />
          <Route path="transactions" element={<TransactionPage />} />
          <Route path="announcements" element={<AdminNoticePage />} />
        </Route>

        {/* ── 마이페이지 영역 ── */}
        <Route path="/mypage" element={<MypageLayout />}>
          <Route index element={<UserEdit />} />
          <Route path="user_edit" element={<UserEdit />} />
          <Route path="purchase_history" element={<OrderHistoryPage />} />
          <Route path="address_edit" element={<AddressEditPage />} />
        </Route>

        <Route path="/announce" element={<Announcement />} />
        <Route path="/Complete" element={<Complete />} />
      </Routes>

      {!isAdmin && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <AppRoutes />
      </CartProvider>
    </BrowserRouter>
  );
}
