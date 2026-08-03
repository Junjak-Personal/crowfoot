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

## 현재 상태 — 코드로 확인함, 실행 검증은 아직

`frontend/packages/cli` 는 **이미 자립 가능한 단일 패키지**다. 새로 만들 필요 없이 이름만 바꾸면 된다.
CLI 소스는 `src/` 전체가 **1,439줄**뿐이라 복제할 만한 덩치도 아니다.

| 확인한 것 | 파일 | 결론 |
|---|---|---|
| rollup `external` 에 `@liam-hq/erd-core`·`@liam-hq/schema` **없음** | `frontend/packages/cli/rollup.config.js` | 번들에 인라인됨 (`cli.js` 3.5MB) |
| `prepack` 이 `workspace:*` 의존 전부 제거 후 `postpack` 복원 | `frontend/packages/cli/scripts/pack-cli.js` | tarball 이 자립 |
| vite `outDir = 'dist-cli/html'`, `erd build` 가 `__dirname/../html` 에서 복사 | `vite.config.ts`, `src/cli/erdCommand/buildCommand/index.ts` | 웹앱 자산도 동봉됨 |
| `files: ["dist-cli/**/*"]` | `frontend/packages/cli/package.json` | 위 3개가 tarball 에 포함 |

> ⚠️ **위 표는 전부 코드 리딩이다. `npm pack` 을 한 번도 돌려본 적이 없다.**
> 첫 `npm pack` 에서 실제로 확인하기 전까지 "자립한다"고 단정하면 안 된다.

## 미결 — 착수 전에 정해야 함

```
새 리포명   [FILL: 미정]
npm 패키지  [FILL: 미정 — 예: @<npm-스코프>/erd-cli]
bin 이름    [FILL: 미정]
```

셋 다 `liam` 을 포함하면 안 된다(§2 상표 항목).

## 실행 계획

### 1) 리포 이전

- 개인 계정에 새 리포 생성 후 **전체 히스토리를 그대로 push**.
  히스토리는 Apache-2.0 파생 관계를 보여주는 근거라 유지하는 게 좋다.
- GitHub 의 fork 관계는 리포 설정에서 못 끊는다(지원팀 요청 필요). 새 리포로 push 하면 자연히 분리된다.

### 2) 패키지 개명 — `frontend/packages/cli/package.json`

| 필드 | 현재 | 변경 |
|---|---|---|
| `name` | `@liam-hq/cli` | 우리 스코프 |
| `bin` | `{"liam": "./dist-cli/bin/cli.js"}` | 우리 이름 |
| `version` | `0.7.24` | upstream 과 혼동되니 우리 체계로 리셋 (`0.1.0` 권장) |
| `repository` / `homepage` / `bugs` | liam-hq | 새 리포 |

> ⚠️ **개명은 편의가 아니라 라이선스 문제다.** Apache-2.0 **§6 은 상표권을 부여하지 않는다.**
> "Liam" 은 ROUTE06 의 제품명이므로 `liam-*` 이름으로 배포하면 그 선을 넘는다.
> 코드 재배포는 §4 만 지키면 자유지만, **이름은 별개다.**

### 3) 🔴 NOTICE 를 tarball 에 넣기 — 지금은 빠져 있다

- `files: ["dist-cli/**/*"]` 라서 NOTICE 가 포함되지 않는다.
  npm 은 LICENSE 는 자동 포함하지만 **NOTICE 는 자동 포함하지 않는다.**
- 게다가 NOTICE 는 **리포 루트**에 있어 패키지 디렉터리에서 보이지도 않는다.
- Apache-2.0 **§4(d)** 는 파생물 배포 시 NOTICE 동반을 요구한다. **퍼블리시 전 필수.**

```jsonc
// frontend/packages/cli/package.json
"files": ["dist-cli/**/*", "NOTICE"]
```

\+ 루트 `NOTICE` 를 패키지로 복사하는 단계를 `prepack`(`scripts/pack-cli.js`)에 추가하거나, 파일 자체를
패키지 디렉터리에 둔다.

> S3 배포 경로는 이미 충족돼 있다(`dist/` 에 `LICENSE`·`NOTICE` 동반). **구멍은 npm 경로만이다.**

### 4) ⚠️ upstream `release.yml` 이 살아 있다 — 개명 전 `main` 금지

`.github/workflows/release.yml` 은 `main` push 시 changesets 로 **`@liam-hq/cli` 를 npm 에 퍼블리시**한다.
npmjs.com Trusted Publisher 설정에 **이 파일명이 등록돼 있어** 파일을 rename 하면 그 설정도 같이 깨진다.

- 개명 전에 `main` 을 건드리면 **남의 패키지 이름으로 발행 시도가 나간다** — §6 위반이 절차보다 먼저 터진다.
- 개명 시 이 워크플로도 같이 손봐야 한다.

### 5) 퍼블리시

- **공개 npm 권장.** 개인 + 타사 프로젝트 양쪽에서 쓸 거면 인증 불필요한 공개가 압도적으로 편하다.
  포크도 이미 공개라 새로 노출되는 것도 없다.
- 첫 배포 전 반드시 `npm pack` 으로 tarball 내용물을 **눈으로** 확인
  (`dist-cli/html/` 과 `NOTICE` 가 실제로 들어갔는지).
- 임시 디렉터리에서 tarball 설치 후 `npx <bin> erd build` **실동작까지 확인**하고 publish.
- `npm publish --access public`

## 순서

1. 새 리포명 · npm 스코프 · bin 이름 결정 → 위 `[FILL: 미정]` 채우기
2. 개인 계정에 새 리포 생성 + 전체 히스토리 push
3. `package.json` 개명 (name / bin / version / repository) + `release.yml` 정리
4. **NOTICE 를 `files` 에 추가** (§4(d))
5. `npm pack` 으로 tarball 내용물 확인 — `dist-cli/html/`, `NOTICE` 존재 여부
6. 임시 디렉터리에서 tarball 설치 후 `npx <bin> erd build` 실동작 확인
7. `npm publish --access public`

## Deferred — `--layout` / `--memos` 옵션

지금 `layout.json`·`memos.json` 은 **빌드 후 `cp` 로 `dist/` 에 밀어넣고 있다.**
carbon 워크플로에만 있는 해킹이라 **다른 프로젝트에서 재현이 안 된다.** 범용 CLI 라면 정식 옵션이어야 한다.

```bash
<cli> erd build --format=tbls --input schema.json \
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
| §4(a) | LICENSE 사본 동반 | ✅ 루트 `LICENSE`, S3 `dist/LICENSE` |
| §4(b) | 변경한 파일에 변경 표시 | ✅ 수정 18파일 / 신규 20파일 상단에 주석 |
| §4(d) | NOTICE 동반 | ⚠️ S3 ✅ / **npm tarball 미포함 — §3** |
| §6 | 상표권 미부여 | ⚠️ **패키지·리포 이름에서 "liam" 제거 필요 — §2** |

`NOTICE` 에 upstream 출처(ROUTE06, Inc.)와 pin 커밋, 변경 요약 6항목이 이미 정리돼 있다.
신규/수정 파일 헤더 주석의 정확한 문구는 `.claude/project-profile/structure.md` 에 있다.
