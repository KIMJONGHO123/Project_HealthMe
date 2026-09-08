import React, { useEffect, useState } from "react";
import AddressEditModal from "./AddressEditModal";
import NewAddress from "./NewAddress";
import axios from "axios";
import { apiUrl } from "config/api";

export default function AddressEditPage() {
  const [open, setOpen] = useState(false);
  const [addrAdd, setAddrAdd] = useState(false);
  const [addr_userDB, setAddr_userDB] = useState([]);
  const [updateaddress, setUpdateaddress] = useState(null);
  const [showDeliveryDetail, setShowDeliveryDetail] = useState(false);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [levelEmoji, setLevelEmoji] = useState(null);
  const [newaddr, setNewaddr] = useState(null);
  const [update, setUpdate] = useState(false);

  const loginUser = JSON.parse(localStorage.getItem("loginUser"));

  const calcLevel = (amount) => {
    if (amount >= 1_000_000) return "👑";
    if (amount >= 500_000) return "🏆";
    if (amount >= 100_000) return "🔥";
    return "🌱";
  };

  const fetchUserInfo = async () => {
    if (loginUser) {
      const res = await axios.get(apiUrl("/mypage/getuserinfo"), {
        // params: { id: loginUser.id },
        withCredentials: true,
      });
      const amount = res.data.totalPurchaseAmount ?? 0;
      setLevelEmoji(calcLevel(amount));
    }
  };

  const handleUpdate = (e, addr) => {
    e.preventDefault();
    console.log("수정 버튼 : ", addr);
    setNewaddr(addr);
    setUpdateaddress(addr);
    setOpen(true);
  };

  const getAddress = async () => {
    const addr_user = await axios.get(apiUrl("/mypage/getaddrinfo"), {
      withCredentials: true,
    });
    setAddr_userDB(addr_user.data);
  };

  const fetchDeliveryOrders = async () => {
    try {
      const res = await axios.get(apiUrl("/mypage/getbuy"), {
        withCredentials: true,
      });
      setDeliveryOrders(res.data);
    } catch (err) {
      console.error("배송 상세 내역 로딩 실패", err);
    }
  };

  const generateTrackingNumber = () => {
    const randomNum = Math.floor(Math.random() * 1_000_000_000_0000);
    return String(randomNum).padStart(13, "0");
  };

  useEffect(() => {
    fetchDeliveryOrders();
    getAddress();
    fetchUserInfo();
  }, [update]);

  const addnewAddr = async () => {
    try {
      const newaddr_use_user = await axios.get(apiUrl("/mypage/getuserinfo"), {
        withCredentials: true,
      });
      setNewaddr({
        recipient: newaddr_use_user.data.username,
        tel: newaddr_use_user.data.tel,
      });
      setAddrAdd(true);
    } catch (e) {
      console.error("유저 정보 가져오기 실패", e);
    }
  };

  const deafult_address = addr_userDB.filter((addr) => addr._default);
  const add_addr = addr_userDB.filter((addr) => !addr._default);

  return (
    <>
      <div className="user-box">
        <div className="user-top">
          <div>
            {levelEmoji} {loginUser.username}
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
        <div className="address-header">
          <h2>배송지 수정</h2>
          <div className="description">
            배송지에 따라 상품정보 및 배송유형이 달라질 수 있습니다.
          </div>
        </div>

        {deafult_address.length > 0 && (
          <div className="address-box">
            <div className="address-header">
              <span className="badge">기본배송지</span>
            </div>
            <div className="address-content">
              <div className="address-info">
                <div className="address-text">{deafult_address[0].address}</div>
                <div className="address-sub">
                  <span className="address-addressDetail">
                    {deafult_address[0].addressDetail}&nbsp;&nbsp;
                  </span>
                  <span className="address-username">
                    {deafult_address[0].recipient}
                  </span>
                </div>
              </div>
              <a
                onClick={(e) => handleUpdate(e, deafult_address[0])}
                className="address-adjustment"
              >
                수정
              </a>
            </div>
          </div>
        )}

        {add_addr.map((addr) => (
          <div className="address-box" key={addr.address_id}>
            <div className="address-header">
              <span className="badge">추가 배송지</span>
            </div>
            <div className="address-content">
              <div className="address-info">
                <div className="address-text">{addr.address}</div>
                <div className="address-sub">
                  <span className="address-addressDetail">
                    {addr.addressDetail}&nbsp;&nbsp;
                  </span>
                  <span className="address-username">{addr.recipient}</span>
                </div>
              </div>
              <a
                onClick={(e) => handleUpdate(e, addr)}
                className="address-adjustment"
              >
                수정
              </a>
            </div>
          </div>
        ))}

        <div className="new_Address_add">
          <button onClick={addnewAddr}>새 배송지 추가</button>
        </div>
      </div>

      <AddressEditModal
        open={open}
        onClose={() => setOpen(false)}
        updateaddress={updateaddress}
        getAddress={getAddress}
      />

      <NewAddress
        addrAdd={addrAdd}
        onClose={() => setAddrAdd(false)}
        newaddr={newaddr}
        addrupdate={() => setUpdate((prev) => !prev)}
      />

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
          </div>
        </div>
      )}
    </>
  );
}
