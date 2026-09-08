import React from "react";
import { Link, useLocation } from "react-router-dom";
import "static/css/pages/complete.css";

export default function Complete() {
  const { state } = useLocation();

  return (
    <div className="order-complete-container">
      <h1>🎉 주문이 완료되었습니다!</h1>
      <p>주문해 주셔서 감사합니다.</p>
      {state?.orderId && <p>주문번호: {state.orderId}</p>}
      {state?.merchantUid && <p>결제 주문번호: {state.merchantUid}</p>}
      <p>주문 내역은 마이페이지에서 확인하실 수 있습니다.</p>
      <Link to="/" className="go-home-button">
        홈으로 가기
      </Link>
    </div>
  );
}
