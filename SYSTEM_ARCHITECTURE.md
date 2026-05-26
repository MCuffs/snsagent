# Shuffla 현재 시스템 구조

기준일: 2026-05-26 (KST)
대상: `main`의 `c19c7d2` 소스 기준 Next.js 애플리케이션

현재 구현 상태와 우선순위는 `CURRENT_STATUS_AND_IMPROVEMENTS.md`, 변경 경과는 `DEVELOPMENT_LOG.md`, 코드 책임 규칙은 `LAYERS.md`를 기준으로 한다.

## 1. 기술 구성

| 분류 | 구성 |
| --- | --- |
| Web Framework | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind CSS 4, Framer Motion, Lucide React |
| DB | PostgreSQL, Prisma 5 |
| 파일 저장 | Vercel Blob 및 생성 이미지 저장 모듈 |
| AI/콘텐츠 | Gemini, Groq, OpenAI 계열 연동 모듈 및 레이아웃 파이프라인 |
| 결제 | PayPal Subscription API/Webhook |
| 소셜 게시 | Meta OAuth, Instagram Graph API |

## 2. 디렉터리 역할

| 경로 | 역할 |
| --- | --- |
| `app/` | App Router 페이지, Server Actions, API routes |
| `app/(cms)/` | 로그인 이후 CMS 사용자 화면 |
| `lib/` | 인증, DB 서비스, 결제, Meta/Instagram, 브랜드 분석 등 애플리케이션 서비스 |
| `src/lib/layout/` | 현재 카드뉴스 레이아웃/렌더링 중심 파이프라인 |
| `src/lib/carousel/` | 기존 또는 보조 카드뉴스 생성 엔진 모듈 |
| `src/lib/ai/` | LLM 및 이미지 공급자 추상화 |
| `app/api/agents/` | 브랜드 수정 및 카드뉴스 설정을 위한 대화형 API |
| `prisma/` | 데이터 모델과 로컬 데이터 관련 파일 |
| `scripts/` | 마이그레이션 및 PayPal 설정 스크립트 |

## 3. 사용자 화면 구조

```mermaid
flowchart LR
    Landing["/"] --> Login["/login"]
    Login --> Concept["/concept"]
    Concept --> Generate["/generate"]
    Generate --> Result["/campaign/[id]"]
    Result --> Works["/works"]
    Works --> Result
    Concept --> Billing["/billing"]
```

CMS 내 실제 메뉴는 `Concept`, `Generate`, `Works` 중심으로 구성되어 있다. 결제 페이지는 존재하지만 Instagram 설정/연동 전용 페이지는 현재 CMS 라우트 목록에 존재하지 않는다.

## 4. 인증 및 사용자 세션 흐름

```mermaid
sequenceDiagram
    participant U as 사용자
    participant A as Next.js App
    participant G as Google OAuth
    participant D as DB Service

    U->>A: /login 에서 Google 로그인 시작
    A->>G: /api/auth/google/start
    G->>A: /api/auth/google/callback
    A->>D: 사용자 조회 또는 생성
    A-->>U: HMAC 서명 세션 토큰 쿠키 설정 후 /concept 이동
```

관련 모듈:

| 영역 | 파일 |
| --- | --- |
| Google OAuth 시작/콜백 | `app/api/auth/google/start/route.ts`, `app/api/auth/google/callback/route.ts` |
| 세션 쿠키 | `lib/auth/session.ts` |
| 로그인 사용자 조회 | `app/actions.ts`의 `getSessionUser()` |

세션은 `SESSION_SECRET` 기반 HMAC 서명 토큰으로 검증되며, 운영 환경에서는 32자 이상의 서명 키가 필요하다. 개발용 이메일 로그인은 운영 환경에서 차단된다.

## 5. 브랜드 분석 및 카드뉴스 생성 흐름

```mermaid
sequenceDiagram
    participant U as 사용자
    participant C as /concept
    participant A as Agent APIs
    participant G as /generate
    participant API as /api/campaigns/generate
    participant P as Media Carousel Pipeline
    participant AI as LLM/Image Providers
    participant DB as DB Service

    U->>C: URL 또는 브랜드 정보 입력
    C->>DB: 브랜드 정보 저장
    U->>A: 브랜드 프로필 대화형 보정
    U->>G: 생성 요청 대화
    G->>A: 생성 조건 수집
    G->>API: 생성 요청
    API->>P: 브랜드/주제/목표 전달
    P->>AI: 카피 및 이미지 생성
    P->>DB: Campaign, Slides, Post 저장
    API-->>G: campaignId 반환
    G-->>U: /campaign/[id] 결과 표시
```

주요 파일:

| 단계 | 파일 |
| --- | --- |
| 브랜드 입력 UI | `app/(cms)/concept/ConceptForm.tsx` |
| 브랜드 분석 Action | `app/actions.ts`의 `analyzeBrandWebsiteAction()` |
| 브랜드 보정 Agent | `app/api/agents/brand/route.ts` |
| 생성 UI | `app/(cms)/generate/GenerateForm.tsx` |
| 생성 조건 Agent | `app/api/agents/generate/route.ts` |
| 생성 API 진입점 | `app/api/campaigns/generate/route.ts`, `src/app/api/campaigns/generate/route.ts` |
| 생성/렌더링 파이프라인 | `src/lib/layout/mediaCarouselPipeline.ts` |
| 결과 UI | `app/(cms)/campaign/[id]/CampaignResultView.tsx` |

`/generate`는 참고 이미지를 최대 4장 업로드해 생성 API에 `productImageUrls`로 전달한다. 이미지 공급자는 Vercel Blob 또는 애플리케이션 `/uploads/` 경로처럼 신뢰되는 업로드 URL만 다시 가져온다.

브랜드 URL 분석에는 `lib/brand-url-collector.ts`와 함께 Gemini, Groq, Perplexity, Naver Shopping 연동 모듈이 존재한다. URL 수집기는 사설 주소 및 redirect 목적지 차단과 응답 크기 제한을 적용한다. 대화형 Agent API는 OpenAI 설정이 없을 경우 제한된 fallback 응답만 반환한다.

## 6. 결과 편집 및 저장 구조

```mermaid
flowchart TD
    Result["/campaign/[id]"] --> Text["슬라이드 텍스트 편집 Action"]
    Result --> ReRender["스타일/이미지 재생성 Action"]
    Result --> Replace["배경 이미지 교체 Action"]
    Replace --> Upload["/api/upload"]
    Text --> DB["DB Service"]
    ReRender --> Pipeline["Renderer / Image Provider"]
    Pipeline --> DB
```

관련 Server Actions는 `app/actions.ts`에 위치한다. 배경 이미지 교체 UI는 업로드 API의 `files` 입력과 `urls` 응답 계약을 사용하도록 연결되어 있다.

## 7. 데이터 모델

```mermaid
erDiagram
    User ||--o{ Brand : owns
    User ||--o{ Campaign : creates
    User ||--o{ Post : owns
    User ||--o| InstagramAccount : connects
    Brand ||--o{ Campaign : defines
    Brand ||--o{ Post : publishes
    Campaign ||--|{ CarouselSlide : contains
    Campaign ||--o{ Post : schedules
```

핵심 저장 객체:

| 모델 | 용도 |
| --- | --- |
| `User` | 로그인 사용자, 플랜, PayPal 구독 상태 |
| `Brand` | 브랜드 분석 결과 및 생성 기준 정보 |
| `Campaign` | 카드뉴스 생성 단위와 상태 |
| `CarouselSlide` | 각 슬라이드 카피 및 이미지 |
| `Post` | Instagram 게시 캡션, 예약 시간, 게시 상태 |
| `InstagramAccount` | Meta 연동 계정 및 암호화 토큰 |

## 8. 결제 구조

```mermaid
sequenceDiagram
    participant U as 사용자
    participant UI as /billing
    participant API as PayPal API Route
    participant PP as PayPal
    participant DB as DB Service

    U->>UI: 플랜 선택
    UI->>PP: 구독 승인
    UI->>API: subscriptionId 전달
    API->>PP: 구독 상태 조회
    API->>DB: 검증된 plan_id 기반 플랜/구독 상태 저장
    PP->>API: Webhook 이벤트
    API->>DB: 결제 상태 동기화
```

관련 파일:

| 기능 | 파일 |
| --- | --- |
| 결제 UI | `app/(cms)/billing/PricingClientView.tsx` |
| 활성화/취소/Webhook | `app/api/paypal/*` |
| PayPal 클라이언트 | `lib/paypal.ts` |
| 요금제 제한 | `lib/limits.ts` |

구독 활성화 시 내부 플랜은 PayPal 구독의 검증된 `plan_id`를 기준으로 결정된다. `FREE`는 생성 권한 없는 내부 상태이며, 유료 상품은 Single(월 3,000원/1회), Creator(월 19,000원/10회), Studio(월 45,000원/30회)다. 현재 취소 정책은 즉시 이용권 없음 상태 전환이며 결제 화면의 안내도 같은 정책을 표시한다.

## 9. Instagram 게시 구조

```mermaid
flowchart LR
    MetaStart["/api/auth/meta/start"] --> Meta["Meta OAuth"]
    Meta --> MetaCallback["/api/auth/meta/callback"]
    MetaCallback --> Account["InstagramAccount 저장"]
    PostAction["승인/예약 Action"] --> Instagram["Instagram Graph API"]
    Cron["/api/cron/publish"] --> Instagram
```

백엔드 구현 위치:

| 기능 | 파일 |
| --- | --- |
| Meta OAuth | `app/api/auth/meta/*`, `lib/meta/*` |
| Instagram 게시 클라이언트 | `lib/instagram/client.ts` |
| 예약 게시 실행 | `app/api/cron/publish/route.ts` |
| 승인/예약 Action | `app/actions.ts` |

현재 OAuth 완료/오류 리다이렉트가 `/instagram`을 대상으로 하지만 해당 UI 경로가 현재 CMS에 없으므로 사용자 기능으로는 완료되지 않은 상태다.

## 10. 운영 경계와 검증 지점

| 경계 | 확인할 사항 |
| --- | --- |
| 인증 | HMAC 서명 세션 적용됨; OAuth state와 키 운영 검증 지속 |
| 외부 URL 수집 | SSRF/redirect/크기 방어 적용됨; 운영 관측 지속 |
| AI 생성 | 주요 배열 응답 fallback 적용됨; 공통 스키마, 생성 시간 및 비용 보완 |
| 업로드 | MIME/파일 크기/요청당 4장 적용됨; 사용자 쿼터와 속도 제한 보완 |
| 결제 | PayPal 플랜 검증 적용됨; webhook 멱등성과 sandbox E2E 보완 |
| 게시 | Instagram 연결 UI, 예약 게시 재시도 및 실패 알림 |
| 데이터 저장 | 운영 DB fail-closed, 마이그레이션 및 백업 |

현재 구현의 우선순위와 장애 목록은 `CURRENT_STATUS_AND_IMPROVEMENTS.md`를 기준 문서로 사용한다.
