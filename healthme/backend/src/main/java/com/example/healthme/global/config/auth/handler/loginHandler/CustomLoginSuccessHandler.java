package com.example.healthme.global.config.auth.handler.loginHandler;

import com.example.healthme.domain.user.dto.UserDto;
import com.example.healthme.global.config.auth.jwt.JwtProperties;
import com.example.healthme.global.config.auth.jwt.JwtTokenProvider;
import com.example.healthme.global.config.auth.jwt.TokenInfo;
import com.example.healthme.global.config.auth.principal.PrincipalDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class CustomLoginSuccessHandler implements AuthenticationSuccessHandler {

	private final JwtTokenProvider jwtTokenProvider;

	@Override
	public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
										Authentication authentication) throws IOException {

		log.info("로그인 성공, JWT 발급 시작");

		// 토큰 생성
		TokenInfo tokenInfo = jwtTokenProvider.generateToken(authentication);

		// 로그인 사용자 정보
		PrincipalDetails principalDetails = (PrincipalDetails) authentication.getPrincipal();
		UserDto userDto = principalDetails.getUserDto();

		// 쿠키에 refreshToken 저장
		Cookie refreshTokenCookie = new Cookie(JwtProperties.REFRESH_TOKEN_COOKIE_NAME, tokenInfo.getRefreshToken());
		refreshTokenCookie.setHttpOnly(true);
		refreshTokenCookie.setSecure(true);
		refreshTokenCookie.setPath("/");
		refreshTokenCookie.setMaxAge(JwtProperties.REFRESH_TOKEN_EXPIRATION_TIME / 1000);
		response.addCookie(refreshTokenCookie);

		log.info("[refreshToken 쿠키 추가됨] 값: {}", tokenInfo.getRefreshToken());

		// 쿠키에 accessToken 저장 (선택적, accessToken은 JS에서 직접 써도 됨)
		Cookie accessTokenCookie = new Cookie(JwtProperties.ACCESS_TOKEN_COOKIE_NAME, tokenInfo.getAccessToken());
		accessTokenCookie.setHttpOnly(true);
		accessTokenCookie.setSecure(true);
		accessTokenCookie.setPath("/");
		accessTokenCookie.setMaxAge(JwtProperties.ACCESS_TOKEN_EXPIRATION_TIME / 1000);
		response.addCookie(accessTokenCookie);

		// JSON 응답 설정
		response.setContentType("application/json");
		response.setCharacterEncoding("UTF-8");

		// 응답 바디 구성 (accessToken은 필요 시 프론트에서 저장)
		ObjectMapper objectMapper = new ObjectMapper();
		String responseJson = objectMapper.writeValueAsString(
				new LoginResponse(tokenInfo.getAccessToken(), userDto)
		);
		response.getWriter().write(responseJson);
	}

	// 로그인 응답용 DTO
	record LoginResponse(String accessToken, UserDto userInfo) {}

}
