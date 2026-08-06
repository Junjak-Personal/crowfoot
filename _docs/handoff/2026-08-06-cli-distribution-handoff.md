---
title: cli-distribution handoff — 2026-08-06
status: processing
topic: cli-distribution
kind: handoff
created: 2026-08-06
updated: 2026-08-06
related:
  - _docs/active/planning/2026-08-05/2026-08-05-cli-distribution-debranding.md
  - _docs/active/planning/2026-08-03/2026-08-03-cli-distribution.md
  - _docs/active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md
---

# cli-distribution — 앱 브랜딩 교체 + 미사용 패키지 정리

**이 리포(`Junjak-Personal/crowfoot`)가 이제 작업 기준이다.** 개명·히스토리 재작성·리포 분리는
끝났고, 남은 건 **앱 화면의 브랜딩**과 **안 쓰는 upstream 패키지 정리**다.

> 🔴 **가장 먼저 읽을 것 — §4 귀속과 §6 상표는 정반대 방향의 의무다.**
> 파일 상단의 `// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.)` 와
> `// Added in crowfoot; not part of the original Liam ERD source.` 는 **§4(b) 가 요구하는
> 고지**다. "Liam" 일괄 치환 스크립트를 돌리면 이게 같이 날아가고 그 순간 라이선스 위반이
> 된다. **브랜딩(§6)은 지우고, 귀속(§4)은 남긴다.** `LICENSE`·`NOTICE`·`scripts/pack-cli.js`
> 도 같은 이유로 보존.
>
> 반대로 **`erdkit` → `crowfoot` 류의 치환은 안전했다** — §4 문구에 그 단어가 없기 때문이다.
> 이 차이를 헷갈리면 안 된다.

---

## State

### 완료 (커밋 근거 있음 — 전부 이 리포 `master` 에 있음)

| | 커밋 |
|---|---|
| CommandPalette 프리뷰 제거 (`assets.liambx.com` 핫링크 6개) | `6ba524a2f` |
| `CrowfootLogoMark` 추가 — 테이블 1개 + 까마귀발, 요소 4, `currentColor` | `0759f6e09` |
| `erdkit` → `crowfoot` 개명 sweep, 버전 **0.1.0** 으로 리셋 | `d35d0c45c` |
| 히스토리 재작성 **11,849 → 38 커밋** + §4(c) 오기 정정 | `95599101d` |

**리포 분리 완료.** `Junjak-Personal/crowfoot` (PUBLIC, `isFork: false`, 기본 브랜치 `master`).
clone 해서 독립 검증했다 — 트리 해시 `a1e62714e…` 로컬/원격 일치, upstream 히스토리 없음,
`LICENSE`·`NOTICE` 존재, `crowfoot@0.1.0` / `bin=crowfoot`.

검증 기준선: `erd-core` 302 passed (4 todo) · `cli` 31 passed · `tsc` 0 · 루트 `pnpm lint` exit 0 ·
`npm pack --dry-run` 13파일(`LICENSE`·`NOTICE` 포함) · `npm publish --dry-run` 경고 0건.

### 미완료

**앱 화면이 아직 남의 브랜딩을 띄운다.** `CrowfootLogoMark` 는 만들어만 뒀고 **아무도 안 쓴다**
(`grep -rn CrowfootLogoMark frontend/packages/*/src` → 0건). 교체 대상 인벤토리 9파일은
[debranding 계획서](../active/planning/2026-08-05/2026-08-05-cli-distribution-debranding.md)의
"브랜딩 인벤토리" 표에 파일·행번호까지 있다. **여기 복제하지 않는다.**

---

## Remaining work

1. **`AppBar` 의 `<h1>` 과 로고** — 가장 눈에 띄고 가장 명확한 §6 표면.
   `AppBar.tsx:45` 의 `<h1>Liam ERD</h1>`, `:2`·`:35` 의 `LiamLogoMark` → `CrowfootLogoMark`,
   `:30` 의 `href="https://liambx.com"`
2. **`LeftPane`** — `LeftPane.tsx:8`·`:75` 의 `LiamLogoMark` + 메뉴 5개 링크(51·58·65·72·79)
3. **나머지 브랜딩 6파일** — Help/Github/ReleaseNote 버튼, `ParseErrorDisplay` **와 그 URL 을
   단언하는 `ErrorDisplay.test.tsx`(52·57)**, `cli/src/cli/urls.ts`
4. **`favicon.ico` 교체** — `cli/public/favicon.ico` 는 upstream 커밋 `ecaef464a` 가 마지막인
   **손 안 댄 upstream 자산**이다. `CrowfootLogoMark` 로 다시 뽑아야 한다
5. **링크 정리 판단** — upstream 문서 링크는 두 갈래다. *포크에도 정확한 것*(파서 포맷 등)은
   남기되 "upstream 문서" 로 읽히게 라벨링(`cli/src/cli/urls.ts:4` 에 그런 주석 선례 있음),
   *제품 정체성을 참칭하는 것*(Homepage/GitHub/Release Notes/Discussions)은 교체 또는 제거
6. **미사용 upstream 패키지 정리** ← **본인이 다음으로 요청한 작업.** 아래 "정리" 절 참조
7. **README 귀속 한 줄** — "Based on Liam ERD by ROUTE06, Inc., Apache-2.0"
8. **정리 후 §4 재검증** — `npm pack --dry-run` 으로 타르볼에 `LICENSE`·`NOTICE` 가 여전히
   들어가는지, 남긴 파일의 헤더가 안 빠졌는지

### 정리 (6번) — 착수 전 확인된 사실

포크가 쓰는 건 `packages/{cli,erd-core,schema,ui}` 뿐이고, 후보는 이만큼이다:

```
frontend/apps/             app  assets  docs  erd-sample
frontend/internal-packages/ agent  configs  db  e2e  figma-to-css-variables
                            github  mcp-server  neverthrow  pglite-server
                            schema-bench  security  storybook
```

> ⚠️ **통째로 지우면 루트 `pnpm lint` 가 깨진다.** turbo(20패키지)·syncpack·knip 이 그 구성에
> 묶여 있어 lint 설정도 같이 손봐야 한다. **의존 그래프로 실제 미사용을 먼저 확정할 것** —
> `erd-sample` 은 `crowfoot` 을 `workspace:*` 로 참조하고, `configs`·`neverthrow` 같은 건
> 남는 패키지가 물고 있을 수 있다.

### 본인이 직접 할 것 (에이전트에게 넘기지 않음)

```bash
# npm Trusted Publisher 등록: crowfoot / GitHub Actions / Junjak-Personal / crowfoot
#                             / release-crowfoot.yml
npm deprecate erdkit "renamed to crowfoot; install crowfoot instead"
```

`Junjak-Personal/erdkit` 리포는 **아카이브로 유지**하기로 했다 — 원본 히스토리가 거기 있어야
나중에 출처 다툼이 생겨도 근거가 된다. 지우지 말 것.

---

## How to resume

```bash
git clone git@github.com:Junjak-Personal/crowfoot.git
cd crowfoot && pnpm install
git log --oneline -6      # 최상단이 95599101d 여야 한다
```

작업 표면은 `frontend/packages/erd-core/src` 와 `frontend/packages/cli/src`.
스택·컨벤션·검증 명령의 SSOT 는 `.claude/project-profile/`.

**검증 명령:**

```bash
cd frontend/packages/erd-core && pnpm exec vitest run && pnpm exec tsc --noEmit
cd frontend/packages/cli      && pnpm exec vitest run && pnpm exec tsc --noEmit
pnpm lint                     # 루트. turbo + syncpack + knip
```

**빌드 산출물로 육안 확인:**

```bash
pnpm exec turbo build --filter=crowfoot --force
cd <scratch> && node <repo>/frontend/packages/cli/dist-cli/bin/cli.js \
  erd build --input ./schema.sql --format postgres --output-dir ./erd-out
cd erd-out && python3 -m http.server 5199 --bind 127.0.0.1
```

---

## Open questions / risks

- **배너 그라디언트 색이 임시다.** `banner.ts` 의 `#38BDF8`/`#818CF8` 는 에이전트가 고른 값이다
  — 원래 있던 `#1DED83` 이 **Liam 브랜드 그린**이라 그대로 둘 수 없어 바꾼 것이고, 본인 승인은
  아직 없다
- **`_docs/active/planning/2026-08-03/2026-08-03-cli-distribution.md` 의 status 가 낡았다.**
  "`npm publish` 만 남음" 이라고 하는데 실제로는 배포까지 끝났다. `complete/` 로 옮길지 미결
- **`_docs/handoff/2026-08-03-erd-viewer-handoff.md` 도 낡았다.** 다른 스트림(`erd-viewer`)
  문서라 손대지 않았다. 정리 여부는 본인 지시 대기
- **이 클론의 `origin`.** 개발 클론에서는 `origin` 이 아직 옛 `erdkit` 을 가리키고 새 리포는
  `crowfoot` remote 로 추가돼 있다. **새로 clone 하면 이 문제는 없다**

## 이 저장소를 만지기 전에 알아야 할 함정

1. **`turbo build --filter=crowfoot` 는 `--force` 없이 믿으면 안 된다.** erd-core 를 TS 소스로
   소비하는 구조라 erd-core 파일이 crowfoot 의 캐시 키에 안 들어간다. erd-core 만 고치면
   **옛 번들이 캐시에서 나온다.** 릴리즈 워크플로에도 `--force` 가 박혀 있다
2. **브라우저 확인 중 탭이 백그라운드로 밀리면 ResizeObserver 가 멈춘다.** React Flow 가 노드를
   측정 못 해 `data-loading` 이 `true` 에 머물고 캔버스가 빈 화면으로 보인다. **제품 결함으로
   오진하기 쉽다** — `document.visibilityState` 를 먼저 확인하라
3. **단위 테스트가 원리적으로 못 닿는 표면이 있다.** CSS Modules 가 happy-dom 에 주입되지 않아
   `pointer-events`·z-index·커서는 클래스명 존재만 확인된다. 브라우저 스모크가 유일한 검증
   수단이고, 그렇게 찾은 결함이 2건 있었다
4. **조립형 SVG 는 렌더 전에 태그 밖 텍스트를 확인하라.** 헬퍼가 path **데이터**만 반환하면
   `<path>` 로 안 감싸여 **조용히 사라진다.** 이걸로 로고 비교를 여러 라운드 헛돌았다
5. **`_docs/index.md` 는 문서 생성·이동·개명 시 같은 커밋에서 갱신**한다 (3개 섹션)

---

## Pointers

- [`2026-08-05-cli-distribution-debranding.md`](../active/planning/2026-08-05/2026-08-05-cli-distribution-debranding.md)
  — **주 계획서.** 브랜딩 인벤토리(파일·행번호), 상표 결정 근거, 마크 geometry 와 **버린 안
  5개의 이유**, 개명 sweep 내역, 히스토리 재작성 기록과 §4 분석이 전부 여기 있다
- [`2026-08-03-cli-distribution.md`](../active/planning/2026-08-03/2026-08-03-cli-distribution.md)
  — 개명·Apache-2.0 준수·npm 배포의 원래 계획. `npm publish` 관련 함정 두 개(`bin` 의 선행
  `./`, `workspace:*` 매니페스트 누출)가 여기 기록돼 있다. status 는 낡음
- [`2026-08-05-erd-viewer-backlog.md`](../active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md)
  — 기능 백로그. 브랜딩과 무관하지만 같은 파일을 만진다
- `.claude/project-profile/` — 스택·컨벤션·검증 명령·파일 헤더 문구의 SSOT
