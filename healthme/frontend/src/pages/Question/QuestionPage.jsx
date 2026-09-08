import React, { useEffect } from 'react';
import 'static/css/pages/Question.css';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { healthmeApiUrl } from "config/api";

const NutritionSurvey = () => {
  useEffect(() => {
    const groups = document.querySelectorAll('.options');

    groups.forEach((group, groupIndex) => {
      const buttons = group.querySelectorAll('.circle');
      const question = group.previousElementSibling;

      buttons.forEach(button => {
        button.addEventListener('click', () => {
          buttons.forEach(b => b.classList.remove('selected'));
          button.classList.add('selected');
          group.classList.add('faded');
          if (question && question.classList.contains('question')) {
            question.classList.add('faded');
          }

          const nextGroup = groups[groupIndex + 1];
          if (nextGroup) {
            setTimeout(() => {
              nextGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }
        });
      });
    });
  }, []);

  const collectAnswers = () => {
    const selectedButtons = document.querySelectorAll('.circle.selected');

    const answers = Array.from(selectedButtons).map((btn) => ({
      questionIndex: parseInt(btn.dataset.questionIndex),
      score: parseInt(btn.dataset.value),
    }));

    return answers;
  };

  const handleSubmit = async () => {
    const answers = collectAnswers();

    if (answers.length < 23) {
      alert("모든 문항에 응답해 주세요.");
      return;
    }

    try {
      const res = await fetch(healthmeApiUrl("/survey"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ answers }),
      });

      if (res.ok) {
        window.location.href = "/result";
      } else if (res.status === 401) {
        alert("로그인이 필요합니다.");
        window.location.href = "/login";
      } else {
        alert("설문 제출에 실패했습니다.");
      }
    } catch (error) {
      console.error("서버 오류:", error);
      alert("서버와 통신 중 문제가 발생했습니다.");
    }
  };

  return (
    <div>
      <div id="header"></div>

      <section className="hero">
        <h1>나의 건강은?</h1>
        <p>HealthMe Project<sup>®</sup></p>

        <section className="question-card-container">
          <div className="card">
            <div className="card-top">
              <img src="https://www.16personalities.com/static/images/test-header-2.svg" alt="아이콘1" />
            </div>
            <div className="card-content">
              <p>여러분의 영양 상태를 빠르게 진단할 수 있도록 간단한 설문에 응답해 주세요.</p>
            </div>
          </div>

          <div className="card">
            <div className="card-top">
              <img src="https://www.16personalities.com/static/images/academy/explorers/icons/theory.svg" alt="아이콘2" />
            </div>
            <div className="card-content">
              <p>설문 결과를 바탕으로 현재 부족한 영양소를 정확하게 분석해 드립니다.</p>
            </div>
          </div>

          <div className="card">
            <div className="card-top">
              <img src="https://www.16personalities.com/static/images/academy/analysts/exercise.svg" alt="아이콘3" />
            </div>
            <div className="card-content">
              <p>부족한 영양소를 보완할 수 있는 맞춤 식단과 제품을 추천해 드려요.</p>
            </div>
          </div>
        </section>
      </section>

      {/* 설문 문항 */}
      <div className="question-block">
        {questions.map((q, index) => (
          <div key={index}>
            <p className="question">{q.text}</p>
            <div className="options">
              <span className="label disagree">그렇지 않다</span>
              {[...Array(7)].map((_, i) => {
                const value = i;
                let colorClass = '';

                if (i < 3) colorClass = 'purple';
                else if (i === 3) colorClass = 'gray';
                else colorClass = 'green';

                return (
                  <button
                    key={i}
                    className={`circle ${colorClass}`}
                    data-value={value}
                    data-question-index={index}
                  >
                    <span className="material-symbols-outlined">check</span>
                  </button>
                );
              })}
              <span className="label agree">그렇다</span>
            </div>
          </div>
        ))}

        <button className="next-button" onClick={handleSubmit}>
          결과 확인하기 <span><ArrowForwardIosIcon /></span>
        </button>
      </div>

      <div id="footer"></div>
    </div>
  );
};

// 질문 목록
const questions = [
  { text: "육류, 달걀, 콩, 유청 등 단백질 식품을 하루 한 끼도 섭취하지 않는 날이 많다.", nutrient: "단백질" },
  { text: "근력이 줄거나 체력이 떨어져 쉽게 피로함을 느낀다.", nutrient: "단백질" },
  { text: "운동 후 회복이 느리고, 몸이 쉽게 지친다.", nutrient: "단백질" },
  { text: "피로하거나 집중력이 떨어지는 일이 자주 있다.", nutrient: "철분" },
  { text: "어지럽거나 창백해 보인다는 말을 듣는 편이다.", nutrient: "철분" },
  { text: "철분이 풍부한 식품(소고기, 간, 시금치 등)을 잘 챙겨 먹지 않는다.", nutrient: "철분" },
  { text: "하루 종일 실내에만 있는 날이 많다.", nutrient: "비타민 D" },
  { text: "햇볕을 쬘 기회가 거의 없다.", nutrient: "비타민 D" },
  { text: "비타민 D가 풍부한 식품(등푸른 생선, 버섯 등)을 잘 먹지 않는다.", nutrient: "비타민 D" },
  { text: "우유, 치즈 등 유제품을 거의 먹지 않는다.", nutrient: "칼슘" },
  { text: "뼈나 관절이 뻐근하거나 약해진 느낌이 든다.", nutrient: "칼슘" },
  { text: "채소, 과일, 해조류를 하루 1회 이하로만 섭취한다.", nutrient: "식이섬유" },
  { text: "배변 활동이 불규칙하거나 불편한 날이 많다.", nutrient: "식이섬유" },
  { text: "눈 떨림, 근육 경련을 자주 경험한다.", nutrient: "마그네슘" },
  { text: "스트레스를 자주 느끼고, 몸이 긴장된 느낌이 든다.", nutrient: "마그네슘" },
  { text: "자극적 음식(짠 음식, 인스턴트)을 주 3회 이상 섭취한다.", nutrient: "칼륨" },
  { text: "바나나, 감자, 아보카도 등 칼륨이 풍부한 식품을 거의 먹지 않는다.", nutrient: "칼륨" },
  { text: "머리카락이 빠지거나 손톱이 약해지고 갈라진다.", nutrient: "비오틴" },
  { text: "피부가 푸석하고 거칠어진 느낌이 든다.", nutrient: "비오틴" },
  { text: "상처가 잘 낫지 않거나, 입안이 자주 헌다.", nutrient: "아연" },
  { text: "감기에 잘 걸리거나 면역력이 떨어진 것 같다.", nutrient: "아연" },
  { text: "운동 후 회복이 느리고 체력이 떨어졌다고 느낀다.", nutrient: "아르기닌" },
  { text: "혈액순환이 안 되는 느낌이 들고 손발이 차다.", nutrient: "아르기닌" },
];

export default NutritionSurvey;
