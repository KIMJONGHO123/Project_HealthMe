import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from 'react-router-dom';
import 'static/css/login/login.css'
import { apiUrl, healthmeApiUrl } from "config/api";

const SHOW_SOCIAL_LOGIN = false;

const LoginPage = () => {
    // 로그인 입력값 상태 관리
    const [loginInfo, setLoginInfo] = useState({
        userid: '',
        password: '',
        remember: false
    });

    // 로그인 요청
    const handleSubmit = async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append("userid", loginInfo.userid);
        formData.append("password", loginInfo.password);

        try {
            const response = await axios.post(healthmeApiUrl("/users/login"), formData, {
                withCredentials: true
            });

            const { accessToken, userInfo } = response.data;
            // localStorage.setItem("accessToken", accessToken);
            localStorage.setItem("loginUser", JSON.stringify(userInfo));
            // 로그인 성공 후 gusetCart  서버로 전송
            await syncGuestCartToServer();

            // 아이디 저장 처리
            if (loginInfo.remember) {
                localStorage.setItem("rememberedId", loginInfo.userid);
            } else {
                localStorage.removeItem("rememberedId");
            }

            // 메인페이지로 이동
            window.location.href = "/";
        } catch (error) {
            alert('로그인 실패!');
            console.error(error);
        }
    };

    // 입력값 및 체크박스 상태 변경 핸들러
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setLoginInfo((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // 비회원 장바구니 
    const syncGuestCartToServer = async () => {
        const guestCart = JSON.parse(localStorage.getItem("guestCart") || "[]");
        if (guestCart.length === 0) return;

        try {
            await axios.post(healthmeApiUrl("/cart/guest-sync"), guestCart, {
                withCredentials: true,
            });
            localStorage.removeItem("guestCart");
            console.log("비회원 장바구니 동기화 완료");
        } catch (error) {
            console.error("비회원 장바구니 동기화 실패:", error);
        }
    };

    // localStorage에 저장된 아이디 자동 입력 (아이디 기억하기 기능)
    useEffect(() => {
        const remembered = localStorage.getItem("rememberedId");
        if (remembered) {
            setLoginInfo(prev => ({
                ...prev,
                userid: remembered,
                remember: true
            }));
        }
    }, []);
    return (
        <>
            <div className="login_box">
                <form onSubmit={handleSubmit}>
                    <div className="box1">
                        <h2>로그인</h2>

                        {/* 아이디 입력 */}
                        <input
                            type="text"
                            name="userid"
                            className="custom-input"
                            placeholder="아이디 또는 이메일"
                            value={loginInfo.userid}
                            onChange={handleChange}
                        />

                        {/* 비밀번호 입력 */}
                        <input
                            type="password"
                            name="password"
                            className="custom-input"
                            placeholder="비밀번호"
                            value={loginInfo.password}
                            onChange={handleChange}
                        />

                        {/* 아이디 기억하기 */}
                        <div className="cb">
                            <input
                                type="checkbox"
                                id="remember"
                                name="remember"
                                checked={loginInfo.remember}
                                onChange={handleChange}
                            />
                            <label htmlFor="remember">아이디 기억하기</label>
                        </div>

                        {/* 로그인 버튼 */}
                        <div className="row mt-4">
                            <div className="col">
                                <button type="submit" className="btn1 btn-custom">로그인</button>
                            </div>
                        </div>

                        {SHOW_SOCIAL_LOGIN && (
                            <>
                        <div className="line">
                            <hr /><span>또는</span><hr />
                        </div>

                        {/* 구글 로그인 */}
                        <div className="row">
                            <div className="col">
                                <button
                                    type="button"
                                    className="btn2 btn-custom"
                                    onClick={() => window.location.href = apiUrl("/oauth2/authorization/google")}
                                >
                                    <img src="/img/google.png" alt="구글" className="logo_google" />
                                    구글로 로그인
                                </button>
                            </div>
                        </div>

                        {/* 카카오 로그인 */}
                        <div className="row">
                            <div className="col">
                                <button
                                    type="button"
                                    className="btn3 btn-custom"
                                    onClick={() => window.location.href = apiUrl("/oauth2/authorization/kakao")}
                                >
                                    <img src="/img/kakao.png" alt="카카오" className="logo_kakao" />
                                    카카오로 로그인
                                </button>
                            </div>
                        </div>
                            </>
                        )}
                    </div>

                    {/* 링크들 */}
                    <div className="hypertext">
                        <Link to="/find">아이디 찾기</Link>
                        <Link to="/find">비밀번호 찾기</Link>
                    </div>
                </form>

                {/* 회원가입 유도 */}
                <div className="suggest-join">
                    <li>아직 회원이 아니세요?</li>
                    <Link to="/join">회원가입</Link>
                </div>
            </div>
        </>
    );
};

export default LoginPage;
