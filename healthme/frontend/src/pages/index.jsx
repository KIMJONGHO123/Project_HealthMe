import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swiper from "swiper/bundle";
import "swiper/css/bundle";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "static/css/home/style.css";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { apiUrl, healthmeApiUrl } from "config/api";

// 임시 아이디 발급 로직
const GUEST_ID_KEY = "guestId";
const GUEST_ID_EXPIRES = "guestIdExpires";

const setupGuestId = () => {
  const now = Date.now();
  const expires = localStorage.getItem(GUEST_ID_EXPIRES);
  const guestId = localStorage.getItem(GUEST_ID_KEY);

  if (!guestId || !expires || now > parseInt(expires, 10)) {
    const newGuestId = uuidv4();
    const newExpires = now + 60 * 60 * 1000; // 1시간
    localStorage.setItem(GUEST_ID_KEY, newGuestId);
    localStorage.setItem(GUEST_ID_EXPIRES, newExpires.toString());
    console.log("새 guestId 발급:", newGuestId);
  } else {
    console.log("기존 guestId 유지:", guestId);
  }
};

const HomePage = () => {
  const [notices, setNotices] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [specialProducts, setSpecialProducts] = useState([]);

  useEffect(() => {
    // 1. 게스트 ID 설정 및 Swiper 초기화
    setupGuestId();
    new Swiper(".swiper", {
      direction: "horizontal",
      loop: true,
      autoplay: { delay: 5000 },
      effect: "slide",
      mousewheel: true,
      speed: 500,
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
        type: "fraction",
      },
      navigation: {
        nextEl: ".swiper-button-next",
        prevEl: ".swiper-button-prev",
      },
    });

    // 2. 공지사항 불러오기
    // fetch("/api/notices")
    //   .then((res) => res.json())
    //   .then((data) => setNotices(data.slice(0, 3)))
    //   .catch((err) => console.error("공지사항 로딩 오류:", err));
    fetch(apiUrl("/api/notices"))
      .then((res) => res.json())
      .then((data) => {
        console.log("응답 데이터:", data);
        setNotices(data.slice(0, 3)); // 에러 나는 부분
      })
      .catch((err) => console.error("공지사항 로딩 오류:", err));

    // 3. 상품 데이터 불러오기
    axios
      .get(healthmeApiUrl("/products"), { withCredentials: true })
      .then((response) => {
        const all = response.data;

        const popular = [...all]
          .sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0))
          .slice(0, 4);

        const special = [...all]
          .filter((p) => p.price && p.salprice)
          .map((p) => ({
            ...p,
            discountRate: Math.round(100 - (p.salprice / p.price) * 100),
          }))
          .sort((a, b) => b.discountRate - a.discountRate)
          .slice(0, 4);

        setPopularProducts(popular);
        setSpecialProducts(special);
      })
      .catch((err) => console.error("상품 로딩 오류:", err));
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  };

  return (
    <main>
      <section>
        {/* 배너 Swiper */}
        <div className="wrapper">
          <section className="banner-section">
            <div className="swiper">
              <div className="swiper-wrapper">
                {[1, 2, 3, 4].map((n) => (
                  <div className="swiper-slide" key={n}>
                    <img
                      src={`${process.env.PUBLIC_URL}/img/main/Banner${n}.jpg`}
                      alt={`배너${n}`}
                    />
                  </div>
                ))}
              </div>
              <div className="swiper-pagination" />
            </div>
          </section>
        </div>

        {/* 상단 컨텐츠 */}
        <ul className="main_top_content">
          <li className="are_you_Health">
            <a href="/question">
              <img
                width="400"
                height="400"
                src="img/main/MyHealth.jpg"
                alt="건강 찾기"
              />
            </a>
          </li>
          <li className="what_health_food">
            <a href="/nutritional">
              <img
                width="400"
                height="400"
                src="img/main/HealthFood.jpg"
                alt="건강 재료 찾기"
              />
            </a>
          </li>
          {/* 공지사항 카드 */}
          <li className="content_news">
            {notices.map((notice, i) => (
              <ul key={i} className="news_card">
                <a href="/announce">
                  {i === 0 && (
                    <ul className="news_card_top">
                      <li className="news_card_title">공지사항</li>
                      <li className="news_card_subtitle">NEW</li>
                    </ul>
                  )}
                  <li className="news_card_content">
                    {notice.title} <br />({formatDate(notice.createdDate)})
                  </li>
                </a>
              </ul>
            ))}
          </li>
        </ul>

        {/* 인기 상품 & 특가 상품 */}
        <ul className="main_low_content">
          <ul className="main_low_top_content">
            <li className="main_low_title">실시간 인기 상품</li>
            <li>가장 인기있는 상품만 모아보세요!</li>
          </ul>
          <ProductList products={popularProducts} />

          <ul className="main_low_top_content">
            <li className="main_low_title">오늘의 특가</li>
            <li>헬시미 추천 특가템 최대 50%</li>
          </ul>
          <ProductList products={specialProducts} isSpecial />
        </ul>
      </section>
    </main>
  );
};

const ProductList = ({ products = [], isSpecial = false }) => {
  const navigate = useNavigate();

  const goToDetail = (product) => {
    if (!product?.productId) {
      alert("상품 ID가 없습니다!");
      return;
    }
    navigate(`/details/${product.productId}`);
  };

  return (
    <ul className="main_low_low_content">
      {products.map((product) => (
        <li key={product.productId} className="item_store">
          <div className="item_img">
            <img src={product.imageUrl} alt={product.name} />
          </div>
          <div className="item_add" onClick={() => goToDetail(product)}>
            <i className="fa-solid fa-cart-shopping" />
            <span>담기</span>
          </div>
          <div className="item_name">
            <span>{product.name}</span>
          </div>
          <div className="item_item_subtitle">
            <span>{product.description}</span>
          </div>
          <div className="item_discount_price">
            <del>{product.price?.toLocaleString()}원</del>
          </div>
          <div className="item_price">
            <ul>
              <li className="discount">
                {Math.round(100 - (product.salprice / product.price) * 100)}%
              </li>
              <li className="price">{product.salprice?.toLocaleString()}원</li>
            </ul>
          </div>
          <div className="item_review">
            <i className="fa-regular fa-comment-dots" />
            <span>{(product.sales_count || 0).toLocaleString()}+</span>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default HomePage;
