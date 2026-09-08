package com.example.healthme.domain.approval.service;

import com.example.healthme.domain.approval.dto.PortOnePaymentDto;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;

@Service
public class PortOneClient {

    private final RestClient restClient;
    private final String baseUrl;
    private final String apiKey;
    private final String apiSecret;
    private final boolean includeSandbox;

    public PortOneClient(
            @Value("${portone.api.base-url:https://api.iamport.kr}") String baseUrl,
            @Value("${portone.api.key:}") String apiKey,
            @Value("${portone.api.secret:}") String apiSecret,
            @Value("${portone.api.include-sandbox:false}") boolean includeSandbox
    ) {
        this.restClient = RestClient.builder().build();
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.includeSandbox = includeSandbox;
    }

    public void preparePayment(String merchantUid, int amount) {
        String accessToken = getAccessToken();
        JsonNode root = restClient.post()
                .uri(baseUrl + "/payments/prepare")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "merchant_uid", merchantUid,
                        "amount", amount
                ))
                .retrieve()
                .body(JsonNode.class);

        requireSuccess(root);
    }

    public PortOnePaymentDto getPayment(String impUid) {
        String accessToken = getAccessToken();
        JsonNode root;
        try {
            root = restClient.get()
                    .uri(baseUrl + "/payments/{impUid}?include_sandbox={includeSandbox}", impUid, includeSandbox)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            throw new IllegalStateException(
                    "PortOne payment lookup failed. impUid=" + impUid
                            + ", includeSandbox=" + includeSandbox
                            + ", status=" + e.getStatusCode()
                            + ", body=" + e.getResponseBodyAsString(),
                    e
            );
        }

        JsonNode payment = requireSuccess(root);
        return PortOnePaymentDto.builder()
                .impUid(payment.path("imp_uid").asText(null))
                .merchantUid(payment.path("merchant_uid").asText(null))
                .status(payment.path("status").asText(null))
                .amount(payment.path("amount").asInt())
                .currency(payment.path("currency").asText(null))
                .paidAt(toLocalDateTime(payment.path("paid_at").asLong(0)))
                .build();
    }

    public void cancelPayment(String impUid, String reason) {
        String accessToken = getAccessToken();
        JsonNode root = restClient.post()
                .uri(baseUrl + "/payments/cancel")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "imp_uid", impUid,
                        "reason", reason
                ))
                .retrieve()
                .body(JsonNode.class);

        requireSuccess(root);
    }

    private String getAccessToken() {
        if (apiKey == null || apiKey.isBlank() || apiSecret == null || apiSecret.isBlank()) {
            throw new IllegalStateException("PortOne REST API key/secret is not configured.");
        }

        JsonNode root = restClient.post()
                .uri(baseUrl + "/users/getToken")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "imp_key", apiKey,
                        "imp_secret", apiSecret
                ))
                .retrieve()
                .body(JsonNode.class);

        JsonNode response = requireSuccess(root);
        String accessToken = response.path("access_token").asText(null);
        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalStateException("PortOne access token was not returned.");
        }
        return accessToken;
    }

    private JsonNode requireSuccess(JsonNode root) {
        if (root == null) {
            throw new IllegalStateException("PortOne API returned an empty response.");
        }
        int code = root.path("code").asInt(-1);
        if (code != 0) {
            String message = root.path("message").asText("Unknown PortOne API error");
            throw new IllegalStateException("PortOne API error: " + message);
        }
        return root.path("response");
    }

    private LocalDateTime toLocalDateTime(long epochSeconds) {
        if (epochSeconds <= 0) {
            return null;
        }
        return LocalDateTime.ofInstant(Instant.ofEpochSecond(epochSeconds), ZoneId.systemDefault());
    }
}
