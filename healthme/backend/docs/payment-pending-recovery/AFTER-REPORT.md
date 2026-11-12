# 결제 완료 후 PENDING 주문 복구: 개선 후

실행일: 2026-11-12 (Asia/Seoul)
비교 기준: 개선 전 `a7ed1a4` ([BEFORE-REPORT.md](BEFORE-REPORT.md))

## 결론

개선 전과 같은 조건(PortOne 결제 완료 100건, 장애 3종 30건 주입)에서 보정 배치를 1회 실행하자 PENDING에 남았던 30건이 모두 PAID로 복구됐다. 불일치 주문은 30건에서 0건이 됐고, 주문에 반영되지 않은 결제 금액은 291,000원에서 0원이 됐다. 배치를 다시 실행하거나 완료 요청이 뒤늦게 도착해도 재고·누적 구매금액은 다시 반영되지 않았다.

## 개선 전후 비교

| 항목 | 개선 전 (`a7ed1a4`) | 개선 후 (배치 1회) |
| --- | --- | --- |
| 불일치 주문 (PortOne 결제 완료 + DB PAID 아님) | 30건 | **0건** |
| 완료 요청 미도달 10건 | PENDING 10 | PAID 10 |
| PortOne 재조회 오류 10건 | PENDING 10 | PAID 10 |
| PAID 처리 중 내부 예외 10건 | PENDING 10 | PAID 10 |
| 자동 복구 | 0건 | 30건 |
| 재고 | 1,000 → 930 | 1,000 → 900 |
| 누적 구매금액 | 679,000원 | 970,000원 |
| 반영되지 않은 결제 금액 | 291,000원 | **0원** |
| 자동 환불 호출 | 0회 | 0회 (모두 정상 결제라 환불 대상 없음) |

## 중복 반영 확인

| 확인 | 결과 |
| --- | --- |
| 배치 2회차 실행 (10분 뒤) | 대상 0건, 변경 없음 |
| 배치 복구 후 완료 요청 미도달 주문 10건의 완료 요청이 늦게 도착 | 10건 모두 HTTP 200 "이미 결제 완료", 재고 900·판매량 100·누적 970,000원 유지 |
| 복구된 30건의 결제번호·결제금액 | 모두 PortOne 결제번호와 9,700원으로 기록 |

## 예외 상황

| 상황 | 1회차 | 2회차 |
| --- | --- | --- |
| 배치 실행 중에도 PortOne 조회 오류가 계속됨 | RETRY_LATER, PENDING 유지 | 조회 정상화 후 RECOVERED_PAID |
| 배치에서 주문 2건 중 1건의 확정 중 DB 예외 | 1건 RETRY_LATER(롤백·PENDING 유지), 1건 RECOVERED_PAID | 남은 1건 RECOVERED_PAID, 재고·누적금액 2건분만 반영 |
| 결제는 됐지만 그 사이 재고가 0이 됨 | CANCELLED, 자동 환불 1회 호출 | — |
| 결제하지 않은 주문 (결제창만 열고 닫음) | 생성 직후: 대상 아님 / 10분 뒤: NOT_PAID_YET, PENDING 유지 | 70분 뒤: EXPIRED, FAILED로 정리, 환불 호출 없음 |

## 해결 방법

1. **주문번호로 PortOne 재조회:** 서버가 결제번호(`imp_uid`)를 받지 못한 주문도 확인할 수 있도록 `PortOneClient.findPaidPaymentByMerchantUid`를 추가했다. PortOne V1 `GET /payments/find/{merchant_uid}/paid`를 호출하고, 결제 완료 건이 없으면(404) 빈 값을 돌려준다.
2. **보정 배치:** `PaymentRecoveryScheduler`가 5분마다(`fixedDelay`) 생성 후 5분이 지난 PENDING 주문을 오래된 순으로 최대 100건 조회한다. 생성 직후 주문은 결제창에서 결제 중이거나 완료 요청이 처리 중일 수 있어 제외한다.
3. **완료 요청과 같은 검증·확정 로직 재사용:** `ApprovalService.recoverPendingPayment`는 완료 요청이 쓰는 검증(결제 상태, 주문번호, 금액, 통화, 결제번호 중복)과 확정(재고·판매량·누적금액 반영, 장바구니 정리)을 그대로 쓴다. 이를 위해 기존 검증 메서드에서 요청 값 비교만 분리하고 나머지를 공용 메서드로 뺐다.
4. **중복 처리 방지:** PortOne 조회는 락 밖에서 먼저 하고, 주문은 비관적 락(`findByMerchantUidForUpdate`)으로 다시 읽은 뒤 PENDING일 때만 처리한다. 완료 요청이 먼저 PAID로 바꿨다면 `ALREADY_PROCESSED`로 건너뛴다. 반대로 배치가 먼저 처리하면 완료 요청은 기존 로직대로 "이미 결제 완료"로 응답한다.
5. **주문별 트랜잭션:** 배치는 주문마다 `recoverPendingPayment`를 별도 트랜잭션으로 호출한다. 한 건의 조회 오류나 DB 예외가 다른 주문의 복구를 되돌리지 않고, 실패한 건은 PENDING으로 남아 다음 실행에서 재시도한다.
6. **복구할 수 없는 결제와 미결제 주문:** 결제는 됐지만 금액 불일치·재고 부족이면 기존 `markInvalidPayment`로 자동 환불(실패 시 PAYMENT_REVIEW_REQUIRED)한다. PortOne에 결제 완료 건이 없는 주문은 생성 후 60분이 지나면 FAILED로 정리한다. 현재 결제수단은 카드뿐이라(가상계좌 없음) 60분 뒤에 결제가 완료되는 경우는 없다.

설정값(`application.properties`에서 변경 가능, 기본값):

| 키 | 기본값 | 의미 |
| --- | --- | --- |
| `payment.recovery.enabled` | true | 스케줄링 활성화 |
| `payment.recovery.fixed-delay-ms` | 300000 | 실행 간격 5분 |
| `payment.recovery.initial-delay-ms` | 60000 | 서버 시작 후 첫 실행 1분 |
| `payment.recovery.min-age-minutes` | 5 | 생성 후 이 시간이 지난 주문만 대상 |
| `payment.recovery.expire-minutes` | 60 | 결제 완료 건이 없으면 이 시간 후 FAILED |

## 실제 PortOne 테스트 결제로 확인 (로컬)

2026-11-12, 로컬 백엔드(8090)·프론트엔드(3000)·로컬 MySQL `healthme`, PortOne V1 + 나이스페이 테스트 결제 1건.

1. 배치 확인용으로 `--payment.recovery.min-age-minutes=1 --payment.recovery.fixed-delay-ms=30000 --payment.recovery.initial-delay-ms=10000`을 주고 서버를 실행했다.
2. 크롬 개발자 도구 Request conditions에서 `POST /healthme/payments/complete`를 차단하고 결제했다. 결제창에서 결제는 승인됐지만 완료 요청은 서버에 도달하지 않았다(결제 후 브라우저 종료와 같은 상황).
3. 결제 직후 주문은 `PENDING`, `payment_imp_uid`·`paid_amount`는 비어 있었다.
4. 배치가 주문번호로 PortOne을 재조회해 복구했다.

| 항목 | 값 |
| --- | --- |
| 주문 | order_id 18, `healthme-20261112-8d1e2a009c26` |
| 주문 생성(`order_date`) | 15:56:19 |
| 배치 처리 로그 | 15:57:49 `[Payment recovery batch] targets=1, result={RECOVERED_PAID=1}` |
| 복구 후 주문 | `PAID`, `payment_imp_uid=imp_709577233578`, `paid_amount=3861` |

생성 후 약 1분 30초 뒤(최소 경과 1분 + 30초 주기 이내)에 처리됐다. 실제 PortOne V1 `GET /payments/find/{merchant_uid}/paid`가 테스트 결제 건을 정상 조회했음을 확인했다.

```text
15:57:49.595 [scheduling-1] ApprovalService : [Payment confirmed] orderId=18, merchantUid=healthme-20261112-8d1e2a009c26, impUid=imp_709577233578, amount=3861
15:57:49.595 [scheduling-1] ApprovalService : [Payment recovered] orderId=18, merchantUid=healthme-20261112-8d1e2a009c26, impUid=imp_709577233578
(장바구니 항목 삭제 SQL)
15:57:49.605 [scheduling-1] PaymentRecoveryScheduler : [Payment recovery batch] targets=1, result={RECOVERED_PAID=1}
```

스레드가 `scheduling-1`로, 사용자 요청 없이 스케줄러가 처리했다. 정상 결제와 같은 확정 로직(`confirmPaidOrder`)을 사용해 장바구니 정리까지 수행됐다.

**결제하지 않은 주문:** 주문 후 결제창을 열었다가 결제하지 않고 닫았다. 배치가 실제 PortOne에 주문번호로 조회했고, 결제 완료 건 없음(404)을 오류가 아닌 빈 결과로 처리했다.

```text
16:12:50.196 [scheduling-1] PaymentRecoveryScheduler : [Payment recovery batch] targets=1, result={NOT_PAID_YET=1}
```

주문은 PENDING으로 유지되고 환불 호출은 없다. 만료 시간(기본 60분)이 지나면 FAILED로 정리된다(만료 처리는 테스트 코드로 확인).

## MySQL 동시성 확인

2026-11-12, 로컬 MySQL 전용 DB `healthme_test`(테이블은 테스트가 생성·삭제), PortOne 대역. 테스트: `PaymentRecoveryConcurrencyTest` (환경 변수 `RUN_MYSQL_CONCURRENCY_TEST=true`일 때만 실행, CI에서는 건너뜀).

회차마다 "결제 완료 + PENDING" 주문 1건을 만들고, 완료 요청 20개와 보정 배치 1개를 `CountDownLatch`로 같은 순간에 출발시켰다. 50회 반복.

| 항목 | 결과 |
| --- | --- |
| 실제로 확정한 주체 | 매 회차 정확히 1개 (완료 요청 50회, 보정 배치 0회) |
| 보정 배치 결과 | `ALREADY_PROCESSED` 50회 (`NO_TARGET` 0회) |
| 완료 요청 응답 | 확정 50건, "이미 결제 완료" 950건 |
| 오류 | 0건 |
| 재고 / 판매량 / 누적 구매금액 | 1,000 → 950 / 0 → 50 / 0 → 485,000원 (기대값과 일치) |

배치는 50회 모두 목록 조회 시점에는 주문을 PENDING으로 봤고(`NO_TARGET` 0회), 주문 락을 잡은 뒤 다시 확인해 이미 PAID인 주문을 건너뛰었다. 실제 경쟁 상황에서 락과 재확인이 중복 반영을 막았다.

이 조건(완료 요청 20 : 배치 1, 배치는 목록 조회를 먼저 수행)에서는 매번 완료 요청이 먼저 락을 잡았다. 두 경로는 같은 주문 락과 PENDING 재확인을 쓰므로 어느 쪽이 먼저 잡아도 나머지는 건너뛴다. 배치가 확정한 뒤 완료 요청이 도착하는 흐름은 순차 테스트(`PendingRecoveryAfterTest`)에서 확인했다. 운영에서는 배치가 생성 후 5분이 지난 주문만 처리하므로, 결제 직후 몇 초 안에 오는 완료 요청과 같은 주문에서 겹칠 가능성은 낮다.

```text
EVIDENCE mysql concurrency rounds=50 perRound=completeRequests 20 + recoveryBatch 1
EVIDENCE winner={완료 요청=50}
EVIDENCE batchResult={ALREADY_PROCESSED=50}
EVIDENCE completeResponses={결제 검증이 완료되었습니다.=50, 이미 결제 완료 처리된 주문입니다.=950}
EVIDENCE errors=0 stock 1000->950 sales 0->50 userPurchaseAmount 0->485000 expected=485000
```

## 기존 동작 회귀 확인

시나리오 1의 결제 검증 테스트 `VerifiedPaymentTest`(14개 사례 + 등급 할인 8개 매개변수 = 22개)를 변경된 코드에 임시로 넣어 실행했고 모두 통과했다. 완료 요청 경로의 검증 순서와 오류 메시지는 바뀌지 않았다. 개선 전 기준선 테스트 `PendingRecoveryBaselineTest`도 계속 통과한다(배치를 실행하지 않으면 여전히 PENDING에 남는다는 것을 보여준다).

## 환경과 범위

- MockMvc → 실제 컨트롤러·서비스·Spring 트랜잭션·JPA repository → H2 메모리 DB. PortOne은 Mockito 대역.
- 배치는 스케줄러를 기다리지 않고 `recoverPendingPayments(기준 시각)`를 직접 호출했다. 기준 시각을 10분·70분 뒤로 넘겨 시간 경과를 표현했다.
- 테스트마다 새 H2 DB를 사용했다(`@DirtiesContext`). 배치가 DB 전체의 PENDING 주문을 대상으로 하기 때문이다.
- 내부 예외는 장바구니 repository `deleteAll`에 DB 접근 예외를 주입해 만들었다.
- **검증하지 않은 것:**
  - 서버를 여러 대 띄웠을 때 배치가 동시에 도는 경우(현재 단일 서버 배포 기준. 주문 락으로 중복 반영은 막히지만 PortOne 조회는 중복될 수 있음)
  - 웹훅(PortOne이 서버로 직접 알림)은 구현하지 않았다. 배치 주기(최대 약 10분)만큼 반영이 늦어질 수 있다.

## 변경한 파일

- `src/main/.../approval/service/PortOneClient.java`: 주문번호 기반 결제 조회 추가, 응답 변환 공용화
- `src/main/.../approval/service/ApprovalService.java`: 검증 로직 공용화, `recoverPendingPayment` 추가
- `src/main/.../approval/service/PaymentRecoveryScheduler.java` (신규): 보정 배치
- `src/main/.../approval/service/PaymentRecoveryResult.java` (신규): 처리 결과 구분
- `src/main/.../approval/repository/ApprovalOrderRepository.java`: 오래된 PENDING 주문 조회 메서드 추가
- `src/main/.../global/config/SchedulingConfig.java` (신규): `@EnableScheduling`
- `src/test/.../payment/PendingRecoveryAfterTest.java` (신규)
- `src/test/.../payment/PaymentRecoveryConcurrencyTest.java` (신규, MySQL `healthme_test` 필요)

## 재현

```powershell
# healthme/backend 폴더에서 실행
.\gradlew.bat test --tests '*PendingRecovery*' --console=plain
```

결과 XML: `build/test-results/test/TEST-com.example.healthme.payment.PendingRecoveryAfterTest.xml` (이 폴더의 `after-junit-result.xml`은 2026-11-12 실행본 사본, `concurrency-junit-result.xml`은 MySQL 동시성 테스트 실행본 사본)

MySQL 동시성 테스트는 `CREATE DATABASE healthme_test;` 후 실행한다.

```powershell
$env:RUN_MYSQL_CONCURRENCY_TEST = "true"
$env:DB_PASSWORD = "<로컬 MySQL 비밀번호>"
.\gradlew.bat test --tests '*PaymentRecoveryConcurrencyTest*' --console=plain
```

```text
EVIDENCE after orders=100 faultsInjected=30
EVIDENCE beforeBatch mismatch=30 stock=930
EVIDENCE batchRun1(now+10m) result={RECOVERED_PAID=30}
EVIDENCE scenario=NORMAL label=정상 완료 요청 dbStatusAfterBatch={PAID=70}
EVIDENCE scenario=COMPLETE_NOT_DELIVERED label=완료 요청 미도달 dbStatusAfterBatch={PAID=10}
EVIDENCE scenario=PORTONE_LOOKUP_ERROR label=PortOne 재조회 오류 dbStatusAfterBatch={PAID=10}
EVIDENCE scenario=INTERNAL_ERROR_ON_PAID label=PAID 처리 중 내부 예외 dbStatusAfterBatch={PAID=10}
EVIDENCE mismatch(PortOne paid, DB not PAID)=0 cancelPaymentCalls=0
EVIDENCE stock 1000->900 sales 0->100 userPurchaseAmount 0->970000 portOnePaidTotal=970000 unreflectedAmount=0
EVIDENCE batchRun2(now+20m) result={} lateCompleteRequests=10 -> HTTP 200 already paid, no double count
EVIDENCE edge=lookupStillDown run1={RETRY_LATER=1} run2={RECOVERED_PAID=1}
EVIDENCE edge=internalErrorInBatch run1={RECOVERED_PAID=1, RETRY_LATER=1} run2={RECOVERED_PAID=1}
EVIDENCE edge=unpaid now+0m=skip now+10m={NOT_PAID_YET=1} now+70m={EXPIRED=1}
EVIDENCE edge=stockShortageAfterPayment run={CANCELLED=1} cancelPaymentCalls=1
```
