import React, { useEffect, useState } from "react";
import DaumPostcodeModal from "./DaumPostcodeModal";
import axios from "axios";
import { apiUrl } from "config/api";
export default function AddressEditModal({
  open,
  onClose,
  updateaddress,
  getAddress,
}) {
  const [user, setUser] = useState({
    address: "",
    addressDetail: "",
    zonecode: "",
  });
  const [showPostcode, setShowPostcode] = useState(false);

  // 주소를 AddressEditPage에서 프롭스로 가져온 후 수정을 위해 user라는 useState 정의.
  useEffect(() => {
    if (updateaddress !== null) {
      //console.log(updateaddress);
      setUser({
        address: updateaddress.address,
        addressDetail: updateaddress.addressDetail,
      });
    }
  }, [updateaddress]);

  const addressUpdateHandle = () => {
    setShowPostcode(true);
  };

  // 주소 검색 api에서 검색 후 user에 저장하는 함수.
  const handleAddressSelect = (updateUser) => {
    // updateUser는 DaumPostcodeModal에서 넘어온 객체이다.
    setUser((prev) => ({
      ...prev,
      address: updateUser.address,
      zonecode: updateUser.zonecode,
    }));
  };

  // 수정된 주소값 저장하기.
  const updateUserSubmit = async () => {
    try {
      console.log("updateaddress", updateaddress);
      await axios.post(
        apiUrl(`/mypage/updateAddr?addr_id=${updateaddress.address_id}`),
        user,
        {
          // 각각의 id에 맞는 주소를 수정
          withCredentials: true,
        }
      );
      window.alert("수정되었습니다.");
    } catch {
      window.alert("수정 실패했습니다.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // 폼이 브라우저 기본-제출 하지 않도록
    await updateUserSubmit(); // axios POST
    await getAddress();
    onClose(); // 모달 닫기
  };

  return (
    <>
      {open && updateaddress ? (
        <div className="modal-backdrop" onClick={onClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={onClose}>
              ×
            </button>
            <h2>배송지 수정</h2>
            <div className="badge">기본 배송지</div>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label htmlFor="address">주소</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={user.address}
                  placeholder="주소를 입력하세요."
                  readOnly
                />
                <button
                  className="address-search-btn"
                  onClick={addressUpdateHandle}
                  type="button"
                >
                  주소 검색
                </button>
              </div>

              <div className="input-group">
                <label htmlFor="detail-address">상세주소 입력</label>
                <input
                  type="text"
                  id="detail-address"
                  name="detailAddress"
                  placeholder="상세주소를 입력하세요."
                  value={user.addressDetail}
                  onChange={(e) => {
                    setUser((prev) => ({
                      ...prev,
                      addressDetail: e.target.value,
                    }));
                  }}
                />
              </div>

              <div className="input-group">
                <label htmlFor="recipient">받으실 분</label>
                <input
                  type="text"
                  id="recipient"
                  name="recipient"
                  value={updateaddress.recipient}
                  readOnly
                />
              </div>

              <div className="input-group">
                <label htmlFor="phone">휴대폰 번호</label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={updateaddress.tel}
                  readOnly
                />
              </div>

              <div className="button-group">
                <button
                  type="submit"
                  className="submit-btn"
                  // onClick={updateUserSubmit}
                >
                  저장
                </button>
              </div>
            </form>

            {showPostcode ? (
              <DaumPostcodeModal
                onClose={() => setShowPostcode(false)}
                onSelect={handleAddressSelect}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
