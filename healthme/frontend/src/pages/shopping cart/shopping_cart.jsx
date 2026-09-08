import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "static/css/pages/shopping-cart.css";
import { useCart } from "static/js/CartContext.js";
import { API_BASE, healthmeApiUrl } from "config/api";

function ShoppingCart() {
  const [isGuest, setIsGuest] = useState(false);
  const { cartItems, setCartItems, setLoading } = useCart(); // loading 상태 제거, setCartItems와 setLoading만 사용
  const [selectAll, setSelectAll] = useState(false);
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);

  const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
  });

  // 주문 금액 (할인 전 원래 가격의 총합)
  const totalPrice = cartItems
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
  // 총 할인 금액 (원래 가격 - 할인가)의 총합
  const totalDiscount = cartItems
    .filter((item) => item.checked)
    .reduce(
      (sum, item) => sum + ((item.price ?? 0) - (item.salprice ?? 0)) * item.quantity,
      0
    );
  // 총 결제 금액 (할인가의 총합)
  const finalPaymentPrice = cartItems
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + (item.salprice ?? 0) * item.quantity, 0);

  // 장바구니 불러오기 (회원용)
  const loadCart = async () => {
    try {
      const res = await api.get("/healthme/cart");
      const items = Array.isArray(res.data) ? res.data : [];

      const enriched = await Promise.all(
        items.map(async (item) => {
          try {
            const { data } = await axios.get(
              healthmeApiUrl(`/products/details/${item.productId}`)
            );
            return {
              ...item,
              name: data.name,
              price: data.price,
              salprice: data.salprice,
              imageUrl: data.image_url,
              amount: data.amount,
              quantity: item.quantity ?? 1,
            };
          } catch (e) {
            console.warn("상품 정보 로딩 실패:", item.productId, e);
            return item; // 상품 정보 로딩 실패 시 기존 item 반환
          }
        })
      );

      setCartItems(enriched.map((item) => ({ ...item, checked: false })));
      // 전체 선택 상태 초기화 (장바구니 내용이 변경될 수 있으므로)
      setSelectAll(false);
    } catch (error) {
      console.error("장바구니 불러오기 오류:", error);
    }
  };

  // 게스트 장바구니 항목들을 상세 정보와 함께 불러와서 state에 저장
  const enrichGuestCartItems = async (items) => {
    const enriched = await Promise.all(
      items.map(async (item) => {
        try {
          const { data } = await axios.get(
            healthmeApiUrl(`/products/details/${item.productId}`)
          );
          return {
            ...item,
            name: data.name,
            price: data.price,
            salprice: data.salprice,
            imageUrl: data.image_url,
            amount: data.amount,
            quantity: item.quantity ?? 1,
            checked: false, // 게스트 장바구니도 초기엔 체크 해제 상태
          };
        } catch (e) {
          console.warn("게스트 상품 정보 로딩 실패:", item.productId, e);
          return item;
        }
      })
    );
    setCartItems(enriched);
    setSelectAll(false);
  };

  // 게스트 장바구니를 회원 장바구니로 마이그레이션 (로그인 시)
  const migrateGuestCartToUserCart = async () => {
    const guestId = localStorage.getItem("guestId");
    if (!guestId) return; // 게스트 ID가 없으면 마이그레이션할 장바구니도 없음

    const guestCartKey = `guestCart_${guestId}`;
    const guestCart = JSON.parse(localStorage.getItem(guestCartKey) || "[]");

    if (guestCart.length === 0) return; // 게스트 장바구니가 비어있으면 할 일 없음

    try {
      console.log("게스트 장바구니 통합 시작:", guestCart);
      for (const item of guestCart) {
        // 각 게스트 장바구니 항목을 회원 장바구니에 추가 또는 수량 업데이트
        await api.post("/healthme/cart", {
          productId: item.productId,
          quantity: item.quantity,
        });
      }
      console.log("게스트 장바구니 통합 완료");
      // 성공적으로 통합 후 로컬 스토리지에서 게스트 장바구니 삭제
      localStorage.removeItem(guestCartKey);
      localStorage.removeItem("guestId");
    } catch (error) {
      console.error("게스트 장바구니 통합 중 오류 발생:", error);
      // 오류 발생 시 사용자에게 알림 (선택 사항)
      alert("이전 비회원 장바구니를 불러오는 데 실패했습니다. 다시 시도해주세요.");
    }
  };

  useEffect(() => {
    const initializeCart = async () => {
      setLoading(true);
      const loginUserString = localStorage.getItem("loginUser");

      if (!loginUserString) { // 비회원
        setIsGuest(true);
        setUserInfo(null);
        const guestId = localStorage.getItem("guestId");
        const guestCartKey = `guestCart_${guestId}`;
        const guestCart = JSON.parse(localStorage.getItem(guestCartKey) || "[]");
        await enrichGuestCartItems(guestCart); // 게스트 장바구니 내용 로드
      } else { // 회원
        setIsGuest(false);
        try {
          const parsedUser = JSON.parse(loginUserString);
          setUserInfo({
            username: parsedUser.username,
            grade: parsedUser.grade,
          });
        } catch (e) {
          console.error("Failed to parse loginUser from localStorage", e);
          setUserInfo(null);
        }

        // 로그인 시 게스트 장바구니를 회원 장바구니로 통합
        await migrateGuestCartToUserCart();
        // 회원 장바구니 불러오기 (통합된 내용 포함)
        await loadCart();
      }
      setLoading(false);
    };

    initializeCart();
  }, []); // 의존성 배열을 비워 컴포넌트 마운트 시 한 번만 실행되도록 함

  // 삭제 버튼 클릭
  const handleDelete = async (productId) => {
    if (!productId) return;

    if (isGuest) {
      const guestId = localStorage.getItem("guestId");
      const guestCartKey = `guestCart_${guestId}`;
      const updatedGuestCart = cartItems.filter((item) => item.productId !== productId);
      localStorage.setItem(guestCartKey, JSON.stringify(updatedGuestCart));
      setCartItems(updatedGuestCart);
    } else {
      try {
        await api.delete(`/healthme/cart/delete/${productId}`);
        await loadCart(); // 서버에서 삭제 후 장바구니 다시 로드하여 UI 업데이트
      } catch (error) {
        console.error("회원 장바구니 삭제 실패:", error);
      }
    }
  };

  // 선택 삭제 버튼 클릭
  const deleteSelected = async () => {
    const selectedItems = cartItems.filter((item) => item.checked);
    const updatedCart = cartItems.filter((item) => !item.checked);
    setCartItems(updatedCart); // UI 먼저 업데이트

    if (isGuest) {
      const guestId = localStorage.getItem("guestId");
      const guestCartKey = `guestCart_${guestId}`;
      localStorage.setItem(guestCartKey, JSON.stringify(updatedCart));
    } else {
      try {
        for (const item of selectedItems) {
          await api.delete(`/healthme/cart/delete/${item.productId}`);
        }
        await loadCart(); // 서버에서 삭제 후 장바구니 다시 로드하여 UI 업데이트
      } catch (error) {
        console.error("선택된 회원 장바구니 항목 삭제 실패:", error);
      }
    }
    setSelectAll(false); // 선택 삭제 후 전체 선택 상태 해제
  };

  // 수량 변경
  const handleQuantityChange = async (id, qty) => {
    const newQuantity = Math.max(1, qty); // 수량은 최소 1

    // 재고량 확인
    const itemToUpdate = cartItems.find(item => (isGuest ? item.productId : item.cartItemId) === id);
    if (itemToUpdate && newQuantity > itemToUpdate.amount) {
      alert(`재고량 ${itemToUpdate.amount}개를 초과할 수 없습니다.`);
      return;
    }

    if (isGuest) {
      const guestId = localStorage.getItem("guestId");
      const guestCartKey = `guestCart_${guestId}`;
      const updated = cartItems.map((item) =>
        (item.productId === id) ? { ...item, quantity: newQuantity } : item
      );
      localStorage.setItem(guestCartKey, JSON.stringify(updated));
      setCartItems(updated);
    } else {
      try {
        // 서버에 수량 변경 요청
        await api.put(`/healthme/cart/item/${id}/quantity`, null, {
          params: { quantity: newQuantity },
        });
        await loadCart(); // 서버에서 업데이트 후 장바구니 다시 로드
      } catch (error) {
        console.error("회원 장바구니 수량 변경 실패:", error);
      }
    }
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    const newValue = !selectAll;
    setCartItems((prev) => prev.map((item) => ({ ...item, checked: newValue })));
    setSelectAll(newValue);
  };

  // 개별 아이템 선택/해제
  const toggleItemChecked = (id) => {
    setCartItems((prev) => {
      const updated = prev.map((item) =>
        (isGuest ? item.productId : item.cartItemId) === id ? { ...item, checked: !item.checked } : item
      );
      // 모든 항목이 체크되었는지 확인하여 '전체 선택' 체크박스 상태 업데이트
      setSelectAll(updated.every(item => item.checked));
      return updated;
    });
  };

  // 결제하기 버튼 클릭
  const handlePaymentClick = () => {
    if (isGuest) {
      alert("로그인이 필요합니다. 먼저 로그인 또는 회원가입을 해주세요.");
      navigate("/login");
      return;
    }

    const selectedItems = cartItems.filter((item) => item.checked);
    if (selectedItems.length === 0) {
      alert("결제할 상품을 선택해주세요.");
      return;
    }

    const loginUser = JSON.parse(localStorage.getItem("loginUser"));

    navigate("/approval", {
      state: {
        items: selectedItems,
        totalPrice,
        userId: loginUser?.userid, // userId는 'id'가 아니라 'userid'일 가능성이 높습니다.
      },
    });
  };

  // cartItems가 변경될 때마다 selectAll 상태를 동기화
  useEffect(() => {
    if (cartItems.length > 0 && cartItems.every(item => item.checked)) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [cartItems]);


  return (
    <main className="shopping-main">
      <div className="cart-cart-container">
        <section className="cart-cart-section">
          <h2>장바구니</h2>

          <div className="cart-cart-all">
            <label htmlFor="select-all">
              <input
                type="checkbox"
                className="cart-custom-checkbox"
                id="select-all"
                checked={selectAll}
                onChange={toggleSelectAll}
              />
            </label>
            <span className="cart-custom-checkbox-all ">전체 선택</span>
            <span>
              <button className="cart-choice-delete" onClick={deleteSelected}>
                선택 삭제
              </button>
            </span>
          </div>

          {cartItems.map((item, index) => (
            <div
              className="cart-cart-item"
              key={item.cartItemId || `guest-${item.productId}` || `fallback-${index}`}
            >
                <input
                  type="checkbox"
                  className="cart-custom-checkbox"
                  checked={item.checked}
                  onChange={() => toggleItemChecked(isGuest ? item.productId : item.cartItemId)}
                />
              <img src={item.imageUrl} alt={item.name} />
              <div className="cart-item-info">
                <p className="cart-name">{item.name}</p>
                <p className="cart-price">{item.price?.toLocaleString()}원</p>
                <p className="cart-sub">{item.salprice?.toLocaleString()}원</p>
                <p className="cart-count">
                  남은 재고량:{" "}
                  {item.amount - item.quantity >= 0
                    ? item.amount - item.quantity
                    : 0}
                  개
                </p>
                <div className="cart-quantity">
                  <button
                    className="cart-qty-btn cart-decrease"
                    onClick={() =>
                      handleQuantityChange(
                        isGuest ? item.productId : item.cartItemId,
                        item.quantity - 1
                      )
                    }
                    disabled={item.quantity <= 1}
                  >
                    -
                  </button>
                  <span className="cart-qty-number">{item.quantity}</span>
                  <button
                    className="cart-qty-btn cart-increase"
                    onClick={() => {
                      // 재고량은 handleQuantityChange에서 체크하므로 여기서는 호출만 합니다.
                      handleQuantityChange(
                        isGuest ? item.productId : item.cartItemId,
                        item.quantity + 1
                      );
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                className="cart-delete"
                onClick={() => handleDelete(item.productId)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          ))}
          <div className="cart-npay-banner">
            <ul className="cart-npay-banner-one">
              <strong>네이버페이 결제 시</strong>
              <p>최대 7천원 혜택</p>
            </ul>
            <ul className="cart-npay-banner-two">
              <div className="cart-npay-icon">N</div>
              <span>pay</span>
            </ul>
          </div>
        </section>

        <aside className="cart-checkout-info">
          {/* 로그인 박스 / 회원 정보 표시 부분 */}
          <div className="cart-login-box">
            {isGuest ? (
              <div className="cart-login-info">
                <span>
                  로그인을 하시면 지금 보고있는 제품을
                  나중에도 확인하실 수 있습니다.
                </span>
                <button>
                  <a href="/login">로그인하기</a>
                </button>
              </div>
            ) : (
              userInfo && ( // userInfo가 있을 때만 렌더링
                <div className="cart-login-info">
                  <span>안녕하세요 {userInfo.username}님</span>
                  <span>등급 : {userInfo.grade}</span>
                </div>
              )
            )}
          </div>

          <div className="cart-payment-summary">
            <h3>결제정보</h3>
            <div className="cart-payment-info">
              <span>최종 할인혜택은 주문서에서 적용됩니다.</span>
              <span>최종 결제금액에 따라 증정품이 변경될 수 있습니다.</span>
            </div>
            <ul>
              <li className="cart-product-item-hline">
                주문금액
                <div className="cart-product-item-gray">
                  <span>{totalPrice.toLocaleString()}원</span>
                  {/* 원래 가격의 총합 */}
                </div>
              </li>
              <li className="cart-product-item-gray">
                ┗ 제품할인
                <span>
                  {totalDiscount.toLocaleString()}원

                </span>
                {/* 할인 금액 및 할인율 */}
              </li>
              <li className="cart-product-item-uline">
                배송비
                <div className="cart-product-item-gray">
                  <span>무료</span>
                </div>
              </li>
            </ul>
            <strong>
              총 결제 금액
              <div className="cart-product-item-red">
                <span>{finalPaymentPrice.toLocaleString()}원</span>
              </div>
            </strong>
          </div>

          <button className="cart-shop-btn" onClick={handlePaymentClick}>
            결제 하기
          </button>
        </aside>
      </div>
    </main>
  );
}

export default ShoppingCart;
