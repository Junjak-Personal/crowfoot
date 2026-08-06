---
title: ERD 뷰어 포크 커스터마이징 (위치 영속 · 메모 · 색상 · 편집모드 · MySQL export)
status: complete
topic: erd-viewer
kind: impl
scope: frontend
created: 2026-08-03
updated: 2026-08-03
related: []
---

# ERD 뷰어 포크 커스터마이징

## Spec

### 목표

Liam ERD(upstream)를 carbon 스키마 문서화에 쓸 수 있게 만든다. upstream 그대로는 세 가지가 막혔다.

- 새로고침할 때마다 자동 배치가 재계산돼 **드래그한 위치가 원위치로 돌아간다**
- 다이어그램에 **설명을 붙일 방법이 없다**
- **MySQL DDL 로 내보낼 수 없다** (PostgreSQL·YAML 만 지원)

### 비목표

- upstream 추종. `92156eac5`(2026-06-18)에 핀하고 따라가지 않는다.
- upstream `frontend/apps/app`(Next.js + Supabase) 수정. 작업 표면은 `erd-core` / `schema` / `cli` 3개 패키지뿐.

### 아키텍처 결정

**1. 위치 해석 우선순위 — 수동 레이아웃 부채를 만들지 않는 게 핵심**

```
URL(?positions=) > localStorage > layout.json > ELK 자동배치
```

미지정 테이블은 **ELK 로 폴백**한다. 그래서 스키마에 신규 테이블이 생겨도 기존 레이아웃이 깨지지 않는다.
"전부 수동 배치" 로 갔다면 테이블이 추가될 때마다 사람이 손봐야 하는 부채가 됐을 것이다.
ELK 가 `nodePlacement/layering: INTERACTIVE` 라, 고정 좌표를 시드로 넣으면 배치 힌트로 존중한다.

**2. URL 이 상태 전송 계층**

`nuqs` 커스텀 파서로 pako-deflate + URL-safe base64 압축. 히스토리 모드를 의도적으로 나눴다.

| 파라미터 | history | 이유 |
|---|---|---|
| `active` `show` `hidden` | `push` | 사용자 **내비게이션** — 뒤로가기가 동작해야 함 |
| `positions` `colors` `memos` | `replace` | 사용자 **편집** — 뒤로가기 스택을 채우면 안 됨 |

메모만 배열 파서가 아닌 **단일 압축 JSON blob** 이다. 메모 텍스트는 자유 형식이라 배열 파서의
`split(',')` 에 잘려나간다.

**3. 읽기 전용이 기본, 편집은 명시적 opt-in**

`?edit=1`(또는 `?edit=true`) 없으면 편집 불가. `editMode` 는 저장하지 않고 파생한다.
공유 링크가 실수로 흐트러지는 걸 구조적으로 막는 쪽을 택했다.

**4. 색상은 디자인 토큰에서만 가져온다**

12색 전부 `@liam-hq/ui` 기존 토큰에서 리프트. `--primary-accent` 는 **의도적으로 제외** — "강조/hover"
의미라 사용자 지정 색으로 겸용하면 의미가 충돌한다.
적용은 인라인 스타일이 아니라 `data-view-color` 속성 + 중앙 CSS 선언(`var(--view-tint)`)으로 했다.
컴포넌트마다 중복 선언할 필요가 없고, 커스텀 프로퍼티에 타입 단언을 붙이는 것도 피할 수 있다.

**5. MySQL 은 기존 deparser 인터페이스 구현으로 추가**

호출부를 특수 분기하지 않고 `deparser/type.ts` 의 `SchemaDeparser` 를 구현했다. 새 타깃을 추가하는 방법이 하나로 유지된다.

## Plan

구현 커밋 2개 (둘 다 push 완료):

```
ac5b392fa  feat(erd-core): persist table positions across reloads
9af3ab35e  feat: memos, colour coding, MySQL export and an explicit edit mode
```

납품된 기능 6개:

1. **테이블 위치 영속** — 위 우선순위대로 해석
2. **캔버스 메모** — `memos.json` 으로 빌드 동봉, `?edit=1` 에서 편집. 우클릭 컨텍스트 메뉴로 추가/삭제, 폰트 크기(+/− 및 숫자 입력), 리사이즈
3. **12색 색상 지정** — 테이블 헤더·메모
4. **읽기 전용 기본 + 명시적 편집모드**
5. **MySQL DDL export** — 클립보드 복사 / `.sql` 다운로드
6. **`?show=all|table|key`** — 내부 이름(`ALL_FIELDS` 등) 대신 짧고 타이핑 가능한 값

변경 규모: `git diff --stat 92156eac5..HEAD` 기준 수정 18파일 / 신규 20파일.

## Findings & Metrics

### 검증 — 됐다 (근거 있음)

- **테스트** (2026-08-03 `d2fb6638c` 재실행 확인)
  - `@liam-hq/schema` **562 pass / 37 files**
  - `@liam-hq/erd-core` **195 pass + 4 todo / 29 files**
  - `tsc --noEmit` 두 패키지 다 exit 0, lint 0
- **MySQL DDL 을 DB 레벨로 검증** — 임시 DB `carbon_ddl_check` 생성 → 64KB DDL 적용(exit 0) → 원본과 대조
  - 86 = 86 테이블, 832 = 832 컬럼
  - FK / PK / UNIQUE = 128 / 85 / 38
  - **타입·NULL·기본값 불일치 0건**
  - 검증 후 DB 삭제
- **브라우저 실동작** — 이 코드로 빌드한 산출물이 https://carbon-stage.qesg.co.kr/erd/ 에 배포되어 동작 확인됨(유저). `?edit=1` 편집모드도 확인됨.

### 남은 결함 — 완료로 오인하면 안 되는 것

- **포크 기능의 E2E 커버리지가 0 이다.** 위치/메모/색상/편집모드/MySQL export 전부 단위 테스트만 있다.
  `frontend/internal-packages/e2e` 의 Playwright 스위트는 upstream Next.js 앱을 겨눈다.
  → 향후 검토 과제. 착수 조건이 생기면 별도 plan 으로 등록한다.

### 설계 교훈

- **URL-safe base64 는 CloudFront 재조립을 통과한다** — CF Functions 가 원본 쿼리스트링 문자열을 노출하지
  않아 손으로 재조립해야 하는데, 값이 전부 URL-safe(`+`→`-`, `/`→`_`, `=` 제거)라 무손실이다 ✅실측
- **산출물이 전부 상대경로**(`./assets/…`, `fetch("./schema.json")`)라 서브경로 마운트에 재빌드가 불필요하다

## Final Summary

포크 뷰어 커스터마이징 완료. 커밋 `ac5b392fa..9af3ab35e`, 브랜치 `feature/erd-view-customization`, push 완료.
carbon stage ERD(86 테이블 · FK 128)가 이 코드로 빌드돼 라이브 동작 중.

Apache-2.0 준수 상태: §4(a) LICENSE 동반 ✅ · §4(b) 변경 파일 헤더 주석 ✅ (수정 18 / 신규 20).
**§4(d) NOTICE 와 §6 상표는 npm 배포 경로에서만 미충족** — [cli-distribution 계획](../cli-distribution/2026-08-03-cli-distribution.md) 참고.

코드 컨벤션·스택·함정은 `.claude/project-profile/` 이 SSOT.
