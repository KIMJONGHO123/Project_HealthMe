package com.example.healthme.global.config.auth.handler.logoutHandler;

import com.example.healthme.global.config.auth.principal.PrincipalDetails;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Slf4j
@Component
public class CustomLogoutSuccessHandler implements LogoutSuccessHandler {

    @Value("${spring.security.oauth2.client.registration.kakao.client-id}")
    String KAKAO_CLIENT_ID;
    @Value("${spring.security.oauth2.client.kakao.logout.redirect.uri}")
    String KAKAO_LOGOUT_REDIRECT_URI;

    @Override
    public void onLogoutSuccess(HttpServletRequest request, HttpServletResponse response,
                                Authentication authentication) throws IOException, ServletException {

        log.info("✅ CustomLogoutSuccessHandler 실행");

        // 무조건 쿠키 삭제
        Cookie accessTokenCookie = new Cookie("accessToken", null);
        accessTokenCookie.setPath("/");
        accessTokenCookie.setHttpOnly(true);
        accessTokenCookie.setMaxAge(0);
        accessTokenCookie.setSecure(true);

        Cookie refreshTokenCookie = new Cookie("refreshToken", null);
        refreshTokenCookie.setPath("/");
        refreshTokenCookie.setHttpOnly(true);
        refreshTokenCookie.setMaxAge(0);
        refreshTokenCookie.setSecure(true);

        response.addCookie(accessTokenCookie);
        response.addCookie(refreshTokenCookie);

        // 소셜 로그아웃 분기
        if (authentication != null && authentication.getPrincipal() instanceof PrincipalDetails principalDetails) {
            String provider = principalDetails.getUserDto().getProvider();
            if ("kakao".equals(provider)) {
                response.sendRedirect("https://kauth.kakao.com/oauth/logout?client_id="
                        + KAKAO_CLIENT_ID
                        + "&logout_redirect_uri="
                        + KAKAO_LOGOUT_REDIRECT_URI);
                return;
            } else if ("naver".equals(provider)) {
                response.sendRedirect("https://nid.naver.com/nidlogin.logout?returl=https://www.naver.com/");
                return;
            } else if ("google".equals(provider)) {
                response.sendRedirect("https://accounts.google.com/Logout");
                return;
            }
        }

        // 기본 리디렉션
        response.sendRedirect(request.getContextPath() + "/");
    }
}
