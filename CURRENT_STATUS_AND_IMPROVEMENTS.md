# Shuffla 개발 현황 및 개선 사항

기준일: 2026-05-25 (KST)
기준 브랜치: `main`

## 1. 현재 구현 현황

### 사용자 화면

| 영역 | 현재 구현 | 상태 |
| --- | --- | --- |
| 랜딩/가격 안내 | `/`, `/pricing` | 구현됨 |
| 로그인 | `/login`, Google OAuth API | 구현됨, 세션 보안 개선 필요 |
| 브랜드 콘셉트 | `/concept` | 구현됨 |
| 카드뉴스 생성 | `/generate`, `POST /api/campaigns/generate` | 구현됨, 생성 안정성 검증 필요 |
| 생성 결과/편집 | `/campaign/[id]` | 부분 구현, 배경 교체 오류 있음 |
| 작업 목록 | `/works` | 구현됨 |
| 결제 | `/billing`, PayPal API/Webhook | 부분 구현, 권한 검증 오류 있음 |
| Instagram 연동/게시 | 서버 API와 Action 존재 | 화면 경로 연결 미완료 |

### 핵심 백엔드 기능

| 기능 | 주요 구현 위치 | 상태 |
| --- | --- | --- |
| 사용자/브랜드/캠페인/게시물 저장 | `lib/db-service.ts`, `prisma/schema.prisma` | 구현됨, mock fallback 정책 점검 필요 |
| 카드뉴스 생성 파이프라인 | `src/lib/layout/mediaCarouselPipeline.ts` | 구현 및 변경 중 |
| 이미지 렌더링/업로드 | `src/lib/layout/renderer.ts`, `app/api/upload/route.ts` | 부분 구현 |
| Google 인증 | `app/api/auth/google/*` | OAuth 구현됨, 앱 세션 강화 필요 |
| Meta OAuth/게시 | `app/api/auth/meta/*`, `lib/instagram/client.ts` | 백엔드 구현됨, UI 미연결 |
| PayPal 구독 | `app/api/paypal/*`, `lib/paypal.ts` | 구현됨, 서버 검증 보완 필수 |

## 2. 현재 기대 흐름과 실제 상태

목표 사용자 흐름은 다음과 같다.

```text
로그인 -> URL/브랜드 입력 -> 참고 이미지 포함 생성 설정 -> 카드뉴스 생성
      -> 결과 편집/다운로드 -> 필요 시 게시 또는 결제
```

현재 상태:

| 단계 | 확인 결과 |
| --- | --- |
| 로그인 후 브랜드/URL 입력 이동 | `/concept` 이동 구조는 존재함 |
| URL 기반 생성 | UI 및 API 연결은 존재함 |
| 참고 이미지 업로드 기반 생성 | API 입력 여지는 있으나 `/generate` 화면 연결이 없음 |
| 이미지 생성 완료 후 결과 화면 | 구현됨 |
| 결과 화면 배경 이미지 교체 | 업로드 API 계약 불일치로 동작 불가 |
| 게시/예약 흐름 | Action과 API는 남아 있으나 CMS 화면에서 접근 불가 |

## 3. 즉시 처리해야 할 문제

### P0 - 배포 차단

| 항목 | 영향 | 관련 파일 | 필요한 조치 |
| --- | --- | --- | --- |
| 이메일 문자열 쿠키를 세션으로 신뢰 | 타 사용자 계정 위조 가능 | `lib/auth/session.ts`, `app/actions.ts` | 서명 세션 또는 서버 저장 세션으로 교체 |
| PayPal 플랜을 클라이언트 요청값으로 반영 | 저가 구독으로 상위 권한 획득 가능 | `app/api/paypal/activate/route.ts`, `lib/paypal.ts` | PayPal `plan_id`와 내부 플랜 매핑을 서버에서 검증 |

### P1 - 핵심 사용자 흐름 장애

| 항목 | 영향 | 관련 파일 | 필요한 조치 |
| --- | --- | --- | --- |
| 참고 이미지 생성 UI 부재 | 요구 기능을 사용할 수 없음 | `app/(cms)/generate/GenerateForm.tsx` | 파일 업로드와 `productImageUrls` 전송 연결 |
| 배경 이미지 교체 업로드 계약 불일치 | 결과 편집 실패 | `app/(cms)/campaign/[id]/CampaignResultView.tsx`, `app/api/upload/route.ts` | 요청 키와 응답 타입 통일 |
| 새 생성 버튼이 `/campaign/new`로 이동 | 결과 화면에서 404 발생 | `app/(cms)/campaign/[id]/CampaignResultView.tsx` | `/generate`로 변경 |
| Instagram OAuth 리다이렉트 대상 화면 없음 | Instagram 연결 완료 불가 | `app/api/auth/meta/*`, `app/(cms)/layout.tsx` | CMS 내 설정/연동 화면 복구 또는 경로 변경 |
| 결제 취소 시 즉시 FREE 처리 | UI 안내와 과금 권한 불일치 | `app/api/paypal/cancel/route.ts`, `app/(cms)/billing/PricingClientView.tsx` | 기간 종료 기반 취소 정책 구현 |

### P2 - 안정성 및 운영 보완

| 항목 | 영향 | 필요한 조치 |
| --- | --- | --- |
| 사용자 입력 URL을 서버에서 직접 fetch | SSRF 위험 | 사설/루프백/메타데이터 주소 차단 및 허용 정책 도입 |
| 무료 플랜 워터마크 미적용 | 과금 기능 우회 | 다운로드/렌더링 출력에 워터마크 적용 |
| DB 오류 시 mock fallback 가능 | 운영 데이터 유실처럼 보이는 장애 | 운영에서는 fail-closed 정책 강제 |
| 업로드 수량/쿼터 제한 없음 | 저장소 비용 및 오남용 위험 | 파일 수, 총 용량, 속도 제한 추가 |
| 기존 플랜 값 호환성 미보장 | 결과 페이지 렌더링 실패 가능 | 플랜 정규화 적용 및 마이그레이션 |

## 4. 이번 커밋에 포함된 진행 중 개발분

이번 문서화 커밋에는 다음 생성 파이프라인 변경도 포함된다.

| 파일 | 변경 내용 | 검토 필요 사항 |
| --- | --- | --- |
| `app/(cms)/generate/GenerateForm.tsx` | 생성 입력의 `keyContent` 구성 변경 | 생성 결과 회귀 테스트 필요 |
| `src/app/api/campaigns/generate/route.ts` | `objective`를 파이프라인에 전달 | 저장/렌더링 결과 확인 필요 |
| `src/lib/layout/mediaCarouselPipeline.ts` | LLM 기반 슬라이드 카피 생성 추가 | 응답 스키마 검증, 실패 fallback, 지연/비용 측정 필요 |

특히 `result.slides`가 배열인지 확인하지 않고 사용하는 경로는 모델 응답 이상 시 전체 생성 실패로 이어질 수 있으므로 보완 후 운영 검증이 필요하다.

## 5. 검증 현황

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run build` | 통과 | 오래된 `.next` 캐시 제거 후 통과 |
| `npm run lint` | 실패 | `GenerateForm.tsx` Hook 규칙 오류, `app/actions.ts` `prefer-const` 오류 등 |
| 로그인부터 생성 완료 E2E | 미검증 | 인증 보안 및 참고 이미지 UI 보완 후 수행 필요 |
| 참고 이미지 생성 E2E | 불가 | 현재 생성 UI 미연결 |
| 결제 권한 E2E | 보류 | PayPal 서버 검증 보완 필요 |

## 6. 권장 개발 순서

1. 세션 인증과 PayPal 플랜 검증을 먼저 수정한다.
2. 참고 이미지 업로드 생성, 배경 이미지 교체, 잘못된 이동 경로를 수정한다.
3. Instagram 설정/게시 UI를 CMS 경로에 다시 연결한다.
4. URL fetch 방어, 워터마크, 업로드 제한, DB fail-closed 정책을 적용한다.
5. lint를 통과시키고 로그인, URL 생성, 참고 이미지 생성, 편집, 결제, 게시의 E2E 검증을 수행한다.
