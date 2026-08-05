---
title: erd-viewer 백로그 — 그룹화 이후 남은 것
status: planning
topic: erd-viewer
kind: plan
scope: frontend
created: 2026-08-05
updated: 2026-08-05
related:
  - _docs/complete/erd-viewer/2026-08-04-table-grouping.md
---

# erd-viewer 백로그

테이블 그룹화(0.4.0, `ba9d82927`) 작업 중 발견했지만 **의도적으로 범위 밖에 둔** 것들.
개별 plan 문서로 쪼개지 않고 여기 모아둔다 — 착수할 때 해당 항목만 떼어 plan 으로 승격한다.

우선순위는 **위험 × 빈도** 순. 1~3 은 실제로 물릴 수 있는 것, 4~6 은 개선, 7~9 는 조건부.

---

## 1. 모든 RF 노드를 테이블로 취급하는 지점 감사

**왜 지금 중요한가.** 그룹화 작업에서 **2건을 실제로 고쳤다** —
`useTableVisibility.ts` 의 `hideAllNodes` 와 `LeftPane.tsx` 의 `showSelectedTables` 가
`nodes.map(n => n.id)` 로 전체 노드를 훑어서, **메모 UUID 가 이미 `?hidden=` 에 새고 있었다.**
그룹 노드가 추가되면서 악화될 참이었다.

같은 패턴이 더 있을 가능성이 높다. 캔버스에 테이블·메모·그룹 세 종류가 공존하는데,
코드는 대부분 upstream 시절(테이블만 있던 때) 가정 위에 있다.

- 착수: `frontend/packages/erd-core/src` 에서 `nodes.map` · `nodes.filter` · `getNodes()` 사용처를
  전수로 훑어 `isTableNode` 필터가 빠진 곳을 찾는다
- 판정 기준: "이 코드가 메모나 그룹 노드를 받으면 뭘 하나?" 에 답이 없으면 결함
- 비용: 낮음. 대부분 한 줄 필터

## 2. `liam:*` → `erdkit:*` 개명

`localStorage` 키 3개(`liam:memos`, `liam:tableLayout`, `liam:groups`)와
콘솔 헬퍼 3개(`window.liamLayout`, `window.liamMemos`, `window.liamGroups`).

Apache-2.0 §6 은 상표권을 주지 않으므로 원칙적으로 `liam` 이름을 안 쓰는 게 맞다.
프로필 규칙 2가 명시하는 표면(패키지 · 실행파일 · 저장소 · 페이지 제목)에는 해당하지 않아
**그룹화 때는 일부러 `liam:groups` 로 맞췄다** — 지금 쪼개면 접두가 두 개가 되어 더 나쁘다.

- **반드시 한 번에** 6개 전부. 부분 개명 금지
- 기존 저장소 값 마이그레이션 필요 여부 판단 (읽기 시 구 키 fallback 1회 후 신 키로 이전, 또는 그냥 버림)
- 비용: 낮음. 단 `docs/usage.md` · `usage_en.md` 의 저장소 키 표도 함께

## 3. 포크 기능 E2E

**현재 0건.** 위치 영속 · 메모 · 색상 · 편집모드 · MySQL export · 그룹화 전부 단위 테스트만 있다.

그룹화에서 이게 아프게 드러났다 — `pointer-events` · 파생 bounding box · CSS 스택 순서 ·
`measured: {0,0}` 의 `fitView` 상호작용은 **happy-dom 에서 원리적으로 검증 불가**다.
CSS Modules 가 스타일시트로 주입되지 않아 클래스명 존재만 확인했다.

- Playwright 는 이미 저장소에 있다 (`@liam-hq/e2e`, upstream 앱용)
- 포크는 정적 SPA 라 `erd build` → `serve dist/` → 시나리오가 자연스럽다
- 최소 시나리오: 편집모드 진입 → 테이블 이동 → 새로고침 후 위치 유지 → 메모 생성 →
  그룹 생성 → 그룹 안쪽 빈 캔버스 클릭이 판으로 가는지
- 비용: 중간. 하네스 1회 구축 후 시나리오 추가는 저렴

## 4. tbls `viewpoints[].groups[]` → `groups.json` 시드

tbls 는 **이미 거의 동일한 그룹 개념을 갖고 있고 이 저장소가 검증까지 한다** —
`parser/tbls/schema.generated.ts` 가 `viewpoints[].groups[]` 를
`{ name, desc, labels?, tables?, color? }` 로 파싱한다. 그런데
`parser/tbls/parser.ts` 는 **`viewpoints` 를 한 번도 읽지 않고** `{tables, enums, extensions}` 만 반환한다.

carbon ERD 의 실제 ingest 경로가 tbls 이므로, `.tbls.yml` 에 viewpoint 그룹이 이미 있다면
`groups.json` 을 손으로 다시 쓰는 건 중복 작업이다.

**구현 위치는 CLI 이지 `@liam-hq/schema` 가 아니다.** 세 가지 이유 모두 검증됨:
- `Schema` 에 필드를 추가하면 `deparser/yaml/schemaDeparser.ts` 가 스키마 객체 **전체를 stringify**
  하므로 YAML export 바이트가 조용히 바뀐다
- `dist/schema.json` 은 `erd build` 가 매번 소스에서 재생성하므로 손으로 넣은 그룹이 덮어써진다
  (`layout.json`·`memos.json` 을 사이드카로 뺀 바로 그 이유)
- tbls 그룹은 `labels` 로도 매칭 — 그룹화의 "자동 추론 없음" 비목표에 걸린다. 단 **시드**는
  일회성 생성이라 런타임 추론과 다르다

**착수 전 정할 것 2가지:**
- 트리거 — `erd build --seed-groups` 명시 플래그(기존 `groups.json` 있으면 보존) vs 부재 시 자동 생성
  vs 별도 서브커맨드
- `labels` 로만 정의된 그룹 — `tables[].labels[].name` 에 조인해 해석할지, 건너뛰되 경고할지.
  (`tables[].labels` 가 같은 JSON 에 있어 해석은 **가능**하다)

겹침 허용 결정 덕에 **여러 viewpoint 가 같은 테이블을 물어도 충돌 규칙이 불필요**해져 단순해졌다.

## 5. 사이드바 섹션별 표시 컨트롤

그룹 뷰에서 그룹 단위로 show/hide. 지금은 전역 Show All / Hide All 만 있다.

- `(n/m visible)` 카운터와의 관계 정의 필요 (전역 유지 vs 섹션별)
- 겹치는 그룹에서 "이 그룹 숨김" 이 공유 테이블에 어떤 의미인지 정해야 함 — 자명하지 않다
- 비용: 낮음~중간. 위 의미론 결정이 실제 비용

## 6. 툴바 토글의 `aria-pressed`

`GroupToggleButton` 은 2상태 뷰 스위치인데 `aria-pressed` 가 없다. 지금은 아이콘 교체 +
`label` 변경으로만 상태를 알린다 (`LeftPane` 의 Show All/Hide All 선례와 동일).

막힌 이유: `ToolbarIconButton` 의 props 타입이 닫혀 있고(`...rest` 스프레드 없음)
공유 surface 라 그룹화 범위에서 건드리지 않았다.

- 선행: `ToolbarIconButton` 에 prop 통과 추가
- 그러면 `ShowModeMenu` 등 다른 토글도 함께 개선 가능
- 비용: 낮음

---

## 조건부 — 필요해지면

## 7. 그룹 접기(collapse)

그룹을 하나의 박스로 축약하고 내부를 숨긴다. **그룹화에서 명시적 비목표였다.**

착수한다면 **관계선 집계 규칙을 먼저 설계**해야 한다 — 접힌 그룹을 드나드는 FK 를 어떻게 그릴지가
범위의 대부분이다(N개 선을 1개로 합치나? 라벨은? 양쪽 다 접히면?). 이걸 정하지 않고 시작하면
UI 부터 만들다 막힌다.

## 8. 진짜 중첩 그룹 (그룹 안에 그룹)

**겹침(한 테이블이 여러 그룹)은 0.4.0 에 이미 있다.** 중첩은 다른 것이고, 아직 실제 요구가 없다.

착수한다면: `Group` 레코드에 부모 링크 · 깊이별 z-순서(현재 모든 박스가 `tableGroupBox: -1` 을
공유해 DOM 순서로 결정됨) · 사이드바 들여쓰기 · **부모 헤더 클릭이 무엇을 선택하는지**(바깥 전체냐
직계냐)의 의미론. 겹침 대비 3~4배.

## 9. 동일 멤버 중복 그룹 가드

같은 테이블 집합을 두 번 그룹화하면 멤버가 같고 id 만 다른 그룹 두 개가 생겨 박스가 겹쳐 그려진다.
**의도적으로 막지 않았다** — 무해하고 `Ungroup` 으로 되돌릴 수 있으며, 사용자 실수 하나를 위해
개념을 추가하는 셈이다. 실제로 불편하다는 신호가 오면 그때.

---

## 감시 항목 (과제가 아니라 조건부 트리거)

**React Flow major 업그레이드 시 반드시 재검증.**
`groupToNode` 의 `measured: { width: 0, height: 0 }` 은 공개 필드지만 문서화된 계약은 아니고,
12.8.6 의 내부 동작 4곳에 기대고 있다. 이게 깨지면 **`fitView` 가 조용히 죽는다** —
Zoom-to-Fit 버튼과 최초 로드 프레이밍 둘 다, 에러 없이.

재검증 대상: `adoptUserNodes` · `nodeHasDimensions` · `getFitViewNodes` ·
`NodeWrapper` 의 `visibility` 계산. `groupNode.ts` 주석이 네 곳을 이름으로 적어두었다.

---

## 완료됨 (이 백로그에서 제외)

- ~~프로젝트 프로필 부정확 4건~~ — 2026-08-05 수정. `docs/` 소유권(2파일 예외 명시),
  `globals: true` 서술, stylelint 기준선, erdkit 테스트 기준선(27/4 실패가 정상)
