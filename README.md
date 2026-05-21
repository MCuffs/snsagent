# InstaAgent (Instagram Card News AI Operations Staff SaaS MVP)

InstaAgent는 인스타그램 마케팅 대행사나 디자이너를 고용하기 힘든 소상공인, 스마트스토어 판매자, 로컬 비즈니스 대표님들을 위한 **"인스타그램 카드뉴스 자동 운영 AI 직원 SaaS"**입니다.
본 리포지토리는 MVP 검증 및 데모 판매가 가능한 완벽한 수준의 풀스택 구현체입니다.

---

## 주요 기능 (MVP)

1. **브랜드 컨셉 커스터마이징**: 브랜드 고유 톤앤매너, 타겟 고객, 브랜드 메인 컬러, 금지어, CTA 스타일 등을 입력하고 관리합니다.
2. **AI 카드뉴스 기획 & 비주얼 초안 빌더**:
   - 상품 정보와 목적을 기반으로 OpenAI GPT-4o를 이용해 모바일 최적화 기획(Hook, 본문 카피, 일러스트 디자인 프롬프트)을 생성합니다.
   - DALL-E 3(또는 Mock 이미지 공급자)를 연동하여 카드뉴스 슬라이드별 배경 이미지를 자동 렌더링합니다.
3. **실시간 모바일 시안 검토 및 카피 편집**: 생성된 카드뉴스를 넘겨보며 타이포그래피 카피를 직접 수정하고 즉시 뷰어에서 반영합니다.
4. **인스타그램 예약 발행 및 스케줄러**:
   - 승인 기반 워크플로우(Human-in-the-loop)를 지원하여 승인 완료된 피드만 예약 시간에 자동 업로드합니다.
   - Meta Instagram Graph API 규격의 연동을 모조리 구현했으며, 토큰 보안을 위해 서버 사이드에서 암호화 처리합니다.
   - 로컬 테스트 편의를 위해 `INSTAGRAM_MOCK_MODE`를 제공하여 Meta API 키 발급이 없는 상태에서도 시뮬레이션 동작을 검증할 수 있습니다.
5. **SaaS 요금제 한도 관리 및 스위처**: 요금제 등급(Free, Starter, Pro, Agency)에 따라 예약 업로드 권한, 한도 체크 및 이미지 워터마크 표시 처리가 내장되어 있습니다.

---

## 기술 스택

- **Frontend**: Next.js App Router, TypeScript, Tailwind CSS (Tailwind CSS v4), Lucide React
- **Backend / Database**: Next.js Server Actions, PostgreSQL, Prisma ORM
- **Database Fallback**: PostgreSQL 인프라 구축 없이 즉각 데모를 실행해볼 수 있도록, 파일 기반 로컬 모의 DB (`prisma/db.json`) 자동 대체 시스템이 내장되어 있습니다.

---

## 시작 방법

### 1. 의존성 패키지 설치
프로젝트 루트 경로에서 패키지를 설치합니다:
```bash
npm install
```

### 2. 환경변수 설정
`.env.example` 파일을 복사하여 `.env` 파일을 생성합니다:
```bash
cp .env.example .env
```

`.env` 설정 옵션:
- `DATABASE_URL`: PostgreSQL 데이터베이스 주소.
- `DATABASE_MOCK_FALLBACK`: `true`로 설정 시, 데이터베이스가 없는 환경에서도 로컬 JSON 파일 DB(`prisma/db.json`)로 즉시 로그인 및 CRUD 테스트가 실행됩니다 (데모 기본값).
- `OPENAI_API_KEY`: 실제 OpenAI 텍스트 및 DALL-E 이미지 생성을 검증하고 싶다면 키값을 대입하세요. 비워두거나 기본값일 경우, 고품질 장르별 미리 정의된 시안으로 AI 생성이 진행됩니다.
- `IMAGE_PROVIDER`: 카드뉴스 배경 이미지 공급자입니다. `mock`, `openai`, `bytedance` 중 하나를 사용합니다.
- `BYTEDANCE_API_KEY`: ByteDance 이미지 모델 연동 준비용 키입니다. 현재는 인터페이스와 TODO provider만 준비되어 있습니다.
- `INSTAGRAM_MOCK_MODE`: `true`로 설정 시, Meta API 토큰이 가짜거나 없어도 인스타그램 연동 성공 및 가상 예약/업로드 동작이 활성화됩니다.

### 3. 로컬 서버 구동
개발 모드로 Next.js 앱을 실행합니다:
```bash
npm run dev
```
로컬 접속 주소: `http://localhost:3000`

---

## 핵심 모듈 및 교체 가이드

### 0. 카드뉴스 생성 백엔드 파이프라인
카드뉴스 생성은 단일 LLM 호출이 아니라 단계형 파이프라인으로 동작합니다. 진입점은 `POST /api/campaigns/generate`이며 실제 구현은 `src/lib/carousel/pipeline.ts`에 있습니다.

순서:
1. `strategyEngine.generateStrategy()`로 콘텐츠 전략을 정합니다.
2. `hookEngine.generateHooks()`와 `selectBestHook()`로 첫 장 Hook을 고릅니다.
3. `structureEngine.generateStructure()`로 슬라이드 역할을 구성합니다.
4. `copyEngine.generateSlideCopies()`로 슬라이드별 카피를 만듭니다.
5. `designPromptEngine.generateDesignPrompts()`로 텍스트 없는 배경 이미지 프롬프트를 만듭니다.
6. `ImageProvider`가 배경 이미지를 생성합니다.
7. `renderer.renderSlide()`가 텍스트를 별도 오버레이로 합성합니다.
8. `captionEngine.generateCaption()`이 캡션과 해시태그를 만듭니다.
9. `qualityCheckEngine.runQualityCheck()`가 슬라이드 수, 문구 길이, 금지어, 이미지 URL, CTA를 검수합니다.
10. Campaign, CarouselSlide, Post를 저장합니다.

이미지 모델은 `src/lib/ai/imageProvider.ts` 인터페이스 뒤에 숨겨져 있으며 `mock`, `openai`, `bytedance` provider를 교체할 수 있습니다. 현재 renderer는 서버에서 SVG 템플릿 파일을 생성해 `/generated/carousel/*` URL을 반환하며, 추후 Sharp/Puppeteer 기반 PNG renderer로 교체할 수 있도록 독립 모듈로 분리되어 있습니다.

API 요청 예시:
```bash
curl -X POST http://localhost:3000/api/campaigns/generate \
  -H "Content-Type: application/json" \
  -d '{
    "brandId": "brand-id",
    "productName": "생활 정리함",
    "productDescription": "작은 공간을 깔끔하게 정리하는 수납 상품",
    "keyBenefits": "공간 절약, 쉬운 설치, 깔끔한 디자인",
    "objective": "구매 전환",
    "slideCount": 5,
    "productImageUrls": []
  }'
```

### 1. 인스타그램 API 연동 방식
인스타그램 업로드는 Meta Graph API를 기반으로 3단계 트랜잭션으로 진행됩니다:
- **1단계**: [lib/instagram/client.ts](file:///Users/jeongminsu/Downloads/SNS%20AI%20Agent/lib/instagram/client.ts) 의 `createMediaContainer` 함수를 통해 업로드할 슬라이드 이미지와 캐러셀 플래그(`is_carousel_item=true`)를 Meta 서버에 임시 업로드하여 컨테이너 ID들을 획득합니다.
- **2단계**: `createCarouselContainer` 함수에 획득한 슬라이드 컨테이너 ID 배열과 피드 캡션을 묶어서 전달하여 최종 캐러셀 배포 컨테이너 ID를 만듭니다.
- **3단계**: `publishMedia` 함수로 캐러셀 컨테이너를 최종 배포(게시)합니다.
- *참고*: Instagram Graph API는 자체 스케줄 인자를 API로 제공하지 않으므로, 미래 시간 예약 시에는 DB 상태를 `scheduled`로 둔 후 크론 스케줄러(Cron Job)가 백그라운드에서 예약 시간에 게시 함수를 트리거하도록 동작해야 합니다.

### 2. ByteDance 이미지 모델(Doubao 등) 교체 방법
현재 카드뉴스 배경 이미지는 [lib/ai/imageProvider.ts](file:///Users/jeongminsu/Downloads/SNS%20AI%20Agent/lib/ai/imageProvider.ts) 인터페이스에 맞춰 추상화되어 있습니다. 추후 ByteDance 모델로 변경하려면 다음 순서를 따르십시오.

1. **ByteDance SDK 및 API Credentials 확보**
2. **ByteDanceImageProvider 클래스 완성**
   ```typescript
   export class ByteDanceImageProvider implements ImageProvider {
     async generateImage(prompt: string): Promise<{ imageUrl: string }> {
       // 1. API 호출 정보 빌드
       const response = await fetch("https://open.volcengineapi.com/api/v1/image/generate", {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           "Authorization": `Bearer ${process.env.BYTEDANCE_API_KEY}`
         },
         body: JSON.stringify({
           model: "doubao-image-v2",
           prompt: prompt,
           width: 1024,
           height: 1024
         })
       });
       const data = await response.json();
       return { imageUrl: data.data[0].url };
     }
   }
   ```
3. **팩토리 함수 스위칭**
   [lib/ai/imageProvider.ts](file:///Users/jeongminsu/Downloads/SNS%20AI%20Agent/lib/ai/imageProvider.ts) 의 `getImageProvider` 함수에서 ByteDanceProvider 인스턴스를 리턴하도록 코드를 변경합니다.

---

## SaaS 확장 로드맵

1. **Stripe / Toss Payments 결제 연동**: 요금제 스위처 페이지에 실제 결제 승인 게이트웨이를 연결하여 정기 구독 결제 구현.
2. **인스타그램 실제 크론 스케줄러**: Vercel Cron 또는 Node-Cron을 도입하여 매분 `scheduled` 상태 중 현재 시각에 도달한 포스트를 실제 업로드하는 배치 파이프라인 가동.
3. **카드뉴스 에디터 고도화**: 타이포 외에도 폰트 종류, 텍스트 배치 좌표 조정 기능 및 브랜드 워터마크 오버레이 실제 이미지 렌더링 서버(Canvas API/Puppeteer) 연동.
4. **성과 피드백 루프**: 게시 완료된 피드의 좋아요, 댓글, 도달수 성과 지표(Graph API Insights)를 수집하여 AI 기획 시 성과가 좋았던 컨셉 비중을 자동 증가시키는 피드백 AI 마케팅 시스템 구축.
