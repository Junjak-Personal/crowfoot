---
title: 브랜딩 탈-Liam + 별도 리포 분리
status: planning
topic: cli-distribution
kind: plan
scope: fullstack
created: 2026-08-05
updated: 2026-08-06
related:
  - _docs/active/planning/2026-08-03/2026-08-03-cli-distribution.md
  - _docs/complete/erd-viewer/2026-08-04-table-grouping.md
  - _docs/active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md
---

# 브랜딩 탈-Liam + 별도 리포 분리

포크가 커스터마이즈 범위를 넘어섰다. upstream 추종을 그만두고 **독립 제품으로 떼어낸다.**

> 2026-08-05 `2026-08-05-cli-distribution-handoff.md` 를 인수해 이 계획서로 승격했다.
> 아래 "인수 검증" 절이 그때 실측한 결과다.

## 왜 지금

포크는 이미 자기 이름(`crowfoot`)·자기 스토리지 네임스페이스(`crowfoot:*`)·자기 기능(위치
영속 · 메모 · 색상 · 그룹화 · 편집모드)을 갖고 npm 에 배포된다. 그런데 **앱이 여전히 남의
제품명과 로고를 자기 브랜딩으로 띄운다.** 이건 Apache-2.0 §6 이 허용하는 "출처 설명" 범위
밖이다.

> **§4 귀속 고지와 §6 상표를 혼동하지 말 것.** 아래 "절대 지우면 안 되는 것" 을 먼저 읽어라.

---

## 상표 — 이름·마크 확정

**이름은 `crowfoot` 으로 확정됐다 (2026-08-05).** `erdkit` 은 ERD + kit 로 순수 서술어라
상표로 가장 약한 층이었다. `crowfoot` 은 suggestive 층이고, 무엇보다 **이 제품이 화면에 실제로
그리는 도형**이다 — `RelationshipEdge.tsx:42` 가 1:1 이 아닌 모든 관계선의 끝에
`url(#zeroOrManyLeft)` 을 물리고, 그 마커가 까마귀발이다. npm 미점유 확인함.

감수하기로 한 단점: DB 밖에서는 의미가 안 통하고, 업계 일반 용어라 무의미 조어보다 상표력이
낮으며, 영어권에서 "crow's feet"(눈가 주름) 연상이 있다.

**마크도 확정됐다 (2026-08-06)** — 아래 `CrowfootLogoMark`. 테이블 하나에 까마귀발이
붙은 형태다.

### 마크 제약 (코드에서 실측 — 새로 만들든 생성하든 동일하게 적용)

| 제약 | 근거 |
|---|---|
| **12px 에서 읽혀야 함** | `LeftPane.module.css:73` 아이콘 `0.75rem`. AppBar 로고는 `1.25rem`(20px), favicon 16px |
| **단색 `currentColor` 실루엣** | `LeftPane.module.css:75` 가 아이콘에 `color: var(--overlay-70)` 를 먹인다 — 색이 박힌 마크는 그 자리에서 못 쓴다 |
| **초록 금지** | 기존 `LiamLogoMark` 가 `#1DED83`, 테마 `--color-green-300` 이 `#4af19c`. 초록 마크는 이름만 바꾸고 trade dress 를 물려받는 꼴이 된다 |

### `CrowfootLogoMark` (`packages/ui/src/logos/CrowfootLogoMark.tsx`)

**테이블 1개 + 까마귀발. 요소 4개, 획 2, `currentColor`.**

```
rect  x=1.5 y=5 w=10 h=14 rx=1.8          테이블
path  M11.5 12H15                          관계선
      M15 12H22 · L22 6.8 · L22 17.2       까마귀발 3갈래
```

**두 번째 테이블을 뺀 것이 이 안의 핵심 결정이다.** 까마귀발 자체가 "반대편은 many" 를 뜻하므로
두 번째 테이블은 그림에 없어도 읽히고, 관계가 화면 밖으로 이어지는 인상이 된다. 대신 테이블
하나가 24 그리드를 다 쓴다 — 2개 안은 박스가 `7×11`/`6×11` 로 쪼그라들고 갈래가 `dx 4.2` 밖에
못 써서, 12px(1단위=0.5px)에서 갈래 3개가 2px 안에 뭉친다.

### 검토했다가 버린 안 (같은 걸 다시 돌지 않도록)

| 안 | 왜 버렸나 |
|---|---|
| `CardinalityZeroOrManyLeftMarker` 승격 (링+갈래) | 링 구멍이 12px 에서 `2.5px` 라 메워져 점이 된다 |
| Material Symbols `flowsheet` 그대로 | 스톡 글리프라 상표가 안 된다(누구나 동일 마크 사용 가능) + Apache-2.0 `NOTICE` 의무 추가 |
| 생성형 SchemaFlow 로고 | 요소 16개 · 4색. LeftPane 은 `currentColor` 단색 슬롯이라 **렌더 자체가 불가**. 로켓은 배포/런치 기호라 뷰어에 안 맞음 |
| 카드 3개 + 연결선 | 12px 에서 카드끼리 붙는다. 색이 유일한 구분자였던 걸 형태로 못 옮김 |
| 테이블 2개 + 까마귀발 | 위 참조 — 갈래가 눌린다 |

최종안이 직접 작도한 도형이라 **Material Symbols 의존이 없고, 그쪽 `NOTICE` 의무도 없다.**

> 🔴 **비교 하네스를 쓸 때의 함정.** SVG 를 문자열로 조립할 때 헬퍼가 path **데이터**만
> 반환하면 `<path>` 로 감싸이지 않아 **조용히 사라진다**(브라우저가 생 텍스트로 무시). 이걸로
> 여러 라운드 동안 까마귀발이 안 그려진 채 비교했다. 조립형 SVG 는 렌더 전에 "태그 밖에 남은
> 텍스트가 있는지" 를 먼저 확인할 것.

---

## 인수 검증 (2026-08-05 실측)

| 항목 | 결과 |
|---|---|
| 인용된 커밋 6개(`8608b1d30` `82f2db018` `6c112432a` `68e37114c` `fbee9db23` `ddbd37bbc`) | ✅ 전부 `HEAD` 에서 도달 가능 |
| `master` 단일 브랜치, `main` 없음, `upstream` 은 remote 로만 | ✅ |
| `v0.4.2` 태그가 `82f2db018` 을 가리킴 (master 가 더 앞섬) | ✅ 낡음 확인 |
| 파일 헤더 귀속 고지 | ✅ 32파일 |
| 루트 `LICENSE`·`NOTICE` + `scripts/pack-cli.js` 의 복사 로직 | ✅ |
| CLI 배너·`--help` 귀속 문구 | ✅ `banner.ts:35`, `index.ts:17` |
| 브랜딩 인벤토리 9파일 | ✅ 전부 기재된 내용 그대로 존재 |
| `erd-core` 테스트 | ✅ 37파일 306 passed (4 todo) |
| `cli` 테스트 · `tsc --noEmit` | ✅ 31 passed · 0 errors |

**인수 중 발견한 어긋난 것 3건:**

- ✅ ~~🔴 `.github/workflows/release-erdkit.yml` 이 미커밋 상태로 인계됐다~~ — Trusted Publishing
  (OIDC) 전환 diff(토큰 스텝 삭제, `npm@^11.5.1` 업그레이드, `--provenance` 제거)가 워킹트리에
  떠 있었다. **`e094438f2` 로 커밋됨**
- ✅ ~~🟠 `_test/` 가 untracked 이고 `.gitignore` 에도 없다~~ — 스모크 스크래치 디렉터리.
  **`.gitignore` 에 추가함**
- 🟠 **`2026-08-03-cli-distribution.md` 와 `index.md` 가 "`npm publish` 만 남음" 이라고
  말하는데 이미 배포됐다.** 그 문서 자신의 검증 기록에 `npx erdkit@0.1.1` 성공이 적혀 있고,
  지금 버전은 0.4.3 이며 태그 트리거 릴리즈 워크플로까지 있다. 그 문서는 status 갱신 대상

**인계 문서가 "미확인" 으로 남긴 것 중 해소된 것:**

- `cli/index.html` 의 `<title>` 은 이미 `ERD` 다 (탈브랜딩 완료)
- `cli/public/favicon.ico` 는 upstream 커밋(`ecaef464a`)이 마지막이라 **손대지 않은
  upstream 자산**이다. 새 마크가 정해지면 교체 대상

---

## 브랜딩 인벤토리

배포되는 패키지 소스만 (`apps/app` 등 미배포 패키지는 제외). 경로·행번호는 실측으로 확인됨.

| 파일 | 내용 |
|---|---|
| `erd-core/.../ERDRenderer/AppBar/AppBar.tsx` | `<h1>Liam ERD</h1>`(45), `LiamLogoMark`(2·35), `href="https://liambx.com"`(30) |
| `erd-core/.../AppBar/HelpButton/HelpButton.tsx` | `liambx.com/docs`(53), `liam-hq/liam/discussions`(61) |
| `erd-core/.../AppBar/GithubButton/GithubButton.tsx` | `liam-hq/liam`(18) |
| `erd-core/.../AppBar/ReleaseNoteButton/ReleaseNoteButton.tsx` | `liam-hq/liam/releases`(18) |
| `erd-core/.../ERDRenderer/LeftPane/LeftPane.tsx` | 메뉴 5개 전부 upstream(51·58·65·72·79) + `LiamLogoMark`(8·75) |
| `erd-core/.../ErrorDisplay/ParseErrorDisplay.tsx` | `liambx.com/docs/parser/troubleshooting`(59), discussions(78) |
| `erd-core/.../ErrorDisplay/ErrorDisplay.test.tsx` | 위 URL 을 단언(52·57) — 같이 고쳐야 함 |
| ~~`erd-core/.../CommandPalette/CommandPalettePreview/CommandPreview.tsx`~~ | ~~`assets.liambx.com` 동영상 3 · 이미지 3 **(핫링크)**~~ → ✅ 제거됨 (아래 5번) |
| `cli/src/cli/urls.ts` | `DocsUrl`(5) · troubleshooting(7) · discussions(13) |
| `cli/public/favicon.ico` | upstream 자산 그대로 |

---

## 작업 순서

1. ✅ **상표 확정 — 이름 `crowfoot`, 마크 `CrowfootLogoMark`** (위 "상표" 절)
2. ✅ **`erdkit` → `crowfoot` 개명 sweep — 완료 (2026-08-06).** `erdkit` 0.4.3 을 내보내지
   않고 **`crowfoot` 0.1.0 으로 새로 시작**하기로 했다. 아래 "개명 sweep" 절 참조
3. **앱 브랜딩 교체** — 인벤토리대로. `AppBar` 의 `<h1>` 과 로고가 최우선(가장 눈에 띄고
   가장 명확한 §6 위반 표면). `favicon.ico` 도 같이
4. **링크 정리** — upstream 문서 링크는 두 갈래다:
   - *포크에도 여전히 정확한 것*(파서 포맷 문서 등) → 남겨도 되지만 "upstream 문서" 라고
     읽히게 라벨링. `cli/src/cli/urls.ts:4` 에 이미 그런 주석이 있다
   - *제품 정체성을 참칭하는 것*(Homepage, GitHub, Release Notes, Discussions) → 교체 또는 제거
5. ✅ **`assets.liambx.com` 핫링크 제거 — 완료.** 상표 결정과 무관해서 먼저 처리했다.
   **자체 호스팅이 아니라 기능 제거**를 골랐다. 근거 셋:
   - 남의 CDN 에 런타임 의존 — 브랜딩 이전에 **가용성 문제**
   - 영상·이미지가 보여주는 건 upstream 의 2025-09-01 UI 다. 포크가 그 뒤로 그룹화·편집모드·
     색상·메모를 얹었으므로 **내용이 이미 틀렸다**
   - 자체 호스팅하면 미디어 6개를 다시 찍어 이미 3.5MB 인 `cli.js` 옆에 얹어야 한다
     — 개발 도구의 마케팅 장식치고 비용이 크다

   커맨드 6개 중 **미디어가 있던 건 애초에 6개뿐**이고 나머지 커맨드는 원래 프리뷰 칸이
   비어 있었다. 즉 빈 칸은 새 상태가 아니라 **기존 상태**다 (`CommandPreview.tsx` 의
   `TODO: set gif or image for "Show All Table"…` 주석이 그 증거). `TablePreview` 는 그대로다.

   지운 것: `CommandPreview.tsx` · `CommandPreview.test.tsx`,
   `CommandPalettePreview/index.ts` 의 재export, `CommandPaletteContent.tsx` 의 import 와
   `suggestion?.type === 'command'` 분기, `.module.css` 의 `.image`/`.video` 규칙(+`.d.ts` 재생성).
   `CommandPaletteContent.test.tsx` 의 `command preview` 케이스는 **프리뷰 칸이 비는지 단언하는
   테스트로 교체**했다 — 지우기만 하면 회귀 감지가 사라진다.
6. **별도 리포 분리** — 히스토리 유지한 채 새 리포로 push (귀속이 커밋 로그에 남아 §4(c) 에
   유리). 그 다음 미사용 upstream 패키지 정리
7. **분리 후 §4 재검증** — 정리 과정에서 `LICENSE`/`NOTICE`/파일 헤더가 빠지지 않았는지.
   `npm pack --dry-run` 으로 타르볼에 `LICENSE`·`NOTICE` 가 여전히 들어가는지 확인
8. **README 귀속 한 줄** — "Based on Liam ERD by ROUTE06, Inc., Apache-2.0"

---

## 개명 sweep — `erdkit` → `crowfoot` (2026-08-06 완료)

**`erdkit` 0.4.3 을 내보내지 않고 `crowfoot` 0.1.0 으로 새로 시작했다.** `erdkit` 은 0.1.0~0.4.2
가 npm 에 올라가 있으나 사용자가 사실상 없고, 개명 후 버전을 이어받으면 "0.4.3 이 첫 릴리즈" 인
이상한 히스토리가 남는다.

**일괄 치환이 안전했던 이유:** §4 귀속 문구는 `Liam ERD source (Apache-2.0, ROUTE06, Inc.)` 라
**"erdkit" 을 포함하지 않는다.** 그래서 `erdkit` 치환은 고지를 건드리지 않는다 — 계획서가 경고한
"Liam 일괄 치환" 함정의 정반대다. 다만 `_docs/complete/`·`_docs/handoff/` 의 과거 기록은
**당시 사실이므로 손대지 않았다.**

| 대상 | 처리 |
|---|---|
| 파일 헤더 `// Added in erdkit;` | 44파일 기계적 치환 |
| 코드·설정 | 17파일 (`App.tsx` 콘솔 헬퍼, `urls.ts`, `index.ts`, `initCommand`, `pack-cli.js`, `knip.jsonc`, 루트/erd-sample `package.json`) |
| `cli/package.json` | `name`·`bin`→`crowfoot`, `version`→**0.1.0**, repo/homepage/bugs URL |
| 워크플로 | `release-erdkit.yml` → **`release-crowfoot.yml`** (Trusted Publisher 가 파일명을 참조하므로 등록 전에 확정돼야 함) |
| localStorage | `crowfoot:*`. 아래 참조 |
| 배너 | ASCII 워드마크 `ERDKIT`(45칸) → `CROWFOOT`(72칸, 80칸 터미널 기준). 그라디언트 `#1DED83`(**Liam 브랜드 그린**) → `#38BDF8`/`#818CF8` |
| `NOTICE` | 9번 항목에 erdkit 경유 사실 반영 + **10번(배너 워드마크·색) 신설** |
| 문서 | `README.md`·`docs/usage*.md`·`.claude/project-profile/` |
| 락파일 | `pnpm install --lockfile-only` 로 재생성 |

### 스토리지 마이그레이션이 2단 hop 이 됐다

`readStoredItem(key, legacyKey)` 의 두 번째 인자를 **배열로 일반화**했다
(`['erdkit:*', 'liam:*']`, 최신 우선). 인자를 하나 더 늘리는 대신 목록으로 만들어 다음 hop 이
생겨도 같은 코드로 끝난다. 클립보드 마커(`crowfoot.memo`)도 같은 방식으로 옛 마커를 읽는다 —
안 그러면 개명 전에 복사한 메모가 **조용히 붙지 않는다.**

### 검증 (2026-08-06 실측)

| 검사 | 결과 |
|---|---|
| `erd-core` 테스트 | ✅ 36파일 302 passed (4 todo) — 스토리지 체인 우선순위·전체 삭제 케이스 추가 |
| `cli` 테스트 | ✅ 31 passed |
| `tsc --noEmit` (erd-core · cli · ui) | ✅ 0 errors |
| 루트 `pnpm lint` | ✅ exit 0 |
| `turbo build --filter=crowfoot --force` | ✅ 6 tasks |
| `cli.js --version` / `--help` | ✅ `0.1.0` / `Usage: crowfoot …` + 귀속 문구 유지 |
| `erd build` 실행 | ✅ `out/{index.html,schema.json,assets,favicon.ico,serve.json}`, 탭 제목 `ERD` |
| `npm pack --dry-run` | ✅ 13파일, **`LICENSE`·`NOTICE` 포함** (§4(a)·§4(d)) |
| `npm publish --dry-run` | ✅ 경고 0건 — `bin` 제거 함정 없음 |
| 매니페스트 `workspace:` 누출 | ✅ 0건 |

### 남은 수동 작업 (본인)

```bash
# 1) GitHub 리포 개명  Junjak-Personal/erdkit → crowfoot
# 2) npm Trusted Publisher 등록: crowfoot / GitHub Actions / release-crowfoot.yml
# 3) 옛 패키지 deprecate
npm deprecate erdkit "renamed to crowfoot; install crowfoot instead"
```

---

## 절대 지우면 안 되는 것

전 파일 상단의

```
// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// Added in crowfoot; not part of the original Liam ERD source.
```

는 **§4(b)/§4(c) 가 요구하는 귀속 고지**다. "Liam" 을 일괄 치환하는 스크립트를 돌리면 이게 같이
날아가고 그 순간 라이선스 위반이 된다. 브랜딩(§6)과 귀속(§4)은 정반대 방향의 의무다 —
**브랜딩은 지우고, 귀속은 남긴다.**

`LICENSE`, `NOTICE`, `docs/packages-license.md`, `scripts/pack-cli.js` 도 같은 이유로 보존.

---

## 검증

작업 표면은 `frontend/packages/erd-core/src` 와 `frontend/packages/cli/src`.
검증 명령의 SSOT 는 `.claude/project-profile/`.

```
cd frontend/packages/erd-core && pnpm exec vitest run && pnpm exec tsc --noEmit
cd frontend/packages/cli      && pnpm exec vitest run && pnpm exec tsc --noEmit
pnpm lint                     # 루트. turbo + syncpack + knip
```

**빌드 산출물로 육안 확인:**

```
pnpm exec turbo build --filter=crowfoot --force
cd <scratch> && node <repo>/frontend/packages/cli/dist-cli/bin/cli.js \
  erd build --input ./schema.sql --format postgres --output-dir ./erd-out
cd erd-out && python3 -m http.server 5199 --bind 127.0.0.1
```

---

## 이 저장소를 만지기 전에 알아야 할 함정

1. **`turbo build --filter=crowfoot` 는 `--force` 없이 믿으면 안 된다.** erd-core 를 TS 소스로
   소비하는 구조라 erd-core 의 파일이 crowfoot 의 캐시 키에 안 들어간다. erd-core 만 고치면
   **옛 번들이 캐시에서 나온다.** 릴리즈 워크플로에도 `--force` 가 박혀 있다
   (`release-crowfoot.yml:64`)
2. **브라우저 테스트 중 탭이 백그라운드로 밀리면 ResizeObserver 가 멈춘다.** React Flow 가
   노드를 측정 못 해 `data-loading` 이 `true` 에 영원히 머물고, 캔버스가 빈 화면으로 보인다.
   **제품 결함으로 오진하기 쉽다** — `document.visibilityState` 를 먼저 확인하라. 스크린샷도
   같은 이유로 낡은 프레임을 반환한다
3. **단위 테스트가 원리적으로 못 닿는 표면이 있다.** CSS Modules 가 happy-dom 에 주입되지 않아
   `pointer-events` · z-index · 커서는 클래스명 존재만 확인된다. 실제 동작은 브라우저 스모크가
   유일한 검증 수단이다. 그렇게 찾은 결함이 2건(`6c112432a`, `68e37114c`)
4. **`_docs/index.md` 는 문서 생성·이동·개명 시 같은 커밋에서 갱신**한다 (3개 섹션)

---

## 미결 / 리스크

- **상표 범위가 미결.** "출처 설명" 은 §6 예외로 허용되고 "자기 제품 브랜딩" 은 아닌데, 그
  사이 어디에 선을 그을지는 판단이 필요하다. 본인이 직접 확인하기로 함. 이 문서를 쓴 에이전트는
  변호사가 아니며 위 내용은 라이선스 본문(§4·§6)을 읽은 결과다
- **어느 패키지를 버릴지 미결.** 모노레포에 `apps/app`·`agent`·`db`·`docs` 등 포크가 안 쓰는
  upstream 코드가 대량으로 있다. 지우면 가볍지만, 남기는 파일의 헤더는 유지해야 하고 루트
  `pnpm lint`(turbo 20 패키지 · syncpack · knip)가 그 구성에 묶여 있다 — 통째로 걷어내면
  lint 설정도 같이 손봐야 한다
- **`v0.4.2` 태그가 낡았다.** `82f2db018` 을 가리키는데 master 는 그보다 앞서 있다. 0.4.3
  릴리즈 시 정리 대상

---

## 인접 스트림 — 릴리즈 (이 계획의 범위 밖이지만 물릴 수 있음)

`master` 에 미푸시 커밋이 쌓여 있고 `v0.4.3` 은 아직 태그되지 않았다. npm 배포는
**Trusted Publishing(OIDC)** 으로 가기로 했고, 본인이 npmjs.com 에서 erdkit 패키지에
Trusted Publisher(GitHub Actions / `Junjak-Personal` / `erdkit` / `release-erdkit.yml`)를
등록하면 `git push` → `v0.4.3` 태그 → 자동 배포로 끝난다. 토큰은 쓰지 않는다
(`ERDKITDEPLOY` 시크릿은 삭제 예정).

⚠️ **그 워크플로 변경이 아직 미커밋이다** — 위 "인수 검증" 참조.

브랜딩 교체가 0.5.0 급 변경이면 릴리즈를 먼저 내보내고 시작하는 편이 히스토리가 깨끗하다.

---

## Pointers

- `_docs/active/planning/2026-08-03/2026-08-03-cli-distribution.md` — 개명·Apache-2.0 준수·
  npm 배포의 원래 계획. §4 의무를 어떻게 충족했는지가 여기 있다 (status 가 낡음 — 위 참조)
- `_docs/complete/erd-viewer/2026-08-04-table-grouping.md` — 그룹화 구현 기록. "왜 이렇게
  만들었나" 절이 특히 중요하다. 함부로 "정리" 하면 깨지는 것들의 목록이다
- `_docs/active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md` — 기능 백로그. 브랜딩과
  무관하지만 같은 파일을 만진다
- `.claude/project-profile/` — 스택·컨벤션·검증 명령의 SSOT
