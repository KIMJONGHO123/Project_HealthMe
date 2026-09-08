import React, { useEffect, useState } from "react";
import DaumPostcodeModal from "./DaumPostcodeModal";
import axios from "axios";
import { apiUrl } from "config/api";
export default function NewAddress({ addrAdd, onClose, newaddr, addrupdate }) {
  const [user, setUser] = useState({
    address: "",
    addressDetail: "",
    zonecode: "",
  });
  const [showPostcode, setShowPostcode] = useState(false);

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

  // 추가된 주소값 저장하기.
  const updateUserSubmit = async () => {
    try {
      // console.log("user", user);
      await axios.post(apiUrl("/mypage/newAddr"), user, {
        withCredentials: true,
      });
      window.alert("저장되었습니다.");
      onClose();
      addrupdate();
    } catch {
      window.alert("저장 실패했습니다.");
    }
  };

  return (
    <>
      {addrAdd ? (
        <div className="modal-backdrop" onClick={onClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={onClose}>
              ×
            </button>
            <h2>배송지 추가</h2>
            <div className="badge">기본 배송지</div>
            <form>
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
                <label htmlFor="recipient">
                  받으실 분 (회원 정보 수정에서 수정하세요.)
                </label>
                <input
                  type="text"
                  id="recipient"
                  name="recipient"
                  value={newaddr?.recipient || ""}
                  readOnly
                />
              </div>

              <div className="input-group">
                <label htmlFor="phone">
                  휴대폰 번호 (회원 정보 수정에서 수정하세요.)
                </label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={newaddr?.tel || ""}
                  readOnly
                />
              </div>

              <div className="button-group">
                <button
                  type="button"
                  className="submit-btn"
                  onClick={updateUserSubmit}
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
