import React, { useEffect, useState } from 'react';
import axios from 'axios';
import 'static/css/pages/Nutritional.css';
import { useNavigate } from "react-router-dom";
import { HEALTHME_API_BASE, healthmeApiUrl } from "config/api";

// 성인 남성 기준 영양소 권장 수치량 (실제 단위: g, mg, µg)
// 이 값들은 displayValue를 계산할 때 '기준'이 됩니다.
const maxScoreMap = {
  "단백질": 154,    // g
  "마그네슘": 400,  // mg
  "칼슘": 1200,     // mg
  "비타민 D": 45,   // µg 
  "아연": 15,       // mg
  "철분": 18,       // mg 
  "식이섬유": 30,   // g
  "칼륨": 4700,     // mg
  "아르기닌": 7000, // mg
  "비오틴": 30      // µg
};

// 제품의 영양소 정보를 표시용으로 포맷하는 함수 (mg -> g 변환 포함)
// 이는 제품 상세 정보 '영양정보 더보기'에 사용됩니다.
const formatNutrient = (label, value, unit) => {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = parseFloat(value);
  if (isNaN(numericValue)) return null;

  let displayValue = numericValue;
  let displayUnit = unit;

  // mg 값이 1000 이상이면 g으로 변환
  if (unit === 'mg' && numericValue >= 1000) {
    displayValue = (numericValue / 1000).toFixed(1);
    displayUnit = 'g';
  }

  return { label, value: displayValue, unit: displayUnit };
};

// 영양소 막대 바를 표시하는 컴포넌트
const CardBar = ({ name, percent, displayValue, unit, onClick }) => {
  // 퍼센트에 따라 색상 클래스 결정
  const getColorClass = (percent) => {
    if (percent <= 20) return 'red';
    if (percent <= 40) return 'orange';
    if (percent <= 60) return 'yellow';
    if (percent <= 80) return 'green';
    return 'blue';
  };

  const colorClass = getColorClass(percent);
  return (
    <div className="nutritional_card-bar" onClick={onClick}>
      <div className="nutritional_bar-label">
        {name} <span className="nutritional_bar-percent">{displayValue}{unit}</span> {/* 누적된 실제 섭취량 표시 */}
      </div>
      <div className="nutritional_bar-container">
        <div
          className={`nutritional_bar-inner ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
        <div
          className={`nutritional_indicator ${colorClass}`}
          style={{ left: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default function CustomNutritionalPage() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});
  const [resultMap, setResultMap] = useState({});
  const [selectedNutrient, setSelectedNutrient] = useState(null);
  const [userNutrientScores, setUserNutrientScores] = useState({});

  const [accumulatedNutrients, setAccumulatedNutrients] = useState({
    "단백질": 154,
    "마그네슘": 400,
    "비오틴": 30,
    "비타민 D": 45,
    "식이섬유": 30,
    "아르기닌": 7000,
    "아연": 15,
    "철분": 18,
    "칼륨": 4700,
    "칼슘": 1200
  });

  const [userNutrientMaxScores, setUserNutrientMaxScores] = useState({
    "단백질": 18,
    "마그네슘": 12,
    "비오틴": 12,
    "비타민 D": 18,
    "식이섬유": 12,
    "아르기닌": 12,
    "아연": 12,
    "철분": 18,
    "칼륨": 12,
    "칼슘": 12
  });

  const navigate = useNavigate();

  // axios 인스턴스 생성 (loadCart 함수에서 사용할 api) - 이 부분은 CustomNutritionalPage 컴포넌트 내부에 있어야 합니다.
  const api = axios.create({
    baseURL: HEALTHME_API_BASE, // 장바구니 API의 기본 URL을 여기에 맞춰주세요.
    withCredentials: true,
  });

  // 장바구니 db로 담기는 로직
  const saveCartToServer = async () => {
    try {
      const loginUser = localStorage.getItem("loginUser");
      if (!loginUser) {
        alert("로그인 후 이용 가능합니다.");
        navigate("/login");
        return;
      }
      const userid = JSON.parse(loginUser).userid;

      // 현재 장바구니에 있는 모든 항목을 서버에 보낼 형식으로 변환
      const cartItemsToSave = cart.map(item => ({
        productId: item.id,
        quantity: item.qty
      }));

      // 모든 장바구니 항목을 서버에 저장
      // NOTE: 서버에서 개별 POST 요청이 아닌, 한 번에 여러 항목을 받는 API가 있다면 그것을 사용하는 것이 효율적입니다.
      // 현재는 각 아이템별로 POST 요청을 보냅니다.
      for (const item of cartItemsToSave) {
        await api.post("/cart", item); // POST /healthme/cart 로 요청
      }

      alert("장바구니에 성공적으로 담겼습니다!");
      navigate("/shoppingcart"); // 예시: 실제 장바구니 페이지 경로로 변경
    } catch (error) {
      console.error("장바구니 저장 중 오류 발생:", error);
      // 에러 발생 시 더 상세한 정보를 제공
      if (error.response && error.response.data) {
        alert(`장바구니 저장에 실패했습니다: ${error.response.data}`);
      } else {
        alert("장바구니 저장에 실패했습니다. 다시 시도해주세요.");
      }
    }
  };
  // 제품의 실제 영양소량(g, mg, µg)을 설문 점수로 변환하는 헬퍼 함수
  const convertNutrientValueToScore = (nutrientName, value) => {
    const recommendedAmount = maxScoreMap[nutrientName];
    const maxScore = userNutrientMaxScores[nutrientName];

    if (!recommendedAmount || !maxScore || recommendedAmount <= 0 || maxScore <= 0) {
      console.warn(`[convertNutrientValueToScore] ${nutrientName}: 유효한 권장량(${recommendedAmount}) 또는 최대 점수(${maxScore})가 없어 점수 환산 불가.`);
      return 0;
    }
    const score = (value / recommendedAmount) * maxScore;
    return score;
  };

  // 영양소 정보(percent, displayValue, unit)를 계산하여 resultMap에 저장하는 함수
  const summarize = () => {
    const updatedResultMap = {};
    for (const nutrientName of Object.keys(maxScoreMap)) {
      const userScore = userNutrientScores[nutrientName] || 0;
      const maxPossibleScore = userNutrientMaxScores[nutrientName];

      let percent = 0;
      if (maxPossibleScore > 0) {
        percent = Math.min(100, Math.round((userScore / maxPossibleScore) * 100));
      }

      let currentAccumulatedValue = accumulatedNutrients[nutrientName] || 0;
      let unit = '';
      let finalDisplayValue;

      if (['단백질', '식이섬유'].includes(nutrientName)) {
        unit = 'g';
        finalDisplayValue = currentAccumulatedValue.toFixed(1);
      } else if (['칼슘', '철분', '마그네슘', '칼륨', '아연', '아르기닌'].includes(nutrientName)) {
        unit = 'mg';
        if (currentAccumulatedValue >= 1000) {
          finalDisplayValue = (currentAccumulatedValue / 1000).toFixed(1);
          unit = 'g';
        } else {
          finalDisplayValue = Math.round(currentAccumulatedValue);
        }
      } else if (['비타민 D', '비오틴'].includes(nutrientName)) {
        unit = 'µg';
        finalDisplayValue = Math.round(currentAccumulatedValue);
      } else {
        unit = '';
        finalDisplayValue = currentAccumulatedValue.toFixed(1);
      }
      updatedResultMap[nutrientName] = { percent, displayValue: parseFloat(finalDisplayValue), unit };
    }
    setResultMap(updatedResultMap);
  };

  // 장바구니 불러오기 (회원용) 함수 정의
  const loadCart = async (initialUserScores) => { // initialUserScores를 매개변수로 받도록 변경
    try {
      const res = await api.get("/cart");
      const items = Array.isArray(res.data) ? res.data : [];

      const enriched = await Promise.all(
        items.map(async (item) => {
          const { data } = await axios.get(
            healthmeApiUrl(`/products/details/${item.productId}`)
          );

          const trueNutrientValues = {
            "단백질": parseFloat(data.protein) || 0,
            "철분": parseFloat(data.iron) || 0,
            "칼슘": parseFloat(data.calcium) || 0,
            "비타민 D": parseFloat(data.vitamin_d) || 0,
            "식이섬유": parseFloat(data.dietary_fiber) || 0,
            "마그네슘": parseFloat(data.magnesium) || 0,
            "칼륨": parseFloat(data.potassium) || 0,
            "비오틴": parseFloat(data.biotin) || 0,
            "아르기닌": parseFloat(data.arginine) || 0,
            "아연": parseFloat(data.zinc) || 0
          };

          return {
            id: String(item.productId),
            name: data.name,
            price: data.salprice,
            originalPrice: data.price,
            img: data.image_url,
            qty: item.quantity ?? 1,
            selected: true,
            nutrientValues: trueNutrientValues,
          };
        })
      );
      setCart(enriched); // 장바구니 상태 업데이트

      // 장바구니 로드 후 초기 누적 영양소 및 점수 계산
      let currentAccumulated = { ...initialUserScores }; // 설문 결과를 기본으로 시작
      let currentScores = { ...initialUserScores }; // 설문 결과를 기본으로 시작

      enriched.forEach(cartItem => {
        for (let i = 0; i < cartItem.qty; i++) {
          for (const [nutrient, value] of Object.entries(cartItem.nutrientValues)) {
            currentAccumulated[nutrient] = (currentAccumulated[nutrient] || 0) + value;
            const scoreToAdd = convertNutrientValueToScore(nutrient, value);
            currentScores[nutrient] = (currentScores[nutrient] || 0) + scoreToAdd;
          }
        }
      });

      setAccumulatedNutrients(currentAccumulated);
      setUserNutrientScores(currentScores);

    } catch (error) {
      console.error("장바구니 불러오기 오류:", error);
    }
  };

  useEffect(() => {
    const loginUser = localStorage.getItem("loginUser");

    // 로그인 여부 확인 및 리디렉션
    if (!loginUser) {
      alert("이 페이지는 로그인 후 이용 가능합니다.");
      navigate("/login");
      return;
    }

    const userid = JSON.parse(loginUser).userid;

    // 비동기 함수로 묶어 내부에서 await를 사용할 수 있도록 합니다.
    const fetchData = async () => {
      try {
        // 1. 제품 데이터 로드
        const productsRes = await axios.get(healthmeApiUrl("/products/details"), { withCredentials: true });
        console.log(productsRes.data);

        if (!Array.isArray(productsRes.data)) {
          console.error("제품 응답 형식 오류: 배열이 아님");
          return;
        }

        // NutritionalPage.jsx 파일 내의 mappedProducts 생성 부분
        const mappedProducts = productsRes.data
          .map((item, idx) => {
            // productId가 무조건 유효한 숫자라고 가정합니다.
            // 만약 여전히 'Skipping product due to missing productId' 경고가 뜨면,
            // 이 가정(productId가 무조건 들어온다)이 틀린 것이므로 백엔드를 다시 확인해야 합니다.
            const productId = Number(item.product_id);
            // 혹시 모를 경우를 대비한 유효성 검사는 남겨두는 것이 좋습니다.
            // 백엔드에서 productId가 항상 유효하게 온다면 이 if 블록은 실행되지 않습니다.
            if (isNaN(productId) || productId === null || productId === undefined) {
              console.warn(`[심각] 백엔드에서 productId가 유효하지 않게 도착했습니다. 상품: ${item.name || 'Unnamed Product'} (원래 ID: ${item.productId})`);
              return null; // 유효하지 않은 상품은 필터링하여 제외
            }

            const nutrientsRaw = [
              formatNutrient('단백질', item.protein, 'g'),
              formatNutrient('철분', item.iron, 'mg'),
              formatNutrient('칼슘', item.calcium, 'mg'),
              formatNutrient('비타민 D', item.vitamin_d, 'µg'),
              formatNutrient('식이섬유', item.dietary_fiber, 'g'),
              formatNutrient('마그네슘', item.magnesium, 'mg'),
              formatNutrient('칼륨', item.potassium, 'mg'),
              formatNutrient('비오틴', item.biotin, 'µg'),
              formatNutrient('아르기닌', item.arginine, 'mg'),
              formatNutrient('아연', item.zinc, 'mg'),
            ].filter(Boolean);

            const trueNutrientValues = {
              "단백질": parseFloat(item.protein) || 0,
              "철분": parseFloat(item.iron) || 0,
              "칼슘": parseFloat(item.calcium) || 0,
              "비타민 D": parseFloat(item.vitamin_d) || 0,
              "식이섬유": parseFloat(item.dietary_fiber) || 0,
              "마그네슘": parseFloat(item.magnesium) || 0,
              "칼륨": parseFloat(item.potassium) || 0,
              "비오틴": parseFloat(item.biotin) || 0,
              "아르기닌": parseFloat(item.arginine) || 0,
              "아연": parseFloat(item.zinc) || 0
            };

            return {
              id: String(productId), // 여전히 `id`는 String으로 유지 (객체 키 사용 편의성)
              name: item.name,
              price: item.salprice,
              originalPrice: item.price,
              discount: Math.round((1 - item.salprice / item.price) * 100),
              img: item.image_url,
              nutrientsLeft: nutrientsRaw.slice(0, 5),
              nutrientsRight: nutrientsRaw.slice(5),
              sales_count: item.sales_count,
              nutrientValues: trueNutrientValues,
            };
          })
          .filter(Boolean); // 유효하지 않은 상품(null)은 걸러냅니다.
        setProducts(mappedProducts);

        // 2. 사용자 설문 점수 로드 (userNutrientScores 초기화)
        const surveyRes = await axios.get(healthmeApiUrl("/survey/scores"), {
          params: { userid },
          withCredentials: true
        });
        const initialUserScores = surveyRes.data;
        setUserNutrientScores(initialUserScores);

        const initialAccumulated = {};
        for (const nutrientName of Object.keys(initialUserScores)) {
          const score = initialUserScores[nutrientName];
          const maxScore = userNutrientMaxScores[nutrientName];
          const recommended = maxScoreMap[nutrientName];

          if (maxScore && recommended && maxScore > 0) {
            initialAccumulated[nutrientName] = (score / maxScore) * recommended;
          } else {
            initialAccumulated[nutrientName] = 0;
          }
        }
        setAccumulatedNutrients(initialAccumulated);
        console.log("초기 누적 영양소 (accumulatedNutrients):", initialAccumulated);

        // 3. 장바구니 데이터 로드 (설문 점수 로드 후에 실행하여 초기 점수를 반영)
        // loadCart 함수에 초기 설문 점수(initialUserScores)를 전달하여 장바구니 항목 합산 시 활용
        await loadCart(initialUserScores);

      } catch (error) {
        console.error("데이터 로드 중 오류 발생:", error);
        // 사용자에게 오류 알림 등 추가적인 에러 처리
      }
    };

    fetchData(); // 비동기 함수 호출

  }, []); // 의존성 배열은 빈 배열로 유지하여 컴포넌트 마운트 시 한 번만 실행되도록 합니다.

  useEffect(() => {
    if (Object.keys(userNutrientScores).length > 0 && Object.keys(accumulatedNutrients).length > 0) {
      summarize();
    }
  }, [userNutrientScores, accumulatedNutrients]);

  const toggleExpand = (productId) => {
    setExpandedItems((prev) => ({
      ...prev,
      [String(productId)]: !prev[String(productId)],
    }));
  };

  const addScoresFromProduct = (nutrientValues) => {
    setUserNutrientScores((prevScores) => {
      const updatedScores = { ...prevScores };
      for (const [nutrient, value] of Object.entries(nutrientValues)) {
        const scoreToAdd = convertNutrientValueToScore(nutrient, value);
        updatedScores[nutrient] = (updatedScores[nutrient] || 0) + scoreToAdd;
      }
      return updatedScores;
    });
  };

  const addNutrientsToAccumulated = (nutrientValues) => {
    setAccumulatedNutrients((prevAcc) => {
      const updatedAcc = { ...prevAcc };
      for (const [nutrient, value] of Object.entries(nutrientValues)) {
        updatedAcc[nutrient] = (updatedAcc[nutrient] || 0) + value;
      }
      return updatedAcc;
    });
  };

  const removeScoresFromProduct = (nutrientValues) => {
    setUserNutrientScores((prevScores) => {
      const updatedScores = { ...prevScores };
      for (const [nutrient, value] of Object.entries(nutrientValues)) {
        const scoreToRemove = convertNutrientValueToScore(nutrient, value);
        updatedScores[nutrient] = Math.max(0, (updatedScores[nutrient] || 0) - scoreToRemove);
      }
      return updatedScores;
    });
  };

  const removeNutrientsFromAccumulated = (nutrientValues) => {
    setAccumulatedNutrients((prevAcc) => {
      const updatedAcc = { ...prevAcc };
      for (const [nutrient, value] of Object.entries(nutrientValues)) {
        updatedAcc[nutrient] = Math.max(0, (updatedAcc[nutrient] || 0) - value);
      }
      return updatedAcc;
    });
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        addScoresFromProduct(product.nutrientValues);
        addNutrientsToAccumulated(product.nutrientValues);
        return prev.map((p) => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
      } else {
        addScoresFromProduct(product.nutrientValues);
        addNutrientsToAccumulated(product.nutrientValues);
        return [...prev, { ...product, qty: 1, selected: true }];
      }
    });
    console.log(product.id);
  };

  const toggleAll = (checked) => {
    setCart((prev) => prev.map((it) => ({ ...it, selected: checked })));
  };

  const toggleOne = (idx) => {
    setCart((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, selected: !it.selected } : it))
    );
  };

  const qty = (idx, diff) => {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i === idx) {
          const newQty = Math.max(1, item.qty + diff);
          if (diff > 0) {
            addScoresFromProduct(item.nutrientValues);
            addNutrientsToAccumulated(item.nutrientValues);
          } else if (diff < 0 && item.qty > 1) {
            removeScoresFromProduct(item.nutrientValues);
            removeNutrientsFromAccumulated(item.nutrientValues);
          }
          return { ...item, qty: newQty };
        }
        return item;
      })
    );
  };

  const deleteSelected = () => {
    setCart((prev) => {
      const itemsToDelete = prev.filter((it) => it.selected);
      itemsToDelete.forEach(item => {
        for (let i = 0; i < item.qty; i++) {
          removeScoresFromProduct(item.nutrientValues);
          removeNutrientsFromAccumulated(item.nutrientValues);
        }
      });
      return prev.filter((it) => !it.selected);
    });
  };

  const selected = cart.filter((c) => c.selected);
  const totalPrice = selected.reduce((sum, v) => sum + v.price * v.qty, 0);

  const sortProducts = (order) => {
    let sorted = [];
    if (order === 'asc' || order === 'desc') {
      sorted = [...products].sort((a, b) =>
        order === 'asc' ? a.price - b.price : b.price - a.price
      );
    } else if (order === 'sales') {
      sorted = [...products].sort((a, b) => b.sales_count - a.sales_count);
    } else if (order === 'discount') {
      sorted = [...products].sort((a, b) => b.discount - a.discount);
    }
    setProducts(sorted);
  };

  const sortByNutrient = (nutrientName) => {
    const sorted = [...products].sort((a, b) => {
      const aValue = a.nutrientValues?.[nutrientName] ?? 0;
      const bValue = b.nutrientValues?.[nutrientName] ?? 0;
      return bValue - aValue;
    });
    setProducts(sorted);
  };

  // 새로 추가된 goToDetail 함수
  const goToDetail = (product) => {
    console.log("Product clicked for detail:", product);
    // product.id가 이미 string으로 매핑되어 있으므로, product.id를 사용합니다.
    if (!product?.id) {
      alert('상품 ID가 없습니다!');
      return;
    }
    navigate(`/details/${product.id}`); // product.id를 사용
  };

  return (
    <div className="nutritional-container">
      <aside className="nutritional-sidebar">
        <div className="nutritional-contents-main">
          <h3 className="nutrition-section-title">영양소 정보</h3>
          {Object.keys(resultMap).length > 0 ? (
            Object.keys(resultMap).map((nutrientName, idx) => {
              const result = resultMap[nutrientName];
              return (
                <CardBar
                  key={idx}
                  name={nutrientName}
                  percent={result.percent}
                  displayValue={result.displayValue}
                  unit={result.unit}
                  onClick={() => {
                    setSelectedNutrient({
                      name: nutrientName,
                      value: result.displayValue,
                    });
                    sortByNutrient(nutrientName);
                  }}
                />
              );
            })
          ) : (
            <p></p>
          )}
        </div>

        <section className="cart-section">
          <span>장바구니</span>
          <hr />
          <div className="cart-header">
            <div className="cart-header-left">
              <input
                type="checkbox"
                className="custom-checkbox"
                checked={cart.length > 0 && selected.length === cart.length}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              <label>
                전체선택 ({selected.length}/{cart.length})
              </label>
            </div>
            <button onClick={deleteSelected}>선택삭제</button>
          </div>
          <hr />
          <ul className="nutritional-cart-items">
            {cart.map((item, idx) => (
              <li key={`cart-${item.id}-${idx}`}>
                <div className="nutritional-cart-line">
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={item.selected}
                    onChange={() => toggleOne(idx)}
                  />
                  <div className="nutritional-cart-desc">
                    <div className="nutritional-cart-item-name">{item.name}</div>
                    <div className="nutritional-cart-item-price">
                      {item.price.toLocaleString()}원
                    </div>
                    <div className="nutritional-cart-item-quantity">
                      <button onClick={() => qty(idx, -1)}>-</button>
                      <span>{item.qty}</span>
                      <button onClick={() => qty(idx, +1)}>+</button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="cart-footer">
            총 합계 : <span>{totalPrice.toLocaleString()}원</span>
          </div>
          <div className="cart-footer-button">
            <button onClick={saveCartToServer}>장바구니 담기</button>
          </div>
        </section>
      </aside>

      <main className="nutritional_main">
        <div className="nutritional-banner">
          <img
            className="nutritional-banner-img"
            src={process.env.PUBLIC_URL + '/img/main/Banner2.jpg'}
            alt="배너"
          />
        </div>

        <ul className="nutritional_low_content">
          {[
            { label: '판매량순', type: 'sales' },
            { label: '할인율순', type: 'discount' },
            { label: '낮은 가격순', type: 'asc' },
            { label: '높은 가격순', type: 'desc' },
          ].flatMap(({ label, type }, i, arr) => {
            const items = [
              <li key={`sort-${label}`}>
                <button className="sort-btn" onClick={() => sortProducts(type)}>
                  {label}
                </button>
              </li>,
            ];
            if (i < arr.length - 1) {
              items.push(<li key={`divider-${i}`}>|</li>);
            }
            return items;
          })}
        </ul>

        <ul className="nutritional_content">
          {products.map((p, idx) => (
            <li key={`product-${p.id}-${idx}`} className="nutritional_item_store">
              {/* 이미지 클릭 시 상세 페이지로 이동 */}
              <div className="nutritional_item_img" onClick={() => goToDetail(p)}>
                <img src={p.img} alt={p.name} />
              </div>
              {/* 담기 버튼 클릭 시 장바구니에 담기 */}
              <div className="nutritional_item_add" onClick={() => addToCart(p)}>
                <i className="fas fa-cart-shopping" /> 담기
              </div>
              <div className="nutritional_item_name">{p.name}</div>
              <div className="item_Nutritional_ingredients">
                <button
                  className="nutrition-more-button"
                  onClick={() => toggleExpand(p.id)}
                >
                  <span>{expandedItems[p.id] ? '접기' : '영양정보 더보기'}</span>
                  <span className="material-symbols-outlined">
                    {expandedItems[p.id] ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {expandedItems[p.id] && (
                  <div className="nutrient-columns">
                    <ul className="nutrient-column">
                      {p.nutrientsLeft.map((n, i) => (
                        <li key={`left-${p.id}-${i}`}>
                          <span>{n.label}</span>
                          <span>{n.value} {n.unit}</span>
                        </li>
                      ))}
                    </ul>
                    <ul className="nutrient-column">
                      {p.nutrientsRight.map((n, i) => (
                        <li key={`right-${p.id}-${i}`}>
                          <span>{n.label}</span>
                          <span>{n.value} {n.unit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="nutritional_item_price">
                <span className="nutritional_discount">{p.discount}%</span>
                <span className="nutritional_price">{p.price.toLocaleString()}원~</span>
              </div>
              <div className="nutritional_item_review">
                <i className="fa-regular fa-comment-dots"></i>
                <span>{p.sales_count.toLocaleString()}+</span>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
