import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Paper,
  Typography,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  MenuItem,
  DialogActions,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { apiUrl } from "config/api";

// 모달창
function NoticeModal({ open, onClose, onSave, init }) {
  const [form, setForm] = useState(init);

  // init 값이 바뀌면 폼 초기화
  useEffect(() => {
    setForm(init);
  }, [init]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    await onSave(form);
    window.alert(form.id ? "수정되었습니다." : "등록되었습니다.");
    // form.id가 존재한다면 이미 있다는거니까 수정되었습니다. 없으면 등록되었습니다. 출력
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{form.id ? "공지 수정" : "새 공지 등록"}</DialogTitle>
      <DialogContent dividers>
        <TextField
          select
          label="분류"
          name="category"
          fullWidth
          value={form.category}
          onChange={handleChange}
          sx={{ mb: 2 }}
        >
          {["공지사항", "이벤트공지", "FAQ"].map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="제목"
          name="title"
          fullWidth
          value={form.title}
          onChange={handleChange}
          sx={{ mb: 2 }}
        />
        <TextField
          label="내용"
          name="content"
          multiline
          rows={8}
          fullWidth
          value={form.content}
          onChange={handleChange}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSubmit}>
          {form.id ? "수정" : "등록"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// 메인 페이지
export default function AdminNoticePage() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);

  // 모달 제어
  const empty = { category: "공지사항", title: "", content: "" };
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null → 신규, obj → 수정

  const fetchRows = () =>
    axios
      .get(apiUrl("/api/notices"), { withCredentials: true })
      .then((r) => setRows(r.data))
      .catch((e) => console.error("공지 조회 실패", e));

  const createRow = (dto) =>
    axios
      .post(apiUrl("/api/admin/notices"), dto, { withCredentials: true })

      .then(fetchRows);

  const updateRow = (dto) =>
    axios
      .put(apiUrl(`/api/admin/notices/${dto.id}`), dto, { withCredentials: true })
      .then(fetchRows);

  const deleteRows = async () => {
    await Promise.all(
      selected.map((id) =>
        axios.delete(apiUrl(`/api/admin/notices/${id}`), { withCredentials: true })
      )
    );
    setSelected([]);
    fetchRows();
  };

  // 최초 조회 ──
  useEffect(() => {
    fetchRows();
  }, []);

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" mb={2}>
        공지 관리
      </Typography>

      {/* 상단 버튼 */}
      <Button
        variant="contained"
        sx={{ mr: 2 }}
        onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}
      >
        + 새 공지
      </Button>
      <IconButton
        disabled={!selected.length}
        onClick={deleteRows}
        color="error"
      >
        <DeleteIcon />
      </IconButton>

      {/* 목록 */}
      <Table size="small" sx={{ mt: 2 }}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            <TableCell>번호</TableCell>
            <TableCell>분류</TableCell>
            <TableCell>제목</TableCell>
            <TableCell>작성일</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, idx) => {
            const checked = selected.includes(row.id);
            const toggle = () =>
              setSelected((prev) =>
                checked ? prev.filter((v) => v !== row.id) : [...prev, row.id]
              );

            return (
              <TableRow
                key={row.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={(e) => {
                  if (e.target.type === "checkbox") return;
                  setEditing(row);
                  setModalOpen(true);
                }}
              >
                <TableCell padding="checkbox">
                  <Checkbox checked={checked} onChange={toggle} />
                </TableCell>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>{row.category}</TableCell>
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.createdDate.slice(0, 10)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* 등록/수정 모달 */}
      <NoticeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={editing ? updateRow : createRow}
        init={editing || empty}
      />
    </Paper>
  );
}
