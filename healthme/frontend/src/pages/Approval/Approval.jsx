import React, { useState, useEffect } from "react";
import "static/css/pages/approval.css";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { apiUrl, healthmeApiUrl } from "config/api";

export default function ApprovalPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const items = state?.items || [];

  // 배송지 상태
  const [isDefaultAddress, setIsDefaultAddress] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [zip, setZip] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [phoneFirst, setPhoneFirst] = useState("010");
  const [phoneMiddle, setPhoneMiddle] = useState("");
  const [phoneLast, setPhoneLast] = useState("");
  const [defaultAddressId, setDefaultAddressId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 사용자/등급·할인 계산
  const loginUser = JSON.parse(localStorage.getItem("loginUser"));
  const userGrade = loginUser?.grade || "새싹";

  const gradeDiscountRates = { 새싹: 0.03, 열정: 0.06, 우수: 0.09, 명예: 0.12 };
  const gradeDiscountRate = gradeDiscountRates[userGrade] || 0;

  const originalTotalPrice = items.reduce(
    (acc, i) => acc + (i.price || 0) * i.quantity,
    0
  );
  const saleTotalPrice = items.reduce(
    (acc, i) => acc + (i.salprice || 0) * i.quantity,
    0
  );

  const productDiscount = originalTotalPrice - saleTotalPrice;
  const totalGradeDiscount = Math.floor(saleTotalPrice * gradeDiscountRate);
  const totalAmount = saleTotalPrice - totalGradeDiscount;

  const totalOverallDiscount = productDiscount + totalGradeDiscount;
  const discountPercentage =
    originalTotalPrice > 0
      ? Math.floor((totalOverallDiscount / originalTotalPrice) * 100)
      : 0;

  // 기본 주소 불러오기
  useEffect(() => {
    const fetchDefaultAddress = async () => {
      if (!isDefaultAddress) return;
      try {
        const res = await axios.get(apiUrl("/approval/default-address"), {
          withCredentials: true,
        });
        const data = res.data;
        setDefaultAddressId(data.address_id || null);
        setRecipient(data.recipient || "");
        setZip(data.zonecode || "");
        setAddress(data.address || "");
        setAddressDetail(data.addressDetail || "");
        if (data.tel) {
          const [first, middle, last] = data.tel.split("-");
          setPhoneFirst(first || "010");
          setPhoneMiddle(middle || "");
          setPhoneLast(last || "");
        }
      } catch (err) {
        console.error("기본 배송지 불러오기 실패:", err);
      }
    };
    fetchDefaultAddress();
  }, [isDefaultAddress]);

  const clearAddressFields = () => {
    setZip("");
    setAddress("");
    setAddressDetail("");
    setPhoneFirst("010");
    setPhoneMiddle("");
    setPhoneLast("");
  };

  const requestPortOnePayment = (paymentData) =>
    new Promise((resolve) => {
      const { IMP } = window;
      IMP.request_pay(paymentData, resolve);
    });

  // TODO: 개발 확인용 로그입니다. 운영 배포 전 반드시 삭제하세요.
  const logDevSnapshot = (label, value) => {
    const snapshot = value == null ? value : JSON.parse(JSON.stringify(value));
    console.log(label, snapshot);
  };

  // 주문 처리
  const handleOrderSubmit = async () => {
    if (isSubmitting) return;

    if (
      !recipient.trim() ||
      !zip.trim() ||
      !address.trim() ||
      !phoneMiddle.trim() ||
      !phoneLast.trim()
    ) {
      return alert("모든 필수 정보를 입력해 주세요.");
    }

    const combinedRecipientPhone = `${phoneFirst}-${phoneMiddle}-${phoneLast}`;

    const prepareData = {
      addressId: isDefaultAddress ? defaultAddressId : null,
      address: isDefaultAddress
        ? null
        : {
            recipient,
            zonecode: zip,
            address,
            addressDetail,
            tel: combinedRecipientPhone,
          },
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      paymentMethod: "card",
    };

    try {
      setIsSubmitting(true);

      if (!window.IMP) {
        alert("PortOne 결제 모듈을 불러오지 못했습니다.");
        return;
      }

      // 서버가 상품 DB, 사용자 등급, 재고 기준으로 금액과 merchant_uid를 확정한다.
      const prepareRes = await axios.post(
        healthmeApiUrl("/payments/prepare"),
        prepareData,
        { withCredentials: true }
      );
      const preparedPayment = prepareRes.data;

      const { IMP } = window;
      IMP.init("imp32678348");

      const portOnePaymentData = {
        pg: "nice_v2",
        pay_method: "card",
        merchant_uid: preparedPayment.merchantUid,
        name: preparedPayment.orderName,
        amount: preparedPayment.amount,
        buyer_name: recipient,
        buyer_tel: combinedRecipientPhone,
        buyer_addr: address,
        buyer_postcode: zip,
      };

      logDevSnapshot("[PortOne request_pay payload]", portOnePaymentData);

      const rsp = await requestPortOnePayment(portOnePaymentData);

      logDevSnapshot("[PortOne request_pay response]", rsp);

      if (!rsp) {
        alert("결제 결과를 확인하지 못했습니다.");
        return;
      }

      if (rsp.error_code || rsp.success === false) {
        alert(`결제 실패: ${rsp.error_msg || "알 수 없는 오류"}`);
        return;
      }

      if (!rsp.imp_uid) {
        alert("결제 처리 중 오류 발생 (imp_uid 누락)");
        return;
      }

      const completePayload = {
        impUid: rsp.imp_uid,
        merchantUid: rsp.merchant_uid || preparedPayment.merchantUid,
      };

      logDevSnapshot("[HealthMe payment complete payload]", completePayload);

      // 서버가 imp_uid로 PortOne 결제 단건을 다시 조회하고 DB 주문과 비교한다.
      const completeRes = await axios.post(
        healthmeApiUrl("/payments/complete"),
        completePayload,
        { withCredentials: true }
      );

      logDevSnapshot("[HealthMe payment complete response]", completeRes.data);

      alert("결제가 완료되었습니다.");
      navigate("/complete", {
        state: {
          orderId: completeRes.data.orderId,
          merchantUid: completeRes.data.merchantUid,
        },
      });
    } catch (err) {
      console.error("주문 처리 오류:", err);
      // TODO: 개발 확인용 로그입니다. 운영 배포 전 반드시 삭제하세요.
      console.error("[HealthMe payment error response]", err.response?.status, err.response?.data);
      alert(err.response?.data || "주문 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="approval-page-main">
      <section className="approval-left">
        <h2>배송지</h2>
        <div className="approval-button-set">
          <button
            type="button"
            className={`approval-left-button ${
              isDefaultAddress ? "active" : ""
            }`}
            onClick={() => setIsDefaultAddress(true)}
          >
            기본 배송지
          </button>
          <button
            type="button"
            className={`approval-right-button ${
              !isDefaultAddress ? "active" : ""
            }`}
            onClick={() => {
              setIsDefaultAddress(false);
              clearAddressFields();
            }}
          >
            직접 입력
          </button>
        </div>

        <div className="approval-main">
          {/* 받는 사람 */}
          <div className="approval-rec">
            <h4>받는사람 *</h4>
            <input
              className="approval-input"
              type="text"
              value={recipient}
              disabled={true}
              placeholder="받는 사람"
            />
          </div>

          {/* 주소 */}
          <div className="approval-address">
            <h4>주소 *</h4>
            <div className="approval-post-container">
              <input
                className="approval-input"
                type="text"
                placeholder="우편번호"
                value={zip}
                disabled={true}
                readOnly={isDefaultAddress}
                onChange={(e) => setZip(e.target.value)}
              />
              <button
                className="approval-post-input"
                disabled={isDefaultAddress}
                onClick={() =>
                  new window.daum.Postcode({
                    oncomplete: (data) => {
                      setZip(data.zonecode);
                      setAddress(data.roadAddress);
                    },
                  }).open()
                }
              >
                주소 검색
              </button>
            </div>
            <input
              className="approval-input"
              type="text"
              placeholder="주소"
              value={address}
              disabled={true}
              onChange={(e) => setAddress(e.target.value)}
            />
            <input
              className="approval-input"
              type="text"
              placeholder="상세주소"
              value={addressDetail}
              disabled={isDefaultAddress}
              onChange={(e) => setAddressDetail(e.target.value)}
            />
          </div>

          {/* 휴대전화 */}
          <div className="approval-phone">
            <h4>휴대전화 *</h4>
            <div className="phone-tel-container">
              <select
                value={phoneFirst}
                className="approval-input-tel1"
                disabled={isDefaultAddress}
                onChange={(e) => setPhoneFirst(e.target.value)}
              >
                <option value="010">010</option>
                <option value="011">011</option>
              </select>
              <input
                className="approval-input"
                type="text"
                maxLength="4"
                value={phoneMiddle}
                disabled={isDefaultAddress}
                onChange={(e) => setPhoneMiddle(e.target.value)}
              />
              <input
                className="approval-input"
                type="text"
                maxLength="4"
                value={phoneLast}
                disabled={isDefaultAddress}
                onChange={(e) => setPhoneLast(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 주문 상품 목록 */}
        <div className="approval-product-list">
          <h2>주문 상품</h2>
          {items.map((item, idx) => (
            <div className="approval-product-item" key={idx}>
              <img src={item.imageUrl} alt={item.productName || item.name} />
              <div className="approval-product-info">
                <div>{item.productName || item.name}</div>
                <div>{item.quantity}개</div>
                <div>정가: {(item.price || 0).toLocaleString()}원</div>
                <div>
                  할인가: {(item.price - item.salprice || 0).toLocaleString()}원
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="approval-right">
        <div className="approval-price-box">
          <ul>
            <li>
              <span>상품 금액</span>
              <span>{originalTotalPrice.toLocaleString()} 원</span>
            </li>
            <li>
              <span>할인 금액</span>
              <span className="approval-gray">
                -{productDiscount.toLocaleString()} 원
              </span>
            </li>
            <li>
              <span>등급 할인</span>
              <span className="approval-gray">
                -{totalGradeDiscount.toLocaleString()} 원
              </span>
            </li>
            <li>
              <span>배송비</span>
              <span className="approval-gray">무료배송</span>
            </li>
            <li className="approval-total-price">
              <span>총 결제금액</span>
              <div className="approval-total-price-right">
                <span className="approval-total-price-red">
                  {discountPercentage}%
                </span>
                <span>{totalAmount.toLocaleString()}원</span>
              </div>
            </li>
          </ul>
        </div>
        <button
          type="button"
          className="approval-button"
          onClick={handleOrderSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "결제 준비 중..." : "주문하기"}
        </button>
      </section>
    </main>
  );
}
