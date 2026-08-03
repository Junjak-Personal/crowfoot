---
title: CLI 개인 계정 이전 + npm 공개 배포
status: planning
topic: cli-distribution
kind: plan
scope: cli
created: 2026-08-03
updated: 2026-08-03
related:
  - _docs/complete/erd-viewer/2026-08-03-erd-viewer-impl.md
  - _docs/active/planning/2026-08-03/2026-08-03-carbon-erd-delivery.md
---

# CLI 개인 계정 이전 + npm 공개 배포

## 목표

```bash
npx <패키지명> erd build --format=tbls --input schema.json --output-dir dist
```

한 줄로 끝나게 만든다. 지금은 이걸 쓰려면 **모노레포를 통째로 클론해서 `pnpm install` + `turbo build`** 를
해야 한다. carbon CI 도 그렇게 하고 있었고, 그 체인이 실제로 배포를 막은 적이 있다
([carbon-erd-delivery](./2026-08-03-carbon-erd-delivery.md) 참고).

**배포는 편의 문제가 아니라 라이선스 문제이기도 하다.** 아래 §3·§4 는 Apache-2.0 준수 조건이라
선택이 아니다.

## 현재 상태 — 1~6 완료, 남은 건 `npm publish` 한 줄

`frontend/packages/cli` 는 **이미 자립 가능한 단일 패키지**였고, 실측으로 확인됐다.
CLI 소스는 `src/` 전체가 **1,439줄**뿐이라 복제할 만한 덩치도 아니다.

| 확인한 것 | 파일 | 결론 |
|---|---|---|
| rollup `external` 에 `@liam-hq/erd-core`·`@liam-hq/schema` **없음** | `frontend/packages/cli/rollup.config.js` | 번들에 인라인됨 (`cli.js` 3.5MB) |
| `prepack` 이 `workspace:*` 의존 전부 제거 후 `postpack` 복원 | `frontend/packages/cli/scripts/pack-cli.js` | tarball 이 자립 |
| vite `outDir = 'dist-cli/html'`, `erd build` 가 `__dirname/../html` 에서 복사 | `vite.config.ts`, `src/cli/erdCommand/buildCommand/index.ts` | 웹앱 자산도 동봉됨 |
| `files` | `frontend/packages/cli/package.json` | 위 3개 + `LICENSE` + `NOTICE` 가 tarball 에 포함 |

> ✅ **`npm pack` 실측 완료 (2026-08-03).** 13파일 tarball → 빈 디렉터리에서 `npm install`
> → `erdkit erd build --input schema.sql --format postgres` 로 `dist/` 생성까지 확인.
> 모노레포 없이 동작한다.

## 확정된 이름

```
리포        Junjak-Personal/erdkit   (구 junhyeon-qesg/liam-custom → 오너쉽 이전 → rename)
npm 패키지  erdkit                    (무스코프, org 생성 불필요)
bin 이름    erdkit
버전        0.1.0                     (upstream 0.7.24 에서 리셋)
```

## 실행 계획

### 1) ✅ 리포 이전 — 완료

`junhyeon-qesg/liam-custom` → 오너쉽 이전 → `Junjak-Personal/erdkit` 으로 rename.
히스토리·이슈·URL 리다이렉트 전부 유지. fork 배지는 남지만 §6 은 **이름** 문제라 rename 으로 해소된다
(새 리포 + `push --mirror` 는 star/이슈만 잃고 얻는 게 없어 기각).

### 2) ✅ 패키지 개명 — 완료

`frontend/packages/cli/package.json`: `name`→`erdkit`, `bin`→`{"erdkit": …}`, `version`→`0.1.0`,
`repository`/`homepage`/`bugs`→새 리포, `description` 재작성.

**코드까지 따라가야 하는 곳이 있었다** (package.json 만으로는 부족):

| 파일 | 왜 |
|---|---|
| `src/cli/index.ts` | `program.name('liam')` → `--help` 첫 줄에 그대로 노출 |
| `src/cli/banner.ts` | init 배너가 **"LIAM ERD" ASCII 워드마크**를 렌더 — §6 상 가장 직접적인 표면. `ERDKIT` 으로 교체하며 long/short 분기 삭제(45칸이면 어떤 터미널에도 들어감) |
| `src/cli/initCommand/index.ts` | 안내문이 `npx @liam-hq/cli …` 를 출력 — **틀린 명령**(upstream 을 받아옴) |
| `src/cli/urls.ts` | `RepositoryUrl`/`DiscussionUrl` 이 upstream — 우리 사용자의 버그가 upstream 으로 감. `DocsUrl`(liambx.com)은 파서 문서라 정확하므로 유지 |
| `index.html` | 생성된 ERD의 **브라우저 탭 제목이 "Liam ERD"** 였다 → `ERD`. upstream 제품 이미지 `og:image`(`liam_erd.png`, 410KB) 삭제 |
| `README.md` | npm 랜딩 페이지. 재작성 + upstream 출처 명시 |
| `frontend/apps/erd-sample/package.json` | `workspace:*` 참조 |

### 3) ✅ LICENSE·NOTICE 를 tarball 에 넣기 — 완료

> 🔴 **계획서가 NOTICE 만 짚었는데 `LICENSE` 도 같이 빠져 있었다.**
> npm 이 LICENSE 를 자동 포함하는 건 **패키지 디렉터리 안**에 있을 때뿐이고, 둘 다 리포 루트에만 있었다.
> 즉 npm 경로는 §4(d) 뿐 아니라 **§4(a) 도 위반 상태**였다.

`scripts/pack-cli.js` 의 `pre` 가 루트에서 두 파일을 복사, `post` 가 삭제. 커밋된 사본을 두지 않아
루트 원본과 **드리프트가 구조적으로 불가능**하다. `files` 에도 명시.

### 4) ✅ upstream `release.yml` — 삭제 완료

실측해보니 **불발탄이었다.** 이 포크에 워크플로 실행 이력 0건이고,
`vars.CHANGESET_CI_TRIGGER_APP_ID` / `secrets.CHANGESET_CI_TRIGGER_APP_PRIVATE_KEY` 가 없어
첫 스텝(`create-github-app-token`)에서 죽는다. npm Trusted Publisher 도 `liam-hq/liam` 리포에 묶여 있어
이 포크발 OIDC 퍼블리시는 npm 이 거부한다. → 위험하진 않지만 **영원히 동작 불가라 삭제**.

- `.github/workflows/release.yml`, `.github/workflows/released_package_test.yml` 삭제
- 루트 `release` 스크립트를 changesets → `pnpm turbo build --filter=erdkit && pnpm --filter=erdkit publish --access public` 로 교체
- ⚠️ 퍼블리시는 이제 **수동**이다. CI 자동 퍼블리시는 별도 과제.

### 5) 🔲 퍼블리시 — 남은 유일한 작업

**본인이 직접 실행.** 토큰을 에이전트에 넘기지 않는다 (unpublish 72시간 제한 + 이름 영구 점유).

```bash
cd frontend/packages/cli && npm publish --access public --otp=<authenticator 6자리>
```

> 🔴 **`bin` 값의 선행 `./` 함정 — 1차 시도에서 발견.**
> upstream 원본 `"liam": "./dist-cli/bin/cli.js"` 를 그대로 물려받았는데, npm 11.16.0 은
> `./` 가 붙은 bin 타깃을 무효로 보고 **publish 매니페스트에서 bin 을 통째로 제거**한다
> (`npm warn publish "bin[erdkit]" script name … was invalid and removed`).
> 그대로 올라갔으면 `npx erdkit` 이 동작하지 않는다.
>
> **로컬 `npm pack` + tarball 설치로는 절대 안 잡힌다** — 제거는 publish 시점 정규화에서만 일어난다.
> `npm publish --dry-run` 이 유일하게 잡아내는 경로다. 실측:
>
> | bin 값 | 결과 |
> |---|---|
> | `./dist-cli/bin/cli.js` | REMOVED |
> | `dist-cli/bin/cli.js` | ok |
>
> → `./` 제거로 수정. `repository.url` 도 `git+https://` 로 정규화해 경고 0건 확인.

> 🔴 **0.1.0 은 깨진 채 발행됐다 — `workspace:*` 가 레지스트리 매니페스트로 샜다.**
> `npm publish` 는 **업로드할 매니페스트를 `prepack` 실행 *전에* 읽는다.** 그래서
> `scripts/pack-cli.js` 가 아무리 `workspace:*` 를 지워도 **tarball 만 깨끗해지고 매니페스트는 그대로**다.
>
> | | `@liam-hq/erd-core` |
> |---|---|
> | tarball 내 `package.json` | 없음 |
> | 레지스트리 매니페스트 | **`workspace:*`** |
>
> 결과: `npx erdkit@0.1.0` → `EUNSUPPORTEDPROTOCOL`. **로컬 `npm pack` + tarball 설치는 전부 통과한다** —
> 이 층은 실제 publish 후 `npx` 로만 드러난다.
>
> **근본 원인은 `prepack` 으로 package.json 을 런타임 조작한 것.** erd-core·schema 는 rollup 이
> `cli.js` 에 인라인하므로 **애초에 런타임 의존이 아니다.** → `devDependencies` 로 이동해서
> 매니페스트가 **구조적으로** 깨끗해지게 했다. 조용한 제거는 **prepack 가드(exit 1)** 로 교체 —
> `dependencies` 에 workspace 항목이 있으면 publish 전에 터진다 (가드 발화 실측 완료).
>
> **0.1.0 은 deprecate 하고 0.1.1 로 재발행한다.**

## 순서

1. ✅ 이름 결정 — `erdkit` (리포/패키지/bin 통일)
2. ✅ 리포 이전 + rename
3. ✅ `package.json` 개명 + 코드 내 브랜딩 제거 + `release.yml` 삭제
4. ✅ `LICENSE`·`NOTICE` 를 `files` + `prepack` 에 추가
5. ✅ `npm pack` 내용물 확인 — 13파일, `dist-cli/html/`·`LICENSE`·`NOTICE` 전부 존재
6. ✅ 빈 디렉터리에서 tarball 설치 → `erdkit erd build` 실동작 확인 (`dist/` 생성, 탭 제목 `ERD`)
7. 🔲 `npm publish --access public` ← **본인 실행**

## 검증 기록 (2026-08-03)

| 검사 | 결과 |
|---|---|
| `pnpm turbo build --filter=erdkit` | ✅ 6 tasks |
| `pnpm --filter erdkit test` | ✅ 23 passed |
| `tsc --noEmit` | ✅ 0 errors |
| `biome check .` | ✅ (기존 `fixtures/input.schema.rb` 깨진 심볼릭 링크 경고 1건 — 이번 변경과 무관) |
| tarball → clean `npm install` → `erd build --format postgres` | ✅ `dist/{index.html,schema.json,assets,serve.json}` 생성, 테이블 2개 파싱 |
| `erdkit --version` / `--help` | ✅ `0.1.0` / `Usage: erdkit …` |
| `npm publish --dry-run` | ✅ 경고 0건 (`bin` 제거 경고 해소 후) |
| `dependencies` 에 workspace 항목 | ✅ 0건 (매니페스트 안전) |
| prepack 가드 발화 | ✅ workspace 런타임 의존 주입 시 exit 1 |
| **`npx erdkit@0.1.1` (레지스트리 경유)** | ✅ `dist/{index.html,schema.json,assets,serve.json}` 생성. **위 두 함정 모두 이 검사로만 잡힌다** |
| 레지스트리 매니페스트 `dependencies` | ✅ workspace 항목 0건 |
| `erdkit@0.1.0` deprecate | ✅ `broken manifest (workspace: protocol leaked); use >=0.1.1` |

## 0.1.2 — `erd from-link` 추가

공유 링크(`?edit=1&positions=…&memos=…`)를 `layout.json` / `memos.json` 으로 되돌리는 서브커맨드.

```bash
erdkit erd from-link --input '<URL>' --output-dir dist
```

- 디코딩은 `node:zlib`. **erd-core 를 import 하지 않는다** — CLI bin 은 erd-core 를 전혀 안 쓰는데
  여기서 끌어오면 뷰어의 React 트리가 `cli.js`(이미 3.5MB)에 딸려온다. 파싱 규칙(오른쪽부터 `:` 분리)만
  `deserializeTableLayout` 과 맞춰 두고 주석으로 연결해 뒀다.
- 팔레트 검증은 **안 한다.** 뷰어가 로드 시 모르는 색 키를 버리므로, CLI 에 키 목록을 복제하면 드리프트만 생긴다.
- **링크에 없는 파라미터는 파일을 안 쓴다.** `{}` 로 멀쩡한 `layout.json` 을 덮어쓰는 사고를 막는다.

> 🟠 **앱 쪽 결함 발견(별건, 미수정)** — Export 메뉴의 `memos.json` 다운로드는 URL 의 메모를 놓친다.
> `memo.ts` 의 `dumpMemos()` 가 `getEffectiveMemos()` 를 **인자 없이** 부른다 (`ErdContent.tsx:211` 은
> `deserializeMemos(memoEntries)` 를 넘겨서 화면엔 제대로 뜬다). 공유 링크를 열고 Export 하면
> **화면과 다른 파일이 조용히 받아진다.** URL 의 `colors=` 도 같은 이유로 빠진다.
> `from-link` 는 이 경로를 우회하지만 근본 수정은 아니다.

## Deferred — `--layout` / `--memos` 옵션

지금 `layout.json`·`memos.json` 은 **빌드 후 `cp` 로 `dist/` 에 밀어넣고 있다.**
carbon 워크플로에만 있는 해킹이라 **다른 프로젝트에서 재현이 안 된다.** 범용 CLI 라면 정식 옵션이어야 한다.

```bash
erdkit erd build --format=tbls --input schema.json \
      --layout layout.json --memos memos.json --output-dir dist
```

관련 코드:
- `frontend/packages/cli/src/cli/erdCommand/buildCommand/index.ts`
  — `cpSync(cliHtmlPath, resolvedOutDir)` **직후**에 주입하면 된다
- 런타임 소비처: `erd-core/src/features/erd/utils/tableLayout/` · `.../utils/memo/`

퍼블리시 자체를 막지는 않으므로 **7단계 이후**로 미룬다. 다만 이게 없으면 "범용 CLI" 라고 부르기 어렵다.

## 라이선스 준수 체크리스트

| 조항 | 요구 | 상태 |
|---|---|---|
| §4(a) | LICENSE 사본 동반 | ✅ 루트 · S3 `dist/LICENSE` · **npm tarball (prepack 복사)** |
| §4(b) | 변경한 파일에 변경 표시 | ✅ 기존 수정 18파일 / 신규 20파일 + 이번 개명으로 건드린 5파일 |
| §4(d) | NOTICE 동반 | ✅ 루트 · S3 · **npm tarball (prepack 복사)** |
| §6 | 상표권 미부여 | ✅ 리포·패키지·bin·CLI 이름·배너 워드마크·탭 제목·og:image 전부 제거 |

`NOTICE` 에 upstream 출처(ROUTE06, Inc.)와 pin 커밋, 변경 요약이 정리돼 있고
**개명 사실을 7번 항목으로 추가**했다 (§6 상 별도 이름으로 재배포한다는 명시 + 승인 관계 부인).
신규/수정 파일 헤더 주석의 정확한 문구는 `.claude/project-profile/structure.md` 에 있다.
