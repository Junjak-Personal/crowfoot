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

우선순위는 **위험 × 빈도** 순. 3 은 실제로 물릴 수 있는 것, 4~6·10 은 개선, 7~9 는 조건부.

> **번호는 고정이다.** 1·2 는 완료돼 아래 "완료됨" 으로 내려갔지만, 남은 항목을
> 다시 매기지 않는다 — 세션 지시가 항목을 번호로 참조한다.

---

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

## 10. 테이블 레이아웃/색상의 **읽기** 측이 노드 종류를 안 가린다

항목 1 감사에서 나왔지만 **고치지 않고 남긴 2건.** 둘 다 앱이 스스로 만들지 않는 입력
(손으로 편집한 링크나 사이드카 파일)에서만 도달하므로 결함 판정을 보류했다.

- `hooks/useInitialAutoLayout.ts:79-82` — `positionedNodes.map` 이 **모든** 노드에
  `resolveTableColor(node.id, …)` 를 적용한다. `?colors=` 나 `layout.json` 에 메모 UUID 나
  `tableGroup:` id 를 키로 넣으면 그 노드가 **테이블 색상 맵으로** 칠해진다.
  쓰기 측(`serializeTableColors`)은 테이블 이름만 내보내므로 자연 발생은 안 한다
- `utils/tableLayout/tableLayout.ts:199-205` `applyTableLayout` — 위치판 동일.
  조작된 `?positions=<memo-uuid>:100:200` 이 메모를 옮긴다. 그룹 노드에는 무해하다
  (박스 기하가 파생이라 `position` 이 쓰이지 않는다). 쓰기 측은 `tableNodesOnly` 로 이미 좁다

- 판단할 것: 방어적 필터를 넣을지, "조작된 입력은 사용자 책임" 으로 문서화하고 둘지
- 비용: 낮음(각 한 줄). 실제 비용은 위 판단

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

- ~~**1. 모든 RF 노드를 테이블로 취급하는 지점 감사**~~ — 2026-08-05, `b805e57fb`.
  `erd-core/src` 의 `nodes.map`·`nodes.filter`·`getNodes()`·`useNodes()` 전 호출부를 훑어
  **결함 1건**을 찾아 고쳤다: `TableDetail.tsx` 의 "Open in main area" 가 캔버스 전체를
  추출 스키마와 diff 해서 **메모 UUID 와 `tableGroup:` id 를 `?hidden=` 에 실었다** —
  `hideAllNodes`·`showSelectedTables` 에 이어 같은 결함의 3번째 사례. 계산을
  `ERDContent/utils/tableIdsToHide.ts` 로 빼고 혼합 픽스처 회귀 테스트 4개를 붙였다.
  나머지 호출부는 이미 필터돼 있거나(9곳) 타입/ id 조회로 안전하거나(4곳)
  전 노드 대상이 맞다(다수)고 확인했다.
  - **부수 동작 변화**: 이 경로가 더 이상 `NON_RELATED_TABLE_GROUP_NODE_ID` 를
    `hiddenNodeIds` 에 넣지 않는다. 렌더는 동일하지만(`shouldHideGroupNodeId: true`)
    popstate 복원은 `hasNonRelatedChildNodes` 로 그 플래그를 유도하므로 달라질 수 있다.
    먼저 고친 두 곳과 규칙을 통일한 결과다
  - 남은 2건은 위 **항목 10** 으로 승격

- ~~**2. `liam:*` → `erdkit:*` 개명**~~ — 2026-08-05. 저장소 키 3개와 콘솔 헬퍼 3개를
  한 번에. 마이그레이션은 **(a) 1회 이전 후 구 키 삭제** 로 결정됐고
  `erd-core/src/features/erd/utils/storage/` 의 `readStoredItem`/`removeStoredItem` 이
  3개 모듈에 공유된다. `clearStoredX` 가 신 키만 지우면 다음 읽기에 구 값이 되살아나
  reset 이 무효가 되는 결함을 함께 막았다(양쪽 삭제 + 모듈별 회귀 테스트).
  `NOTICE` 9번, `docs/usage.md`·`usage_en.md`, README 2개 갱신.
  포크 출처는 CLI 배너 한 줄과 `--help` 설명에도 넣었다 — 배너는 `erdkit init` 에서만
  렌더되고 `erd build` 에선 안 나오기 때문이다. `erdkit 0.4.1`
