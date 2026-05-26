# Shuffla (AI Card News Studio SaaS MVP)

Shuffla는 브랜드 URL과 대화를 바탕으로 SNS 카드뉴스를 생성하고 편집하는 SaaS MVP입니다.

현재 구현은 제품 검증용 단계입니다. 랜딩, Google Login, 브랜드 분석, 참고 이미지 기반 카드뉴스 생성, 결과 편집, 작업 목록, 국내 토스페이먼츠 카드 자동결제와 해외 고객용 PayPal 구독이 연결되어 있으며 세션 서명과 결제 검증도 반영되었습니다. 공개 화면은 현재 구현된 생성·편집·다운로드 흐름만 안내하고, Instagram 사용자 흐름은 추후 개발 범위입니다.

## 문서 기준

| 문서 | 용도 |
| --- | --- |
| `CURRENT_STATUS_AND_IMPROVEMENTS.md` | 현재 구현 완료 범위, 장애, 우선순위의 기준 문서 |
| `SYSTEM_ARCHITECTURE.md` | 현재 라우트와 서비스 구조 |
| `DEVELOPMENT_LOG.md` | 날짜별 주요 개발 이력과 검증 기록 |
| `LAYERS.md` | 코드 책임 분리 및 확장 규칙 |
| `UNIT_ECONOMICS.md` | Creator 가격 정책의 수수료·VAT·AI 원가 분석 |

## 현재 제공 범위

| 영역 | 경로/모듈 | 상태 |
| --- | --- | --- |
| 마케팅 화면 | `/`, `/pricing`, `/blog` | 구현됨 |
| 인증 | `/login`, `app/api/auth/google/*` | Google OAuth 및 HMAC 서명 세션 구현됨 |
| 브랜드 콘셉트 | `/concept`, `app/api/agents/brand` | URL 분석, 프로필 저장, 대화형 수정 구현됨 |
| 카드뉴스 생성 | `/generate`, `app/api/agents/generate`, `POST /api/campaigns/generate` | 유료 이용권의 월 횟수 내 대화형 생성 및 렌더링 구현됨 |
| 결과/편집 | `/campaign/[id]` | Editorial Canvas, 레이어 편집, AI 부분 보정, 확정 렌더/내보내기 구현됨 |
| 작업 목록 | `/works` | 구현됨 |
| 구독 | `/billing`, `app/api/payments/toss/*`, `app/api/paypal/*`, `app/api/cron/billing` | 국내 토스 자동결제 및 해외 PayPal 구독으로 유료 플랜 결제 구현됨 |
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
- 결과 화면은 `AI-Assisted Editorial Carousel Studio` 방식의 직접 조작 캔버스입니다. 배경/오버레이/타이틀/본문/스티커/CTA/워터마크 레이어를 분리하고, 텍스트 인라인 편집, 드래그/스냅, 순서/가시성/불투명도/서체/크기/오버레이 조절, undo/redo와 자동 저장을 지원합니다.
- AI 보정은 전체 슬라이드를 다시 생성하지 않고 선택 슬라이드의 카피 레이어 또는 배경 레이어만 변경합니다. 사용자 편집 상태는 `CarouselSlide.editorDocument`에 보존되고 확정 렌더 때 결정론적 PNG/JPG로 합성됩니다.
- 내보내기는 현재 슬라이드의 PNG/JPG, PNG 2x 및 전체 슬라이드 Instagram 4:5 PNG ZIP을 제공합니다.
- 생성 캠페인은 사용 이미지 모델, 최초 이미지 수, AI 배경 재생성 이미지 수를 저장하며 AI 배경 재생성은 최초 슬라이드 수만큼의 포함 크레딧으로 제한됩니다.

`src/lib/carousel/pipeline.ts`의 commerce 파이프라인도 남아 있으며 API의 비-`media` 입력에서 사용할 수 있으나, 현재 CMS 주 흐름은 미디어 파이프라인입니다.

### 결제와 후속 범위

- 내부 `FREE` 상태는 로그인 직후 또는 취소 후의 이용권 없음 상태이며 생성 한도는 0회입니다.
- 결제 플랜은 `LITE`/Single 월 3,000원 1회, `PRO`/Creator 월 19,000원 20회, `UNLIMITED`/Studio 월 45,000원 30회로 매핑됩니다.
- 토스페이먼츠 SDK가 카드 자동결제 인증을 시작하고, 서버 콜백이 저장된 `customerKey`를 검증한 후 내부 플랜 금액으로 빌링키 최초 결제를 승인합니다.
- 토스페이먼츠는 청구 스케줄을 제공하지 않으므로 `app/api/cron/billing`이 `CRON_SECRET` 인증 하에 국내 카드 구독 만기를 월별 승인합니다.
- 해외 고객은 PayPal Subscription 버튼을 사용하며, 서버가 PayPal의 `plan_id`와 서명된 웹훅을 검증해 권한을 동기화합니다. 활성 구독이 있으면 다른 공급자의 중복 가입은 허용하지 않습니다.
- 결제 공급자 전환 배포 전에는 `node scripts/migrate-tosspayments.mjs`를 먼저 실행합니다. 이 스크립트는 기존 네이버페이 배포가 조회하는 컬럼도 유지해 순차 배포 중 로그인 장애를 방지합니다.
- Meta OAuth, Instagram Graph API 클라이언트, cron 발행 라우트는 존재합니다.
- 현재 CMS에는 Instagram 계정 연결/예약 발행 화면이 없으므로 발행 기능은 사용자 흐름으로 완료되지 않았습니다.

## 알려진 주요 제한

운영 전에 해결하거나 범위를 결정해야 할 핵심 항목은 다음과 같습니다. 전체 목록과 우선순위는 `CURRENT_STATUS_AND_IMPROVEMENTS.md`를 기준으로 합니다.

1. Instagram 계정 연결/예약 게시 UI는 이번 범위에서 제외되어 추후 개발 예정입니다.
2. 업로드는 파일당 크기 및 요청당 4장 제한을 적용하지만, 사용자별 저장 쿼터와 속도 제한은 남아 있습니다.
3. 운영 DB fail-closed, 마이그레이션/백업 정책을 확정해야 합니다.
4. 토스페이먼츠 자동결제 MID 계약·청구 크론과 PayPal 해외 결제 플랜/웹훅을 설정하고 두 결제 경로의 테스트/라이브 소액 E2E를 완료해야 합니다.
5. 외부 인증/이미지 공급자를 사용한 E2E와 `npm audit` moderate 2건 검토가 남아 있습니다.
6. 브랜드 단위 스타일 메모리, MP4/애니메이션 출력, 실시간 공동 편집은 편집 문서가 확장 가능하도록 준비되어 있으나 후속 구현 범위입니다.

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
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `IMAGE_PROVIDER` | Agent, 카피, 이미지 생성 (`gpt-image-1` 원가 기준 고정) |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `PERPLEXITY_API_KEY` | 브랜드 분석 공급자 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 네이버 스토어 상품 보조 수집 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `SESSION_SECRET` | HMAC 세션 토큰 서명 키, 운영 환경에서 32자 이상 필요 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` | 토스페이먼츠 카드 자동결제 |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `NEXT_PUBLIC_PAYPAL_*` | 해외 고객용 PayPal 구독 |
| `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY` | Meta/Instagram 연동 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 업로드 |
| `CRON_SECRET` | 예약 게시 및 월 구독 청구 실행 보호 |

## 검증

문서 기준 최근 확인 결과는 `CURRENT_STATUS_AND_IMPROVEMENTS.md`의 검증 현황을 참조합니다. `npm run lint`와 `npm run build`는 통과했으며, 운영 준비 판단은 남은 정책 구현과 외부 서비스 E2E 완료 이후에 내려야 합니다.
