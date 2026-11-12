package com.example.healthme.global.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 결제 보정 배치 등 @Scheduled 작업 활성화. payment.recovery.enabled=false 로 끌 수 있다. */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "payment.recovery.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {
}
