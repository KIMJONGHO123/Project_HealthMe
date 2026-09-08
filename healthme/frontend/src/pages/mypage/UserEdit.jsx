import React, { useEffect, useState } from "react";
import axios from "axios";
import { apiUrl } from "config/api";

export default function UserEdit() {
  const [form, setForm] = useState({
    userid: "",
    password: "",
    username: "",
    tel1: "",
    tel2: "",
    tel3: "",
  });
  const [password, setPassword] = useState();
  const [update, setUpdate] = useState(false);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [showDeliveryDetail, setShowDeliveryDetail] = useState(false);
  const [levelEmoji, setLevelEmoji] = useState(null);

  const loginUser = JSON.parse(localStorage.getItem("loginUser"));

  const calcLevel = (amount) => {
    if (amount >= 1_000_000) return "👑"; // 명예
    if (amount >= 500_000) return "🏆"; // 우수
    if (amount >= 100_000) return "🔥"; // 열정
    return "🌱"; // 새싹
  };
  const userinfo = async () => {
    if (loginUser !== null) {
      const getuser = await axios.get(apiUrl("/mypage/getuserinfo"), {
        // params: { id: loginUser.id },
        withCredentials: true,
      });
      console.log("getuser : ", getuser);
      if (getuser !== null) {
        setForm({
          ...getuser.data,

          tel1: getuser.data.tel.substring(0, 3),
          tel2: getuser.data.tel.substring(4, 8),
          tel3: getuser.data.tel.substring(9, 13),
        });

        // 등급 이모지 설정
        const amount = getuser.data.totalPurchaseAmount ?? 0;
        setLevelEmoji(calcLevel(amount));
      }
    }
  };

  const fetchDeliveryOrders = async () => {
    try {
      const res = await axios.get(apiUrl("/mypage/getbuy"), {
        withCredentials: true,
      });
      console.log("결제상품들 : ", res.data);
      setDeliveryOrders(res.data);
    } catch (err) {
      console.error("배송 내역 로딩 실패", err);
    }
  };

  const updateHandler = (e) => {
    const name = e.target.name;
    const value = e.target.value;
    setForm((prevform) => ({
      ...prevform,
      [name]: value,
    }));
  };

  const checkpasswordHandler = (e) => {
    setPassword(e.target.value);
  };

  const userAlter = async () => {
    const formData = new FormData();
    formData.append("userid", form.userid);
    formData.append("password", form.password);
    formData.append("username", form.username);
    formData.append("phone", form.tel1 + "-" + form.tel2 + "-" + form.tel3);
    if (form.password !== password) {
      window.alert("비밀번호가 틀렸습니다.");
      return;
    } else {
      try {
        // 사용자 정보 수정
        await axios.post(apiUrl(`/mypage/user/update?id=${form.id}`), formData, {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        // address 테이블 recipient 동기화
        await axios.post(
          apiUrl("/mypage/update-recipient"),
          {
            recipient: form.username,
          },
          {
            withCredentials: true,
          }
        );

        window.alert("수정에 성공했습니다.");

        setUpdate((prev) => !prev);
      } catch (error) {
        window.alert("수정에 실패했습니다.");
      }
    }
  };

  useEffect(() => {
    userinfo();
    fetchDeliveryOrders();
  }, [update]);

  const generateTrackingNumber = () => {
    const randomNum = Math.floor(Math.random() * 1_000_000_000_0000);
    return String(randomNum).padStart(13, "0");
  };

  if (!form) return <h2>잠시만 기다려주세요.</h2>;

  return (
    <>
      <div className="user-box">
        <div className="user-top">
          <div>
            {levelEmoji} {form.username}
          </div>
        </div>
        <div className="delivery-status-summary">
          📦 현재 배송 상태:{" "}
          <span className="badge">
            {deliveryOrders.filter((i) => i.status === "배송완료").length} /{" "}
            {deliveryOrders.length}건 배송 완료
          </span>
        </div>
        <div className="delivery-detail-button">
          <button onClick={() => setShowDeliveryDetail(true)}>
            배송 상세보기
          </button>
        </div>
      </div>

      <div className="form-box">
        <h2>회원 정보 수정</h2>
        <form className="profile-edit-form">
          <div className="input-row">
            <label>아이디</label>
            <input type="text" name="userid" value={form.userid} readOnly />
          </div>
          <div className="input-row">
            <label>새 비밀번호</label>
            <input
              type="password"
              name="password"
              value={form.password || ""}
              placeholder="새 비밀번호 입력"
              onChange={updateHandler}
            />
          </div>
          <div className="input-row">
            <label>비밀번호 재확인</label>
            <input
              type="password"
              name="checkPassword"
              placeholder="다시 입력"
              value={password || ""}
              onChange={checkpasswordHandler}
            />
          </div>
          <div className="input-row">
            <label>이름</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={updateHandler}
            />
          </div>
          <div className="input-row">
            <label>휴대폰</label>
            <div className="phone-box">
              <select className="mypage-phone-input" name="tel1" value={form.tel1} onChange={updateHandler}>
                <option value="">선택</option>
                <option value="010">010</option>
                <option value="011">011</option>
              </select>
              <input className="mypage-phone-input" name="tel2" value={form.tel2} onChange={updateHandler} />
              <input className="mypage-phone-input" name="tel3" value={form.tel3} onChange={updateHandler} />
            </div>
          </div>
          <div className="button-group">
            <button type="button" className="submit-btn" onClick={userAlter}>
              수정하기
            </button>
          </div>
          <form action="">
            <input type="hidden" name="userid" value={"${user.name}"} />
            <div className="button-group">
              <button type="submit" className="withrdraw-btn">
                탈퇴하기
              </button>
            </div>
          </form>
        </form>
      </div>

      {/* 배송 상세 모달 */}
      {showDeliveryDetail && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h4>배송 상세정보</h4>

            {deliveryOrders.map((order, oidx) => (
              <div
                className="delivery-group"
                key={oidx}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "10px",
                  padding: "15px",
                  marginBottom: "20px",
                  backgroundColor: "#fff",
                }}
              >
                <div className="delivery-detail">
                  <strong>주문일:</strong>{" "}
                  {new Date(order.orderDate).toLocaleDateString()}
                  <br />
                  <strong>배송 상태:</strong>{" "}
                  {order.status === "배송완료" ? "배송 완료" : "배송 중"}
                </div>

                {order.items.map((item, iidx) => (
                  <ul
                    className="delivery-status-list"
                    key={iidx}
                    style={{
                      marginBottom: "15px",
                      borderTop: "1px dashed #ccc",
                      paddingTop: "10px",
                    }}
                  >
                    <li>
                      <strong>상품명:</strong>{" "}
                      {item.productName ?? "상품명 없음"}
                    </li>
                    <li>
                      <strong>수량:</strong> {item.quantity}
                    </li>
                    <li>
                      <strong>단가:</strong> {item.unitPrice.toLocaleString()}원
                    </li>
                    <li>
                      <strong>합계:</strong> {item.itemTotal?.toLocaleString()}
                      원
                    </li>
                    <li>
                      <strong>배송사:</strong> CJ대한통운
                    </li>
                    <li>
                      <strong>운송장번호:</strong>{" "}
                      {item.trackingNumber ?? generateTrackingNumber()}
                    </li>
                    <li>
                      <strong>주문일시:</strong>{" "}
                      {new Date(order.orderDate).toLocaleString()}
                    </li>
                    <li>
                      <strong>배송 상태:</strong>{" "}
                      {order.status === "배송완료" ? "완료됨" : "배송 중..."}
                    </li>
                  </ul>
                ))}
              </div>
            ))}

            <button onClick={() => setShowDeliveryDetail(false)}>닫기</button>
            {/* deliveryOrders.length > 0 && () 이렇게 조건을 달았기 때문에 [] 빈 배열로 해야 length가 0이 되면서 닫긴다. */}
          </div>
        </div>
      )}
    </>
  );
}
