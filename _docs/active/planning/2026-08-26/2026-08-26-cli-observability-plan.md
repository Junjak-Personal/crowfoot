# 도구가 무엇을 못 읽었는지 말하게 하기 — `--json` · `meta` · `unparsed`

- 상태: planning (1~4단계 + C·E 완료, D만 남음)
- 토픽: `cli-observability`
- 작성: 2026-08-26
- 작업 표면: `frontend/packages/schema` (파서·메타), `frontend/packages/cli` (명령), `frontend/packages/erd-core` (헤더 표시)

## 문제

사용자가 매 빌드마다 ① `node` 한 줄로 6지표를 세고 ② DDL을 grep해서 역산한다.
도구가 정확도를 말해주지 않기 때문이다. 그런데 그 역산으로도 `text[]`는 못 잡았다 —
컬럼 «수»는 맞았으니까.

들어온 요청을 그대로 만들기 전에, 근거를 확인하고 두 가지를 고쳐 잡는다.

### 정정 ① — "실패해도 successfully를 찍는다"는 정확하지 않다

`runPreprocess`는 파서 에러를 그대로 올리고, `buildCommand`는 그것이 비어 있지 않으면
성공 메시지 **전에** return한다 (`buildCommand/index.ts:24`).

진짜 문제는 실패가 아니라 **에러를 만들지 않는 무손실 아닌 파싱**이다. 조용히 버려진다.
그래서 만들 것은 "실패 시 정직해지기"가 아니라 **"버린 것을 이름으로 말하기"** 다.
목표는 같지만 붙일 자리가 다르다.

### 정정 ② — `text[]`는 관측 공백이 아니라 버그다

```ts
// converter.ts:432
function extractColumnType(typeName: { names?: Node[] } | undefined): string {
  const names = typeName?.names ...        // arrayBounds 를 안 읽는다
```

`@pgsql/types@15.1.1`의 `TypeName`에 **`arrayBounds?: Node[]`가 있다** (`types.d.ts:1880`).
정보는 AST에 들어 있는데 읽지 않는 것뿐이다.

그리고 deparser는 **이미 배열을 처리한다** — `escapeTypeIdentifier`가 `[]` 접미사를
벗겼다 다시 붙인다 (`deparser/postgresql/utils.ts:25-33`). 즉 `text[]`는 파이프라인 전체가
기대하는 값인데 파서만 못 만들어내고 있다.

`unparsed`에 `parsedAs: "text"`로 리포트하는 것은 **버그를 리포트로 포장하는 것**이다.
고치는 게 먼저다.

## 결정

| 질문 | 결정 | 근거 |
|---|---|---|
| `text[]`를 리포트할까 고칠까 | **고친다. 먼저.** | AST에 정보가 있고 deparser도 기대한다. 안 고치면 첫 `unparsed` 출력이 "사실 고칠 수 있었던 것"으로 채워진다 |
| `unparsed` 범위 | **postgres SQL 경로만** | 파서가 6종(sql/postgresql, schemarb, prisma, drizzle, tbls, liam). 실사용은 Supabase 마이그레이션 |
| `ProcessResult.unparsed` | **필수 필드**, 나머지 파서는 `[]` | CLAUDE.md — 하위호환 분기 대신 호출부를 같이 고친다 |
| `meta`의 소스 표기 | **`sources: [{path, sha256}]` 배열** | `--input`이 glob과 URL을 받는다(`getInputContent`). 데모 자체가 `supabase/migrations/*.sql`. 단수로 박으면 그 케이스에서 거짓말이 된다 |
| `--json` 출력 위치 | **stdout은 순수 JSON, 안내는 stderr** | `planCommand`가 이미 쓰는 규약 — `> out.json`이 깨지지 않는다 |
| 뷰어의 meta 표시 | **HelpButton 팝오버, `ReleaseVersion` 옆** | 버전 정보가 이미 사는 자리 |

## 단계

번호는 고정. 각 단계는 그 자체로 green이어야 한다.

### 1. `text[]` 배열 타입 파싱 — 버그

- `extractColumnType`이 `typeName.arrayBounds`를 읽어 차원 수만큼 `[]`를 붙인다.
- 지역 타입 `{ names?: Node[] }`를 `arrayBounds`까지 포함하도록 넓힌다.
- **회귀 위험**: `__snapshots__/index.test.ts.snap`. 스냅샷이 바뀌면 그게 변경의 증거다 —
  배열 컬럼이 있는 케이스만 바뀌어야 한다. 다른 게 바뀌면 멈춘다.

### 2. `erd build --json` + `--strict` — A1

`runPreprocess`가 이미 `Schema`를 손에 들고 있다. 세는 것은 순수 파생이라 파서를 안 건드린다.

```json
{ "tables": 54, "columns": 545,
  "constraints": { "primaryKey": n, "foreignKey": n, "unique": n, "check": n },
  "indexes": 77, "unparsed": [] }
```

- `--json`: stdout에 위 JSON만. 사람용 안내는 stderr.
- `--strict`: `unparsed`가 비지 않으면 exit 1. (`actionRunner` 레이어)
- `--json` 없이도 `unparsed`가 있으면 stderr에 한 줄 요약 — 조용한 실패가 이 작업의 표적이다.

### 3. `schema.json.meta` + 뷰어 헤더 — B

```json
"meta": { "sources": [{ "path": "...", "sha256": "..." }],
          "crowfootVersion": "0.5.0", "builtAt": "2026-08-26T…Z" }
```

- **호환**: `schemaSchema`가 `v.object(...)`고 valibot `object()`는 모르는 키를 거부하지 않는다.
  구버전 뷰어가 안 깨진다. 다만 **strip**하므로, 헤더에 찍으려면 `schemaSchema`에
  `meta: v.optional(...)`을 추가해야 컴포넌트까지 값이 간다.
- `crowfootVersion`은 `cli/index.ts:11`이 이미 읽는 `package.json`에서.
- `curl .../schema.json | jq .meta`가 즉시 동작하는 것이 이 단계의 합격 기준.
- `from-link` / `arrange`는 schema.json을 다시 쓰지 않으므로 meta가 덮이지 않는다 — 확인함.

### 4. postgres `unparsed` — A2

`ProcessResult`에 `unparsed: UnparsedItem[]` 추가.

```ts
type UnparsedItem = { table: string; column?: string; clause: string; raw: string }
```

첫 기록 지점은 **`defaultValueOf` (`converter.ts:188`)** — 이미 "못 그리겠으면 `null`"인
단일 분기이고 원문(`chunkSql`)까지 손에 들고 있다. `ARRAY['ko','en','zh']`가 조용히 null이
된 이유가 `A_ArrayExpr` 분기 부재다.

`parsedAs`는 넣지 않는다. 1단계에서 그 케이스가 사라지고, 남기면 "손실 파싱을 리포트로
때운다"는 선례가 된다.

## 검증

- 각 단계 후 `pnpm lint` / `pnpm test` / `pnpm build`.
- 1단계: 배열 컬럼이 있는 SQL 픽스처로 파서 테스트 + 스냅샷 diff 검수.
- 2단계: 6지표가 `schema.json`을 직접 센 값과 일치하는지 — 사용자가 매번 짜던 그 검산을
  테스트로 고정한다.
- 3단계: 빌드 산출물의 `jq .meta`, glob 입력(다중 소스)에서 `sources`가 실제 파일 수와 일치.
- 4단계: `DEFAULT ARRAY[...]`가 든 픽스처에서 `unparsed`가 그 컬럼을 이름으로 집는지.

## 비범위였다가 이어서 한 것

| 항목 | 커밋 | 계획 대비 |
|---|---|---|
| C `erd plan --update` | `6423fe6` | 계획대로. `readPlan`을 `arrangeCommand`에서 `arrange/`로 빼 두 커맨드가 공유 |
| E `erd arrange --check` | `f57c5c8` | **입력이 계획과 다르다** — 아래 |

### E 의 입력이 바뀐 이유

처음엔 `--plan` 을 받아 `arrange` 를 다시 돌리고 그 출력을 검사하게 만들었다. **vacuous 했다**:
`arrange` 는 그룹을 `GROUP_GAP`(340) 간격으로 놓고 박스는 사방 24 만 번지므로 자기 출력에선
박스가 절대 안 겹친다. 항상 통과하는 검사다.

겹침은 **편집 모드에서 끌어다 놓은 뒤** 생기고, 그 결과가 들어 있는 것은 배포되는
`layout.json` / `groups.json` 이다. 그래서 `--check` 는 `--output-dir` 의 사이드카를 읽고
`--plan` 을 아예 요구하지 않는다. 검증도 그 방식으로 했다 — `users` 를 옆 그룹 블록 안으로
옮긴 `layout.json` 에서 `order and people cross by 388x148`, exit 1.

## 비범위 (남은 것)

- FK 없는 표 배치 (D) — **CLI 플래그로 안 된다.** 뷰어가 그 표들을
  `NON_RELATED_TABLE_GROUP_NODE_ID`에 parent로 붙이고 직접 배치하므로 erd-core를 고쳐야 한다.
  `--check` 가 이 표들을 "위치 없는 멤버"로 이름 붙여 보고하므로, 지금은 최소한 조용하지는 않다.

## 실행 기록 (2026-08-26)

| 단계 | 커밋 | 계획과 달라진 점 |
|---|---|---|
| 1 | `6f608a4` | 없음. 기존 픽스처에 배열 컬럼이 하나도 없어 569 테스트가 전부 통과한 채였다 |
| 2 | `cfcc129` | `--strict`를 4단계로 미뤘다 — `unparsed`가 없는 동안은 아무 일도 안 하는 플래그가 된다. `enums`/`extensions`를 지표에 추가 |
| 3 | `a8bc3d5` | 계획대로 `sources` 배열. glob 정렬과 버전 읽기 경로 수정이 딸려 나왔다 (아래) |
| 4 | `3543742` | 원문 위치를 식 노드가 아니라 `DEFAULT` 키워드에서 읽는다 — postgres는 연산자 식의 location을 **연산자**에 둬서 `('a' \|\| ',')`가 `\|\| ','`로 잘렸다 |

### 작업 중 드러난 것

- **glob 순서 비결정성** — `glob`이 파일시스템 순서를 그대로 주고 그걸 이어붙여 파싱한다.
  같은 입력이 두 개의 다른 스키마를 만들 수 있었다. 출처 스탬프의 전제를 무너뜨리므로 3단계에서 정렬.
- **번들 평탄화** — rollup이 전 소스를 `dist-cli/bin/cli.js` 하나로 합쳐서, 더 깊은 디렉터리에서
  쓴 상대 경로(`../../../package.json`)가 빌드에선 아무것도 가리키지 않았다. `cli/version.ts` 한 곳에서 읽는다.
- **`crowfoot` 패키지의 `lint:tsc`가 아무것도 검사하지 않는다.** 루트 tsconfig가 `"files": []` +
  references뿐이라 `tsc --noEmit`이 `-b` 없이는 no-op다. 실제로 이 작업 중 타입 에러 하나가 그대로
  통과했다(수동 `tsc -p tsconfig.app.json`으로 발견). **미수정 — 별도 과제.**
  같이 드러난 기존 오류: `App.tsx`의 `emptySchema`가 `enums`/`extensions` 누락.
  **`7db358f` 에서 수정** — 두 프로젝트를 명시적으로 검사하게 바꾸고, 숨어 있던 오류 3건도 같이.
- **README 의 절대경로 경고가 틀렸다** — POSIX 절대경로는 `new URL()` 이 base 없이 던져서
  로컬 분기로 간다. URL 로 잡히는 것은 **Windows 드라이브 문자 경로**뿐이었고, 그건 문서가
  아니라 버그였다. `d557009` 에서 고치고 경고문을 지웠다.
