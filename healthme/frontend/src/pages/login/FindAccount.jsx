import React, { useState } from "react";
import axios from 'axios';
import 'static/css/login/findAccount.css';
import { healthmeApiUrl } from "config/api";

const FindAccount = () => {
    const [activeTab, setActiveTab] = useState('username');

    const [username, setUsername] = useState('');  // 사용자 이름
    const [userid, setUserid] = useState('');      // 이메일 (아이디)
    const [loading, setLoading] = useState(false);

    const handleFindUsername = () => {
        axios.post(healthmeApiUrl("/users/find-username"), { username })
            .then(res => {
                console.log("백엔드 응답:", res.data);
                alert(`아이디(이메일): ${res.data}`)
            })
            .catch(() => alert("일치하는 정보가 없습니다."));

    };

    const handleResetPassword = () => {
        setLoading(true);  // 로딩 시작

        axios.post(healthmeApiUrl("/users/reset-password"), { username, userid })
            .then(() => alert("임시 비밀번호가 이메일로 전송되었습니다."))
            .catch(() => alert("정보가 일치하지 않습니다."))
            .finally(() => setLoading(false)); // 로딩 종료
    };
    return (
        <div className="find-account-wrapper">
            <h2>아이디 / 비밀번호 찾기</h2>
            <div className="tab-buttons">
                <button
                    className={activeTab === 'username' ? 'active' : ''}
                    onClick={() => setActiveTab('username')}
                >아이디 찾기</button>

                <button
                    className={activeTab === 'password' ? 'active' : ''}
                    onClick={() => setActiveTab('password')}
                >비밀번호 찾기</button>
            </div>

            {/* 아이디 찾기 */}
            {activeTab === 'username' && (
                <div className="find-box">
                    <input
                        type="text"
                        placeholder="이름"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <button onClick={handleFindUsername}>아이디 찾기</button>
                </div>
            )}

            {/* 비밀번호 재설정 */}
            {activeTab === 'password' && (
                <div className="find-box">
                    <input
                        type="text"
                        placeholder="이름"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        type="email"
                        placeholder="이메일 (아이디)"
                        value={userid}
                        onChange={e => setUserid(e.target.value)}
                    />
                    <button onClick={handleResetPassword} disabled={loading}>
                        {loading ? "전송 중..." : "임시 비밀번호 받기"}
                    </button>
                </div>
            )}
        </div>
    );
};

export default FindAccount;
