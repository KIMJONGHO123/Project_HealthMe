package com.example.healthme;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "jwt.secret=test-jwt-secret-for-context-load")
class DemoApplicationTests {

	@Test
	void contextLoads() {
	}

}
