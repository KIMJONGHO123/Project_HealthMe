import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { healthmeApiUrl } from "config/api";

const TraitsSection = ({ type }) => {
  const [tips, setTips] = useState([]);
  const isNutrientInfo = type === 'nutrient-info';
  const iconSrc = isNutrientInfo ? '/img/check_circle.svg' : '/img/error.svg';

  // 백엔드에서 데이터 로딩
  useEffect(() => {
    axios.get(healthmeApiUrl(`/result/random/${type}`), {
      withCredentials: true
    })
      .then(res => setTips(res.data))
      .catch(err => console.error("TraitsSection 데이터 불러오기 실패", err));
  }, [type]);

  // 2개씩 묶어 2행으로 렌더링
  const safeTips = Array.isArray(tips) ? tips : [];
  const limitedTips = safeTips.slice(0, 4);

  const rows = [];
  for (let i = 0; i < limitedTips.length; i += 2) {
    const row = limitedTips.slice(i, i + 2);
    if (Array.isArray(row)) rows.push(row);
  }

  return (
    <div className="traits-container">
      {rows.map((row, rowIdx) => (
        <div className="traits-row" key={rowIdx}>
          {row.map((tip, colIdx) => (
            <div className="trait" key={colIdx}>
              <div className={`icon ${type}`}>
                <img src={iconSrc} alt="trait-icon" />
              </div>
              <div className="trait-content">
                <p>{tip.title}</p>
                <p>{tip.description}</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default TraitsSection;
