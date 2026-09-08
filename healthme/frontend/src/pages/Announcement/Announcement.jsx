import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { apiUrl } from "config/api";

import "static/css/common/common.css";
import "static/css/pages/Announcement.css";

export default function Announcement() {
  const [category, setCategory] = useState("전체");
  const [notices, setNotices] = useState([]);
  const [detail, setDetail] = useState(null); // 단건 조회 결과
  const [open, setOpen] = useState(false); // Dialog open 여부

  const faqList = [
    {
      id: 101,
      question: "배송은 얼마나 걸리나요?",
      answer: "결제 완료 후 영업일 기준 2~3일 내에 받아보실 수 있습니다.",
      createdDate: "2025-04-01",
    },
    {
      id: 102,
      question: "교환·환불 절차가 궁금해요?",
      answer:
        "마이페이지 > 주문 내역에서 교환·환불 신청 버튼을 눌러 주세요.\n이미 배송이 시작된 경우 고객센터(1234-5678)로 문의해 주세요.",
      createdDate: "2025-04-02",
    },
    {
      id: 103,
      question: "주문 후 주소를 변경할 수 있나요?",
      answer:
        "배송 준비 전 단계까지는 마이페이지에서 직접 주소를 수정할 수 있습니다.\n이미 배송 준비가 시작되었다면 고객센터로 연락해 주세요.",
      createdDate: "2025-04-03",
    },
    {
      id: 104,
      question: "결제 수단은 어떤 것이 있나요?",
      answer:
        "신용·체크카드, 계좌이체, 카카오페이, 네이버페이, 무통장입금이 가능합니다.",
      createdDate: "2025-04-04",
    },
    {
      id: 105,
      question: "적립금(포인트)은 어떻게 사용하나요?",
      answer:
        "결제 단계에서 ‘적립금 사용’란에 보유 포인트를 입력하면 즉시 할인됩니다.",
      createdDate: "2025-04-05",
    },
    {
      id: 106,
      question: "회원 등급은 어떻게 올라가나요?",
      answer:
        "최근 6개월 누적 결제 금액에 따라 매월 1일 등급이 자동 조정됩니다.\n등급별 혜택은 ‘멤버십 안내’ 공지사항을 참고해 주세요.",
      createdDate: "2025-04-06",
    },
    {
      id: 107,
      question: "비회원으로 주문이 가능한가요?",
      answer:
        "아니요. 비회원 주문은 지원하지 않습니다.\n서비스 이용을 위해 간편 회원가입(네이버·카카오·이메일) 후 주문해 주세요.",
      createdDate: "2025-04-07",
    },
  ];

  useEffect(() => {
    (async () => {
      try {
        if (category === "자주하는 질문") {
          setNotices(faqList);
        } else {
          let query =
            category === "전체"
              ? ""
              : "?category=" + encodeURIComponent(category);
          const res = await axios.get(apiUrl("/api/notices" + query), {
            withCredentials: true,
          });
          setNotices(
            res.data.map((n) => ({
              ...n,
              category: n.category || "",
              title: n.title || "",
            }))
          );
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [category]);

  const formatDate = (iso) => (iso || "").slice(2, 10).replace(/-/g, ".");
  const tabs = ["전체", "공지사항", "자주하는 질문"];

  const handleOpenDetail = async (id) => {
    try {
      const res = await axios.get(apiUrl("/api/notices/" + id), {
        withCredentials: true,
      });
      setDetail(res.data);
      setOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="announce-wrap">
      <h1>고객센터</h1>

      {/* 탭 네비 */}
      <div className="announce-nav">
        {tabs.map((t) => (
          <a
            key={t}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setCategory(t);
            }}
          >
            <div
              className="nav_btn"
              style={
                t === category
                  ? { fontWeight: 700, borderBottom: "2px solid #000" }
                  : {}
              }
            >
              {t}
            </div>
          </a>
        ))}
      </div>

      <div className="announce-sum">총 {notices.length}개</div>

      {/* 자주하는 질문 */}
      {category === "자주하는 질문" &&
        notices.map((faq, idx) => (
          <Accordion
            key={faq.id}
            sx={{
              mb: 1,
              mt: idx === 0 ? 2 : 0, // 첫 번째 항목만 위로 띄움 (예: 16px)
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ width: 30 }}>{idx + 1}</Typography>
              <Typography sx={{ ml: 2, flex: 1 }}>{faq.question}</Typography>
              <Typography sx={{ fontSize: 14 }}>
                {formatDate(faq.createdDate)}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography whiteSpace="pre-wrap">{faq.answer}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}

      {/* 공지·이벤트 목록 */}
      {category !== "자주하는 질문" &&
        notices.map((n, i) => (
          <div
            className="announce-item"
            key={n.id}
            onClick={() => handleOpenDetail(n.id)}
          >
            <div className="num">{i + 1}</div>

            <div className="title">
              {(n.category || "").includes("이벤트") && (
                <span className="event_mark">이벤트공지</span>
              )}
              {(n.title || "").includes("당첨") && (
                <span className="winner_mark">당첨자발표</span>
              )}
              {n.title}
            </div>

            <div className="date">{formatDate(n.createdDate)}</div>
          </div>
        ))}

      {detail && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{detail.title}</DialogTitle>
          <DialogContent dividers>
            <Typography variant="subtitle2" gutterBottom>
              [{detail.category}] · {formatDate(detail.createdDate)}
            </Typography>
            <Typography whiteSpace="pre-wrap">{detail.content}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>닫기</Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
