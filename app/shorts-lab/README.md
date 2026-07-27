# Shorts Lab — 구조 검증 데모

이지컷(easycut.co.kr)이 쓰는 "인기 롱폼 → 쇼츠 자동 생성" 파이프라인을 우리 환경에서 검증하기 위한
**독립 데모**입니다. Shuffla 본 서비스의 도메인 로직·DB·인증과 의존관계가 없습니다.

```bash
npm run dev
open http://localhost:3000/shorts-lab
```

---

## 1. 4단계 구조

```
1) 실시간 인기 롱폼 로딩     videos.list?chart=mostPopular&regionCode=KR   (1 유닛)
2) 재사용 가능 여부 확인      status.license === 'creativeCommon' + 길이·퍼가기·지역
3) 숏폼 자동 생성            하이라이트 스코어링 → 훅 제목·자막
4) 인기 댓글 캡처            commentThreads.list?order=relevance           (1 유닛)
```

3~4단계는 NDJSON 스트리밍입니다. 실제 파이프라인도 단계가 길어서(다운로드 → 전사 → 스코어링 → 렌더)
처음부터 스트리밍으로 잡아뒀습니다. 실 구현으로 바꿔도 UI는 그대로 씁니다.

## 2. 파일 맵

| 경로 | 역할 |
|---|---|
| `page.tsx` / `../[locale]/shorts-lab/page.tsx` | 진입점. **둘 다 필요** (아래 4번 참고) |
| `ShortsLab.tsx` | 메인 클라이언트 UI (3열 워크플로우) |
| `ShortPreview.tsx` | 9:16 프리뷰 렌더러 + YouTube IFrame 플레이어 |
| `pipeline.ts` | 순수 로직 — 자격 검사, 클립 생성, 포맷터 |
| `trending.ts` | 1단계 데이터 로더 (실 API / 픽스처 폴백) |
| `comments.ts` | 4단계 댓글 수집 (실 API / 픽스처 / 없음) |
| `fixtures.ts` | 키 없을 때 쓰는 가상 데이터셋 |
| `types.ts` | 공용 타입 |
| `../api/shorts-lab/{trending,generate}/route.ts` | 라우트 핸들러 |

## 3. ⚠️ 실제 동작 vs 목업

이어서 작업할 때 가장 먼저 알아야 할 부분입니다.

| 기능 | 상태 |
|---|---|
| 인기 영상 목록 | ✅ **실제** YouTube Data API |
| 라이선스·길이·퍼가기 필터 | ✅ **실제** API 응답 기반 |
| 인기 댓글 캡처 | ✅ **실제** commentThreads (좋아요순 재정렬) |
| 구간 재생 | ✅ **실제** IFrame 임베드 (다운로드 없음) |
| **하이라이트 구간 선정** | ❌ **휴리스틱** — 사실상 무작위 |
| **훅 제목·자막** | ❌ **템플릿 문자열 조합** |
| 음성 전사 | ❌ 미구현 (단계 표시만) |
| mp4 렌더 | ❌ 미구현 (합성 미리보기만) |

훅 점수(예: 92점)는 **결정적 난수**입니다. 영상 내용과 무관합니다.

## 4. 이 레포 특유의 함정

- **`app/[locale]/shorts-lab/page.tsx`가 반드시 있어야 합니다.** `proxy.ts`의 next-intl 미들웨어가
  모든 경로를 `/{locale}/...`로 리라이트해서, 루트 `app/shorts-lab/`만 있으면 404가 납니다.
  `sling-pang`, `studio-tycoon`도 같은 패턴입니다.
- **API 라우트는 `/api/` 아래에 둬야 합니다.** `proxy.ts`가 `/api`로 시작하는 경로만 통과시킵니다.
- **CSP.** `next.config.ts`의 전역 CSP에 `frame-src`가 없어 `default-src 'self'`로 폴백되며
  모든 외부 iframe이 차단됩니다. 전역을 넓히지 않고 `/shorts-lab` 경로에만 오버라이드를 추가했습니다.
  (같은 헤더 키는 뒤 항목이 앞 항목을 덮어씀)
- **React Compiler 린트가 엄격합니다.** `react-hooks/set-state-in-effect` 때문에 effect 안에서
  setState를 못 씁니다. 초기 데이터는 서버 컴포넌트에서 props로 내리고, 나머지는 파생값(useMemo)이나
  이벤트 핸들러로 처리했습니다. **effect를 추가하지 마세요.**
- `AGENTS.md` 지시대로 Next.js 16 API는 `node_modules/next/dist/docs/`를 먼저 확인할 것.

## 5. 환경변수

```bash
# .env.local  (gitignore 대상 — 저장소에 없음)
YOUTUBE_API_KEY=...
```

- **없어도 동작합니다.** 픽스처 데이터로 폴백하고 헤더 배지가 `DEMO`로 표시됩니다.
- 발급: Google Cloud Console → YouTube Data API v3 사용 설정 → API 키 생성
  → **API 제한사항을 YouTube Data API v3로 한정**할 것.
- OAuth 불필요(공개 데이터만 사용). 기본 쿼터 1일 10,000유닛, 이 데모는 호출당 1유닛이라 사실상 무제한.

## 6. 실측으로 확인된 제약

2026-07-27 한국 인기 차트 50개 기준:

```
전체 50개 → 롱폼(3~60분) 33개 → CC 라이선스 1개
```

- **재사용 허용 영상이 2%뿐입니다.** 그래서 `재사용 허용만` 필터 기본값을 껐습니다.
  대신 필터 라벨에 개수를 표시해 제약이 눈에 보이게 했습니다.
- 유일한 CC 영상이 이지컷 `/popular`에서 "재사용 허용" 배지가 붙어 있던 것과 동일했습니다.
  → 이지컷도 같은 `status.license` 필드를 쓰고 있으며, 같은 소재 고갈 문제를 겪습니다.
- **댓글이 비활성화된 영상이 흔합니다.** `commentsDisabled` 403은 정상 상태로 처리하며,
  픽스처로 폴백하지 않고 `source: 'none'`으로 둡니다 (가짜 댓글이 섞이면 안 되므로).
- `order=relevance`는 좋아요순이 아닙니다. 50개를 받아 `likeCount`로 재정렬해야 "인기 댓글"이 됩니다.

## 7. 다음 작업

**하이라이트 선정을 실제 LLM으로 교체** — 교체 지점은 코드에 주석으로 표시돼 있습니다.

`app/api/shorts-lab/generate/route.ts`:
```ts
// ── 실 구현 교체 지점 ──
const clips = generateClips(video, pool.comments)
```

`ShortClip[]` 타입만 맞추면 UI는 수정할 필요가 없습니다. 선행 작업으로 전사(STT)가 필요합니다.
레포에 `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY` 슬롯이 이미 있습니다(`.env.example` 참고).

그 밖에 남은 것:
- mp4 렌더 — ffmpeg 필요. **원본 다운로드가 필요해 라이선스 리스크와 직결**되므로 의도적으로 미구현.
- 소재 확보 전략 — CC만 쓰면 소재가 마릅니다. `search.list`에 `videoLicense=creativeCommon`을
  쓰면 트렌딩 밖에서 긁어올 수 있지만 100유닛/호출입니다.

## 8. 참고: 템플릿 구조

5종이 **동일한 레이아웃**을 공유하고 훅 둘째 줄의 색 처리만 다릅니다 (이지컷과 동일 구조).

```
[ 훅 2줄 · 중앙정렬 ]   ← 템플릿 배경색
[ 영상 밴드 · 풀블리드 ]
[ (댓글 카드) ]
[ 워터마크 · 하단 중앙 ]
```

| 템플릿 | 둘째 줄 |
|---|---|
| 댓글 캡처 | 블루→퍼플 그라데이션 텍스트 |
| 다크 레드 | 빨강 박스 + 흰 글씨 |
| 화이트 옐로 | 노랑 박스 + 검은 글씨 |
| 다크 미니멀 | 빨강 텍스트 |
| 페이퍼 | 빨강 텍스트 |

템플릿 추가는 `ShortPreview.tsx`의 `TEMPLATES` 배열 + CSS `.sl-tpl-{id}` 규칙만 넣으면 됩니다.

앱 UI는 Shuffla 마케팅 페이지 톤(`#fbfaf7` 배경 / `#ed6238` 액센트)을 따르고,
9:16 프레임 **안쪽**은 결과물 디자인이라 별도 색을 유지합니다.
