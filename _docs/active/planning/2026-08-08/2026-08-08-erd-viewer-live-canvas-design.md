# 스키마 편집 중 캔버스를 살아있게 두기 — 설계

- 상태: planning
- 토픽: `erd-viewer`
- 작성: 2026-08-08
- 작업 표면: `frontend/packages/erd-core`

## 문제

`ERDContent` 는 노드를 `useState(() => …)` 로 **마운트 시점에 스냅샷**한다. 그래서 새 스키마를
반영할 수단이 `ErdRenderer.tsx` 의 `key={\`${schemaKey}-${showMode}\`}` 재마운트밖에 없다.
`schemaKey` 는 스키마 전체의 해시라, **편집 한 번에 캔버스가 통째로 다시 만들어진다.**

재마운트가 파괴하는 것:

| 잃는 것 | 경로 |
|---|---|
| 뷰포트 | `useInitialAutoLayout` 이 `fitView()` 재실행 |
| 안 옮긴 테이블의 위치 | ELK 재계산. 입력(노드 높이·엣지)이 바뀌었으니 결과도 바뀐다 |
| React Flow 선택 상태 | 노드가 전부 새 객체 |
| — | `ErdContentProvider` 의 loading 이 리셋되어 스피너가 깜빡인다 |

원래부터 있던 구조지만(show mode 전환도 같은 경로), 스키마가 런타임에 안 바뀌던 동안에는
실질적으로 안 터지던 경로였다. 편집 기능이 그 경로를 상시로 만들었다.

곁가지로 발견한 것: `ErdRenderer` 가 `convertSchemaToNodes` 를 **렌더 바디에서 `useMemo` 없이**
호출한다. 사이드바 토글·패널 리사이즈마다 스키마 전체를 노드로 재변환하고, 정작 `ERDContent`
는 마운트 때만 쓴다. 지금은 순수 낭비이고, 아래 설계에서는 반드시 고쳐야 하는 전제다.

## 전제

- ELK 는 `elk.algorithm: layered` (기본 방향 RIGHT) — `getElkLayout.ts`. 테이블이 세로 컬럼으로
  쌓이므로 **노드가 커지면 침범하는 것은 언제나 아래쪽**이다. 밀어내기는 세로 한 축이면 족하고,
  그게 배치의 결에 맞는다.
- 툴바에 `Tidy up`(수동 전체 재배치)이 **이미 있다.** 자동 재배치를 없애도 사용자에게는 원할 때
  부르는 버튼이 남는다. 이것이 "편집 중에는 절대 재배치하지 않는다"를 안전하게 만드는 근거다.

## 결정

| 질문 | 결정 |
|---|---|
| 재배치 문제의 깊이 | 제자리 갱신 + 겹침 해소 (아래 Part 1 + Part 2) |
| show mode 전환 | **지금대로 재마운트 + 재배치 유지.** `ALL_FIELDS ↔ TABLE_NAME` 은 노드 높이가 몇 배 차이라 안 옮기면 사이가 통째로 비거나 겹친다 |
| 노드가 작아졌을 때 | **위로 안 당긴다.** 빈칸이 남는다. 눈에 띄는 결함은 "안 건드린 게 움직였다"이지 "빈칸이 생겼다"가 아니다. 거슬리면 `Tidy up` |
| 밀려날 때 애니메이션 | **넣는다.** 180ms slide. 이게 "자리를 만들어줬다"로 읽히게 하는 핵심 |

## Part 1 — 스키마 편집은 재마운트하지 않는다

### 1.1 `ErdRenderer.tsx`

- `convertSchemaToNodes({ schema, showMode })` 를 `useMemo(…, [schema, showMode])` 로 감싼다.
  Part 1.2 의 동기화 effect 가 이 참조 안정성에 의존한다.
- `key={\`${schemaKey}-${showMode}\`}` → `key={showMode}`.
- `schemaKey` / `createHash` 가 다른 데서 안 쓰이면 제거한다.

`showDiff` 토글도 `schema` 를 바꾸므로(`merged` ↔ `current`) 이제 재마운트가 아니라 제자리
갱신으로 처리된다. 의도한 개선이다.

### 1.2 `reconcileTableNodes` (순수, 신규)

`features/erd/utils/nodeSync/reconcileTableNodes.ts`

```
reconcileTableNodes(current: Node[], incoming: Node[], place: (id) => XYPosition): Node[]
```

- **남은 테이블**: `data` 만 incoming 으로 교체. `position` · `selected` · `measured` ·
  `hidden` 은 current 유지. `data.color` 는 `useInitialAutoLayout` 이 붙인 것이라 incoming
  에 없다 → `{ ...current.data, ...incoming.data }` 로 병합(incoming 의 키는 값이
  `undefined` 여도 항상 존재하므로 FK 제거 같은 "값이 사라짐"도 정확히 반영된다).
- **사라진 테이블**: 제거.
- **새 테이블**: incoming 그대로, `position = place(id)`.
- **메모 · 그룹 노드**: 손대지 않는다.
- **`nonRelatedTableGroup` 노드**: incoming 의 존재 여부를 따른다.
- **`parentId` 전환 보정**: 테이블이 FK 를 얻으면 `parentId: NON_RELATED_TABLE_GROUP_NODE_ID`
  가 사라지고, 잃으면 붙는다. React Flow 에서 자식의 `position` 은 **부모 상대**라 좌표계가
  바뀐다. 그룹 노드 위치만큼 보정하지 않으면 `Connect to` 할 때마다 테이블이 튄다.
  - 그룹을 벗어남: `position += group.position`
  - 그룹에 들어감: `position -= group.position`
- **변경이 없으면 `current` 를 그대로 반환**(같은 배열 참조). effect 루프를 막는 핵심 계약.

`place(id)` 는 호출부가 만든다: `?positions=` 핀 → `dumpTableLayout()`(= `resolvedLayout`)
→ 뷰포트 중앙. rename 은 `renameTableInLayout` 이 `resolvedLayout` 키까지 바꿔 두므로
두 번째 단계에서 정확히 원래 자리를 찾는다.

### 1.3 `ERDContent.tsx`

```tsx
useEffect(() => {
  setNodes((current) => reconcileTableNodes(current, _nodes, place))
  setEdges(_edges)
}, [_nodes, _edges, place, setNodes, setEdges])
```

effect 를 쓰는 이유: 노드 상태의 소유자가 React Flow(`useNodesState`)라 props 를 그대로
렌더에 쓸 수 없고, 스키마는 이 컴포넌트 **밖**에서 바뀐다. 이벤트 훅으로 대체할 지점이 없다.
루프 방지는 위의 "변경 없으면 동일 참조" 계약이 담당한다.

첫 마운트에서도 이 effect 는 돈다. `initialNodes` 가 `_nodes` 에서 만들어졌으므로 내용이
같고 → 동일 참조 반환 → no-op. `useInitialAutoLayout` 과 순서를 다투지 않는다.

## Part 2 — 겹침 해소

### 2.1 `settleOverlaps` (순수, 신규)

`features/erd/utils/nodeSync/settleOverlaps.ts`

```
settleOverlaps(nodes: Node[], grownIds: Set<string>, gap = 40): Node[]
```

**커진 노드에서 출발해 아래로만 전파한다.**

```
frontier = grownIds
while frontier 비지 않음 (최대 N회):
  next = []
  for a in frontier:
    for b in 아직 안 밀린 테이블, b ∉ grownIds:
      if a 와 b 가 가로로 겹치고, b.top < a.bottom + gap, b 가 a 보다 아래면:
        b.y = a.bottom + gap
        next.push(b)
  frontier = next
```

- 앵커(커진 노드)는 안 움직인다.
- 위로 당기지 않는다. 가로로 안 움직인다.
- 사용자가 일부러 겹쳐 둔 것은 안 건드린다 — 전파의 출발점이 "이번에 커진 노드"뿐이라
  전역 정리 패스가 아니다.
- 좌표계: 비교는 절대 좌표로, 기록은 각 노드 자신의 프레임으로. `nonRelatedTableGroup`
  자식은 부모 상대이므로 그룹 위치를 더해 비교하고 뺀 값을 쓴다.
- `gap` 기본값 40 은 ELK 의 `elk.layered.spacing.baseValue` 와 같은 값이다.

### 2.2 트리거

`reconcileTableNodes` 직후 테이블별 `measured.height` 를 ref 에 기록한다. React Flow 의
`onNodesChange` 로 `type: 'dimensions'` 변경이 오면, **직전 기록보다 높이가 커진 노드만**
앵커로 삼아 `settleOverlaps` 를 1회 돌린다.

- 컬럼 **이름만** 바꾸면 높이가 안 변하므로 아무것도 안 움직인다.
- 최초 측정 때는 직전 기록이 없으므로 건너뛴다 → `useInitialAutoLayout` 의 초기 배치와
  경쟁하지 않는다(스스로 무장된다).

### 2.3 애니메이션

settle 하는 동안만 ERDContent wrapper 에 클래스 하나를 붙이고 200ms 뒤 뗀다.

```css
.settling :global(.react-flow__node) {
  transition: transform 180ms ease-out;
}
```

- 노드마다 `style` 을 심고 지우는 부기가 없다. boolean 하나 + 타이머 하나.
- `onNodeDragStart` 에서 즉시 해제한다 — 드래그가 절대 느려지면 안 된다.

### 2.4 뒤처리

settle 후 `setResolvedTableLayout(nodes)` 로 모듈의 화면 좌표 스냅샷을 갱신한다.
`renameTableInLayout` 과 `dumpTableLayout`(layout.json) 이 이걸 읽는다.

## 테스트

순수 함수 단위(vitest):

- `reconcileTableNodes` — 유지(위치·선택·측정 보존) / 추가 / 삭제 / `data` 교체 /
  `parentId` 전환 양방향 좌표 보정 / **무변경 시 동일 참조** / 메모·그룹 노드 무간섭
- `settleOverlaps` — 단순 1건 / 아래로 캐스케이드 / 가로로 안 겹치면 무시 / 앵커 고정 /
  위로 안 당김 / 수렴(최대 반복 안에서 끝남) / 부모 상대 좌표 혼재

브라우저 스모크: 컬럼 추가 → 아래 테이블만 내려가고 뷰포트·선택 유지 / 컬럼 이름 변경 →
아무것도 안 움직임 / `Connect to` → 테이블이 안 튐 / 테이블 삭제 → 나머지 제자리.

## 비목표

- 축소 시 위로 당기기
- 가로 밀어내기
- 기존 겹침의 전역 정리 (`Tidy up` 의 몫)
- show mode 전환 동작 변경
