import React, { useEffect, useState } from "react";
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Button,
  Box,
  Pagination,
} from "@mui/material";
import axios from "axios";
import ProductRegisterDialog from "./ProductRegisterDialog";
import ProductUpdate from "./ProductUpdate";
import { apiUrl } from "config/api";

export default function ProductPage() {
  // DB조회와 상품 등록후 재조회
  const [products, setPrducts] = useState([]); // db에 저장된 등록된 상품

  // 페이지네이션
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 제품등록 모달창
  const [open, setOpen] = useState(false);
  const [update, setUpdate] = useState(false); // 제품등록 후 다시 db를 가져오기 위한 트리거

  // 제품 수정 모달창
  const [updateProduct, setUpdateProduct] = useState([]);
  const [updateOpen, setUpdateOpen] = useState(false);

  const [checkItems, setCheckItems] = useState([]);

  // 로직 함수

  // 페이지 버튼 클릭 이벤트 정의
  const handlePageChange = (event, value) => {
    // event : 클릭 이벤트 객체, value : 사용자가 선택한 페이지 번호(1부터 시작) MUI의 Pagination 컴포넌트가 넘겨주는 매개변수이다.
    console.log(event);
    console.log(value);
    setPage(value);
  };
  // 제품등록 이벤트 정의
  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const onsubmit = () => {
    window.alert("제품이 등록 되었습니다.");
    setPage(1);
    setUpdate((state) => !state);
    // setPage(1)	사용자가 1페이지로 이동하도록 함 (신규 등록된 제품이 최신순 맨 앞이기 때문)
    // setUpdate(state => !state)	현재 page가 이미 1일 때도 목록을 강제로 다시 불러오도록 유도
  };

  // 제품 수정 이벤트 정의
  const UpdatehandleClose = () => {
    setUpdateOpen(false);
  };
  const handleUpdate = (product) => {
    setUpdateProduct(product); // 해당 상품 데이터 저장하기
    setUpdateOpen(true); // 모달창 열기
  };
  const updatesucess = () => {
    // 수정하기 버튼을 누르면 실행
    window.alert("제품이 수정되었습니다.");
    setUpdate((state) => !state);
  };

  // 삭제하기 체크박스 선택
  const AllCheck = (checked) => {
    if (checked) {
      const product_idArray = [];
      products.forEach((el) => product_idArray.push(el.product_id));
      setCheckItems(product_idArray);
    } else {
      setCheckItems([]);
    }
  };

  const subCheckBox = (checked, product_id) => {
    if (checked) {
      setCheckItems((prev) => [...prev, product_id]);
    } else {
      setCheckItems(checkItems.filter((el) => el !== product_id));
    }
  };

  // 삭제하기 api
  const handledelete = async () => {
    const delteBoolean = window.confirm("정말로 삭제하시겠습니까?");
    if (delteBoolean) {
      await axios.post(apiUrl("/product/delete"), checkItems, {
        withCredentials: true,
      });
      window.alert("삭제 완료되었습니다.");
      setUpdate((prev) => !prev); // 목록 새로고침
    } else {
      setCheckItems([]); // 체크된 항목 초기화
      return;
    }
  };

  // useEffect
  // useEffect(() => {
  //   const fetchData = async () => {
  //     try {
  //       const list = await axios.get("/product/dbpct");
  //       console.log("전체데이터", list);
  //       setPrducts(list.data);
  //     } catch (error) {
  //       console.log("조회되지 않습니다.", error);
  //     }
  //   };
  //   fetchData();
  // }, [update]);
  // // 인자값으로 빈 배열을 넣는 경우 컴포넌트가 처음 렌더링 될때(mount 될 때)만 실행된다.

  // 페이지네이션
  useEffect(() => {
    const pagemove = async () => {
      const PageContent = await axios.get(
        apiUrl(`/product/pagination?page=${page - 1}&size=10`),
        { withCredentials: true }
      );
      // size는 한페이지에 몇개를 보여줄지 , page-1은 백엔드에서는 0부터 세니까 개발자 편하라고 하는거다.
      console.log("페이지네이션한 데이터", PageContent);
      console.log("페이지네이션한 데이터컨텐츠", PageContent.data.content);
      setPrducts(PageContent.data.content);
      setTotalPages(PageContent.data.totalPages);
    };

    pagemove();
  }, [page, update]);

  return (
    <Box>
      <Typography variant="h6" fontWeight="bold">
        상품 관리 페이지입니다
      </Typography>
      <TableContainer>
        <Table>
          {/*실제 테이블을 감싸는 컴포넌트 */}
          <TableHead>
            {/* thead 역할을 하는 컴포넌트 */}
            <TableRow>
              {/* tr 역할을 하는 컴포넌트 */}
              <TableCell padding="checkbox">
                {/* th, td 역할( TableHead안에서는 th 역할 TableBody안에서는 td 역할) */}
                <Checkbox
                  onChange={(e) => AllCheck(e.target.checked)}
                  checked={checkItems.length === products.length ? true : false}
                ></Checkbox>
              </TableCell>
              <TableCell>No</TableCell>
              <TableCell>카테고리</TableCell>
              <TableCell>상품명</TableCell>
              <TableCell>정가</TableCell>
              <TableCell>최종 판매가</TableCell>
              <TableCell>할인율</TableCell>
              <TableCell>재고</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/*map()으로 반복 렌더링 */}
            {products.map((product) => (
              <TableRow key={product.product_id}>
                {/*key는 React가 어떤 항목이 바뀌었는지 정확히 알게 도와주는 고유 식별자입니다. */}
                <TableCell padding="checkbox">
                  <Checkbox
                    onChange={(e) =>
                      subCheckBox(e.target.checked, product.product_id)
                    }
                    checked={
                      checkItems.includes(product.product_id) ? true : false
                    }
                  ></Checkbox>
                </TableCell>
                <TableCell>{product.product_id}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.price}</TableCell>
                <TableCell>{product.salprice}</TableCell>
                <TableCell>
                  {Math.round((1 - product.salprice / product.price) * 100)}%
                </TableCell>

                <TableCell>{product.amount}</TableCell>
                <TableCell>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      handleUpdate(product);
                    }}
                  >
                    수정하기
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {/* sx : style,  1 : 8px  */}

      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <Pagination
          count={totalPages}
          page={page}
          onChange={handlePageChange}
          color="primary"
          shape="rounded"
          size="large"
        />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2, gap: 2 }}>
        <Button
          variant="outlined"
          color="secondary"
          sx={{ mt: 2 }}
          onClick={handledelete}
        >
          삭제
        </Button>
        <Button
          variant="contained"
          color="secondary"
          sx={{ mt: 2 }}
          onClick={handleClickOpen}
        >
          제품등록
        </Button>
      </Box>
      {/* 제품 등록하기 */}
      <ProductRegisterDialog
        open={open}
        onClose={handleClose}
        onSubmit={onsubmit}
      ></ProductRegisterDialog>

      {/* 제품 수정하기 */}
      <ProductUpdate // ProductUpdate 컴포넌트를 찾는다(사용한 컴포넌트 이름).
        open={updateOpen}
        onClose={UpdatehandleClose}
        product={updateProduct}
        updatesucess={updatesucess}
      ></ProductUpdate>
    </Box>
  );
}
