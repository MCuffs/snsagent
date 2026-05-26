# Shuffla (AI Card News Studio SaaS MVP)

Shuffla는 브랜드 URL과 대화를 바탕으로 SNS 카드뉴스를 생성하고 편집하는 SaaS MVP입니다.

현재 구현은 제품 검증용 단계입니다. 랜딩, Google Login, 브랜드 분석, 참고 이미지 기반 카드뉴스 생성, 결과 편집, 작업 목록, PayPal 결제 연동이 연결되어 있으며 세션 서명과 결제 플랜 서버 검증도 반영되었습니다. 공개 화면은 현재 구현된 생성·편집·다운로드 흐름만 안내하고, Instagram 사용자 흐름은 추후 개발 범위입니다.

## 문서 기준

| 문서 | 용도 |
| --- | --- |
| `CURRENT_STATUS_AND_IMPROVEMENTS.md` | 현재 구현 완료 범위, 장애, 우선순위의 기준 문서 |
| `SYSTEM_ARCHITECTURE.md` | 현재 라우트와 서비스 구조 |
| `DEVELOPMENT_LOG.md` | 날짜별 주요 개발 이력과 검증 기록 |
| `LAYERS.md` | 코드 책임 분리 및 확장 규칙 |

## 현재 제공 범위

| 영역 | 경로/모듈 | 상태 |
| --- | --- | --- |
| 마케팅 화면 | `/`, `/pricing`, `/blog` | 구현됨 |
| 인증 | `/login`, `app/api/auth/google/*` | Google OAuth 및 HMAC 서명 세션 구현됨 |
| 브랜드 콘셉트 | `/concept`, `app/api/agents/brand` | URL 분석, 프로필 저장, 대화형 수정 구현됨 |
| 카드뉴스 생성 | `/generate`, `app/api/agents/generate`, `POST /api/campaigns/generate` | 유료 이용권의 월 횟수 내 대화형 생성 및 렌더링 구현됨 |
| 결과/편집 | `/campaign/[id]` | 텍스트/스타일/배경 교체/다운로드 구현됨 |
| 작업 목록 | `/works` | 구현됨 |
| 구독 | `/billing`, `app/api/paypal/*` | Single 3,000원/1회, Creator 19,000원/10회, Studio 45,000원/30회 및 서버 검증 구현됨 |
| Instagram 발행 | `app/api/auth/meta/*`, `app/api/cron/publish`, Server Actions | 백엔드 코드 유지, 사용자 흐름은 추후 개발 예정 |

현재 CMS 메뉴는 `Concept`, `Generate`, `Works`이며, 결제 화면은 사이드바의 요금제 링크에서 접근합니다. 과거 `/brand`, `/campaign/new`, `/instagram` 기반 안내는 현재 사용자 화면 구조가 아닙니다.

## 사용자 흐름

```text
Google Login
  -> /concept 에서 브랜드 URL 분석 및 프로필 저장
  -> /billing 에서 카드뉴스 이용권 구독
  -> /generate 에서 AI와 생성 조건 대화
  -> 카드뉴스 생성
  -> /campaign/[id] 에서 문구/스타일 편집 및 다운로드
  -> /works 에서 결과 재조회
```

`/generate`와 `/works`는 저장된 브랜드에 `websiteUrl`이 있어야 접근할 수 있습니다.

## 주요 구현

### 브랜드 분석

- `app/actions.ts`의 `analyzeBrandWebsiteAction()`이 URL 콘텐츠 수집과 브랜드 프로필 생성을 수행합니다.
- `lib/perplexity.ts`, `lib/gemini.ts`, `lib/groq.ts`, `lib/naver-shopping.ts`가 공급자별 분석과 네이버 스토어 보조 수집을 담당합니다.
- `app/api/agents/brand/route.ts`는 저장된 브랜드를 바탕으로 대화형 필드 수정을 제안합니다.
- Brand DNA는 `lib/brand-dna.ts`에 직렬화되어 생성 프롬프트에 전달됩니다.

### 카드뉴스 생성 및 편집

- `/generate`는 `app/api/agents/generate/route.ts`를 호출해 주제, 스타일, 목적, 슬라이드 수, 선택 상품 URL을 대화로 수집합니다.
- `/generate`에서 상품 참고 이미지를 최대 4장 업로드해 생성 요청의 `productImageUrls`로 전달할 수 있습니다.
- 생성 진입점은 `POST /api/campaigns/generate`이며, 현재 CMS 흐름은 `src/lib/layout/mediaCarouselPipeline.ts`의 미디어 파이프라인을 사용합니다.
- 미디어 파이프라인은 LLM 카피 생성, 규칙 기반 Agent 보정, 레이아웃/타이포그래피 계산, 이미지 생성, SVG/PNG 렌더링, 품질 로그 저장을 수행합니다.
- 결과 화면은 슬라이드 문구 저장, 폰트/색상 적용 재렌더링, 스타일 재생성, 캡션 저장, 개별/전체 다운로드 기능을 포함합니다.

`src/lib/carousel/pipeline.ts`의 commerce 파이프라인도 남아 있으며 API의 비-`media` 입력에서 사용할 수 있으나, 현재 CMS 주 흐름은 미디어 파이프라인입니다.

### 결제와 후속 범위

- 내부 `FREE` 상태는 로그인 직후 또는 취소 후의 이용권 없음 상태이며 생성 한도는 0회입니다.
- 결제 플랜은 `LITE`/Single 월 3,000원 1회, `PRO`/Creator 월 19,000원 10회, `UNLIMITED`/Studio 월 45,000원 30회로 매핑됩니다.
- PayPal 구독 생성, 활성화, 취소, webhook 라우트가 존재하며, 활성화는 PayPal에서 조회한 `plan_id`를 내부 플랜으로 매핑합니다.
- Meta OAuth, Instagram Graph API 클라이언트, cron 발행 라우트는 존재합니다.
- 현재 CMS에는 Instagram 계정 연결/예약 발행 화면이 없으므로 발행 기능은 사용자 흐름으로 완료되지 않았습니다.

## 알려진 주요 제한

운영 전에 해결하거나 범위를 결정해야 할 핵심 항목은 다음과 같습니다. 전체 목록과 우선순위는 `CURRENT_STATUS_AND_IMPROVEMENTS.md`를 기준으로 합니다.

1. Instagram 계정 연결/예약 게시 UI는 이번 범위에서 제외되어 추후 개발 예정입니다.
2. 업로드는 파일당 크기 및 요청당 4장 제한을 적용하지만, 사용자별 저장 쿼터와 속도 제한은 남아 있습니다.
3. 운영 DB fail-closed, 마이그레이션/백업 정책을 확정해야 합니다.
4. 새 KRW 요금제에 맞는 PayPal plan ID를 생성·설정하고 sandbox E2E를 수행해야 합니다.
5. 외부 인증/이미지 공급자를 사용한 E2E와 `npm audit` moderate 2건 검토가 남아 있습니다.

## 로컬 실행

```bash
npm install
cp .env.example .env
npm run dev
```

기본 접속 주소는 `http://localhost:3000`입니다.

주요 환경변수:

| 변수 | 용도 |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL/Prisma 연결 |
| `DATABASE_MOCK_FALLBACK` | 로컬 JSON DB fallback 허용 여부 |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `IMAGE_PROVIDER` | Agent, 카피, 이미지 생성 |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `PERPLEXITY_API_KEY` | 브랜드 분석 공급자 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 네이버 스토어 상품 보조 수집 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `SESSION_SECRET` | HMAC 세션 토큰 서명 키, 운영 환경에서 32자 이상 필요 |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_PLAN_*` | PayPal 구독 |
| `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY` | Meta/Instagram 연동 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 업로드 |
| `CRON_SECRET` | 예약 게시 실행 보호 |

## 검증

문서 기준 최근 확인 결과는 `CURRENT_STATUS_AND_IMPROVEMENTS.md`의 검증 현황을 참조합니다. `npm run lint`와 `npm run build`는 통과했으며, 운영 준비 판단은 남은 정책 구현과 외부 서비스 E2E 완료 이후에 내려야 합니다.
