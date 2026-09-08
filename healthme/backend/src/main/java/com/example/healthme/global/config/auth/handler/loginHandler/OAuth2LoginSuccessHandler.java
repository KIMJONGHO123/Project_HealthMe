package com.example.healthme.global.config.auth.handler.loginHandler;

import com.example.healthme.global.config.auth.jwt.JwtTokenProvider;
import com.example.healthme.global.config.auth.jwt.TokenInfo;
import com.example.healthme.global.config.auth.principal.PrincipalDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final JwtTokenProvider jwtTokenProvider;
    private final ObjectMapper objectMapper;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        // 1. 토큰 생성
        TokenInfo tokenInfo = jwtTokenProvider.generateToken(authentication);

        // 2. 쿠키에 토큰 저장
        Cookie accessTokenCookie = new Cookie("accessToken", tokenInfo.getAccessToken());
        accessTokenCookie.setPath("/");
        accessTokenCookie.setHttpOnly(true);
        accessTokenCookie.setSecure(true);
        accessTokenCookie.setMaxAge(60 * 60); // 1시간

        Cookie refreshTokenCookie = new Cookie("refreshToken", tokenInfo.getRefreshToken());
        refreshTokenCookie.setPath("/");
        refreshTokenCookie.setHttpOnly(true);
        refreshTokenCookie.setSecure(true);
        refreshTokenCookie.setMaxAge(7 * 24 * 60 * 60); // 7일

        response.addCookie(accessTokenCookie);
        response.addCookie(refreshTokenCookie);

        //3. 사용자 정보(loginUser)를 쿼리스트링에 포함하여 프론트로 전달
        PrincipalDetails principal = (PrincipalDetails) authentication.getPrincipal();

        String loginUser = URLEncoder.encode(
                objectMapper.writeValueAsString(principal.getUserDto()),
                StandardCharsets.UTF_8
        );

        // 4. 프론트에서 loginUser만 localStorage에 저장하게 유도
        response.sendRedirect(frontendUrl + "/oauth2/redirect?loginUser=" + loginUser);
    }
}
