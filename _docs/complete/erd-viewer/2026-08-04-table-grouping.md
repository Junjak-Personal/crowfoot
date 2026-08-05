---
title: 테이블 그룹화 — 시각적 묶음 · 그룹 단위 이동 · 좌측 패널 2모드
status: complete
topic: erd-viewer
kind: impl
scope: frontend
created: 2026-08-04
updated: 2026-08-05
related:
  - _docs/complete/erd-viewer/2026-08-03-erd-viewer-impl.md
---

# 테이블 그룹화

기능 단위로 테이블을 묶어 보기 편하게 만든다. 그룹은 데이터 모델이 아니라 **뷰 레이어**다 —
FK · 관계선 · export 결과에 영향이 없다.

`erdkit 0.4.0`. 설계 → 구현 → 검증 전 과정을 5-phase 팀 워크플로로 진행했고,
이 문서가 설계 문서 · team plan · 검증 결과를 통합한 최종 기록이다.

## 무엇이 생겼나

1. **시각 효과** — 멤버 테이블을 파생 bounding box 로 감싸고 좌상단 바깥에 그룹명을 붙인다
2. **논리적 그룹화** — 사람이 명시적으로 묶는다. 자동 추론 없음
3. **그룹 단위 이동** — 헤더를 클릭하면 멤버가 선택되고, 기존 다중 선택 드래그가 그대로 처리한다
4. **보기 모드 2개** — 토글 하나가 캔버스와 사이드바를 **함께** 전환한다
5. **겹침 허용** — 한 테이블이 여러 그룹에 속할 수 있다

### 보기 모드

| | **단일 뷰** (`?showgroups=off`) | **그룹 뷰** (`?showgroups=on`, 기본) |
|---|---|---|
| 캔버스 | 박스 · 라벨 없음 | 박스 + 라벨 |
| 사이드바 | 평평한 알파벳 목록 | 그룹별 섹션 + Ungrouped |
| N개 그룹에 속한 테이블 | **1번** 렌더 | **N번** 렌더 |
| 불변식 | 테이블이 **정확히 한 번** | 테이블이 **최소 한 번** |
| `nodes` prop | `partition.flat` | `partition.flattenedUnique` |
| `(n/m visible)` 카운트 | `partition.flat` | `partition.flat` (중복 행이 아님) |

단일 뷰는 **탈출구**다. 중복 행이 헷갈리면 토글 하나로 이전과 완전히 동일한 목록으로 돌아간다.
그래서 단일 뷰 분기는 기존 JSX 에서 배열 이름만 바꾼 것으로 유지했다 — 같은 비교자, 같은 배열, 같은 key.

## 비목표 (의도적으로 안 만든 것)

- **접기(collapse)** — 관계선 집계 규칙이 따라붙어 범위가 몇 배가 된다
- **중첩(nesting)** — 그룹 안에 그룹. 겹침으로 실제 사용 사례가 충족되고, 중첩은 부모 링크 ·
  깊이별 z-순서 · 사이드바 들여쓰기가 필요해 값이 3~4배다
- **자동 그룹 추론**(FK 클러스터링, 라벨 매칭 등)
- **저장된 박스 좌표** — 항상 파생
- **`parentId`**
- 신규 런타임 의존성 · 사이드바 섹션별 표시 컨트롤

---

## 데이터

### `groups.json` 사이드카

```json
[
  { "id": "payment", "name": "Payment", "tableNames": ["orders", "payments"], "color": "gold" },
  { "id": "shipping", "name": "Shipping", "tableNames": ["shipments"] }
]
```

| 필드 | 타입 | 필수 | 규칙 |
|---|---|---|---|
| `id` | string | ✅ | 빈 문자열 불가. 신규는 `crypto.randomUUID()`. 중복 시 **먼저 것이 이김** |
| `name` | string | ✅ | 빈 문자열 **허용** |
| `tableNames` | string[] | ✅ | 빈 배열이면 항목 전체를 버린다. 항목 **안에서** 중복 제거. **같은 이름이 여러 그룹에 나올 수 있다** |
| `color` | string | | 팔레트 키. 목록 밖 값은 `undefined` 로 강등하되 항목은 유지 |

`layout.json` 에 얹지 않았다 — `layout.json` 은 테이블당 한 항목인데 그룹은 테이블 여러 개를
참조하는 역방향 관계라, 같은 파일에 넣으면 두 스키마가 섞인다.

**파싱 정책은 `memos.json` 과 동일**: 필수 필드가 어긋난 항목은 조용히 버리고, 파일 전체가 깨져도
ERD 로딩을 막지 않는다.

### 우선순위

```
?groups= (링크)  >  브라우저 저장소(liam:groups)  >  groups.json  >  없음
```

링크의 `null` 은 "링크가 아무 말도 안 했다" 이지 "빈 그룹을 명시했다" 가 아니다.

### 쿼리 파라미터

| 파라미터 | 의미 | 파서 | history |
|---|---|---|---|
| `?groups=` | 압축 JSON 그룹 데이터 | `parseAsCompressedString` (`?memos=` 와 동일 — 자유 텍스트 이름이 배열 파서의 `split(',')` 에 잘린다) | `replace` |
| `?showgroups=on\|off` | 보기 모드 (캔버스 + 사이드바) | `parseAsStringLiteral(['on','off'])` — nuqs 내장 | `push`, 기본 `on` |

`?showgroups=` 는 순수 뷰 설정이라 사이드카에 절대 기록되지 않고 `from-link` 도 읽지 않는다.

---

## 왜 이렇게 만들었나 — 비직관적 결정들

코드만 보면 이상해 보이는 것들. 함부로 "정리"하면 깨진다.

### 노드 타입이 `'group'` 이 아니라 `'tableGroup'`

React Flow 12.8.6 이 **`group` 내장 노드 타입을 제공**한다 (`dist/esm/index.js:1897`).
`nodeTypes` 에 `group:` 을 등록하면 그걸 **조용히 덮어쓴다**. 게다가 이 코드베이스는 이미
`NON_RELATED_TABLE_GROUP_NODE_ID` 로 "group" 이라는 단어를 다른 개념에 쓰고 있다.

### `zIndex.tableGroupBox = -1` 을 계산이 아니라 리터럴로

`zIndex` 는 `{ nodeDefault: 2, edgeHighlighted: 1, edgeDefault: 0 }` 이라
"테이블보다 하나 아래"인 `nodeDefault - 1` 은 **`1` = `edgeHighlighted`** 와 충돌하고
기본 엣지 **위**로 올라간다. 박스는 배경이어야 하므로 모든 엣지보다 아래인 `-1` 이 맞다.

### `groupToNode` 가 `measured: { width: 0, height: 0 }` 을 명시

**이걸 지우면 `fitView` 가 영구히 죽는다.** 측정되지 않은 노드가 하나라도 있으면 React Flow 가
`nodesInitialized: false` 를 계속 유지하고, `fitView()` 는 그 플래그에 게이트돼 있어서
Zoom-to-Fit 버튼과 최초 로드 프레이밍이 **둘 다** 조용히 동작하지 않는다. 게다가 미측정 노드는
래퍼가 `visibility: hidden` 이 되어 박스 자체도 안 보인다.

`measured` 를 **0 으로 명시**하면 네 가지가 동시에 성립한다: 초기화된 것으로 취급되고,
보이고, `getFitViewNodes` 의 `measured.width && measured.height` 에서 falsy 라 프레이밍
대상에서 제외되고, `updateNodeInternals` 가 0×0 에서는 덮어쓰지 않아 값이 유지된다.

### `resolveGroupMemberIds` 가 `[]` 대신 `null` 을 반환

`getNodesBounds([])` 는 원점의 0 크기 rect 를 반환하고, **모르는 id 는 건너뛰는 게 아니라
원점의 박스를 병합**한다. 둘 중 하나라도 일어나면 박스가 (0,0) 까지 늘어난다.
그래서 세 가지 경우 — 멤버가 캔버스에 없음 / 숨김 / 미측정 — 모두 `null` 이고, 호출자는
`getNodesBounds` 를 **호출하기 전에** 빠져나가야 한다.

### bounding box 를 손으로 min/max 하지 않고 `getNodesBounds` 를 쓴다

일부 테이블 노드가 이미 `parentId: NON_RELATED_TABLE_GROUP_NODE_ID` 를 갖고 있어
(`convertSchemaToNodes.ts:63`) `position` 이 **상대좌표**다. 손으로 min/max 하면
그런 테이블이 낀 그룹에서 틀린 박스가 나온다.

### 노드 id 가 `tableGroup:${group.id}`

테이블 노드 id 는 **테이블 이름 그 자체**다. 접두 없이 쓰면 `{"id": "payment"}` 인 그룹이
`payment` 테이블과 같은 노드 id 를 만들어 `nodeLookup` 을 오염시킨다.
실제 id 는 `data.groupId` 에 있고, 접두를 파싱해서 되찾지 않는다.

### `.box { pointer-events: none }` 는 필수다

React Flow 는 노드 래퍼에 `pointerEvents: 'all'` 을 **인라인으로** 박는다 (캔버스가
`onNodeClick` 을 등록하므로 `selectable: false` 여도 그렇다). `pointer-events` 는 상속되므로
박스가 이걸 물려받으면 **그룹 안쪽 빈 캔버스 클릭이 판(pane) 으로 안 간다** —
`onPaneClick` → `deselectTable()` 과 판 컨텍스트 메뉴가 조용히 죽는다.
헤더만 `auto` 로 되돌린다.

### 파생 박스가 write-back 없이 추적된다

`TableGroupNode` 가 `useNodes()` 를 구독하고 `useMemo` 안에서 `getNodesBounds` 를 부른다.
노드 상태에 **되쓰지 않으므로** `setNodes` ↔ `onNodesChange` 피드백 루프 자체가 구조적으로
존재하지 않는다. `adoptUserNodes` 가 `set()` **전에** `nodeLookup` 을 갱신하므로
`useNodes()` 와 `nodeLookup` 이 어긋난 프레임이 나올 수 없다.

### `showGroups` 게이트가 `ErdContent` 가 아니라 leaf 컴포넌트에 있다

`<ReactFlow>` 에 넘기는 `nodes` 를 필터링하면 `getNodes()` 가 그룹 노드를 못 보게 되고,
`commitGroups` 가 그 결과로 저장 내용을 만들기 때문에 **단일 뷰에서 그룹을 하나라도 건드리면
다음 commit 에서 모든 그룹이 조용히 삭제**된다.

### 사이드바 shift 범위가 `flattenedUnique` 를 받는다

`handleShiftSelection` 이 `nodeIds.indexOf(...)` 로 범위를 계산한다. 중복이 든 배열을 넘기면
`indexOf` 가 항상 첫 등장 위치를 반환해서, 테이블의 두 번째 행을 shift-클릭하면 엉뚱한 범위가
잡힌다. 선택은 어차피 테이블 정체성 기준(`Set`)이라 중복 제거 배열과 중복 배열이 **같은 결과**를
낸다 — 대신 규칙이 말이 된다: *"읽는 순서대로 범위를 잡되, 여러 번 나오는 테이블은 첫 등장 위치로 센다."*

### 사이드바 React key 의 그룹 쪽에 `group:` 접두

`section.group?.id ?? 'ungrouped'` 로 쓰면 `{"id": "ungrouped"}` 인 그룹이 합성 Ungrouped
섹션과 key 가 충돌한다. 그룹 id 는 사용자가 파일에 쓰는 값이라 도달 가능하다.

### `parseGroups` 는 절대 throw 하지 않는다

CLI 의 `ResultAsync.combine(...).map(...).andThen(...).match(ok, err)` 체인에서 `.map()` 안의
throw 는 **`match` 의 에러 분기조차 실행되지 않는** unhandled rejection 이 된다.
`setSchema` 가 호출되지 않아 앱이 `emptySchema` 에 머물고, 콘솔 외에 아무 흔적이 없는 **백지 ERD** 가
된다. 그래서 Valibot `v.parse` 는 무거운 게 아니라 **틀린 선택**이다.

### `id: "__proto__"` 는 유효한 값이다

빈 문자열이 아닌 문자열이므로 파서를 통과한다. `Object.prototype` 은 오염되지 않지만
(`JSON.parse` 는 `CreateDataProperty` 로 정의해 `__proto__` setter 를 우회한다),
일반 객체로 키잉하면 그 객체의 프로토타입이 **국소적으로** 바뀌어 `Object.entries` 가 해당 키를
건너뛴다 → 섹션이 조용히 사라진다. 그래서 파싱된 문자열로 하는 조회는 전부 `Set` / `Map` 이고,
`partitionTablesByGroup` 은 아예 `group.id` 로 인덱싱하지 않는다.

### `isViewColorKey` 가 `key in obj` 가 아니라 `Map.has` 를 쓴다

일반 객체 + `in` 이었다면 `"toString"` · `"constructor"` · `"valueOf"` 가 전부 팔레트 허용 목록을
통과한다. **간소화 금지.**

---

## 알려진 제약

**그룹 라벨은 테이블 위로 그려질 수 없다.** React Flow 가 래퍼에 `zIndex` 를 인라인으로 박고
`transform` 도 걸기 때문에 각각이 스택 컨텍스트를 만든다. 그룹 서브트리 전체가 `-1` 에서 렌더되므로
그 안의 라벨은 자기 z 값과 무관하게 `2` 인 테이블 위로 못 올라간다. 즉 라벨 자리에 **남의 테이블**이
있으면 라벨이 가려진다. 그룹 자기 멤버는 24px 패딩 띠 덕에 안 겹친다.

고칠 방법이 없다 — 그룹 z 를 올리면 "박스가 관계선 아래" 요구가 깨지고, 라벨을 별도 노드로 빼는 건
범위 초과다. **배치는 사람 책임**으로 수용한다.

**겹치는 박스**는 이제 예외가 아니라 정상 상태다. 8% 틴트 두 겹이 교집합에서 약 15.4% 로 합성되고
(메모의 단일 25% 보다 낮다), 헤더가 겹치면 `groups.json` 배열 순서로 결정된다(나중 항목이 이김).

---

## 검증

기준선은 `c0c06ab0e` (0.3.0).

| | 기준선 | 최종 |
|---|---|---|
| `erd-core tsc --noEmit` | 0 | **0** |
| `erdkit tsc --noEmit` | 0 | **0** |
| erd-core 테스트 | 203 / 29 files | **281 / 33 files** |
| `pnpm lint` (turbo + syncpack + knip) | exit 0 | **exit 0** |
| `turbo build --filter=erdkit` | — | **6/6 successful** |

루트 `tsconfig.json` 이 없어서 루트 `tsc --noEmit` 은 공허하다. 반드시 패키지별로 돌린다.

**미검증 — 브라우저 스모크.** 자동 테스트가 원리적으로 못 닿는 항목:

1. 그룹 박스 **안쪽 빈 캔버스** 클릭 → 판 컨텍스트 메뉴가 열려야 함 (`pointer-events` 실검증).
   CSS Modules 클래스가 vitest/happy-dom 에서 스타일시트로 주입되지 않아 단위 테스트는
   **클래스명 존재만** 확인했지 실제 클릭 통과는 확인하지 못했다
2. 그룹 헤더 드래그 → 멤버 동시 이동, 박스 실시간 추적, 깜빡임/루프 없음
3. Zoom to Fit → 그룹 박스가 프레이밍 대상에서 제외
4. 박스가 점선 배경 **위**, 관계선 **아래**
5. 라벨 자리에 남의 테이블 → 문서화된 가림 제약이지 크래시가 아님
6. 겹치는 그룹 2개 → 사이드바에 두 번, 카운터는 한 번
7. 대시 테두리 대비 (WCAG 1.4.11)

**보안 감사 (Architect C, 실제 diff 대상): 차단 이슈 0건.** 20+ 페이로드를 실행해
`Object.prototype` 오염 0건 · 파서 totality · 색상 허용 목록의 유일 경로 · `dangerouslySetInnerHTML`
계열 0건 · 신규 의존성 0건 · 압축 폭탄 표면 불변을 확인했다. 감사가 찾은 도달 가능한 결함
1건(위 React key 충돌)은 수정 후 재검증했다.

---

## 후속 과제 (이 작업을 마쳤을 때 기준)

> 이 목록은 **2026-08-04 당시의 기록**이다. 살아 있는 상태는
> `_docs/active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md` 가 갖는다.
> 아래 1(개명)·2(노드타입 감사)는 2026-08-05 에 완료됐고, 3(프로필 부정확)도 수정됐다.

1. **`liam:*` → `erdkit:*` 개명** — `localStorage` 키 3개(`liam:memos`, `liam:tableLayout`,
   `liam:groups`)와 콘솔 헬퍼 3개(`window.liamLayout/liamMemos/liamGroups`)를 한 번에.
   지금 네임스페이스를 쪼개면 접두가 두 개가 되어 더 나쁘다
2. **모든 React Flow 노드를 테이블로 취급하는 지점 감사** — 이번에 2건 고쳤고 더 있을 것이다
3. **프로젝트 프로필 부정확 4건** — 전부 구현자를 오도한다:
   - `structure.md` / `index.md` 가 루트 `docs/` 를 전부 upstream 소유라고 하지만
     `docs/usage.md` · `usage_en.md` 는 포크가 만들었다
   - `testing.md` 가 `globals: true` 라 vitest import 불필요라고 하지만 포크 테스트는 전부 명시 import
   - stylelint 기준선이 0 이라고 암시하지만 실제로는 모노레포 전반에 ~77건이 있다
   - erdkit 테스트 기준선이 green 이라고 하지만 `runPreprocess.test.ts` 4건이 실패한다
     (절대경로/tmpdir 관련, Windows)
4. **사이드바 섹션별 표시 컨트롤**
5. **포크 기능 E2E** — 위치 · 메모 · 색상 · 편집모드 · MySQL export 전부 여전히 0
6. **그룹 접기** — 필요해지면 관계선 집계 규칙을 먼저 설계
7. **tbls `viewpoints[].groups[]` → `groups.json` 시드** — tbls 는 이미 거의 동일한 그룹 개념을
   갖고 있고 이 저장소가 검증까지 하지만(`parser/tbls/schema.generated.ts`) 파서가 `viewpoints` 를
   한 번도 읽지 않고 버린다. 겹침 허용 결정으로 충돌 규칙이 불필요해져 단순해졌다.
   **구현 위치는 CLI 이지 `@liam-hq/schema` 가 아니다** — `Schema` 에 필드를 추가하면
   YAML deparser 가 스키마 객체 전체를 stringify 하므로 export 바이트가 바뀌고,
   `dist/schema.json` 은 `erd build` 가 매번 재생성하므로 손으로 넣은 그룹이 덮어써진다
8. **`measured: {0,0}` 은 React Flow 12.8.6 내부 동작에 기댄다** — 공개 필드이고 검증했지만
   문서화된 계약은 아니다. major 업그레이드 시 `adoptUserNodes` · `nodeHasDimensions` ·
   `getFitViewNodes` · `NodeWrapper` 의 `visibility` 네 곳을 재확인해야 한다
9. **진짜 중첩 그룹** — 부모 링크 · 깊이별 z-순서 · 사이드바 들여쓰기 · 부모 헤더 클릭 의미론
10. **동일 멤버 중복 그룹**은 의도적으로 막지 않았다 — 같은 테이블을 두 번 그룹화하면
    멤버가 같고 id 만 다른 그룹 두 개가 생긴다. 무해하고 `Ungroup` 으로 되돌릴 수 있다
11. **툴바 토글의 `aria-pressed`** — 2상태 스위치의 올바른 패턴이지만 공유 surface 인
    `ToolbarIconButton` 의 props 타입이 닫혀 있어 prop 통과가 먼저 필요하다
