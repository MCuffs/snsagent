# Shuffla — System Layer Architecture

> **이 문서는 시스템의 공식 레이어 정의서입니다.**
> 새 기능을 추가하거나 기존 코드를 수정할 때 반드시 이 문서를 기준으로 삼으세요.
> 레이어 경계를 위반하는 코드는 작성하지 마세요.

---

## 레이어 전체 맵

```
┌─────────────────────────────────────────────────────────────────────┐
│  L1  PRESENTATION          app/(dashboard)/*, app/login/            │
├─────────────────────────────────────────────────────────────────────┤
│  L2  APPLICATION           app/actions.ts, app/api/**               │
├──────────────────────┬──────────────────────────────────────────────┤
│  L3  BUSINESS DOMAIN │  L4  ORCHESTRATION                           │
│  limits, brand-dna   │  carousel/pipeline, mediaCarouselPipeline    │
│  auth/session        │  (두 파이프라인 공통 진입점)                  │
├──────────────────────┴──────────────────────────────────────────────┤
│  L5  AGENT             carousel/agents, cardNewsAgent, brandHarness  │
├─────────────────────────────────────────────────────────────────────┤
│  L6  GENERATION        strategy/hook/copy/design/caption engines     │
│                        visualDirection, layoutEngine, referencePattern│
├─────────────────────────────────────────────────────────────────────┤
│  L7  AI PROVIDER       llmClient, ImageProvider (OpenAI/ByteDance/Mock)│
├─────────────────────────────────────────────────────────────────────┤
│  L8  RENDERING         renderer (SVG→PNG), typography, overlay       │
│                        layoutConfigs (10종), qualityCheck, harness   │
├─────────────────────────────────────────────────────────────────────┤
│  L9  DISTRIBUTION      instagram/client, meta/oauth, cron/publish    │
├─────────────────────────────────────────────────────────────────────┤
│  L10 PERSISTENCE       db-service, db (Prisma), storage/upload       │
│                        errorLogger                                    │
├─────────────────────────────────────────────────────────────────────┤
│  L11 INFRASTRUCTURE    env.ts, next.config, prisma/schema, .env      │
└─────────────────────────────────────────────────────────────────────┘
```

**호출 방향:** 위 레이어는 아래 레이어만 호출할 수 있습니다. 역방향 호출은 금지입니다.

---

## L1 — Presentation Layer

### 책임
사용자 인터페이스 렌더링. 상태 표시, 사용자 입력 수집, L2 액션 호출.

### 소속 파일
```
app/(dashboard)/brand/BrandForm.tsx
app/(dashboard)/brand/page.tsx
app/(dashboard)/calendar/CalendarView.tsx
app/(dashboard)/calendar/page.tsx
app/(dashboard)/campaign/new/CreateCampaignForm.tsx
app/(dashboard)/campaign/new/page.tsx
app/(dashboard)/campaign/[id]/CampaignResultView.tsx
app/(dashboard)/campaign/[id]/page.tsx
app/(dashboard)/dashboard/page.tsx
app/(dashboard)/instagram/page.tsx
app/(dashboard)/layout.tsx
app/(dashboard)/pricing/PricingClientView.tsx
app/(dashboard)/pricing/page.tsx
app/components/InstagramIcon.tsx
app/layout.tsx
app/login/page.tsx
app/page.tsx
app/globals.css
```

### 허용
- L2 Server Actions (`app/actions.ts`) 직접 import 및 호출
- L3 Business Domain 타입 import (읽기 전용, 타입만)
- React 상태 관리 (`useState`, `useReducer`)
- Next.js 라우팅 (`useRouter`, `redirect`)

### 금지
- L4 이하 직접 import (pipeline, agents, engines 등)
- DB 접근 (`dbService`, `prisma` 직접 사용)
- LLM/이미지 생성 API 직접 호출
- 비즈니스 로직 포함 (유효성 검사 이상의 로직)

### 확장 규칙
새 페이지 → `app/(dashboard)/[feature]/page.tsx` + 필요시 `[feature]/[Component].tsx`
새 공통 컴포넌트 → `app/components/[Component].tsx`

---

## L2 — Application Layer

### 책임
외부 요청의 유일한 진입점. 인증 확인, 권한 검사, L3 도메인 규칙 실행 후 L4 파이프라인으로 위임.

### 소속 파일
```
app/actions.ts                              ← Server Actions (UI에서 호출)
src/app/api/campaigns/generate/route.ts    ← REST API (외부/클라이언트 호출)
app/api/auth/google/callback/route.ts
app/api/auth/google/start/route.ts
app/api/auth/meta/callback/route.ts
app/api/auth/meta/start/route.ts
app/api/auth/test-login/route.ts
app/api/instagram/accounts/route.ts
app/api/cron/publish/route.ts
```

### 허용
- `getSessionUser()` 호출로 인증 확인
- L3 도메인 규칙 호출 (`checkBrandCountLimit` 등)
- L4 파이프라인 호출 (`generateCarouselCampaign`, `generateMediaCarousel`)
- L10 저장소 직접 호출 (`dbService`) — 단순 CRUD에 한함
- 에러 로깅 (`saveErrorLog`)

### 금지
- LLM 직접 호출 (OpenAI SDK를 `app/actions.ts`에서 직접 `new OpenAI()`) → L6으로 이동
- 렌더링 로직 포함
- 이미지 생성 로직 포함
- 비즈니스 알고리즘 포함

### 현재 위반 사항 ⚠️
`app/actions.ts`의 `analyzeBrandWebsiteAction`, `recommendCampaignAction`에서 OpenAI SDK를 직접 사용 중.
→ 향후 `lib/ai/brandAnalyzer.ts`, `lib/ai/campaignRecommender.ts`로 추출 예정 (L6 소속)

### 확장 규칙
새 Server Action → `app/actions.ts`에 추가 (파일이 커지면 `app/actions/[domain].ts`로 분리)
새 API 엔드포인트 → `app/api/[feature]/route.ts`

---

## L3 — Business Domain Layer

### 책임
도메인 규칙과 제약 조건 정의. 플랜 한도, 인증 세션, Brand DNA 스키마, 요금제 정의 등 비즈니스 정책.

### 소속 파일
```
lib/limits.ts              ← 플랜별 한도 실행 함수
lib/limits-types.ts        ← SubscriptionPlan, PRICING_PLANS 정의
lib/auth/session.ts        ← 세션 쿠키 관리
lib/brand-dna.ts           ← BrandDna 타입, parse/build/stringify
lib/brand-url-collector.ts ← 브랜드 URL 스크래핑
lib/env.ts                 ← 환경변수 접근자 (인프라 경계 추상화)
lib/errorLogger.ts         ← 에러 로그 저장
```

### 핵심 타입 (레이어 간 Contract)
```ts
// lib/brand-dna.ts
interface BrandDna {
  coreProducts: string[]
  valueProposition: string
  customerPainPoints: string[]
  differentiators: string[]
  visualMood: string
  contentPillars: string[]
  brandKeywords: string[]
  avoidVisuals: string[]
}

// lib/limits-types.ts
type SubscriptionPlan = 'FREE' | 'STARTER' | 'PRO' | 'AGENCY'
interface PlanFeature { monthlyCampaignLimit, brandLimit, canSchedule, hasWatermark }
```

### 허용
- L10 (`dbService`) 조회 — 규칙 판정에 필요한 데이터 읽기
- L11 (`env.ts`) 호출

### 금지
- L4 이하 파이프라인/에이전트/엔진 호출
- 이미지 생성, LLM 호출
- UI 의존성

### 확장 규칙
새 도메인 규칙 → `lib/[domain].ts` 또는 기존 파일에 함수 추가
새 플랜 기능 → `lib/limits-types.ts`의 `PlanFeature`에 필드 추가 후 `lib/limits.ts`에 체크 함수 추가

---

## L4 — Orchestration Layer

### 책임
카드뉴스 생성의 전체 흐름 제어. 각 단계(에이전트 → 생성 → 렌더링)를 순서대로 호출하고 결과를 DB에 저장.

### 소속 파일
```
src/lib/carousel/pipeline.ts          ← Commerce 타입 파이프라인
src/lib/layout/mediaCarouselPipeline.ts ← Media 타입 파이프라인
```

### 두 파이프라인의 차이
| 항목 | Commerce Pipeline | Media Pipeline |
|------|------------------|----------------|
| 진입 | `createCampaignAction` (products) | `POST /api/campaigns/generate` (topic/content) |
| 콘텐츠 생성 | strategy→hook→structure→copy 엔진 체인 | `cardNewsAgent` + `planMediaSlides` |
| 레이아웃 | 단순 텍스트 오버레이 | 10종 `LayoutDefinition` |
| 타이포그래피 | 기본 | `typographyEngine` 완전 적용 |
| 비주얼 | designPrompt 기반 | `visualDirectionEngine` 기반 |
| 결과 크기 | 1080×1080 | 1080×1350 |

### 허용
- L5 에이전트 실행
- L6 생성 엔진 호출
- L7 AI Provider 호출
- L8 렌더러 호출
- L10 DB 저장 (`dbService.saveCampaign` 등)

### 금지
- L1/L2 의존성
- 비즈니스 규칙 직접 판정 (한도 체크 등) → L3에서 수행 후 진입해야 함

### 확장 규칙
새 파이프라인 타입 → `src/lib/[type]Pipeline.ts` 생성, L2에서 분기 호출

---

## L5 — Agent Layer

### 책임
슬라이드 데이터의 규칙 기반 처리. 금칙어 제거, 글자수 제한, 중복 헤드라인 조정, 브랜드 DNA 강화.

### 소속 파일
```
src/lib/carousel/agents.ts          ← 4개 Agent 클래스 (Commerce 파이프라인용)
  BrandIdentityAgent                  - 금칙어 제거, CTA 적용
  CopywritingAgent                    - 글자수 트리밍, 중복 제거
  VisualConceptAgent                  - 레이아웃 타입 재배치 (수치 감지)
  QualityGuardAgent                   - 품질 점수 산정

src/lib/layout/cardNewsAgent.ts     ← 통합 규칙 프로세서 (Media 파이프라인용)
src/lib/layout/brandHarness.ts      ← Brand DNA 슬라이드 강화
```

### 에이전트 실행 순서 (Media Pipeline)
```
BrandIdentityAgent → CopywritingAgent → VisualConceptAgent → reinforceSlidesWithBrandDna → [렌더링] → QualityGuardAgent
```

### 현재 한계 및 향후 방향
현재 에이전트들은 **규칙 기반(deterministic)**으로만 동작합니다.
- LLM 추론 없음
- 상태 없음 (매 실행마다 리셋)
- QualityGuardAgent 점수가 실제 재생성을 트리거하지 않음

향후 LLM 기반 Agent로 업그레이드 시 이 레이어의 인터페이스를 유지하며 내부만 교체하세요.

### 핵심 타입 (레이어 간 Contract)
```ts
// src/lib/carousel/agents.ts
interface AgentSlideData {
  slideNumber: number
  role: string
  headline: string
  body: string
  layoutType: string
  designPrompt?: string
  diagnostics?: string[]
}
interface AgentReport { timestamp, status, score, logs: AgentReportItem[] }
```

### 허용
- 슬라이드 데이터 읽기/변환
- L6 엔진이 생성한 데이터를 후처리
- `parseBrandDna` (L3) 호출

### 금지
- LLM 직접 호출 (현재는 규칙 기반, LLM 도입 시 L6 통해야 함)
- DB 직접 접근
- 이미지 생성

---

## L6 — Generation Layer

### 책임
AI를 활용한 콘텐츠 생성. 전략, 훅, 구조, 카피, 디자인 프롬프트, 캡션, 비주얼 디렉션을 LLM/알고리즘으로 생성.

### 소속 파일
```
src/lib/carousel/strategyEngine.ts      ← 콘텐츠 전략 유형 결정
src/lib/carousel/hookEngine.ts          ← 훅 후보 생성 및 선택
src/lib/carousel/structureEngine.ts     ← 슬라이드 구조 설계
src/lib/carousel/copyEngine.ts          ← 슬라이드별 카피 생성
src/lib/carousel/designPromptEngine.ts  ← 이미지 생성용 프롬프트 생성
src/lib/carousel/captionEngine.ts       ← 인스타그램 캡션/해시태그 생성
src/lib/carousel/qualityCheckEngine.ts  ← Commerce 파이프라인 QA

src/lib/layout/visualDirectionEngine.ts ← 배경 이미지 프롬프트 생성
src/lib/layout/layoutEngine.ts          ← 콘텐츠→레이아웃 타입 매핑
src/lib/layout/referencePatternEngine.ts← 레이아웃 패턴 분석/기록
```

### 향후 추가 예정 (현재 L2 위반 중)
```
lib/ai/brandAnalyzer.ts            ← analyzeBrandWebsiteAction의 LLM 로직
lib/ai/campaignRecommender.ts      ← recommendCampaignAction의 LLM 로직
```

### 허용
- L7 AI Provider 호출 (`getLLMClient()`, `getPipelineImageProvider()`)
- L3 Brand DNA 파싱 (`parseBrandDna`)
- 순수 생성 함수 (입력 → 출력, 부수효과 없음)

### 금지
- DB 직접 접근
- 렌더링 로직
- 인증/권한 처리

### 확장 규칙
새 생성 단계 → `src/lib/carousel/[step]Engine.ts` 또는 `src/lib/layout/[step]Engine.ts`
LLM 호출은 반드시 L7의 `getLLMClient()` 또는 `getPipelineImageProvider()`를 통해야 함

---

## L7 — AI Provider Layer

### 책임
외부 AI API의 단일 추상화 지점. LLM(텍스트)과 Image Generator를 교체 가능한 인터페이스로 제공.

### 소속 파일
```
src/lib/ai/llmClient.ts                   ← LLMClient 인터페이스 + OpenAI/Mock 구현
src/lib/ai/imageProvider.ts               ← ImageProvider 인터페이스
src/lib/ai/providers/index.ts             ← getPipelineImageProvider() 팩토리
src/lib/ai/providers/openAIImageProvider.ts
src/lib/ai/providers/byteDanceImageProvider.ts
src/lib/ai/providers/mockImageProvider.ts
lib/ai/imageProvider.ts                   ← (레거시, 통합 예정)
lib/ai/generateCarousel.ts                ← (레거시, 통합 예정)
```

### 핵심 인터페이스 (레이어 간 Contract)
```ts
// src/lib/ai/llmClient.ts
interface LLMClient {
  generateJson<T>(stepName: string, prompt: string, fallback: () => T): Promise<T>
}

// src/lib/ai/imageProvider.ts
interface ImageProvider {
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<{ imageUrl: string }>
}
```

### Provider 선택 로직
```
IMAGE_PROVIDER=openai  + OPENAI_API_KEY 존재  → OpenAIImageProvider
IMAGE_PROVIDER=bytedance + BYTEDANCE_API_KEY 존재 → ByteDanceImageProvider
그 외                                         → MockImageProvider

LLM: OPENAI_API_KEY 존재 → OpenAILLMClient
     없음                 → MockLLMClient (deterministic fallback)
```

### 허용
- 외부 API 호출 (OpenAI, ByteDance 등)
- Retry 로직 (`withJsonRetry`)
- Mock 구현 (로컬 개발용)

### 금지
- 비즈니스 로직
- DB 접근
- 프롬프트 구성 (프롬프트는 L6에서 만들어 전달)

### 확장 규칙
새 이미지 Provider → `src/lib/ai/providers/[name]ImageProvider.ts` 구현 후 `providers/index.ts` 팩토리에 추가
새 LLM Provider → `LLMClient` 인터페이스 구현 후 `getLLMClient()` 팩토리에 추가

---

## L8 — Rendering Layer

### 책임
텍스트 + 배경 이미지를 합성하여 최종 카드뉴스 이미지(PNG)를 생성. SVG 구성 → Sharp PNG 변환 → 업로드.

### 소속 파일
```
src/lib/layout/renderer.ts              ← 메인 렌더러 (SVG→PNG, 1080×1350)
src/lib/carousel/renderer.ts            ← Commerce 렌더러 (SVG→PNG, 1080×1080)
src/lib/layout/typographyEngine.ts      ← 폰트 크기/줄바꿈/가독성 계획
src/lib/layout/overlayEngine.ts         ← SVG 오버레이 정의
src/lib/layout/mediaCardHarness.ts      ← 레이아웃+타이포그래피 통합 조정기
src/lib/layout/qualityCheck.ts          ← 렌더링 결과 품질 검사
src/lib/layout/layoutConfigs/           ← 10종 레이아웃 정의
  breaking-news.ts
  cinematic-headline.ts
  community-style.ts
  dark-editorial.ts
  magazine.ts
  minimal-clean.ts
  quote-focus.ts
  split-comparison.ts
  stat-highlight.ts
  trend-feed.ts
  config.ts / index.ts

src/lib/typography/emphasisEngine.ts    ← 강조 토큰 처리
src/lib/typography/lineBreakEngine.ts   ← 줄바꿈 알고리즘
src/lib/typography/typographyEngine.ts  ← (레거시, layout/typographyEngine.ts로 통합 예정)
```

### 레이아웃 시스템
10종 `LayoutDefinition` 각각은 다음을 정의합니다:
- `typographyStyle` — 폰트 계열 선택
- `overlayStyle` — 오버레이 종류 (dark-gradient, archive-light 등)
- `textPosition` — 텍스트 안전 영역
- `safeArea` — 픽셀 좌표 여백
- `recommendedHeadlineLength` / `recommendedBodyLength`
- `spacingRules` — 줄간격, 배지-헤드라인 간격 등

### 허용
- `sharp` 라이브러리 (PNG 변환)
- SVG 생성 (문자열 템플릿)
- L10 `uploadGeneratedAsset` 호출 (완성된 이미지 저장)

### 금지
- LLM/이미지 생성 API 호출
- DB 접근 (dbService)
- 비즈니스 로직

### 확장 규칙
새 레이아웃 → `src/lib/layout/layoutConfigs/[name].ts`에 `LayoutDefinition` 구현 후 `config.ts`에 등록, `layoutTypes.ts`의 `LayoutType`에 추가

---

## L9 — Distribution Layer

### 책임
생성된 카드뉴스를 Instagram에 발행하고 예약 관리.

### 소속 파일
```
lib/instagram/client.ts          ← Instagram Graph API 클라이언트 + 토큰 암호화
lib/meta/oauth.ts                ← Meta OAuth 플로우
lib/meta/pages.ts                ← Facebook Page 목록 조회
lib/meta/types.ts                ← Meta API 타입 정의
app/api/instagram/accounts/route.ts  ← 계정 목록 조회 API
app/api/cron/publish/route.ts    ← 예약 발행 Cron 핸들러
```

### 토큰 보안
Instagram 액세스 토큰은 DB 저장 전 AES-256-GCM으로 암호화됩니다 (`tokenEncryptor`).
복호화 키: `INSTAGRAM_TOKEN_ENCRYPTION_KEY` 환경변수.
레거시 base64 토큰도 읽기 가능 (하위 호환).

### Mock 모드
`INSTAGRAM_MOCK_MODE=true` 시 실제 API 호출 없이 성공 응답 시뮬레이션.
로컬 개발 및 데모 환경에서 사용.

### 발행 흐름
```
approveAndScheduleCampaignAction (L2)
  → campaign.slides[].imageUrl 수집 (절대 URL 조합)
  → schedulePost() (L9)
    → [Mock] mockMediaId 반환
    → [Real] Instagram Graph API: 미디어 업로드 → 발행 예약
  → DB 상태 업데이트: scheduled | posted
```

### 현재 한계 ⚠️
- Cron이 자동 실행되려면 Vercel Cron 설정 필요 (현재 수동 트리거만 가능)
- 재시도 로직 없음 — 발행 실패 시 `status=failed`로 영구 처리
- 작업 큐 없음

### 확장 규칙
새 소셜 플랫폼 → `lib/[platform]/client.ts` 패턴으로 추가

---

## L10 — Persistence Layer

### 책임
데이터 저장소 접근의 단일 추상화 지점. DB CRUD, 파일 저장, 에러 로깅.

### 소속 파일
```
lib/db.ts                        ← Prisma 클라이언트 싱글톤
lib/db-service.ts                ← Repository 패턴 (모든 DB 조작)
src/lib/storage/upload.ts        ← 파일 저장 (Vercel Blob | 로컬 폴백)
lib/errorLogger.ts               ← ErrorLog 테이블 기록
```

### 스토리지 선택 로직
```
BLOB_READ_WRITE_TOKEN 존재  → Vercel Blob (공개 https:// URL 반환)
BLOB_READ_WRITE_TOKEN 없음  → 로컬 public/generated/carousel/ (상대 경로 반환)
```

### DB 모델 요약
```
User          id, email, name, plan (FREE|STARTER|PRO|AGENCY)
Brand         id, userId, name, industry, ..., brandDna (JSON string)
InstagramAccount  id, userId, brandId, accessTokenEncrypted, status
Campaign      id, userId, brandId, status (draft→generated→scheduled→posted)
CarouselSlide id, campaignId, slideNumber, headline, body, imageUrl
Post          id, campaignId, userId, caption, hashtags, scheduledAt, status
ErrorLog      id, userId, actionName, errorMessage, contextData
```

### dbService 공개 인터페이스 (주요 메서드)
```ts
getOrCreateUser(email, name?)
getUser(userId) / updateUserPlan(userId, plan)
getBrands(userId) / getBrand(brandId) / saveBrand(userId, brandId?, data)
getInstagramAccount(userId, brandId) / saveInstagramAccount(...)
getCampaigns(userId) / getCampaign(campaignId) / saveCampaign(...)
saveSlides(campaignId, slides) / updateSlideContent(slideId, headline, body, imageUrl?)
getPosts(userId) / getPost(postId) / savePost(...) / updatePostStatus(...)
```

### 허용
- Prisma 호출 (`prisma.model.findMany` 등)
- Vercel Blob SDK (`@vercel/blob`)
- `fs` 모듈 (로컬 개발 폴백)

### 금지
- 비즈니스 로직 포함
- AI/LLM 호출
- HTTP 요청

---

## L11 — Infrastructure Layer

### 책임
애플리케이션 외부 설정 및 환경 변수 관리. 코드가 이 레이어를 통해서만 환경에 접근해야 합니다.

### 소속 파일
```
lib/env.ts             ← 모든 환경변수 접근 함수 (process.env 직접 접근 금지)
next.config.ts         ← Next.js 빌드 설정
prisma/schema.prisma   ← DB 스키마 정의
.env                   ← 로컬 환경변수 (git 제외)
.env.example           ← 환경변수 템플릿 (git 포함)
.env.vercel            ← Vercel 배포용 참고
tsconfig.json          ← TypeScript 설정
```

### env.ts 제공 함수
```ts
isProduction()
isInstagramMockMode()
getInstagramAccountId() / getInstagramAccessToken()
getMetaAppId() / getMetaAppSecret() / getMetaApiVersion()
getGoogleClientId() / getGoogleClientSecret()
getAppBaseUrl(request?)
getTokenEncryptionSecret()
isConfiguredOpenAIKey(apiKey)
```

### 규칙
- `process.env.XXX` 직접 접근은 `lib/env.ts`에서만 허용
- 다른 모든 레이어는 `lib/env.ts` 함수를 통해 접근
- 새 환경변수 추가 시 반드시 `env.ts`에 접근 함수 추가, `.env.example`에 문서화

---

## 데이터 흐름 다이어그램

### A. 카드뉴스 생성 (Media Pipeline)
```
[L1] CreateCampaignForm 제출
  ↓
[L2] POST /api/campaigns/generate
  → getSessionUser() [L3 auth]
  → checkMonthlyCampaignUsage() [L3 limits]
  → generateMediaCarousel() [L4]
      → planMediaSlides() → 슬라이드 구조 초안
      → BrandIdentityAgent.run() [L5]
      → CopywritingAgent.run() [L5]
      → VisualConceptAgent.run() [L5]
      → reinforceSlidesWithBrandDna() [L5]
      → for each slide:
          → planTypography() [L8]
          → applyMediaCardHarness() [L8]
          → generateVisualDirection() [L6]
          → imageProvider.generateImage() [L7]
          → renderMediaCard() [L8]
              → SVG 합성 → sharp().png() → uploadGeneratedAsset() [L10]
              → Vercel Blob URL 반환
          → runMediaCardQualityCheck() [L8]
      → QualityGuardAgent.run() [L5]
      → dbService.saveCampaign() [L10]
      → dbService.saveSlides() [L10]
  ↓
[L1] CampaignResultView 렌더링
```

### B. 인스타그램 발행
```
[L1] 승인 버튼 클릭
  ↓
[L2] approveAndScheduleCampaignAction()
  → campaign.slides[].imageUrl 수집
  → schedulePost() [L9]
      → Instagram Graph API (또는 Mock)
  → dbService.updatePostStatus('scheduled'|'posted') [L10]
  ↓
[L1] 상태 업데이트 표시
```

### C. 브랜드 URL 분석
```
[L1] URL 입력
  ↓
[L2] analyzeBrandWebsiteAction()
  → collectBrandUrlContext() [L3]
  → OpenAI GPT-4o 직접 호출 ← ⚠️ L6 위반 (향후 개선)
  → buildBrandDnaFromProfile() [L3]
  ↓
[L1] BrandForm 자동 채움
```

---

## 레이어 위반 현황 및 개선 로드맵

### 현재 위반 (기술 부채)
| 위치 | 위반 내용 | 심각도 | 개선 방향 |
|------|-----------|--------|-----------|
| `app/actions.ts:analyzeBrandWebsiteAction` | L2에서 OpenAI 직접 호출 | 중 | `lib/ai/brandAnalyzer.ts` (L6)로 추출 |
| `app/actions.ts:recommendCampaignAction` | L2에서 OpenAI 직접 호출 | 중 | `lib/ai/campaignRecommender.ts` (L6)로 추출 |
| `src/lib/typography/typographyEngine.ts` | L8 중복 구현 | 하 | `src/lib/layout/typographyEngine.ts`로 통합 |
| `lib/ai/generateCarousel.ts` | L7 레거시 파일 | 하 | `src/lib/ai/` 구조로 통합 |
| `lib/db-service.ts:DB_FILE_PATH` | JSON 파일 DB 잔재 | 하 | 제거 |

### 우선 순위 개선 항목
1. **완료** ✅ L10 Storage → Vercel Blob 교체
2. **예정** `lib/ai/brandAnalyzer.ts` 추출 (L2→L6 정리)
3. **예정** `lib/ai/campaignRecommender.ts` 추출 (L2→L6 정리)
4. **예정** L9 Distribution 재시도 로직 + Vercel Cron 설정
5. **장기** L5 Agent의 QualityGuard → 실패 시 재생성 트리거 구현

---

## 개발 시 체크리스트

새 코드를 작성하기 전에 확인하세요:

- [ ] 이 코드가 속할 레이어는 어디인가?
- [ ] 내가 호출하려는 모듈은 같은 레이어 또는 하위 레이어인가?
- [ ] DB 접근은 `dbService`를 통하는가? (직접 `prisma` 접근 금지)
- [ ] 환경변수는 `lib/env.ts` 함수를 통하는가? (`process.env` 직접 접근 금지)
- [ ] LLM 호출은 `getLLMClient()`를 통하는가?
- [ ] 이미지 생성은 `getPipelineImageProvider()`를 통하는가?
- [ ] 새 레이아웃 추가 시 `layoutConfigs/`에 정의하고 `config.ts`에 등록했는가?
- [ ] `.env.example`에 새 환경변수를 문서화했는가?
