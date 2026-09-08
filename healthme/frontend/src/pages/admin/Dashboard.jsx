import React, { useEffect, useState } from "react";
import { Typography, Box, Stack } from "@mui/material";
import {
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import InfoIcon from "@mui/icons-material/Info";
import DoneIcon from "@mui/icons-material/Done";
import CancelIcon from "@mui/icons-material/Cancel";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import axios from "axios";
import { apiUrl, healthmeApiUrl } from "config/api";

const COLORS = [
  "#8884d8",
  "#8dd1e1",
  "#82ca9d",
  "#ffc658",
  "#ff8042",
  "#ffbb28",
];

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [canceledCount, setCanceledCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const res1 = await axios.get(apiUrl("/mypage/getbuy"), { withCredentials: true });
      const res2 = await axios.get(healthmeApiUrl("/products"));
      setOrders(res1.data);
      setProducts(res2.data);
      processData(res1.data, res2.data);
    };
    fetchData();
  }, []);

  const processData = (orders, products) => {
    const productMap = {};
    products.forEach((p) => {
      productMap[p.productId] = p;
    });

    let categoryCount = {};
    let dateMap = {};
    let total = 0;
    let complete = 0;
    let cancel = 0;

    orders.forEach((order) => {
      if (order.isCompleted) complete++;
      if (order.isCanceled) cancel++;
      total += order.totalPrice;

      const date = new Date(order.orderDate).toLocaleDateString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
      });
      let sum = 0;

      order.items.forEach((item) => {
        const product = productMap[item.productId];
        if (!product) return;

        const category = product.category || "기타";
        categoryCount[category] =
          (categoryCount[category] || 0) + item.quantity;

        sum += item.unitPrice * item.quantity;
      });

      dateMap[date] = (dateMap[date] || 0) + sum;
    });

    const pie = Object.entries(categoryCount).map(([key, val]) => ({
      name: key,
      value: val,
    }));
    setCategoryData(pie);

    const sortedDates = Object.keys(dateMap).sort();
    const bar = sortedDates.map((d) => ({ date: d, 금액: dateMap[d] }));
    setDailySales(bar);

    setTotalRevenue(total);
    setCompletedCount(complete);
    setCanceledCount(cancel);
  };

  return (
    <Box sx={{ mt: "45px", px: 4, py: 3 }}>
      <Box
        sx={{
          backgroundColor: "#fff",
          borderRadius: 2,
          boxShadow: 2,
          p: 4,
        }}
      >
        <Box display="flex" justifyContent="space-between" gap={4} mb={6}>
          <Box flex={1}>
            <Typography variant="h6" gutterBottom>
              이번 달 거래 현황
            </Typography>
            <Stack spacing={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <InfoIcon /> 거래 수 <strong>{orders.length}개</strong>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <CancelIcon /> 거래 취소 수 <strong>{canceledCount}개</strong>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <DoneIcon /> 거래 확정 수 <strong>{completedCount}개</strong>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <AttachMoneyIcon /> 총 매출 금액{" "}
                <strong>{totalRevenue.toLocaleString()}원</strong>
              </Box>
            </Stack>
          </Box>

          <Box flex={1}>
            <Typography variant="h6" gutterBottom>
              거래 카테고리 통계
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                >
                  {categoryData.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        <Box display="flex" justifyContent="space-between" gap={4}>
          <Box flex={1}>
            <Typography variant="h6" gutterBottom>
              현재 상품 현황
            </Typography>
            <Stack spacing={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <ShoppingCartIcon /> 총 상품 수{" "}
                <strong>{products.length}개</strong>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <ReportProblemIcon /> 품절 상품 수 <strong>5개</strong>
              </Box>
            </Stack>
          </Box>

          <Box flex={1}>
            <Typography variant="h6" gutterBottom>
              이번 주 거래 금액 통계
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={dailySales}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="금액" name="매출" barSize={30} fill="#ffc658" />
                <Line
                  type="monotone"
                  dataKey="금액"
                  name="추세선"
                  stroke="#ff3333"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
