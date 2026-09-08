package com.example.healthme.domain.user.controller;

import com.example.healthme.domain.user.repository.UserRepository;
import com.example.healthme.domain.user.dto.JoinRequestDto;
import com.example.healthme.domain.user.dto.LoginRequestDto;
import com.example.healthme.domain.user.dto.UserResponseDto;
import com.example.healthme.domain.user.entity.User;
import com.example.healthme.domain.user.service.UserService;
import com.example.healthme.global.config.auth.jwt.TokenInfo;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/healthme/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final UserRepository userRepository;
    // 회원가입
    @PostMapping("/join")
    public ResponseEntity<?> join(@RequestBody @Valid JoinRequestDto dto, BindingResult bindingResult) {
        // 1. 유효성 검사 실패 시
        if (bindingResult.hasErrors()) {
            Map<String, String> errorMap = new HashMap<>();
            bindingResult.getFieldErrors().forEach(error -> {
                errorMap.put(error.getField(), error.getDefaultMessage());
            });
            return ResponseEntity.badRequest().body(errorMap);
        }

        // 2. 비밀번호 일치 여부 확인
        if (!dto.getPassword().equals(dto.getPassword2())) {
            Map<String, String> errorMap = new HashMap<>();
            errorMap.put("password2", "비밀번호가 일치하지 않습니다.");
            return ResponseEntity.badRequest().body(errorMap);
        }

        // 3. 아이디 중복 여부
        try {
            userService.join(dto);
            return ResponseEntity.ok(Collections.singletonMap("message", "회원가입 성공"));
        } catch (DataIntegrityViolationException e) {
            Map<String, String> errorMap = new HashMap<>();
            errorMap.put("userid", "이미 존재하는 아이디입니다.");
            return ResponseEntity.status(409).body(errorMap);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Collections.singletonMap("error", "회원가입 중 서버 오류가 발생했습니다."));
        }
    }
    
    
    // 로그인 중복확인
    @GetMapping("/check")
    public Map<String, Boolean> checkUserid(@RequestParam String userid) {
        boolean exists = userService.isUseridExists(userid);
        return Collections.singletonMap("exists", exists);
    }

    // 로그인
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @Valid LoginRequestDto dto, BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            String errorMessage = bindingResult.getFieldError().getDefaultMessage();
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", errorMessage));
        }

        try {
            // 1. JWT 발급
            TokenInfo tokenInfo = userService.login(dto);

            // 2. 사용자 정보 조회 (userService.login은 userDto 반환 안 하니까 여기서 따로 불러옴)
            User user = userRepository.findByUserid(dto.getUserid())
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
            UserResponseDto userResponseDto = UserResponseDto.fromEntity(user);

            // 3. 응답 조립
            Map<String, Object> result = new HashMap<>();
            result.put("accessToken", tokenInfo.getAccessToken());
            result.put("refreshToken", tokenInfo.getRefreshToken());
            result.put("userInfo", userResponseDto);

            return ResponseEntity.ok(result);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    // 아이디 찾기
    @PostMapping("/find-username")
    public ResponseEntity<?> findUsername(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String userid = userService.findUseridByName(username);

        if (userid != null) {
            return ResponseEntity.ok(userid);
        } else {
            return ResponseEntity.status(404).body("일치하는 정보가 없습니다.");
        }
    }

    // 비밀번호 재설정
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> request) {
        String username = request.get("username"); // 사용자 이름
        String userid = request.get("userid");     // 이메일 (아이디)

        try {
            userService.sendTemporaryPassword(username, userid);
            return ResponseEntity.ok("임시 비밀번호 전송 완료");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body("정보가 일치하지 않습니다.");
        }
    }

    // 로그아웃 - 쿠키 삭제용
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        // 2. HttpOnly 쿠키 삭제 (accessToken + refreshToken)
        Cookie accessTokenCookie = new Cookie("accessToken", null);
        accessTokenCookie.setHttpOnly(true);
        accessTokenCookie.setSecure(true);
        accessTokenCookie.setPath("/");
        accessTokenCookie.setMaxAge(0);  // 즉시 삭제

        Cookie refreshTokenCookie = new Cookie("refreshToken", null);
        refreshTokenCookie.setHttpOnly(true);
        refreshTokenCookie.setSecure(true);
        refreshTokenCookie.setPath("/");
        refreshTokenCookie.setMaxAge(0);  // 즉시 삭제

        response.addCookie(accessTokenCookie);
        response.addCookie(refreshTokenCookie);

        return ResponseEntity.ok(Collections.singletonMap("message", "로그아웃 완료"));
    }
}
