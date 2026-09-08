package com.example.healthme.domain.admin.controller;

import com.example.healthme.domain.admin.dto.TranscationStatusDto;
import com.example.healthme.domain.admin.service.TranscationService;
import com.example.healthme.domain.approval.dto.ApprovalOrderResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/transactions")
@RequiredArgsConstructor
public class TranscationController {

    private final TranscationService transcationService;

    // 수정
    @PostMapping("/status")
    public ResponseEntity<String> updateStatus(@RequestBody TranscationStatusDto dto) {
        try {
            boolean ok = transcationService.updateTranscation(dto);

            return ok
                    ? ResponseEntity.ok("수정되었습니다.")
                    : ResponseEntity.status(HttpStatus.NOT_FOUND).body("수정에 실패하였습니다.");
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    // 이름 검색
    @GetMapping("/search/data")
    public Page<ApprovalOrderResponseDto> searchData(@RequestParam String searchText,
                                                     @RequestParam int page,
                                                     @RequestParam int size) {
        return transcationService.selectByUserName(searchText, page, size);
    }

    // 반품 환불요청
    @PostMapping("/refundReturn")
    public ResponseEntity<String> refundOrReturn(@RequestBody TranscationStatusDto dto,
                                                 @RequestParam("type") String type) {
        try {
            boolean ok = transcationService.refundOrReturn(dto, type);

            return ok
                    ? ResponseEntity.ok(type + " 되었습니다.")
                    : ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(type + "에 실패하였습니다.");
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }
}
