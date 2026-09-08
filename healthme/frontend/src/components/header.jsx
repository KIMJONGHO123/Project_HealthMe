// src/components/Header.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "static/css/common/common.css";
import axios from "axios";
import { useCart } from "static/js/CartContext.js";
import { healthmeApiUrl } from "config/api";

const handleLogout = async () => {
  try {
    await axios.post(
      healthmeApiUrl("/users/logout"),
      {},
      {
        withCredentials: true,
      }
    );
  } catch (err) {
    console.warn("서버 로그아웃 실패 (무시하고 클라이언트만 정리)", err);
  } finally {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("loginUser");
    window.location.href = "/";
  }
};

const Header = () => {
  const navigate = useNavigate();
  const { cartItems } = useCart();
  const loginUser = JSON.parse(localStorage.getItem("loginUser"));

  const goToCart = () => {
    if (!loginUser) {
      alert("로그인이 필요합니다.");
      navigate("/login");
    } else {
      navigate("/shoppingcart");
    }
  };

  const isAdmin = loginUser?.role === "ROLE_ADMIN";

  return (
    <div className="header">
      <ul className="top_of_top_header">
        {loginUser ? (
          <>
            <li>
              <span>{loginUser.username}님</span>
            </li>
            <li className="logo_middle">|</li>
            <li>
              {isAdmin ? (
                <a href="/admin">관리자페이지</a>
              ) : (
                <a href="/mypage">마이페이지</a>
              )}
            </li>
            <li className="logo_middle">|</li>
            <li>
              <button className="logout-btn" onClick={handleLogout}>
                로그아웃
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <a href="/join">회원가입</a>
            </li>
            <li className="logo_middle">|</li>
            <li>
              <a href="/login">로그인</a>
            </li>
          </>
        )}
        <li className="logo_middle">|</li>
        <li>
          <a href="/shoppingcart">장바구니</a>
          {cartItems.length > 0 && (
            <span className="header-cart-badge">{cartItems.length}</span>
          )}
        </li>
      </ul>

      <div className="header_main_row">
        <div className="logo">
          <a href="/">
            <span className="logo_eng">HealthMe</span>
            <span className="logo_middle">ㅤ|ㅤ</span>
            <span className="logo_kor">헬시미</span>
          </a>
        </div>

        <form className="search_box" action="" method="get">
          <button className="search_btn" type="submit">
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
          <input
            className="search_txt"
            type="text"
            placeholder="검색어를 입력해주세요"
          />
        </form>
      </div>

      <ul className="low_header_nav">
        <li>
          <a href="/question">설문하기</a>
        </li>
        <li>
          <a href="/result">결과보기</a>
        </li>
        <li>
          <a href="/nutritional">추천재료</a>
        </li>
        <li>
          <a href="/purchase">쇼핑하기</a>
        </li>
      </ul>
    </div>
  );
};

export default Header;
