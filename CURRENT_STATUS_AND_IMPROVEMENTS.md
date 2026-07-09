# Shuffla 개발 현황 및 개선 사항

기준일: 2026-07-08 (KST)
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
| 생성 결과/편집 | `/campaign/[id]` | 레이어 캔버스, 인라인/드래그 편집, AI 부분 보정, 확정 렌더/다중 포맷 export 구현됨 |
| 작업 목록 | `/works` | 구현됨 |
| 결제 | `/billing`, Polar Checkout/Subscription | Polar 결제 승인, 취소, webhook 동기화 구현됨 |
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
| Polar 구독 | `app/api/polar/*`, `lib/polar.ts`, `lib/polar-orders.ts` | Checkout 생성, 취소, webhook 검증, 주문/결제 기록 동기화 구현됨 |
| 생성 비용 통제 | `lib/db-service.ts`, `app/actions.ts` | 이미지 모델/초기·재생성 수 기록, 캠페인별 재생성 1회분 제한 구현됨 |
| Meta OAuth/게시 | `app/api/auth/meta/*`, `lib/instagram/client.ts` | 백엔드 유지, 제품 흐름은 보류 |

## 2. 완료된 점

### 기존 구현 범위

| 범위 | 완료된 구현 | 확인 위치 |
| --- | --- | --- |
| 브랜드 온보딩 | URL 입력, 분석 결과 편집/저장, Brand DNA 저장, 대화형 프로필 수정 | `app/(cms)/concept/*`, `app/api/agents/brand/route.ts`, `lib/brand-dna.ts` |
| 생성 UX | AI 대화로 생성 조건 수집 후 미디어 생성 API 호출 | `app/(cms)/generate/*`, `app/api/agents/generate/route.ts` |
| 생성 파이프라인 | LLM 카피, Agent 보정, 레이아웃/렌더링, 품질 로그 저장 | `src/lib/layout/*`, `src/lib/carousel/agents.ts` |
| 결과 조회/편집 | Editorial Canvas, 7종 레이어, 직접 텍스트 편집/드래그/스냅, 타이포그래피·오버레이 인스펙터, undo/redo·자동 저장, PNG/JPG/2x/ZIP export | `app/(cms)/campaign/[id]/*`, `src/lib/editor/*`, `app/actions.ts` |
| 결제 기반 코드 | 이용권 없음 상태와 3개 유료 요금제, Polar 구독 | `lib/limits-types.ts`, `app/(cms)/billing/*`, `app/api/polar/*` |

### 이번 우선 개발로 완료한 사항

| 우선도 | 완료 항목 | 구현 결과 |
| --- | --- | --- |
| P0 | 세션 위조 차단 | 이메일 원문 쿠키 대신 `SESSION_SECRET` 기반 HMAC 서명 토큰을 검증하고 레거시 쿠키를 제거한다. 운영 환경의 개발용 이메일 로그인도 차단한다. |
| P0 | 결제 권한 검증 | Polar Checkout/order/webhook에서 검증된 결제 상태만 내부 플랜 권한에 반영한다. 직접 유료 플랜 변경 Action도 차단한다. |
| P1 | 참고 이미지 생성 연결 | `/generate`에서 상품 이미지 최대 4장을 업로드하고 생성 API에 전달한다. |
| P1 | 배경 교체 정상화 | 결과 화면과 업로드 API의 `files`/`urls` 계약을 통일했다. |
| P1 | 잘못된 새 생성 경로 수정 | 결과 화면에서 새 생성을 `/generate`로 이동시킨다. |
| P1 | 결제 취소 안내 일치 | 취소 시 내부 `FREE` 전환을 UI에서는 즉시 “이용권 없음”으로 안내한다. |
| P1 | 레거시 플랜 호환 | billing/result 페이지에서 저장된 과거 플랜 값을 `normalizePlan()`으로 처리한다. |
| P2 | 외부 URL 요청 방어 | URL 수집에 프로토콜/사설 IP/DNS/redirect/응답 크기 제한을 추가하고, 참고 이미지 fetch는 신뢰 업로드 URL로 제한한다. |
| P2 | 생성 응답 안정성 | media 및 commerce 생성 흐름에서 모델 배열 응답 누락 시 fallback을 사용하도록 방어했다. |
| P2 | 로컬 결제 상태 재현성 | mock DB가 Polar 주문, 결제, 구독 상태를 저장/조회하도록 계약을 맞췄다. |
| P1 | 프론트 제공 범위/가격 정합성 | 자동 게시 및 무료 생성 안내를 제거하고 `Google Login`, Single 3,000원/1회, Creator 25,000원/20회, Studio 39,000원/30회로 UI·한도를 통일했다. |
| P1 | AI 이미지 원가 상한 | 활성 CMS 이미지 모델을 `gpt-image-1`로 고정하고 캠페인별 최초 장수와 같은 AI 배경 재생성 크레딧만 허용한다. 사용 모델·최초/재생성 이미지 수를 저장한다. |
| P1 | Creator 손익 분석 | `UNIT_ECONOMICS.md`에 OpenAI 원가, 결제 수수료, VAT 가정 기반 기여이익을 정리했다. |
| P1 | Google 로그인 진입 단축 | 랜딩·공개 요금제·공통 마케팅 CTA의 `Google Login`을 `/api/auth/google/start`에 직접 연결해 중간 로그인 화면을 생략한다. `/login`은 오류 안내와 개발용 대체 진입으로 유지한다. |
| P0 | 결제 공급자 단일화 | 결제 경로를 Polar 구독으로 단일화했다. 활성 구독이 있는 사용자의 중복 가입은 차단한다. |
| P1 | Editorial Studio 편집기 | 최종 이미지와 분리된 `editorDocument`를 저장하고 배경/오버레이/타이틀/본문/스티커/CTA/워터마크 레이어를 시각 편집한다. AI 카피·배경 변형은 해당 레이어만 변경하며 확정 렌더는 서버에서 결정론적으로 수행한다. |
| P1 | 제작용 내보내기 | 현재 슬라이드 PNG/JPG/2x 렌더와 전체 Instagram 4:5 PNG ZIP export를 제공한다. |
| P1 | 브랜드 스타일 메모리 | 확정 렌더한 타이포그래피/오버레이 스타일을 `Brand.editorPreferences`에 저장하고 이후 새 슬라이드 에디터 초기값으로 재사용한다. |

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
| P2 | AI 응답 검증 확대 | 비정상 모델 응답의 일부 경로 실패 가능 | 공통 런타임 스키마와 관측/비용 지표 추가 |
| P2 | 의존성 감사 경고 | moderate 취약점 2건 보고됨 | 영향 범위 분석 후 호환 가능한 의존성 업데이트 |
| P1 | Editor E2E/시각 회귀 미수행 | 드래그, 자동 저장, 원격 이미지 렌더와 ZIP 출력이 브라우저/Blob 구성에 영향받음 | 운영 DB 마이그레이션 후 실제 생성본으로 캔버스 편집-확정 렌더-export 회귀 테스트 수행 |
| P0 | Polar 운영 설정 검증 필요 | 상품 ID, checkout 링크, webhook secret 오설정 시 결제 권한 동기화 실패 | Polar 상품/checkout/webhook 설정 후 테스트/라이브 소액 결제와 취소 E2E 수행 |

### 추후 개발 범위

| 항목 | 현재 상태 | 결정 |
| --- | --- | --- |
| Instagram 계정 연결 UI | Meta OAuth/게시 백엔드는 있으나 CMS 화면과 리다이렉트 대상 `/instagram`이 없음 | 사용자 요청에 따라 이번 개발에서 제외하고 추후 제품 흐름으로 구현 |
| Instagram 예약 게시 운영 UX | 사용자 접근/실패 처리 화면과 운영 cron은 현재 제외됨 | Instagram 흐름 재개 시 함께 설계 및 검증 |
| 스타일 추천 고도화 | 브랜드별 마지막 확정 스타일 재사용은 구현되었으나 복수 작업 기반 선호 학습/추천은 미구현 | 사용 패턴 집계와 생성 기본값 피드백 루프를 후속 구현 |
| Motion/협업 | 레이어에 animation metadata 구조는 있으나 MP4 출력과 실시간 공동 편집은 미구현 | 문서 버전/동시성 정책과 모션 렌더 파이프라인을 후속 설계 |

## 4. 정책 결정 사항

| 주제 | 현재 결정 |
| --- | --- |
| 유료 권한 부여 | Polar Checkout/order/webhook에서 검증된 결제 완료 또는 활성 구독 상태만 내부 플랜 권한으로 반영한다. |
| 가격 정책 | 내부 `FREE`는 생성 권한 없는 상태다. 유료 플랜은 Single 월 3,000원/1회, Creator 월 25,000원/20회, Studio 월 39,000원/30회다. |
| AI 재생성 정책 | 캠페인마다 최초 슬라이드 수만큼 AI 배경 변형 이미지를 포함한다. 에디터는 `same style`, `stronger mood`, `brighter background`처럼 현재 슬라이드 배경만 생성하고 카피/레이어/스타일은 유지한다. |
| 이미지 모델/원가 기록 | 유료 CMS 생성의 OpenAI 이미지 모델은 `gpt-image-1`로 고정하고 캠페인에 최초/재생성 이미지 수와 재생성 모델을 저장한다. |
| 구독 취소/실패 | Polar 구독 취소, 환불, 결제 실패 webhook 수신 시 내부 `FREE`(이용권 없음)로 전환한다. |
| 개발 로그인 | 테스트 로그인은 비운영 환경에서만 허용한다. |
| Instagram | 서버 코드 유지, UI/게시 흐름 구현은 차기 범위로 분리한다. |

## 5. 검증 현황

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run quality` | 통과 | 2026-07-08, Prisma generate, lint, typecheck, node test 26개 통과 |
| `npm run build` | 통과 | 2026-07-08, Next.js 16.2.6 빌드 및 라우트 생성 성공. Turbopack NFT 추적 경고 1건은 남음 |
| 로그인-생성-편집 E2E | 미검증 | 실 OAuth/AI/Blob 환경 구성 후 확인 필요 |
| Polar 결제 E2E | 미검증 | 상품 매핑, checkout 완료, webhook 서명, 취소/환불 동기화 확인 필요 |
| Instagram E2E | 범위 제외 | 추후 개발 재개 시 수행 |

## 6. 이후 개발 순서

1. 업로드 쿼터/속도 제한과 운영 DB fail-closed를 구현한다.
2. Polar 상품/checkout/webhook 환경변수를 구성하고 결제 완료, 취소, 환불 동기화 E2E를 수행한다.
3. 청구 실패 알림/재시도 정책과 AI 응답 공통 스키마 검증, 의존성 감사 경고를 정리한다.
4. Instagram 흐름은 별도 제품 범위가 확정된 뒤 연결 UI와 게시 운영 UX를 함께 구현한다.
