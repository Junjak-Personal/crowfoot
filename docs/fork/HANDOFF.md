# 포크 작업 인계 문서

> 이 문서는 **포크(liam-custom) 전용**이다. `docs/` 의 나머지는 upstream 문서이므로 섞지 말 것.
> 최초 작성 2026-08-03 · 최종 정리 2026-08-03.
>
> **프로젝트 컨벤션·스택·함정은 `.claude/project-profile/` 이 SSOT 다.** 이 문서는 중복하지 않고
> **남은 작업**만 다룬다. 코드를 만지기 전에 `.claude/project-profile/index.md` 를 먼저 읽을 것.

---

## 0. 한 줄 요약

Liam ERD 포크에 **위치 영속 · 메모 · 색상 · MySQL export · 편집모드**를 얹어 동작 검증까지 끝냈다.
다음 할 일은 **개인 계정으로 옮기고 npm 에 공개 배포**해서, carbon 말고 개인/타사 프로젝트에서도
`npx` 로 쓰게 만드는 것.

---

## 1. 현재 상태

| 항목 | 값 |
|---|---|
| 리포 | `junhyeon-qesg/liam-custom` (공개 포크) |
| 브랜치 | `feature/erd-view-customization` |
| 최신 기능 커밋 | **`9af3ab35e`** (push 완료) — 이후 커밋은 문서·프로필뿐 |
| upstream pin | **`92156eac5`** (2026-06-18) — 추종하지 않음 |
| CLI 패키지 | `frontend/packages/cli` = `@liam-hq/cli` 0.7.24 |
| 로컬 경로 | `C:\Users\harin\dev\carbon\liam-custom` |

기능 커밋 2개:

```
ac5b392fa  feat(erd-core): persist table positions across reloads
9af3ab35e  feat: memos, colour coding, MySQL export and an explicit edit mode
```

### 구현된 기능

1. **테이블 위치 영속** — 우선순위 `URL(?positions=) > localStorage > layout.json > ELK 자동배치`.
   미지정 테이블은 ELK 폴백이라 **신규 테이블이 생겨도 안 깨진다**(수동 레이아웃 부채 회피의 핵심).
   ELK 가 `nodePlacement/layering: INTERACTIVE` 라 고정 좌표를 시드로 넣으면 배치 힌트로 존중한다.
2. **캔버스 메모** — `memos.json` 으로 빌드에 동봉, `?edit=1` 에서 편집. 우클릭 컨텍스트 메뉴로 추가/삭제,
   폰트 크기(+/− 및 숫자 입력), 리사이즈.
3. **12색 색상 지정** — 테이블 헤더·메모. 전부 기존 디자인 토큰에서 가져왔다.
   `--primary-accent` 는 "강조/hover" 의미라 일부러 제외했다.
4. **읽기 전용 기본 + 명시적 편집모드** — `?edit=1`(또는 `?edit=true`) 없으면 편집 불가.
   공유 링크가 실수로 흐트러지지 않게.
5. **MySQL DDL export** — upstream 은 PostgreSQL·YAML 만 지원. 클립보드 복사 / `.sql` 다운로드 2가지.
6. **`?show=all|table|key`** — 내부 이름(ALL_FIELDS 등) 대신 짧은 값.

### 검증 현황 (정직하게)

**됐다 (근거 있음)**

- 테스트 — 2026-08-03 `d2fb6638c` 에서 재실행 확인:
  `@liam-hq/schema` **562 pass / 37 files**, `@liam-hq/erd-core` **195 pass + 4 todo / 29 files**,
  `tsc --noEmit` 두 패키지 다 exit 0, lint 0.
- **MySQL DDL 을 DB 레벨로 검증** — 임시 DB `carbon_ddl_check` 를 만들어 64KB DDL 적용(exit 0) 후
  원본과 대조: 86=86 테이블, 832=832 컬럼, FK/PK/UNIQUE 128/85/38, **타입·NULL·기본값 불일치 0건**.
  검증 후 DB 삭제.
- **브라우저 실동작** — 이 코드로 빌드한 산출물이 https://carbon-stage.qesg.co.kr/erd/ 에 배포되어
  동작 확인됨(유저). `?edit=1` 편집모드도 확인됨.

**미검증 — 완료로 적으면 안 되는 것**

- **npm pack/publish 경로를 한 번도 돌려본 적이 없다.** 아래 2장의 "퍼블리시가 쉬운 이유" 표는
  코드 리딩으로 확인한 것이지 실제 tarball 을 만들어 설치해본 게 아니다. 첫 `npm pack` 에서 확인 필요.
- **포크 기능의 E2E 커버리지가 0 이다.** 위치/메모/색상/편집모드/MySQL export 전부 단위 테스트만 있다.
  `frontend/internal-packages/e2e` 의 Playwright 스위트는 upstream Next.js 앱을 겨눈다.

---

## 2. 다음 작업 — 개인 계정 이전 + npm 공개 배포

### 왜

지금 이걸 쓰려면 **모노레포를 통째로 클론해서 pnpm install + turbo build** 를 해야 한다.
carbon CI 도 그렇게 하고 있었고, 그 체인이 실제로 배포를 막은 적이 있다(3장).
개인/타사 프로젝트에서 재사용하려면 목표는 이거다:

```bash
npx <패키지명> erd build --format=tbls --input schema.json --output-dir dist
```

### 퍼블리시가 쉬운 이유 (코드로 확인함 — 실행 검증은 아직)

`packages/cli` 는 **이미 자립 가능한 단일 패키지**다. 새로 만들 필요 없이 이름만 바꾸면 된다.
CLI 소스는 `src/` 전체가 **1,439줄**뿐이라 복제할 만한 덩치도 아니다.

| 확인한 것 | 파일 | 결론 |
|---|---|---|
| rollup `external` 에 `@liam-hq/erd-core`·`@liam-hq/schema` **없음** | `packages/cli/rollup.config.js` | 번들에 인라인됨 (`cli.js` 3.5MB) |
| `prepack` 이 `workspace:*` 의존 전부 제거 후 `postpack` 복원 | `packages/cli/scripts/pack-cli.js` | tarball 이 자립 |
| vite `outDir = 'dist-cli/html'`, `erd build` 가 `__dirname/../html` 에서 복사 | `vite.config.ts`, `src/cli/erdCommand/buildCommand/index.ts` | 웹앱 자산도 동봉됨 |
| `files: ["dist-cli/**/*"]` | `packages/cli/package.json` | 위 3개가 tarball 에 포함 |

### 절차

**1) 리포 이전**

- 개인 계정에 새 리포 생성 후 **전체 히스토리를 그대로 push**.
  히스토리는 Apache-2.0 파생 관계를 보여주는 근거라 유지하는 게 좋다.
- GitHub 의 fork 관계는 리포 설정에서 못 끊는다(지원팀 요청 필요). 새 리포로 push 하면 자연히 분리된다.
- 리포 이름에서도 `liam` 을 빼는 걸 권한다 (아래 상표 항목).

  ```
  새 리포명   [FILL: 미정]
  npm 패키지  [FILL: 미정 — 예: @<npm-스코프>/erd-cli]
  bin 이름    [FILL: 미정]
  ```

**2) 패키지 개명** — `packages/cli/package.json`

| 필드 | 현재 | 변경 |
|---|---|---|
| `name` | `@liam-hq/cli` | 우리 스코프 |
| `bin` | `{"liam": "./dist-cli/bin/cli.js"}` | 우리 이름 |
| `version` | `0.7.24` | upstream 과 혼동되니 우리 체계로 리셋 (`0.1.0` 권장) |
| `repository`/`homepage`/`bugs` | liam-hq | 새 리포 |

> ⚠️ **개명은 편의가 아니라 라이선스 문제다.** Apache-2.0 **§6 은 상표권을 부여하지 않는다.**
> "Liam" 은 ROUTE06 의 제품명이므로 `liam-*` 이름으로 배포하면 그 선을 넘는다.
> 코드 재배포는 §4 만 지키면 자유지만, 이름은 별개다.

**3) 🔴 NOTICE 를 tarball 에 넣기 — 지금은 빠져 있다**

- `files: ["dist-cli/**/*"]` 라서 NOTICE 가 포함되지 않는다.
  npm 은 LICENSE 는 자동 포함하지만 **NOTICE 는 자동 포함하지 않는다.**
- 게다가 NOTICE 는 **리포 루트**에 있어 패키지 디렉터리에서 보이지도 않는다.
- Apache-2.0 **§4(d)** 는 파생물 배포 시 NOTICE 동반을 요구한다. **퍼블리시 전 필수.**

```jsonc
// packages/cli/package.json
"files": ["dist-cli/**/*", "NOTICE"]
```
\+ 루트 `NOTICE` 를 패키지로 복사하는 단계를 `prepack` 에 추가(또는 파일 자체를 패키지에 둠).

> S3 배포 경로는 이미 충족돼 있다(`dist/` 에 `LICENSE`·`NOTICE` 동반). 구멍은 **npm 경로만**이다.

**4) ⚠️ upstream `release.yml` 이 살아 있다**

`.github/workflows/release.yml` 은 `main` push 시 changesets 로 **`@liam-hq/cli` 를 npm 에 퍼블리시**한다
(npmjs.com Trusted Publisher 에 이 파일명이 등록돼 있음). 개명 전에 `main` 을 건드리지 말 것.
개명 시 이 워크플로도 같이 손봐야 한다.

**5) 퍼블리시**

- 공개 npm 권장. 개인 + 타사 프로젝트 양쪽에서 쓸 거면 인증 불필요한 공개가 압도적으로 편하다.
  포크도 이미 공개라 새로 노출되는 것도 없다.
- 첫 배포 전 반드시 `npm pack` 으로 tarball 내용물을 눈으로 확인할 것
  (`dist-cli/html/` 과 `NOTICE` 가 실제로 들어갔는지). 위 표는 코드 리딩 기반이라 **미검증**이다.
- 임시 디렉터리에서 tarball 설치 후 `npx <bin> erd build` 실동작까지 확인하고 publish.

### 라이선스 준수 — 남은 2건

| 조항 | 요구 | 상태 |
|---|---|---|
| §4(a) | LICENSE 사본 동반 | ✅ 루트 `LICENSE`, S3 `dist/LICENSE` |
| §4(b) | 변경한 파일에 변경 표시 | ✅ 수정 18파일 / 신규 20파일 상단에 주석 |
| §4(d) | NOTICE 동반 | ⚠️ S3 ✅ / **npm tarball 미포함 — 위 3) 참고** |
| §6 | 상표권 미부여 | ⚠️ **패키지·리포 이름에서 "liam" 제거 필요 — 위 2) 참고** |

`NOTICE` 에 upstream 출처(ROUTE06, Inc.)와 pin 커밋, 변경 요약 6항목이 이미 정리돼 있다.
**신규/수정 파일마다 헤더 주석을 붙이는 규칙**은 `.claude/project-profile/structure.md` 에 정확한 문구가 있다.

---

## 3. 남은 개선 — `--layout` / `--memos` 옵션

지금 `layout.json`·`memos.json` 은 **빌드 후 `cp` 로 `dist/` 에 밀어넣고 있다.**
carbon 워크플로에만 있는 해킹이라 **다른 프로젝트에서 재현이 안 된다.** 범용 CLI 라면 정식 옵션이어야 한다.

```bash
<cli> erd build --format=tbls --input schema.json \
      --layout layout.json --memos memos.json --output-dir dist
```

관련 코드:
- `src/cli/erdCommand/buildCommand/index.ts` — `cpSync(cliHtmlPath, resolvedOutDir)` 직후에 주입하면 된다
- 런타임 소비처: `erd-core/src/features/erd/utils/tableLayout/` · `.../utils/memo/`

---

## 4. carbon 프로젝트 연동 현황 (이 CLI 의 첫 소비자)

### 배포된 것

- **stage ERD 라이브** — https://carbon-stage.qesg.co.kr/erd/ (수동 배포, 2026-08-03)
  - 산출물: `carbon-emission-measure-platform-integrated/_workspace/liam-erd/manual-2026-08-03/dist/`
  - 내용: 86 테이블 · FK 128 · 백업 테이블 27개 제외
  - S3: `s3://carbon-estimate-dev/erd-stage/`
- **dev 는 미설정** — CloudFront origin path 가 `/erd-stage` 로 고정이라 dev 도메인도 stage ERD 를 본다.

> CloudFront 서브경로 마운트 함정(접두사 미제거·default root object·AccessDenied·301 쿼리스트링 소실·
> 무효화 범위)은 `.claude/project-profile/deployment.md` 에 정리돼 있다.

### CI/CD 자동화 — revert 됨

BE 리포(`carbon-emission-measure-platform-backend`)에 PR#368 로 넣었다가 **stage 배포를 막아서
PR#369 로 전체 원복**했다.

- 직접 원인: `docker/flyway.Dockerfile` 의 `COPY --from=amazon/aws-cli:2` 에서 **`:2` 태그가 존재하지 않음**
  (Docker Hub·ECR Public 둘 다 태그 950개 중 `2` 없음. `2.34.x` / `latest` 만 있음)
- **근본 원인은 배치**: ERD 이미지 빌드를 배포 임계경로(`flyway.Dockerfile`)에 넣어서
  ERD 와 무관한 마이그레이션·ECS 배포까지 함께 멈췄다.
- 재개 게이트: **ECR 권한** (인프라 담당자 요청 중)

### npm 퍼블리시가 carbon CI 를 크게 단순화한다

현재(revert된) 워크플로는 `checkout liam-custom → corepack → pnpm install → turbo build → node <경로>/cli.js`
5단계다. 퍼블리시하면 `npx <pkg>@<version> erd build …` 한 줄이 되고, 부수적으로:

- **`LIAM_CUSTOM_REF` 저장소 변수가 불필요해진다.**
  지금은 이 변수가 비면 `actions/checkout` 이 빈 `ref` 를 기본 브랜치로 해석해서
  **포크의 `main`(= 순정 upstream)을 받아 커스터마이징 없는 ERD 를 "성공적으로" 빌드한다.**
  실패가 아니라 조용한 열화라 알아채기 어렵다. 버전 핀이 `npx <pkg>@1.2.3` 안으로 들어가면
  이 위험이 구조적으로 사라진다.
- 모노레포 빌드 실패 = 배포 실패 경로도 없어진다.

### 변경 감지 설계 (실측 완료, 미구현)

지문 = `sha256(schema.json)` + `sha256(layout.json/memos.json)` + CLI 버전.
`<prefix>/_build/erd.fingerprint` 에 저장 후 비교, 같으면 빌드·업로드·무효화 전부 생략.

- **tbls 출력은 결정적** — 같은 DB 2회 추출 시 sha256 동일, 타임스탬프 필드 0건 ✅실측
- **행 수(record count)는 안 담긴다** → 데이터가 바뀌어도 지문이 안 흔들린다.
  (나중에 ERD 에 행 수를 표시하고 싶어지면 이 설계와 충돌한다)
- 인덱스(253)·제약(251)이 `schema.json` 안에 있어 인덱스 변경도 잡힌다 ✅실측
- ❌ "flyway 가 마이그레이션을 적용했을 때만 실행" 은 금지 — 시드 CLI 가 마이그레이션 밖에서 스키마를 바꾼다

---

## 5. 함정 모음 → 프로필로 이관

실제로 밟은 함정(CLI `--input` 절대경로, tbls DSN·viewpoints, `dist/schema.json` 혼동,
CloudFront 서브경로 5종, Windows pre-commit·`gen:css`·CRLF)은 전부
**`.claude/project-profile/`** 로 옮겼다. 중복 유지하지 말 것.

| 함정 | 위치 |
|---|---|
| CLI 입력·산출물 | `api-layer.md` → "CLI ingest contract" |
| CloudFront / S3 / 배포 | `deployment.md` |
| Windows 개발환경 | `deployment.md` → "Local gate" |
| 요약본 | `index.md` → "Known gotchas" |

---

## 6. 이어서 할 일 (순서)

1. 새 리포명·npm 스코프·bin 이름 결정 → 2장 `[FILL: 미정]` 채우기
2. 개인 계정에 새 리포 생성 + 전체 히스토리 push
3. `packages/cli/package.json` 개명 (name / bin / version / repository) + `release.yml` 정리
4. **NOTICE 를 `files` 에 추가** (§4(d))
5. `npm pack` 으로 tarball 내용물 확인 — `dist-cli/html/`, `NOTICE` 존재 여부
6. 임시 디렉터리에서 tarball 설치 후 `npx <bin> erd build` 실동작 확인
7. `npm publish --access public`
8. (선택) `--layout` / `--memos` 옵션 추가
9. (선택) 포크 기능 E2E 추가 — 현재 커버리지 0
10. carbon 워크플로를 `npx` 방식으로 재작성 — 단, **ECR 권한이 나온 뒤** (4장 참고)
