---
title: 브랜딩 탈-Liam + 별도 리포 분리
status: complete
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

> 🔴 **이 문서에서 제일 먼저 읽을 것 — §4 귀속과 §6 상표는 정반대 방향의 의무다.**
> 파일 상단의 `// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.)` 와
> `// Added in crowfoot; not part of the original Liam ERD source.` 는 **§4(b) 가 요구하는
> 고지**다(현재 **92파일** — 두 문구를 **다** 세고 `-- frontend/packages` 로 스코프해야 이 수가
> 나온다. "Modified from" 만 세면 43이 나와 대참사처럼 보인다).
> "Liam" 일괄 치환 스크립트를 돌리면 이게 같이 날아가고 그 순간
> 라이선스 위반이 된다. **브랜딩(§6)은 지우고, 귀속(§4)은 남긴다.**
>
> 반대로 **`erdkit` → `crowfoot` 류의 치환은 안전했다** — §4 문구에 그 단어가 없기 때문이다.
> 이번 세션에 그게 무사히 끝났다는 사실이 오히려 함정이다. **`Liam` 은 정반대다.**
> 자세한 것은 아래 "절대 지우면 안 되는 것".

> 2026-08-05 `2026-08-05-cli-distribution-handoff.md` 를 인수해 이 계획서로 승격했다.
> 아래 "인수 검증" 절이 그때 실측한 결과다.
> 2026-08-06 `2026-08-06-cli-distribution-handoff.md` 를 인수해 이 문서에 병합했다
> (아래 "2026-08-06 인수 검증"). 그 시점에 `planning → processing` 으로 넘어갔다.

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
- `cli/public/favicon.ico` 는 upstream 커밋이 마지막이라 **손대지 않은 upstream 자산**이다.
  새 마크가 정해지면 교체 대상. (당시 인용한 `ecaef464a` 는 **히스토리 재작성으로 사라진
  해시**다. 지금 이 파일의 마지막 커밋은 압축된 upstream 루트 `f4dd6c4` — 사실 자체는 그대로다)

---

## 2026-08-06 인수 검증 (실측 — 새 clone 에서)

`2026-08-06-cli-distribution-handoff.md` 를 인수하며 그 문서의 주장을 전수 대조했다.
**어긋난 "완료" 주장은 0건**이라 그대로 이 문서에 병합했다.

### 완료 — 커밋 4건 전부 `HEAD` 에서 도달 가능

| | 커밋 |
|---|---|
| CommandPalette 프리뷰 제거 (`assets.liambx.com` 핫링크 6개) | `6ba524a2f` |
| `CrowfootLogoMark` 추가 — 테이블 1개 + 까마귀발, 요소 4, `currentColor` | `0759f6e09` |
| `erdkit` → `crowfoot` 개명 sweep, 버전 **0.1.0** 으로 리셋 | `d35d0c45c` |
| 히스토리 재작성 **11,849 → 38 커밋** + §4(c) 오기 정정 | `95599101d` |

### 검증 기준선 — 재현됨

| 검사 | 인계 문서 주장 | 실측 |
|---|---|---|
| `erd-core` 테스트 | 302 passed (4 todo) | ✅ 36파일 302 passed \| 4 todo (306) |
| `cli` 테스트 | 31 passed | ✅ 5파일 31 passed |
| `tsc --noEmit` (erd-core · cli) | 0 errors | ✅ 양쪽 exit 0, 0 errors |
| 루트 `pnpm lint` | exit 0 | ✅ exit 0 |
| 리포 분리 | PUBLIC · `isFork: false` · 기본 `master` | ✅ `gh repo view` 로 확인 |
| `CrowfootLogoMark` 소비자 | 0건 | ✅ `ui/src` 밖 참조 0건 |
| 브랜딩 인벤토리 행번호 | 9파일 | ✅ 아래 표대로 (`urls.ts` discussions 만 13→**14**) |
| `erd-sample` 의 `crowfoot` 의존 | `workspace:*` | ✅ `package.json:6` |
| 배너 색 | `#38BDF8`/`#818CF8` | ✅ `banner.ts:10` |

### 🔴 인수하며 새로 발견한 것 2건

**1. `pnpm install` 만으로는 테스트가 안 돈다 — 인계 문서의 "How to resume" 가 부족했다.**
새 clone 에서 `pnpm install` 직후 `vitest run` 을 돌리면 **erd-core 24파일 · cli 3파일이
collection 단계에서 실패**한다:

```
Error: Failed to resolve entry for package "@liam-hq/schema".
```

`@liam-hq/schema` · `@liam-hq/ui` 의 `dist` 가 없어서다. **제품 회귀로 오진하기 딱 좋다.**
워크스페이스 의존을 먼저 빌드해야 한다:

```bash
pnpm install
pnpm exec turbo build --filter=@liam-hq/schema --filter=@liam-hq/ui   # ← 이게 빠져 있었다
```

**2. 브랜딩 인벤토리에 빠진 §6 표면이 `ui` 패키지에 있다.** 인벤토리 9파일은 `erd-core`/`cli`
만 훑었는데, 배포 대상인 `ui` 에도 남아 있다:

| 파일 | 내용 | 성격 |
|---|---|---|
| `ui/src/components/CookieConsent/CookieConsent.tsx:21` | `<h4>Liam ERD Cookie Consent</h4>` | **소비자 0건** — `ui/src/components/index.ts:11` 에서 재export 만 됨. 6번(미사용 정리) 후보 |
| `ui/src/logos/LiamLogoMark.tsx` · `logos/index.ts:7` · `logos/index.stories.tsx` | `LiamLogoMark` 본체와 재export | AppBar·LeftPane 교체가 끝나면 **마지막 소비자가 사라진다** → 그때 같이 제거 |

즉 3번(브랜딩 교체)의 종료 조건은 "인벤토리 9파일" 이 아니라 **`LiamLogoMark` 소비자 0 →
컴포넌트·재export·스토리까지 제거**다. `schema` 쪽 `liam-hq/liam` 언급 3건은 upstream
이슈 인용(출처 표기)이라 **§6 대상이 아니다 — 건드리지 말 것.**

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
| `cli/src/cli/urls.ts` | `DocsUrl`(5) · troubleshooting(7) · discussions(**14**) |
| `cli/public/favicon.ico` | upstream 자산 그대로 |

---

## 작업 순서

1. ✅ **상표 확정 — 이름 `crowfoot`, 마크 `CrowfootLogoMark`** (위 "상표" 절)
2. ✅ **`erdkit` → `crowfoot` 개명 sweep — 완료 (2026-08-06).** `erdkit` 0.4.3 을 내보내지
   않고 **`crowfoot` 0.1.0 으로 새로 시작**하기로 했다. 아래 "개명 sweep" 절 참조
3. ✅ **앱 브랜딩 교체 — 완료 (2026-08-06).** 아래 "앱 브랜딩 교체" 절 참조.
   `LiamLogoMark` 제거만 6번에 딸려 남았다
4. ✅ **링크 정리 — 완료 (2026-08-06).** 3번과 같은 커밋에서 처리했다. 원칙은 그대로였다:
   - *포크에도 여전히 정확한 것*(파서 포맷 문서) → 남기되 "upstream" 이라고 **라벨에 박았다**
     (`Parser Docs (upstream)`, `Check out the upstream troubleshooting guide →`)
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
6. ✅ **별도 리포 분리 — 완료.** 히스토리 재작성 + `Junjak-Personal/crowfoot` push 까지 끝났다
   (아래 "리포 분리" 절). **남은 건 미사용 upstream 패키지 정리** — 아래 "패키지 정리" 절
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

## 리포 분리 — 히스토리 재작성 (2026-08-06)

### 먼저 정정: 히스토리 보존은 §4 의무가 아니다

인계 문서에서 물려받은 "히스토리 유지한 채 push (귀속이 커밋 로그에 남아 §4(c) 에 유리)" 는
**틀린 서술이었다.** §4 는 조건이 정확히 넷이고 버전 관리 히스토리는 어디에도 없다.

| 조항 | 요구 | 어디서 충족되나 |
|---|---|---|
| (a) | License 사본 | 루트 `LICENSE` + npm 타르볼 |
| (b) | 수정 파일에 변경 고지 | **파일 상단 헤더** — 커밋 메타데이터가 아니다 |
| (c) | Source form 의 notice 보존 | 아래 참조 |
| (d) | NOTICE 사본 | 루트 `NOTICE` + 타르볼 |

(c) 의 대상을 실측했다 — **upstream 소스에 파일 단위 저작권 헤더가 0건이다**
(`grep -rl "Copyright" --include="*.ts" --include="*.tsx" frontend/packages` → 없음).
보존 대상은 루트 `LICENSE` 뿐이고 그건 그대로 있다. 참고로 **upstream 92156eac5 에는 `NOTICE`
파일이 없다** — 즉 §4(d) 는 upstream Work 에 애초에 걸리지 않고, 우리 `NOTICE` 는 자발적
귀속 기록이다.

출처 앵커도 로컬 히스토리에 의존하지 않는다. `NOTICE:11` 이 `pinned to upstream commit
92156eac5` 를 못박고 있고 그 커밋은 공개된 `liam-hq/liam` 에 실재한다.

### 결과 — `crowfoot-history` 브랜치

```
11,849 커밋  →  37 커밋
```

분기점 `92156eac5` 기준 포크 커밋은 36개(0.3%)뿐이었고 나머지 99.7% 가 upstream 것이었다.
upstream 트리를 **orphan 루트 커밋 1개**로 압축하고 그 위에 포크 36개를 replay 했다. 커밋
메시지·blame 이 살아 있어 "왜 이렇게 만들었나" 가 보존된다.

**판정 기준은 하나였다 — 최종 트리가 `master` 와 동일한가.**

```
master           68c9cf2e9819647e847556ec1577b1381ae23091
crowfoot-history 68c9cf2e9819647e847556ec1577b1381ae23091   ← 동일
```

`erd-core` 302 passed 로 재확인.

> 🔴 **`--rebase-merges` 없이는 안 된다.** 평탄화하면 머지 양쪽이 각각 0.4.1 을 올린 커밋
> (`791e9f9de` / `642790f91`)이 선형으로 재생되며 충돌한다. 토폴로지를 보존해야 하고, 그래도
> 머지 커밋 자체에서 `cli/package.json` 충돌이 한 번 난다 —
> **원본 머지가 기록한 결과(`git show 43ebc7555:<path>`)를 그대로 쓰는 것이 정답**이다.
> 손으로 고르면 원본과 달라진다.

### push 완료 (2026-08-06)

`Junjak-Personal/crowfoot` — **PUBLIC · `isFork: false` · 기본 브랜치 `master`.**
clone 해서 독립 검증했다: 트리 해시 로컬/원격 일치, upstream 히스토리 없음,
`LICENSE`·`NOTICE` 존재, `crowfoot@0.1.0` / `bin=crowfoot`.
인수 시 `gh repo view` 로 재확인함.

### 남은 수동 작업 (본인 — 에이전트에게 넘기지 않음)

1. **기존 `Junjak-Personal/erdkit` 은 지우지 말고 아카이브로 유지** — 원본 히스토리가 거기
   남아 있어야 나중에 출처 다툼이 생겨도 근거가 있다. 공짜 보험이다
2. Trusted Publisher 등록: `crowfoot` / GitHub Actions / `Junjak-Personal` / `crowfoot`
   / `release-crowfoot.yml`
3. `npm deprecate erdkit "renamed to crowfoot; install crowfoot instead"`

---

## 브랜드 색 — 확정 (2026-08-06)

**`#F59E0B` (앰버) 단색.** 본인이 3개 안 중에 고른 값이다.

전임 에이전트가 임의로 넣었던 `#38BDF8`/`#818CF8`(sky→indigo)는 **폐기**했다. 그 색을 버린
이유는 미승인이라서만이 아니라 **sky→indigo 그라디언트가 AI 생성물에서 가장 흔한 팔레트**라,
그대로 두면 제품 색이 "생성물 기본값" 으로 굳기 때문이다.

| 표면 | 적용 |
|---|---|
| `banner.ts` | 단색 `#F59E0B`. **그라디언트 자체를 없앴다** → `ink-gradient` 의존 제거(`package.json`·락파일) |
| `cli/public/favicon.ico` | `#F59E0B` 라운드 사각 + 흰색 마크, 16/32/48px |

> 초록 금지 제약은 그대로 유효하다 (위 "마크 제약"). 앰버는 Liam 그린과도, 흔한 AI 팔레트와도
> 겹치지 않는다.

### favicon 을 어떻게 만들었나

변환 도구(`magick`·`rsvg-convert`)가 이 머신에 없어서 `sharp`(모노레포에 이미 있음)로 SVG →
PNG 3종을 렌더하고 **ICO 컨테이너를 직접 조립**했다(헤더 6바이트 + 엔트리 16바이트×3 + PNG
페이로드). PNG-in-ICO 는 현행 브라우저가 전부 읽는다.

**생성 스크립트는 리포에 남기지 않았다** — 산출물이 `favicon.ico` 이고, 마크가 바뀌지 않는 한
다시 돌릴 일이 없다. 다시 필요하면 `CrowfootLogoMark.tsx` 의 `rect`/`path` 를 그대로 SVG 로
옮기고 `translate(2.6 2.4) scale(0.8)` 로 감싸면 된다(내용 bbox 가 x 0.5..23 · y 4..20 이라
이 값이 24 그리드 정중앙에 놓는다).

---

## 앱 브랜딩 교체 — 완료 (2026-08-06, `d9e6adb`)

작업 순서 3·4번. 인벤토리 9파일 중 `favicon.ico` 를 포함해 전부 처리했다.

| 표면 | 결과 |
|---|---|
| `AppBar` | `<h1>Crowfoot</h1>`, `CrowfootLogoMark`, 로고 링크 → 리포 (툴팁 `Go to the repository`) |
| `LeftPane` | 메뉴 **5개 → 3개**. `Go to Homepage` 는 리포 링크로 바뀌면서 `Go to GitHub` 와 **같은 URL 이 되어** 제거. `Community Forum` 도 제거 |
| `GithubButton` · `ReleaseNoteButton` | → `Junjak-Personal/crowfoot`(+`/releases`) |
| `HelpButton` | `Community Forum` 제거, 문서 항목은 `Parser Docs (upstream)` 으로 개명 |
| `ParseErrorDisplay` | `Send a signal!` 블록 **삭제** — upstream discussions 로 이 포크의 파서 버그를 보내라는 안내였다. 쓰이지 않게 된 `.message3*` CSS 3규칙도 같이 제거 |
| `ErrorDisplay.test.tsx` | `Send Signal` 단언을 **"어떤 링크도 upstream discussions 로 안 간다"** 는 단언으로 교체 (지우기만 하면 회귀 감지가 사라진다 — 5번과 같은 원칙) |
| `cli/urls.ts` | `DbOrmDiscussionUrl`(upstream 스레드 364) 제거 → `DiscussionUrl`(우리 Issues)로 흡수 |
| `initCommand` | "crowfoot 사용법은 여기" 라며 upstream 문서를 가리키던 문구 3곳을 upstream 문서라고 명시하도록 수정 |
| `favicon.ico` | 위 "브랜드 색" 참조 |

**§4(b) 헤더를 6파일에 새로 넣었다** (AppBar · GithubButton · ReleaseNoteButton · HelpButton ·
ParseErrorDisplay · ErrorDisplay.test). 손대는 순간 고지 의무가 생기는 파일들이다. **86 → 92파일.**

> `LiamLogoMark` 는 **아직 지우지 않았다.** 배포 패키지에서는 소비자가 0이 됐지만 `apps/app`
> 이 6곳에서 아직 쓴다. 그 패키지는 6번에서 통째로 나가므로 **같이 지우는 게 맞다** — 지금
> 지우면 루트 `pnpm lint` 만 깨진다.

### 브라우저 스모크 (실측)

빌드 산출물을 띄워 확인했다. 페이지의 **`<a>` 7개 전수**:

```
(로고)                  → github.com/Junjak-Personal/crowfoot
(GitHub 버튼)           → github.com/Junjak-Personal/crowfoot
(릴리즈 버튼)           → .../crowfoot/releases
Release Notes           → .../crowfoot/releases
Parser Docs (upstream)  → liambx.com/docs        ← 유일하게 남은 upstream 링크, 라벨로 명시
Go to GitHub            → github.com/Junjak-Personal/crowfoot
React Flow              → reactflow.dev          ← 서드파티 귀속, 무관
```

`liam-hq/liam` 링크 **0건**. `<h1>` 은 `Crowfoot`, 마크는 `<rect>`+`<path>` 둘 다 DOM 에 있고
20px 에서 갈래 3개가 살아 있다(조립형 SVG 함정 해당 없음 — 실제 React 컴포넌트라 안전).
favicon 은 브라우저가 `assets/favicon-*.ico` 를 **200 / 1890바이트**로 실제 로드하는 것까지 확인.

---

## 패키지 정리 — 확정 계획 (2026-08-06, `/team` Phase 1 완료)

Leader + Architect FE/BE/Infra 4명이 실측으로 다듬은 최종안. **단일 커밋.** Designer 1명 순차.

### 왜 병렬이 아닌가 (기각 근거)
`pnpm-lock.yaml` 이 단일 전역 산출물이라 워크트리 2개가 각자 install 하면 병합 불가. 루트
`pnpm lint` 는 워크스페이스 전체를 보므로 **절반만 지운 워크트리에서는 원리적으로 검증 불가.**
`lefthook` pre-commit 이 `pnpm lint` 를 돌려 half-state 는 커밋 자체가 막힌다.

### 🔴 아키텍트가 뒤집은 전제 4건 (전부 실측 증명)

| # | 통념 | 실측 |
|---|---|---|
| 1 | "knip 이 죽은 설정을 다 짚어준다 → oracle 로 쓰면 됨" | **절반만 참.** 죽은 `ignoreDependencies` → hint → exit 1 ✅. 죽은 `ignore[]` **경로 → 출력 없음, exit 0** ❌. **11개는 손으로 지워야 한다** |
| 2 | "knip 이 ui 의 죽은 export 를 강제로 잡아준다" | **거짓.** `ui/src/index.ts` 가 entry 파일이라 `includeEntryExports` 없이는 보고 안 함. ui 정리는 **강제가 아니라 선택** |
| 3 | "`frontend/turbo/generators/` 는 쓸모 있으니 유지" | **이미 3중으로 깨져 있다.** `stories.tsx.hbs` 없음(config.ts:60 이 요구) · `apps/service-site` 를 `readdirSync`(존재 안 함 → throw) · 루트 `turbo/` 없음. **삭제** |
| 4 | "§4(b) 헤더가 삭제로 훼손될 위험" | 92개 **전부** keep-package 안. 디렉터리 삭제로는 못 건드림. 단 **헤더 카운트는 2가지 문구를 다 세고 `-- frontend/packages` 로 스코프**해야 92가 나온다(A형만 세면 43) |

### 🔴 강제 의존 1건
`erd-core/src/features/erd/mocks.ts`(18KB)의 유일한 importer 가 삭제 대상 스토리 2개다.
**같이 안 지우면 knip unused-file 로 루트 lint 가 깨진다.**

### 삭제 대상

**패키지 14개** (`crowfoot` 에서 의존 그래프상 도달 불가):
`apps/{app,assets,docs,erd-sample}` ·
`internal-packages/{agent,db,e2e,figma-to-css-variables,github,mcp-server,pglite-server,schema-bench,security,storybook}`

**그 외:** `packages/db-structure`(package.json 없는 고아) · `frontend/turbo/generators/` ·
`scripts/{extract-supabase-anon-key,extract-supabase-service-key,setup-local-dev}.sh` ·
`CONTRIBUTING.md`(upstream 기여 거절 정책 + 죽은 Supabase 안내) ·
`docs/{langgraph/,migrationOpsContext.md,migrationPatterns.md,schemaPatterns.md}` ·
`.env.template`(21개 변수 전부 고아) · `.stylelintrc.json` · `.stylelintignore`

**keep-package 내부 정리 (사용자 결정):**
- 스토리 32개 전부(ui 30 + erd-core 2) + `@storybook/nextjs` devDep + `erd-core/.../mocks.ts`
- ui 컴포넌트 디렉터리 18개 + 심볼 106개 → **`@radix-ui` 의존 6개가 배포 산출물에서 빠진다**
  (collapsible · dialog · popover · select · switch · tabs)
- 로고/아이콘: `Liam{LogoMark,Logo,DbLogo}` · `LinkedInLogo` · `XLogo` · `CookieConsent` ·
  `Cardinality*Icon` 3종 · `ErdIcon` · `FacebookIcon`
  → **`markers/` 3종은 유지** (erd-core `CardinalityMarkers.tsx` 가 실제로 그린다)

### 설정 변경
`turbo.json`(태스크 4개 삭제 + `@liam-hq/cli#dev`→`crowfoot#dev` 결함 수정 + `build.env` 비움) ·
`package.json`(name→`crowfoot-monorepo`, 스크립트 4개·devDep 4개 삭제, `onlyBuiltDependencies` 삭제) ·
`pnpm-workspace.yaml`(`apps/*`·dangling `__mocks__/*`·`minimumReleaseAgeExclude` 삭제) ·
`knip.jsonc`(`ignore[]` 11개 손으로, `ignoreDependencies` 5개) · `.syncpackrc` · `vitest.config.ts` ·
`.vscode/settings.json` · `AGENTS.md` · `CLAUDE.md` · `README.md` · `NOTICE`

> 🔴 `knip.jsonc` 의 `workspaces` 블록(`frontend/packages/cli` entry)은 **그대로 둔다.**
> 지우면 `bin/cli.ts` 가 unused file 로 잡힌다.

### 🔴 `pnpm.overrides` 6개 — 전부 보존 (Infra 판정, BE 와 충돌 → Infra 채택)
`esbuild`·`@radix-ui/react-dialog` 는 keep-set 에서 여전히 살아 있다. 나머지 4개
(`cookie`·`path-to-regexp`·`prismjs`·`undici`)는 트리에서 사라지지만 **no-op override 는
비용이 0이고, 지우면 나중에 그 패키지가 transitive 로 돌아올 때 핀이 풀린다.** 비대칭 리스크라
보존이 맞다. `cookie: ^0.7.0` 은 리포 유일의 비-exact 스펙 = 명백한 CVE 범위 핀.
(별건: pnpm 11 은 이 필드를 조용히 무시한다 → `packageManager` 올리기 전에
`pnpm-workspace.yaml` 로 옮길 것. **이번 작업 아님.**)

### 게이트 (실측 기준선 → 기대값)

| 검사 | 이전 | 이후 |
|---|---|---|
| 워크스페이스 | 21 | **7** |
| `turbo build --filter=crowfoot --force` | 6 tasks | **6 (불변)** |
| `turbo lint` | 26 | **10** |
| `schema` / `erd-core` / `cli` 테스트 | 562 / 303+4 todo / 31 | **동일** |
| **`ui` 테스트** | **60** | **30** (아이콘 테스트 5파일 삭제 — 의도된 감소) |
| `tsc --noEmit` (erd-core·cli·ui) | 0 | **0** |
| 루트 `pnpm lint` | exit 0 | **exit 0** ← 하드 게이트 |
| `npm pack --dry-run` | 13파일 + LICENSE·NOTICE | **동일** (§4(a)(d)) |
| §4(b) 헤더 | 92 | **92** (diff 가 비어야 함) |
| `turbo dev --filter=crowfoot --dry` | `deps: []` | **`["crowfoot#build"]`** ← 결함 수정 증명 |

### 별건 등록 (이번 커밋 아님)
- 🔴 `cli/vite-plugins/setEnv.ts` → **이번에 같이 처리하기로 결정됨** (아래 절)
- pnpm 11 에서 overrides 무시 → `pnpm-workspace.yaml` 이관
- `route06/actions` 재사용 워크플로 의존 (codeql·dependency_review) → inline 권고
- `command:build` 가 mastodon `main` 을 unpinned 로 참조 (erd-sample 은 커밋 고정이었음)
- `frontend-ci.yml:33` paths-filter 의 선행 `./` 가 매칭 안 될 가능성
- CI 가 `@liam-hq/schema` 562 테스트를 한 번도 안 돌림

---

## `setEnv.ts` 정리 (사용자 추가 지시, 2026-08-06)

`frontend/packages/cli/vite-plugins/setEnv.ts` — **유지되는 패키지**인데 upstream 을 향한다.

| 위치 | 문제 | 현재 실제 효과 |
|---|---|---|
| L20 | `git remote add origin .../liam-hq/liam.git` | origin 없는 체크아웃에서 **빌드가 upstream 에 연결** |
| L55 | `versionPrefix = '@liam-hq/cli@'` | crowfoot 태그는 `v*` → **태그 조회가 영원히 불일치** |
| L95 | `gitBranch === 'main'` | 기본 브랜치는 **`master`** → `envName` 이 항상 `'preview'` |
| L61–65 | `git fetch --tags` + `git ls-remote origin` | 매 빌드마다 네트워크 I/O, 오프라인 실패 |

L15 주석이 `remoteAddOrigin` 을 **Vercel 자동배포 우회책**이라고 설명한다 — crowfoot 에 Vercel 이
없으므로 근거 자체가 소멸했다.

**해법:** `isReleasedGitHash` 의 유일한 소비자는 `ReleaseVersion.tsx:24`(릴리즈가 아니면
`+<hash>` 표기)이고, **로컬 태그만으로 답할 수 있다** — `v<version>` 태그가 HEAD 를 가리키는가.
→ `remoteAddOrigin` 전체 · 네트워크 호출 2개 · Vercel 주석이 한꺼번에 사라진다.
`versionPrefix` → `'v'`, 브랜치 비교 → `'master'`.

---

## 패키지 정리 — 실행 결과 (2026-08-06 완료)

계획 그대로 단일 커밋. **1,415 삭제 · 27 수정.** 게이트 전부 기대값과 일치.

| 검사 | 기대 | 실측 |
|---|---|---|
| 워크스페이스 | 7 | ✅ 7 |
| `schema` / `erd-core` / `cli` 테스트 | 562 / 303+4todo / 31 | ✅ 동일 |
| `ui` 테스트 | 30 | ✅ 30 (아이콘 테스트 5파일 삭제 — 의도된 감소) |
| `tsc` (erd-core·cli·ui) | 0 | ✅ 0 |
| 루트 `pnpm lint` | exit 0 | ✅ exit 0 |
| `turbo build --filter=crowfoot --force` | 6 | ✅ 6 |
| `turbo lint` | 10 | ✅ 10 (26에서) |
| `crowfoot#dev` 의존 | `["crowfoot#build"]` | ✅ 일치 — 죽은 키 수정 증명 |
| `npm pack --dry-run` | 13파일 + LICENSE·NOTICE | ✅ 동일 |
| §4(b) 헤더 | 92, diff empty | ✅ 92, diff empty |
| `pnpm.overrides` | 6개 무손상 | ✅ 무손상 |

### 구현 중 드러난 것 (계획과 어긋난 지점)

1. **lucide 죽은 아이콘이 37이 아니라 38이었다** — `X` 가 누락돼 있었다. grep 재검증 후 38 삭제.
2. **`Sidebar.tsx` 가 `PanelLeft` 를 `@liam-hq/ui` 가 아니라 내부 상대경로(`'../../icons'`)로
   import 한다** — 패키지 간 import 만 훑은 최초 스캔이 놓쳤고 `tsc` 가 TS2305 로 잡았다.
   되돌린 뒤 `ui/src` 내부 상대 import 를 전수 재검토.
3. **`git rm -r` 는 추적 파일만 지운다** — gitignore 된 `*.module.css.d.ts` 가 남아 디렉터리
   15개가 안 사라졌다. `rm -rf` 로 정리.
4. **심볼을 지우면 CSS 클래스가 고아가 된다** — `DropdownMenu.module.css` 의 `.separator`,
   `Sidebar.module.css` 의 `.sidebarFooter`. `eslint` 의 `css-modules-kit/no-unused-class-names`
   가 잡아줬다.
5. **NOTICE 7번은 삭제 대신 `[Retired]` 표시** — 기록을 지우기보다 남기는 쪽. 신규 12번에 정리 사실.

### 🔴 리뷰에서 추가로 잡은 결함 1건

`setEnv.ts` 의 `isReleasedGitHash` 가 `git rev-parse v0.1.0` 로 비교하는데, **릴리즈 태그는
보통 annotated 라 이건 태그 객체 해시를 돌려준다** — 커밋 해시와 절대 일치하지 않는다.
즉 upstream 태그명 문제를 고쳐도 **여전히 영원히 0** 이 나올 뻔했다. `^{commit}` 를 붙여
해결(실측 검증: annotated 태그에서 match=1, 없는 태그는 catch → 0).

### 브라우저 스모크 (Designer 가 안 한 것을 리뷰에서 수행)

UI 컴포넌트 디렉터리 18개를 지웠으므로 단위 테스트만으로는 부족하다(CSS Modules 가
happy-dom 에 안 닿는다 — 이 문서 "함정" 3번). 빌드 산출물을 띄워 확인:

- 캔버스 렌더 ✅ (`data-loading=false`, 노드 23개, 까마귀발 마커 표시)
- **Sidebar 토글** ✅ (심볼 8개 제거함) — Tables 목록 정상
- **Export 드롭다운** ✅ (심볼 4개 제거함) — 4항목, 포크의 MySQL export 포함
- **Toast** ✅ (뷰포트 provider 2개 제거함) — Copy Link → "Link copied!"
- **Help 메뉴** ✅ — `v0.1.0 + fa74cef (2026-08-06)`. `setEnv.ts` 가 네트워크 없이 버전·해시·
  날짜를 채운다는 증명이고, `+해시` 는 아직 릴리즈 태그가 없다는 뜻으로 정상

### Phase 5 보안 감사 — **SHIP** (하드 불변식 4개 전부 증거와 함께 확인)

§4(b) 헤더 92개 목록 byte-identical · `pnpm.overrides` 6개 byte-identical ·
`LICENSE`/`NOTICE`/`packages-license.md`/`pack-cli.js` 무손상 + 타르볼에 LICENSE·NOTICE 존재 ·
`setEnv.ts` 네트워크 I/O 0. 추가 의존성 0, `.github/` diff 완전히 비어 있음.
비밀값 형태 문자열 스캔(+5560줄) 0건.

**의도치 않은 좋은 결과 1건:** `CookieConsent` 제거가 살아있는 트래커를 남기지 않았다 —
`gtm/utils/pushToDataLayer.ts` 는 in-page `window.dataLayer` 배열에 push 만 하고 네트워크
송출이 없다. 이 삭제가 프라이버시 회귀를 만들 수 있었던 유일한 경로였는데 아니었다.

### 남은 플래그 (owner 판단)
- 🔴 **`pnpm.overrides` 가 deprecated 위치에 있다.** pnpm 10.18.3 에서는 적용되지만
  **pnpm 11 에서는 조용히 무시된다**(실측 확인). `packageManager` 올리는 날 CVE 핀 6개가
  증발한다 → `pnpm-workspace.yaml` 로 이관 필요 (이미 `minimumReleaseAge` 가 거기 있다)
- 🟠 **`.npmrc` 가 git 추적 중인데 `.gitignore` 는 `/.env`·`.env*.local` 만 제외한다.**
  리포 루트에서 `pnpm login` 하면 토큰이 추적 파일에 박힌다
- 🟠 `.npmrc` 의 `minimum-release-age-exclude` 13개 중 `@electric-sql/pglite`(락파일 0건)와
  `next`/`@next/swc-*` 가 죽었다. 참고: `nuqs` 의 optional peer 때문에 `next@15.4.8` +
  `@next/swc-darwin-arm64`(**124MB**)가 아직 설치된다
- 🟠 `setEnv.ts` 의 `fetchGitBranch` 가 릴리즈 경로에서 안 먹는다 — `release-crowfoot.yml` 은
  태그를 detached 로 체크아웃하므로 `git rev-parse --abbrev-ref HEAD` 가 `HEAD` 를 반환한다.
  즉 `main`→`master` 수정이 **릴리즈 빌드에서는 발동하지 않고** 항상 `'preview'` 다.
  `github.ref_name` 을 쓰거나 `envName` 자체를 없애는 게 맞다 (소비처가 inert dataLayer 뿐)
- `knip.jsonc` 의 `@swc/core` 주석이 stale ("Required for Vercel deployment" — Vercel 표면 소멸)
- `.vscode/settings.json` 의 `stylelint.configFile`/`validate` 가 삭제된 `.stylelintrc.json` 참조
- README 내비게이션 3개 링크가 upstream 인데 `(upstream)` 라벨이 없다 (§4 단계 관행과 불일치)
- `.github/CODEOWNERS`(`@liam-hq/liam-dev`)·`SECURITY.md`(upstream 취약점 신고 경로) — 기존 문제,
  이번 diff 와 무관하지만 리포 분리 취지와 어긋남
- `.claude/project-profile/` 이 이 커밋으로 다시 낡는다 → `/team-init` 재실행 필요

---

## 패키지 정리 — 착수 전 확인된 사실 (원본 메모)

포크가 실제로 쓰는 건 `packages/{cli,erd-core,schema,ui}` 뿐이고, 후보는 이만큼이다:

```
frontend/apps/              app  assets  docs  erd-sample
frontend/internal-packages/ agent  configs  db  e2e  figma-to-css-variables
                            github  mcp-server  neverthrow  pglite-server
                            schema-bench  security  storybook
```

> ⚠️ **통째로 지우면 루트 `pnpm lint` 가 깨진다.** turbo(20패키지)·syncpack·knip 이 그 구성에
> 묶여 있어 lint 설정도 같이 손봐야 한다. **의존 그래프로 실제 미사용을 먼저 확정할 것** —
> `erd-sample` 은 `crowfoot` 을 `workspace:*` 로 참조하고(`package.json:6`),
> `configs`·`neverthrow` 같은 건 남는 패키지가 물고 있을 수 있다.

**정리 후에는 반드시 §4 재검증**(작업 순서 7번) — `npm pack --dry-run` 으로 타르볼에
`LICENSE`·`NOTICE` 가 여전히 들어가는지, 남긴 파일의 귀속 헤더(**92파일**)가 안 빠졌는지.

**같이 처리할 것:** `LiamLogoMark`(본체·`logos/index.ts` 재export·`index.stories.tsx`)와
`ui/src/components/CookieConsent`(소비자 0, `<h4>Liam ERD Cookie Consent</h4>`) — 둘 다
`apps/app` 이 나가면 소비자가 0 이 된다.

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

```bash
# 🔴 새 clone 이면 이 두 줄이 먼저다. 안 하면 테스트가 27파일 collection 실패한다
pnpm install
pnpm exec turbo build --filter=@liam-hq/schema --filter=@liam-hq/ui

cd frontend/packages/erd-core && pnpm exec vitest run && pnpm exec tsc --noEmit
cd frontend/packages/cli      && pnpm exec vitest run && pnpm exec tsc --noEmit
pnpm lint                     # 루트. turbo + syncpack + knip
```

기준선(2026-08-06 재현): `erd-core` 302 passed (4 todo) · `cli` 31 passed · `tsc` 0 ·
루트 `pnpm lint` exit 0.

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
- **어느 패키지를 버릴지 미결.** 후보 목록과 착수 전 주의사항은 위 "패키지 정리" 절로 옮겼다

- ✅ ~~**배너 그라디언트 색이 승인 안 된 임시값이다.**~~ **해소됨 (2026-08-06)** — 아래
  "브랜드 색" 절 참조. `#38BDF8`/`#818CF8` 는 폐기됐다

- **`v0.4.2` 태그가 낡았다.** `82f2db018` 을 가리키는데 master 는 그보다 앞서 있다.
  다만 개명하며 **버전을 0.1.0 으로 리셋**했으므로 이 태그는 `erdkit` 시절 유물이다.
  정리(삭제) 여부는 본인 판단

- **낡은 문서 2건 — 이 문서 밖이라 손대지 않았다.**
  - `_docs/active/planning/2026-08-03/2026-08-03-cli-distribution.md` 가 "`npm publish` 만
    남음" 이라고 하는데 실제로는 배포까지 끝났다. `complete/` 로 옮길지 미결
  - `_docs/handoff/2026-08-03-erd-viewer-handoff.md` 도 낡았다. 다른 스트림(`erd-viewer`)
    이라 지시 대기

---

## 인접 스트림 — 릴리즈 (이 계획의 범위 밖이지만 물릴 수 있음)

개명으로 전제가 바뀌었다 — **다음 릴리즈는 `crowfoot@0.1.0` 이고 `erdkit`/`v0.4.3` 이 아니다.**
npm 배포는 **Trusted Publishing(OIDC)** 으로 가고(`e094438f2` 로 커밋됨, 토큰 안 씀),
워크플로는 `release-crowfoot.yml` 이다. 본인이 npmjs.com 에서 `crowfoot` 에 Trusted Publisher
(GitHub Actions / `Junjak-Personal` / `crowfoot` / `release-crowfoot.yml`)를 등록하면
태그 → 자동 배포로 끝난다.

**브랜딩 교체를 먼저 끝내고 0.1.0 을 내보내는 편이 낫다** — 첫 릴리즈가 남의 로고를 띄우면
개명한 의미가 없다.

---

## Pointers

- `_docs/active/planning/2026-08-03/2026-08-03-cli-distribution.md` — 개명·Apache-2.0 준수·
  npm 배포의 원래 계획. §4 의무를 어떻게 충족했는지가 여기 있다 (status 가 낡음 — 위 참조)
- `_docs/complete/erd-viewer/2026-08-04-table-grouping.md` — 그룹화 구현 기록. "왜 이렇게
  만들었나" 절이 특히 중요하다. 함부로 "정리" 하면 깨지는 것들의 목록이다
- `_docs/active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md` — 기능 백로그. 브랜딩과
  무관하지만 같은 파일을 만진다
- `.claude/project-profile/` — 스택·컨벤션·검증 명령의 SSOT
