# 결제 완료 후 PENDING 주문 복구: 개선 전 기준선

실행일: 2026-11-11 (Asia/Seoul)
코드 기준: `2560d23` (애플리케이션 코드 변경 없음)

## 결론

PortOne에서 결제가 완료된 주문 100건 중 장애 3종을 10건씩 총 30건 주입했다. 30건 모두 주문이 `PENDING`에 남았고, 자동 복구 0건, 자동 환불(`cancelPayment`) 호출 0회였다. 고객이 결제한 970,000원 중 291,000원(30건 × 9,700원)이 주문·누적 구매금액에 반영되지 않은 채 남았다.

현재 코드에는 이 상태를 다시 확인하는 경로가 없다. 코드 전체에서 웹훅 수신 API와 `@Scheduled` 작업을 검색한 결과는 0건이다. 서버가 결제 사실을 확인하는 경로는 브라우저가 보내는 `POST /healthme/payments/complete` 하나뿐이다.

## 결과

| 시나리오 | 주입 방법 | 건수 | 완료 요청 응답 | DB 주문 상태 |
| --- | --- | ---: | --- | --- |
| 정상 완료 요청 | 장애 없음 | 70 | HTTP 200 | PAID 70 |
| 완료 요청 미도달 | 결제 후 complete API를 호출하지 않음 (브라우저 종료·네트워크 단절) | 10 | 요청 없음 | PENDING 10 |
| PortOne 재조회 오류 | complete 처리 중 PortOne 결제 조회에서 예외 | 10 | HTTP 502 | PENDING 10 |
| PAID 처리 중 내부 예외 | 재고·누적금액 반영 뒤 장바구니 정리 단계에서 DB 접근 예외(`DataAccessResourceFailureException`) | 10 | 처리되지 않은 예외 (실제 서버 HTTP 500) | PENDING 10 |

| 항목 | 값 |
| --- | --- |
| 불일치 주문 (PortOne 결제 완료 + DB PAID 아님) | **30건** |
| 자동 복구 | 0건 |
| 자동 환불 호출 | 0회 |
| 재고 | 1,000 → 930 (정상 70건분만 차감) |
| 판매량 | 0 → 70 |
| 누적 구매금액 | 0 → 679,000원 (70 × 9,700원) |
| PortOne 결제 총액 | 970,000원 (100 × 9,700원) |
| 주문에 반영되지 않은 결제 금액 | **291,000원** |

불일치 30건은 모두 `paymentImpUid`와 `paidAmount`가 비어 있다. DB만 보면 결제하지 않은 주문과 구분할 수 없다.

## 관찰한 점

- **세 원인의 최종 상태가 같다.** 완료 요청이 오지 않은 주문, 조회 오류로 중단된 주문, 내부 예외로 롤백된 주문 모두 "PortOne 결제 완료 + 주문 PENDING + 결제번호 없음"이다. 원인과 상관없이 이 상태를 찾아 복구하는 장치 하나로 세 경우를 덮을 수 있다.
- **내부 예외는 롤백까지만 된다.** 재고·판매량·누적금액 변경은 정상적으로 롤백됐다(재고가 정상 70건분만 차감). 하지만 PortOne 결제는 DB 트랜잭션 밖이라 그대로 남는다.
- **내부 예외는 HTTP 500으로 끝난다.** 컨트롤러는 `PaymentValidationException`, `IllegalArgumentException`(400)과 `IllegalStateException`(502)만 처리한다. DB 접근 예외는 처리되지 않아 500이 된다. 검증 실패와 달리 자동 취소 분기(`markInvalidPayment`)도 타지 않는다.
- **이미 있는 장치:** 주문 비관적 락과 "이미 PAID면 같은 응답 반환" 처리는 있다. 같은 주문의 완료 요청이 반복돼도 한 번만 반영된다(별도 JMeter 검증). 복구 경로를 추가할 때 이 처리를 재사용할 수 있다.

## 환경과 범위

- MockMvc → 실제 `PortOneController` → 실제 `ApprovalService`의 Spring 트랜잭션 → 실제 JPA repository → H2 메모리 DB.
- `PortOneClient`는 Mockito 대역이다. 결제 원장(결제번호별 paid 응답)과 조회 오류를 대역으로 구성했다. 실제 PortOne·카드 결제는 사용하지 않았다.
- 내부 예외는 실제 장바구니 repository의 `deleteAll` 호출에 DB 접근 예외를 주입해 만들었다. DB 서버 장애를 직접 일으킨 것은 아니다.
- 요청은 순차 실행했다. 동시 처리와 MySQL 락 동작은 이 테스트의 범위 밖이다.
- 사용자 1명(새싹 등급, 3% 할인), 상품 1개(판매가 10,000원, 재고 1,000), 주문당 수량 1개.
- 실제 운영 장애 빈도를 재현한 것이 아니다. 장애를 의도적으로 주입한 결과다.

## 변경한 파일

- `healthme/backend/src/test/java/com/example/healthme/payment/PendingRecoveryBaselineTest.java` (신규)
- `healthme/backend/build.gradle`: `testRuntimeOnly 'com.h2database:h2'` 1줄 추가. 이전 시나리오 1은 별도 checkout의 init 스크립트로 넣었지만, 이번에는 프로젝트 안에서 바로 실행할 수 있게 빌드 파일에 넣었다.
- 애플리케이션 코드(`src/main`) 변경 없음. 아직 커밋하지 않았다.

## 재현

```powershell
# healthme/backend 폴더에서 실행
.\gradlew.bat test --tests '*PendingRecoveryBaselineTest' --console=plain
```

결과 XML: `build/test-results/test/TEST-com.example.healthme.payment.PendingRecoveryBaselineTest.xml` (이 폴더의 `before-junit-result.xml`은 2026-11-11 실행본 사본). `EVIDENCE`로 시작하는 줄이 위 표의 원본이다. 2026-11-12 개발자 로컬 재실행에서도 같은 결과를 확인했다.

```text
EVIDENCE baseline commit=2560d23 orders=100 faultsInjected=30
EVIDENCE scenario=NORMAL label=정상 완료 요청 http={HTTP 200=70} dbStatus={PAID=70}
EVIDENCE scenario=COMPLETE_NOT_DELIVERED label=완료 요청 미도달 http={complete 요청 없음=10} dbStatus={PENDING=10}
EVIDENCE scenario=PORTONE_LOOKUP_ERROR label=PortOne 재조회 오류 http={HTTP 502=10} dbStatus={PENDING=10}
EVIDENCE scenario=INTERNAL_ERROR_ON_PAID label=PAID 처리 중 내부 예외 http={처리되지 않은 예외(HTTP 500)=10} dbStatus={PENDING=10}
EVIDENCE mismatch(PortOne paid, DB not PAID)=30 autoRecovered=0 cancelPaymentCalls=0
EVIDENCE stock 1000->930 sales 0->70 userPurchaseAmount 0->679000 portOnePaidTotal=970000 unreflectedAmount=291000
```

## 개선 후 같은 테스트로 확인할 것

- 보정 배치 1회 실행 후 불일치 30건 → 0건 (PAID 확정 또는 환불)
- 재고 1,000 → 900, 누적 구매금액 970,000원으로 정확히 100건분만 반영, 중복 반영 0건
- 복구할 수 없는 주문(예: 결제 후 재고 부족)은 자동 환불
