# AE Tracking Plan Setup and Code Instrumentation Guide

이 문서는 웹 서비스에 `ae-tracking` 기반 트래킹 플랜을 만들고, AE에 업로드한 뒤, 코드에 이벤트를 심는 과정을 순차적으로 정리한 가이드입니다.

특정 서비스에 종속되지 않도록 작성했습니다. 각 프로젝트에서는 서비스명, APP_ID, host, projectId, 이벤트 목록만 해당 서비스 기준으로 바꿔 적용하세요.

## 1. 준비물 확인

필요한 값:

- AE 접속 host: 예) `https://your-domain.thinkingdata.kr/`
- ThinkingData SDK APP_ID: 예) `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- AE projectId: 숫자형 ID. 예) `12345`
- AE 한국어 데이터 트래킹 샘플 템플릿 xlsx
- 현재 서비스의 주요 사용자 흐름
- 코드에서 사용할 분석 SDK 위치

주의:

- APP_ID와 projectId는 다릅니다.
- APP_ID는 SDK 초기화와 데이터 수집에 사용합니다.
- projectId는 트래킹 플랜 업로드에 사용합니다.

## 2. CLI 설치

```bash
npm install -g ae-tracking
```

설치 확인:

```bash
ae-tracking --help
```

## 3. Skills 초기화

```bash
ae-tracking init
```

이미 링크된 skill은 `skipped`로 표시될 수 있습니다.

`AGENTS.md` 충돌이 뜨면 기존 파일을 확인한 뒤 수동 병합하거나, 필요한 경우에만 `--force`를 사용합니다.

## 4. AE 로그인

```bash
ae-tracking auth login --host https://your-domain.thinkingdata.kr/
```

macOS에서 Chrome 자동 캡처를 사용할 때 Chrome 설정이 필요할 수 있습니다:

1. Chrome 메뉴 바에서 `보기`
2. `개발자`
3. `Apple Events의 자바스크립트 허용` 활성화

로그인 상태 확인:

```bash
ae-tracking auth status
```

정상 상태 예:

```text
https://your-domain.thinkingdata.kr/  abc123...xyz  updated 2026-06-08T02:34:56.144Z
```

## 5. 서비스 흐름 분석

트래킹 플랜을 만들기 전에 현재 서비스의 핵심 사용자 흐름을 정리합니다.

예시:

```text
방문
  -> 로그인
  -> 온보딩 또는 설정
  -> 유료 전환 또는 주요 기능 진입
  -> 핵심 작업 생성
  -> 결과 조회
  -> 편집 또는 재시도
  -> 다운로드, 공유, 저장
  -> 작업 목록 재방문
```

분석할 파일:

- README 또는 제품 설명 문서
- 라우트/페이지 파일
- 주요 클라이언트 컴포넌트
- 주요 API route 또는 server action
- 결제/구독 관련 코드
- 다운로드/내보내기 관련 코드
- 기존 analytics helper

## 6. 트래킹 플랜 설계

트래킹 플랜은 보통 네 묶음으로 나눕니다.

1. 이벤트 데이터
2. 이벤트 속성
3. 공통 이벤트 속성
4. 유저 속성

권장 이벤트 범위:

- `page_view`: 페이지 조회
- `login_start`, `login_complete`, `login_failed`, `logout`: 인증
- 설정/온보딩 시작 및 완료
- 주요 기능 시작, 완료, 실패
- 결제 페이지 조회, 플랜 선택, 결제 시작, 결제 성공, 결제 실패, 구독 취소
- 결과 화면 조회
- 편집 시작/저장/실패
- 다운로드/내보내기 시작 및 완료
- 목록 조회, 아이템 열기, 삭제
- 주요 네비게이션 클릭

속성명 규칙:

- 이벤트명은 snake_case 사용
- 속성명도 snake_case 사용
- 서비스별 내부 ID는 `*_id` 형태 사용
- 성공/실패 이벤트에는 `success`, `reason`, `error_code`, `http_status`를 함께 설계
- 결제 이벤트에는 `selected_plan`, `current_plan`, `payment_provider`, `amount`, `currency`, `order_id`, `subscription_id`를 설계

## 7. draft JSON 생성

`ae-tracking plan draft`는 JSON 입력을 xlsx로 변환합니다. 기본 구조는 다음과 같습니다.

```json
{
  "meta": {
    "app_type": "web_saas",
    "sdk_integration_mode": "both",
    "client_platforms": ["javascript"],
    "client_sdk_type": "javascript",
    "client_languages": ["typescript"],
    "server_language": "nodejs",
    "host": "https://your-domain.thinkingdata.kr/",
    "plan_name": "Tracking Plan",
    "scenario": "Core user funnel and product usage tracking",
    "source_type": "codebase",
    "user_identity": {
      "account_id_source": "user_account",
      "account_id_field": "user.id",
      "distinct_id_strategy": "auto"
    }
  },
  "events": [],
  "event_properties": [],
  "common_event_properties": [],
  "user_properties": []
}
```

검증:

```bash
ae-tracking plan validate --in .ae-tracking/output/tracking-plan-draft.json
```

CLI xlsx 생성:

```bash
ae-tracking plan draft \
  --in .ae-tracking/output/tracking-plan-draft.json \
  --out .ae-tracking/output/tracking-plan.xlsx
```

## 8. 한국어 템플릿 형식으로 변환

한국어 AE 환경에서는 기본 CLI가 만든 중국어 시트 형식을 인식하지 못할 수 있습니다.

기본 CLI 출력 예:

- `#事件数据`
- `#公共事件属性`
- `#用户数据`
- 타입: `文本`, `数值`, `布尔`, `时间`

한국어 템플릿 형식:

- `#이벤트 데이터`
- `#공통 이벤트 속성`
- `#유저 데이터`
- `#유저 ID 체계`
- 타입: `string`, `number`, `boolean`, `time`, `list`, `object`, `object group`

권장 방식:

1. 한국어 샘플 템플릿 xlsx를 원본으로 복사
2. 설명 시트와 `#유저 ID 체계`는 그대로 유지
3. 아래 세 데이터 시트만 draft 기준으로 다시 채움
   - `#이벤트 데이터`
   - `#공통 이벤트 속성`
   - `#유저 데이터`
4. 이벤트가 여러 속성을 가질 경우 `A:D` 이벤트 필드 셀은 같은 이벤트 범위에서 병합
5. 공통 속성과 유저 속성 중 이벤트 속성과 이름이 겹치는 항목은 업로드용 파일에서 제거하는 것을 권장

타입 매핑:

| draft type | 한국어 템플릿 type |
| --- | --- |
| `string` | `string` |
| `number` | `number` |
| `bool` | `boolean` |
| `datetime` | `time` |
| `array_string` | `list` |
| `array_row` | `object group` |

업데이트 방식 매핑:

| draft update_type | 업로드 값 |
| --- | --- |
| `user_set` | `user_set` |
| `user_setOnce` | `user_setOnce` |
| `user_add` | `user_add` |

주의:

- 한국어 샘플에 `user_set_once`가 보이더라도, 서버가 `user_setOnce`만 받는 환경이 있습니다.
- 오류 예: `유저 업데이트 방식이 올바른 열거형 값이 아닙니다. ( user_set_once )`
- 이 경우 `user_setOnce`로 수정합니다.

## 9. 업로드 전 검증

검증 체크리스트:

- 시트명이 한국어 템플릿과 정확히 같은가
- 헤더명이 템플릿과 정확히 같은가
- `#유저 ID 체계` 시트를 삭제하지 않았는가
- 이벤트명은 snake_case인가
- 필수 값이 빈칸인 행이 없는가
- 속성 타입이 허용 enum인가
- 유저 업데이트 방식이 허용 enum인가
- 이벤트 속성, 공통 속성, 유저 속성 사이에 같은 속성명이 과도하게 중복되지 않는가

## 10. AE 업로드

append 업로드:

```bash
ae-tracking plan upload \
  --project <projectId> \
  --xlsx .ae-tracking/output/tracking-plan-ko-template.xlsx \
  --draft .ae-tracking/output/tracking-plan-draft.json \
  --host https://your-domain.thinkingdata.kr/
```

기존 플랜 삭제 후 교체:

```bash
ae-tracking plan upload \
  --replace \
  --project <projectId> \
  --xlsx .ae-tracking/output/tracking-plan-ko-template-dedup.xlsx \
  --draft .ae-tracking/output/tracking-plan-draft.json \
  --host https://your-domain.thinkingdata.kr/
```

주의:

- `--replace`는 원격 기존 플랜 삭제 후 재업로드합니다.
- 운영 프로젝트에서는 반드시 기존 플랜 삭제 가능 여부를 확인한 뒤 실행합니다.

성공 응답:

```text
{
  "return_code": 0,
  "return_message": "success"
}
```

## 11. 업로드 오류 대응

### 형식 식별 실패

오류:

```text
트래킹 방안을 식별 할 수 없습니다. 방안 설명에 따라 업로드했는지 확인하십시오.
```

확인할 것:

- 한국어 템플릿이 아닌 중국어 템플릿으로 업로드하지 않았는가
- 시트명이 정확한가
- 설명 시트 또는 `#유저 ID 체계`가 삭제되지 않았는가
- 헤더명이 템플릿과 정확히 같은가

### 업데이트 방식 enum 오류

오류:

```text
# 유저 데이터, 업데이트 방식, N행: 유저 업데이트 방식이 올바른 열거형 값이 아닙니다. ( user_set_once )
```

조치:

```text
user_set_once -> user_setOnce
```

수정 후 `--replace`로 다시 업로드합니다.

### fetch 결과가 비어 있음

업로드 API가 success를 반환했는데:

```text
AE plan fetch returned no data
```

가능성:

- 조회 API가 업로드 결과를 바로 반영하지 않음
- 업로드는 되었지만 서버 검증에서 일부가 UI에만 표시됨
- 프로젝트 화면에서 직접 오류를 확인해야 함

이 경우 AE 웹 화면에서 트래킹 플랜 화면을 직접 확인하고, 표시되는 시트명/행/컬럼 오류를 기준으로 수정합니다.

## 12. 코드 계측 준비

권장 구조:

```text
lib/analytics/provider.ts
  - SDK 초기화
  - identify/login
  - super properties
  - track()
  - typed analytics helper
```

브라우저 SDK 초기화 예:

```ts
td.init({
  appId: APP_ID,
  serverUrl: SERVER_URL,
  autoTrack: {
    pageShow: true,
    pageHide: true,
  },
})
```

공통 속성으로 설정할 값:

- `app_name`
- `app_env`
- `app_version`
- `locale`
- `plan`
- `is_authenticated`
- `user_status`
- `device_type`
- `session_id`

로그인 사용자는 SDK login 또는 identify를 호출합니다.

## 13. Typed analytics helper 만들기

직접 `track('event_name', props)`를 곳곳에서 호출하지 말고, 이벤트별 helper를 만듭니다.

예:

```ts
export const analytics = {
  pageView: (page: string, props?: Record<string, unknown>) =>
    track('page_view', { page, ...props }),

  paymentStart: (
    selectedPlan: string,
    provider: string,
    props?: Record<string, unknown>,
  ) =>
    track('payment_start', {
      selected_plan: selectedPlan,
      payment_provider: provider,
      ...props,
    }),

  featureComplete: (
    resourceId: string,
    props?: Record<string, unknown>,
  ) =>
    track('feature_complete', {
      resource_id: resourceId,
      ...props,
    }),
}
```

장점:

- 이벤트명 오타 방지
- 속성명 일관성 유지
- 트래킹 플랜 변경 시 수정 지점 축소

## 14. 코드에 이벤트 심는 순서

### 14.1 페이지 조회

라우팅 변경을 감지하는 클라이언트 컴포넌트에서 기록합니다.

수집 속성:

- `page`
- `path`
- `search`
- `url`
- `full_url`
- `title`
- `referrer`
- `locale`
- `is_authenticated`
- `user_status`
- `user_id`
- `anonymous_id`
- `plan`

### 14.2 인증

심을 위치:

- 로그인 버튼 클릭
- OAuth 시작 route
- OAuth callback 성공/실패
- 로그아웃 버튼 클릭

이벤트:

- `login_start`
- `login_complete`
- `login_failed`
- `logout`

### 14.3 온보딩/설정

심을 위치:

- 설정 시작 버튼
- URL 분석 또는 프로필 생성 시작
- 분석 성공/실패
- 설정 저장 성공/실패
- 설정 보정용 AI 채팅 전송

이벤트:

- `setup_start`
- `setup_analysis_complete`
- `setup_complete`
- `setup_ai_chat_send`

### 14.4 핵심 기능 생성 플로우

심을 위치:

- AI 대화 메시지 전송
- 생성 조건이 준비되는 시점
- 생성 버튼 클릭
- API 성공 응답
- API 실패 응답

이벤트:

- `generate_agent_message_send`
- `generate_brief_ready`
- `generate_start`
- `generate_complete`
- `generate_failed`

생성 시간 측정:

```ts
const startedAt = Date.now()

analytics.generateStart(...)

// 성공 시
analytics.generateComplete({
  duration_ms: Date.now() - startedAt,
})
```

### 14.5 결제/구독

심을 위치:

- 결제 페이지 진입
- 플랜 선택
- 결제 SDK 호출 직전
- 결제 승인 API 성공/실패
- 구독 취소 요청 및 완료

이벤트:

- `billing_page_view`
- `plan_select_click`
- `payment_start`
- `payment_success`
- `payment_failed`
- `subscription_cancel`
- `subscription_cancel_complete`

### 14.6 결과/편집

심을 위치:

- 결과 화면 진입
- 항목 선택
- 편집 레이어 변경
- 자동 저장/수동 저장
- 이미지 업로드
- 재생성
- 캡션 또는 메타데이터 저장

이벤트:

- `result_view`
- `item_select`
- `editor_layer_edit`
- `editor_document_save`
- `background_upload`
- `item_regenerate`
- `caption_save`

### 14.7 다운로드/내보내기

심을 위치:

- 다운로드 버튼 클릭
- 서버 렌더 또는 zip 생성 성공/실패

이벤트:

- `asset_download`
- `export_complete`

수집 속성:

- `resource_id`
- `export_format`
- `export_scale`
- `download_scope`
- `success`
- `reason`

### 14.8 목록/재방문

심을 위치:

- 작업 목록 화면 진입
- 항목 클릭
- 항목 삭제 성공/실패

이벤트:

- `works_view`
- `work_open`
- `resource_delete`

## 15. 코드 검증

최소 검증:

```bash
npm run typecheck
```

변경 파일 lint:

```bash
npx eslint \
  lib/analytics/provider.ts \
  app/path/to/changed-component.tsx
```

가능하면 로컬에서 실제 브라우저 흐름을 실행하며 AE Debug 또는 브라우저 네트워크 탭에서 이벤트 전송 여부를 확인합니다.

## 16. 운영 전 체크리스트

- APP_ID가 운영 프로젝트 값인가
- receiver URL이 운영 수집 서버인가
- projectId가 업로드 대상 프로젝트와 일치하는가
- 이벤트명과 속성명이 AE 화면에 정상 등록됐는가
- 개인정보가 불필요하게 이벤트 속성으로 들어가지 않는가
- 결제 금액/통화/주문 ID가 성공/실패 모두에서 남는가
- 실패 이벤트에 reason이 남는가
- 다운로드/생성 같은 핵심 액션은 시작과 완료를 모두 기록하는가
- 타입스크립트와 lint가 통과하는가

## 17. 반복 운영 방식

이벤트를 추가하거나 수정할 때는 아래 순서를 반복합니다.

1. 코드 변경 전에 이벤트명/속성명 결정
2. draft JSON 업데이트
3. 한국어 템플릿 xlsx 재생성
4. AE 업로드
5. AE 화면 오류 확인
6. 코드 helper 업데이트
7. 호출부 계측
8. typecheck/lint 실행
9. Debug 모드 또는 실제 이벤트 수집 확인
