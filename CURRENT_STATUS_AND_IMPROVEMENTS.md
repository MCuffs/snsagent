# Shuffla 개발 현황 및 개선 사항

기준일: 2026-05-26 (KST)
기준 브랜치: `main`
기준 소스: `main` 이후 현재 작업 트리 반영 기준

이 문서는 현재 구현 단계와 운영 전 보완 항목의 기준 문서다. Instagram 계정 연결 및 게시 사용자 흐름은 이번 우선 개발 범위에서 제외하며 추후 개발 대상으로 둔다.

## 1. 현재 구현 현황

### 사용자 화면

| 영역 | 현재 구현 | 상태 |
| --- | --- | --- |
| 랜딩/가격 안내 | `/`, `/pricing`, `/blog` | 구현됨 |
| 로그인 | `/login`, Google OAuth API | Google OAuth 및 HMAC 서명 세션 구현됨 |
| 브랜드 콘셉트 | `/concept` | URL 분석, 저장, 대화형 수정 구현됨 |
| 카드뉴스 생성 | `/generate`, `POST /api/campaigns/generate` | 이용권 한도 내 참고 이미지 최대 4장 포함 생성 구현됨 |
| 생성 결과/편집 | `/campaign/[id]` | 문구/배경 교체/다운로드 및 포함 크레딧 내 AI 배경 재생성 구현됨 |
| 작업 목록 | `/works` | 구현됨 |
| 결제 | `/billing`, Toss Payments 빌링, PayPal Subscription | 국내 카드 자동결제 및 해외 PayPal 구독 승인/취소 구현됨 |
| Instagram 연동/게시 | 서버 API와 Action 존재 | UI 흐름은 추후 개발 예정, 이번 범위 제외 |

### 핵심 백엔드 기능

| 기능 | 주요 구현 위치 | 상태 |
| --- | --- | --- |
| 사용자/브랜드/캠페인/게시물 저장 | `lib/db-service.ts`, `prisma/schema.prisma` | 구현됨, 운영 DB 정책 보완 필요 |
| 카드뉴스 생성 파이프라인 | `src/lib/layout/mediaCarouselPipeline.ts`, `src/lib/carousel/*` | 구현됨, 주요 배열 응답 fallback 보강 |
| 이미지 렌더링/업로드 | `src/lib/layout/renderer.ts`, `app/api/upload/route.ts` | 구현됨, 쿼터/속도 제한 보완 필요 |
| 대화형 Agent API | `app/api/agents/brand/route.ts`, `app/api/agents/generate/route.ts` | 구현됨, 외부 공급자 E2E 필요 |
| URL/참고 이미지 입력 경계 | `lib/brand-url-collector.ts`, `src/lib/ai/providers/openAIImageProvider.ts` | SSRF 및 신뢰 URL 검증 반영 |
| Google 인증 | `app/api/auth/google/*`, `lib/auth/session.ts` | OAuth와 서명 세션 구현됨 |
| Toss Payments 구독 | `app/api/payments/toss/*`, `app/api/cron/billing`, `lib/tosspayments.ts` | 빌링키 발급, 서버 금액 승인, 취소 및 월 갱신 구현됨 |
| PayPal 해외 구독 | `app/api/paypal/*`, `lib/paypal.ts` | 서버 `plan_id` 검증, 취소, 서명 검증 webhook 구현됨 |
| 생성 비용 통제 | `lib/db-service.ts`, `app/actions.ts` | 이미지 모델/초기·재생성 수 기록, 캠페인별 재생성 1회분 제한 구현됨 |
| Meta OAuth/게시 | `app/api/auth/meta/*`, `lib/instagram/client.ts` | 백엔드 유지, 제품 흐름은 보류 |

## 2. 완료된 점

### 기존 구현 범위

| 범위 | 완료된 구현 | 확인 위치 |
| --- | --- | --- |
| 브랜드 온보딩 | URL 입력, 분석 결과 편집/저장, Brand DNA 저장, 대화형 프로필 수정 | `app/(cms)/concept/*`, `app/api/agents/brand/route.ts`, `lib/brand-dna.ts` |
| 생성 UX | AI 대화로 생성 조건 수집 후 미디어 생성 API 호출 | `app/(cms)/generate/*`, `app/api/agents/generate/route.ts` |
| 생성 파이프라인 | LLM 카피, Agent 보정, 레이아웃/렌더링, 품질 로그 저장 | `src/lib/layout/*`, `src/lib/carousel/agents.ts` |
| 결과 조회/편집 | 결과 미리보기, 문구/캡션 저장, 폰트/색상/스타일 변경, 다운로드 | `app/(cms)/campaign/[id]/*`, `app/actions.ts` |
| 결제 기반 코드 | 이용권 없음 상태와 3개 유료 요금제, 국내 토스 빌링 및 해외 PayPal 구독 | `lib/limits-types.ts`, `app/(cms)/billing/*`, `app/api/payments/toss/*`, `app/api/paypal/*` |

### 이번 우선 개발로 완료한 사항

| 우선도 | 완료 항목 | 구현 결과 |
| --- | --- | --- |
| P0 | 세션 위조 차단 | 이메일 원문 쿠키 대신 `SESSION_SECRET` 기반 HMAC 서명 토큰을 검증하고 레거시 쿠키를 제거한다. 운영 환경의 개발용 이메일 로그인도 차단한다. |
| P0 | 결제 권한 검증 | 토스는 무작위 `customerKey` 및 서버 금액을 검증하고, PayPal은 조회된 `plan_id`와 서명 웹훅만 신뢰한다. 직접 유료 플랜 변경 Action도 차단한다. |
| P1 | 참고 이미지 생성 연결 | `/generate`에서 상품 이미지 최대 4장을 업로드하고 생성 API에 전달한다. |
| P1 | 배경 교체 정상화 | 결과 화면과 업로드 API의 `files`/`urls` 계약을 통일했다. |
| P1 | 잘못된 새 생성 경로 수정 | 결과 화면에서 새 생성을 `/generate`로 이동시킨다. |
| P1 | 결제 취소 안내 일치 | 취소 시 내부 `FREE` 전환을 UI에서는 즉시 “이용권 없음”으로 안내한다. |
| P1 | 레거시 플랜 호환 | billing/result 페이지에서 저장된 과거 플랜 값을 `normalizePlan()`으로 처리한다. |
| P2 | 외부 URL 요청 방어 | URL 수집에 프로토콜/사설 IP/DNS/redirect/응답 크기 제한을 추가하고, 참고 이미지 fetch는 신뢰 업로드 URL로 제한한다. |
| P2 | 생성 응답 안정성 | media 및 commerce 생성 흐름에서 모델 배열 응답 누락 시 fallback을 사용하도록 방어했다. |
| P2 | 로컬 결제 상태 재현성 | mock DB가 토스 고객키, 빌링키, 다음 청구일, 최신 결제 상태를 저장/조회하도록 계약을 맞췄다. |
| P1 | 프론트 제공 범위/가격 정합성 | 자동 게시 및 무료 생성 안내를 제거하고 `Google Login`, Single 3,000원/1회, Creator 19,000원/20회, Studio 45,000원/30회로 UI·한도를 통일했다. |
| P1 | AI 이미지 원가 상한 | 활성 CMS 이미지 모델을 `gpt-image-1`로 고정하고 캠페인별 최초 장수와 같은 AI 배경 재생성 크레딧만 허용한다. 사용 모델·최초/재생성 이미지 수를 저장한다. |
| P1 | Creator 손익 분석 | `UNIT_ECONOMICS.md`에 OpenAI 원가, 토스페이먼츠 일반 카드 공식 요율, VAT 가정 기반 기여이익을 정리했다. |
| P1 | Google 로그인 진입 단축 | 랜딩·공개 요금제·공통 마케팅 CTA의 `Google Login`을 `/api/auth/google/start`에 직접 연결해 중간 로그인 화면을 생략한다. `/login`은 오류 안내와 개발용 대체 진입으로 유지한다. |
| P0 | 국내/해외 결제 분리 | 네이버페이 결제 경로를 제거하고 국내 고객용 토스 빌링과 해외 고객용 PayPal 구독을 병행한다. 활성 구독이 있는 사용자의 이중 가입은 차단한다. |

현재 연결된 주요 사용자 흐름은 다음과 같다.

```text
Google Login -> /concept 브랜드 분석/저장 -> /billing 이용권 구독
             -> /generate 대화 및 참고 이미지 선택
             -> 카드뉴스 생성 -> /campaign/[id] 편집/다운로드
             -> /works 재조회
```

## 3. 보완할 점

### 운영 전 필요한 항목

| 우선도 | 항목 | 영향 | 필요한 조치 |
| --- | --- | --- | --- |
| P1 | 업로드 운영 제한 미완료 | 저장 비용 및 오남용 위험 | 사용자별 용량 쿼터, 요청 속도 제한, 만료/정리 정책 추가 |
| P1 | 운영 DB 장애 정책 미확정 | fallback 동작 시 데이터 신뢰성 저하 | production fail-closed 강제, 마이그레이션/백업 절차 검증 |
| P1 | 외부 서비스 E2E 미수행 | OAuth/결제/이미지 공급자 실환경 회귀 미확인 | 테스트 계정과 sandbox로 로그인-생성-편집-결제 E2E 수행 |
| P1 | 토스 월 청구 운영 미설정 | 토스는 자동 청구 스케줄을 제공하지 않아 갱신 결제가 실행되지 않음 | `CRON_SECRET`과 일별 `/api/cron/billing` 호출을 배포 환경에 설정하고 실패 알림 추가 |
| P2 | AI 응답 검증 확대 | 비정상 모델 응답의 일부 경로 실패 가능 | 공통 런타임 스키마와 관측/비용 지표 추가 |
| P2 | 의존성 감사 경고 | moderate 취약점 2건 보고됨 | 영향 범위 분석 후 호환 가능한 의존성 업데이트 |
| P0 | 토스 자동결제 운영 계약 필요 | 빌링 MID 계약 및 API 키 없이는 국내 카드 정기결제 판매 불가 | 토스 자동결제 리스크 검토/계약 후 키 설정, DB 마이그레이션, 테스트/라이브 소액 결제 수행 |
| P1 | PayPal 해외 판매 검증 필요 | 통화 변환, 해외 수수료, 구독 웹훅 운영 상태가 수익과 권한에 영향 | PayPal plan/webhook 설정 후 해외 테스트 결제 및 실수수료를 확인 |

### 추후 개발 범위

| 항목 | 현재 상태 | 결정 |
| --- | --- | --- |
| Instagram 계정 연결 UI | Meta OAuth/게시 백엔드는 있으나 CMS 화면과 리다이렉트 대상 `/instagram`이 없음 | 사용자 요청에 따라 이번 개발에서 제외하고 추후 제품 흐름으로 구현 |
| Instagram 예약 게시 운영 UX | cron/API 기반 코드는 있으나 사용자 접근/실패 처리 화면 없음 | Instagram 흐름 재개 시 함께 설계 및 검증 |

## 4. 정책 결정 사항

| 주제 | 현재 결정 |
| --- | --- |
| 유료 권한 부여 | 국내 토스는 검증된 `customerKey`와 서버 금액 승인 완료 시, 해외 PayPal은 검증된 `plan_id` 승인 완료 시만 플랜을 부여한다. |
| 가격 정책 | 내부 `FREE`는 생성 권한 없는 상태다. 유료 플랜은 Single 월 3,000원/1회, Creator 월 19,000원/20회, Studio 월 45,000원/30회다. |
| AI 재생성 정책 | 캠페인마다 최초 슬라이드 수만큼 AI 배경 재생성 이미지를 포함한다. 전체 스타일 재생성 1회 또는 같은 수의 개별 재생성으로 사용할 수 있으며 초과 생성은 차단한다. |
| 이미지 모델/원가 기록 | 유료 CMS 생성의 OpenAI 이미지 모델은 `gpt-image-1`로 고정하고 캠페인에 최초/재생성 이미지 수와 재생성 모델을 저장한다. |
| 구독 취소/실패 | 토스 빌링키 해지/월 청구 실패 또는 PayPal 구독 취소/중단 시 내부 `FREE`(이용권 없음)로 전환한다. |
| 개발 로그인 | 테스트 로그인은 비운영 환경에서만 허용한다. |
| Instagram | 서버 코드 유지, UI/게시 흐름 구현은 차기 범위로 분리한다. |

## 5. 검증 현황

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm ci` | 통과 | 2026-05-26, `npm audit` moderate 2건 보고 |
| `npm run lint` | 통과 | 2026-05-26, 우선 수정 반영 후 재실행 |
| `npm run build` | 통과 | 2026-05-26, Next.js 16.2.6 빌드 및 라우트 생성 성공 |
| 로그인-생성-편집 E2E | 미검증 | 실 OAuth/AI/Blob 환경 구성 후 확인 필요 |
| Toss Payments 테스트 E2E | 미검증 | 자동결제 계약/테스트 키 설정 후 카드 인증, 최초 승인, 취소, 월 갱신 확인 필요 |
| PayPal sandbox E2E | 미검증 | 해외 고객 승인, `plan_id` 매핑, 서명 webhook 및 취소 확인 필요 |
| Instagram E2E | 범위 제외 | 추후 개발 재개 시 수행 |

## 6. 이후 개발 순서

1. 업로드 쿼터/속도 제한과 운영 DB fail-closed를 구현한다.
2. 생성 사용량 및 `scripts/migrate-tosspayments.mjs` DB 마이그레이션을 적용하고, 토스 자동결제 계약·청구 크론과 PayPal 해외 플랜·웹훅을 구성한 뒤 두 결제 경로의 E2E를 수행한다.
3. 청구 실패 알림/재시도 정책과 AI 응답 공통 스키마 검증, 의존성 감사 경고를 정리한다.
4. Instagram 흐름은 별도 제품 범위가 확정된 뒤 연결 UI와 게시 운영 UX를 함께 구현한다.
