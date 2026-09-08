import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import 'static/css/pages/Purchase.css';
import { healthmeApiUrl } from "config/api";

//  제품 리스트 컴포넌트 분리
const ProductList = ({ products = [], isSpecial = false }) => {
  const navigate = useNavigate();

  const goToDetail = (product) => {
    if (!product?.productId) {
      alert('상품 ID가 없습니다!');
      return;
    }
    navigate(`/details/${product.productId}`);
  };

  return (
    <ul className="purchase-product-list">
      {products.map((product, index) => (
        <li
          key={`product-${product.id}-${index}`}
          className={`purchase-item_store ${product.category}`}
        >
          <div className="purchase-item_img">
            <img src={product.imageUrl} alt={product.name} />
          </div>
          <div className="purchase-item_add" onClick={() => goToDetail(product)}>
            <i className="fa-solid fa-cart-shopping" />
            <span>담기</span>
          </div>
          <div className="purchase-item_name">
            <span>{product.name}</span>
          </div>
          <div className="purchase-item_subtitle">
            <span>{product.description}</span>
          </div>
          <div className="purchase-item_discount_price">
            <del>{product.price.toLocaleString()}원</del>
          </div>
          <div className="purchase-item_price">
            <ul>
              <li className="purchase-discount">
                {Math.round(100 - (product.salprice / product.price) * 100)}%
              </li>
              <li className="purchase-price">
                {product.salprice.toLocaleString()}원
              </li>
            </ul>
          </div>
          <div className="purchase-item_review">
            <i className="fa-regular fa-comment-dots"></i>
            <span>{product.sales_count.toLocaleString()}+</span>
          </div>
        </li>
      ))}
    </ul>
  );
};


const PurchasePage = () => {
  const [products, setProducts] = useState([]);
  const [originalProducts, setOriginalProducts] = useState([]);

  useEffect(() => {
    axios.get(healthmeApiUrl("/products"), {
      withCredentials: true,
    })
      .then(response => {
        setProducts(response.data);
        setOriginalProducts(response.data);
      })
      .catch(error => {
        console.error("에러 발생:", error);
      });

    // 버튼 fade 효과 처리
    const buttonsGroup = document.querySelectorAll('.options');
    buttonsGroup.forEach((group) => {
      const buttons = group.querySelectorAll('.circle');
      const question = group.previousElementSibling;

      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          buttons.forEach((b) => b.classList.remove('selected'));
          button.classList.add('selected');
          group.classList.add('faded');
          if (question && question.classList.contains('question')) {
            question.classList.add('faded');
          }
        });
      });
    });
  }, []);

  const sortProducts = (order) => {
    let sorted = [];
    if (order === 'asc' || order === 'desc') {
      sorted = [...products].sort((a, b) => {
        const priceA = a.salprice ?? a.price;
        const priceB = b.salprice ?? b.price;
        return order === 'asc' ? priceA - priceB : priceB - priceA;
      });
    } else if (order === 'sales') {
      sorted = [...products].sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
    } else if (order === 'discount') {
      sorted = [...products].sort((a, b) => {
        const discountA = a.salprice ? ((a.price - a.salprice) / a.price) * 100 : 0;
        const discountB = b.salprice ? ((b.price - b.salprice) / b.price) * 100 : 0;
        return discountB - discountA;
      });
    }
    setProducts(sorted);
  };

  const filterCategory = (category) => {
    const items = document.querySelectorAll('.purchase-item_store');
    items.forEach((item) => {
      item.style.display = 'none';
    });

    const selectedItems = document.querySelectorAll(`.${category}`);
    selectedItems.forEach((item) => {
      item.style.display = 'block';
    });
  };

  return (
    <main className="purchase-wrapper">
      <aside className="purchase-left-content">
        <div className="purchase-left-title">
          <h2>구매</h2>
          <a href="/purchase">전체보기 +</a>
        </div>
        <ul className="purchase-left-menu">
          {['건강식품', '유제품', '축산물', '농산물', '수산물'].map((category) => (
            <li key={category}>
              <label className="custom-radio">
                <input
                  type="radio"
                  name="category"
                  onClick={() => filterCategory(category)}
                />
                {category}
              </label>
            </li>
          ))}
        </ul>
      </aside>

      <section className="purchase-right-content">
        <div className="purchase-banner">
          <img
            className="purchase-banner-img"
            src="/img/main/Banner3.jpg"
            alt="배너"
          />
        </div>

        <ul className="purchase-sort-menu">
          <li><a href="#" onClick={() => sortProducts('sales')}>판매량순</a></li>
          <li>|</li>
          <li><a href="#" onClick={() => sortProducts('discount')}>할인율순</a></li>
          <li>|</li>
          <li><a href="#" onClick={() => sortProducts('asc')}>낮은 가격순</a></li>
          <li>|</li>
          <li><a href="#" onClick={() => sortProducts('desc')}>높은 가격순</a></li>
        </ul>

        {/*  상품 목록 */}
        <ProductList products={products} />
      </section>
    </main>
  );
};

export default PurchasePage;
