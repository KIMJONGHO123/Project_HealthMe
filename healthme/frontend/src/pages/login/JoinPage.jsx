import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import 'static/css/login/join.css';
import { healthmeApiUrl } from "config/api";

const JoinPage = () => {
    const [formData, setFormData] = useState({
        userid: '',
        password: '',
        password2: '',
        username: '',
        zip: '',
        address: '',
        addressDetail: '',
        gender: '',
        tel1: '010',
        tel2: '',
        tel3: '',
    });

    const [errors, setErrors] = useState({});
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        setErrors((prev) => ({ ...prev, [name]: '' }));
    };

    // 아이디 중복확인
    const handleUseridCheck = () => {
        axios.get(healthmeApiUrl("/users/check"), { params: { userid: formData.userid } })
            .then(res => alert(res.data.exists ? '이미 사용 중인 아이디입니다' : '사용 가능한 아이디입니다'))
            .catch(() => alert('중복 확인 실패'));
    };

    // 주소검색 api
    const handleAddressSearch = () => {
        new window.daum.Postcode({
            oncomplete: (data) => {
                setFormData((prev) => ({
                    ...prev,
                    zip: data.zonecode,
                    address: data.address,
                }));
            }
        }).open();
    };

    // 성별 선택창
    const handleGenderSelect = (value) => {
        setFormData({ ...formData, gender: value });
    };

    // 유효성 검사 에러 메세지
    const handleSubmit = () => {
        const fullPhone = `${formData.tel1}-${formData.tel2}-${formData.tel3}`;
        const joinData = { ...formData, phone: fullPhone };

        axios.post(healthmeApiUrl("/users/join"), joinData)
            .then((res) => {
                alert(res.data.message);
                navigate('/login');
            })
            .catch((err) => {
                const errorData = err.response?.data;

                // 서버 응답이 객체가 아닌 경우 (예: 서버 오류)
                if (!errorData || typeof errorData !== 'object') {
                    alert('회원가입 실패 (서버 오류)');
                    return;
                }

                // 서버에서 내려준 에러 객체를 그대로 errors에 반영
                setErrors(errorData);
            });
    };

    return (
        <div className="join_box">
            <div className="box1">
                <h2>회원가입</h2>

                {/* 아이디 */}
                <div className="input-wrapper">
                    <div className="id-box">
                        <input type="text" name="userid" className="join-custom-input" placeholder="이메일" value={formData.userid} onChange={handleChange} />
                        <button type="button" className="btn-small btn-main" onClick={handleUseridCheck}>중복확인</button>
                    </div>
                    {errors.userid && <div className="error-message" style={{ whiteSpace: 'pre-line' }}>{errors.userid}</div>}
                </div>

                {/* 비밀번호 */}
                <div className="input-wrapper">
                    <input type="password" name="password" className="join-custom-input" placeholder="비밀번호" value={formData.password} onChange={handleChange} />
                    {errors.password && <div className="error-message" style={{ whiteSpace: 'pre-line' }}>{errors.password}</div>}
                </div>

                {/* 비밀번호 확인 */}
                <div className="input-wrapper">
                    <input type="password" name="password2" className="join-custom-input" placeholder="비밀번호 재확인" value={formData.password2} onChange={handleChange} />
                    {errors.password2 && <div className="error-message" style={{ whiteSpace: 'pre-line' }}>{errors.password2}</div>}
                </div>

                {/* 이름 */}
                <div className="input-wrapper">
                    <input type="text" name="username" className="join-custom-input" placeholder="이름" value={formData.username} onChange={handleChange} />
                    {errors.username && <div className="error-message" style={{ whiteSpace: 'pre-line' }}>{errors.username}</div>}
                </div>

                {/* 주소 */}
                <div className="input-wrapper">
                    <div className="join-address-box">
                        <input type="text" name="zip" className="join-custom-input" placeholder="우편번호" value={formData.zip} onChange={handleChange} />
                        <button type="button" className="btn-small btn-main" onClick={handleAddressSearch}>우편번호 검색</button>
                    </div>
                    {errors.zip && <div className="error-message" style={{ whiteSpace: 'pre-line' }}>{errors.zip}</div>}
                </div>

                <div className="input-wrapper">
                    <input type="text" name="address" className="join-custom-input" placeholder="주소" value={formData.address} onChange={handleChange} />
                    {errors.address && <div className="error-message" style={{ whiteSpace: 'pre-line' }}>{errors.address}</div>}
                </div>

                <div className="input-wrapper">
                    <input type="text" name="addressDetail" className="join-custom-input" placeholder="상세주소" value={formData.addressDetail} onChange={handleChange} />
                    {errors.addressDetail && <div className="error-message" style={{ whiteSpace: 'pre-line' }}>{errors.addressDetail}</div>}
                </div>

                {/* 성별 */}
                <div className="input-wrapper">
                    <h6>성별</h6>
                    <div className="gender-btn-group">
                        {['남자', '여자', '선택안함'].map(option => (
                            <button
                                key={option}
                                type="button"
                                className={`btn-option ${formData.gender === option ? 'selected' : ''}`}
                                onClick={() => handleGenderSelect(option)}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 휴대폰 번호 */}
                <div className="input-wrapper">
                    <h6>휴대전화</h6>
                    <div className="tel">
                        <select name="tel1" className="join-custom-input tel1" value={formData.tel1} onChange={handleChange}>
                            <option value="010">010</option>
                            <option value="011">011</option>
                            <option value="012">012</option>
                        </select>
                        <span className="tel-hypen">-</span>
                        <input type="text" name="tel2" className="join-custom-input tel2" value={formData.tel2} onChange={handleChange} />
                        <span className="tel-hypen">-</span>
                        <input type="text" name="tel3" className="join-custom-input tel3" value={formData.tel3} onChange={handleChange} />

                    </div>
                </div>

                {/* 가입 버튼 */}
                <button type="button" className="btn-big btn-main" onClick={handleSubmit} >
                    회원가입
                </button>

                <div className="suggest-login">
                    <li>아이디가 이미 있으신가요?</li>
                    <Link to="/login">로그인</Link>
                </div>
            </div>
        </div>
    );
};

export default JoinPage;
