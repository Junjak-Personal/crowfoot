---
title: 그룹 라벨 드래그 — 라벨을 끌어 그룹 전체 이동
status: complete
topic: erd-viewer
kind: design
scope: frontend
created: 2026-08-05
updated: 2026-08-06
related:
  - _docs/complete/erd-viewer/2026-08-04-table-grouping.md
  - _docs/active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md
---

# 그룹 라벨 드래그

그룹 라벨(헤더)을 끌면 그룹 전체가 따라 움직인다.

현재는 헤더 **클릭**이 멤버를 선택하고, 이동은 선택된 멤버 중 하나를 잡아 끌어야 한다.
한 동작으로 줄인다.

## 무엇이 바뀌나

| | 지금 | 이후 |
|---|---|---|
| 헤더 클릭 | 멤버 선택 | 그대로 |
| 헤더 드래그 | 아무 일도 안 일어남 | 멤버 전체 이동 (편집 모드에서만) |
| 박스 | 멤버 따라 파생 | 그대로 |

## 비목표

- 박스 리사이즈
- 그룹 간 드래그 앤 드롭으로 멤버 이동
- 드래그 중 스냅 · 정렬 가이드
- 그룹 노드 자체에 좌표를 저장하는 것 — 박스는 계속 **파생**이다

---

## 핵심 전제 — 박스는 이동 대상이 아니다

`TableGroupNode` 는 매 렌더 `getNodesBounds(멤버)` 로 박스를 다시 만들고 **노드 상태에 되쓰지
않는다**. 그래서 이 기능은 "박스를 옮기는 일"이 아니라 **"멤버 테이블의 좌표를 옮기는 일"**이고,
박스는 그 결과를 공짜로 따라온다. 새로 저장되는 상태가 없다.

이 전제가 깨지면(= 박스 좌표를 어딘가 저장하기 시작하면) `setNodes` ↔ `onNodesChange` 피드백
루프가 생긴다. 기존 설계가 의도적으로 피한 것이므로 그대로 둔다.

## 겹침 — 멤버는 전부 따라온다

`orders` 가 Payment 와 Shipping 양쪽 멤버일 때 Payment 라벨을 끌면 `orders` 도 이동하고,
Shipping 박스는 `bounds(shipments, orders)` 로 재파생되어 **길게 늘어난다.**

이걸 정상 동작으로 받아들인다. 그룹은 뷰 레이어고 테이블이 진실이라는 기존 원칙과 일치하며,
"그룹을 옮겼는데 멤버 하나가 안 따라왔다"는 조용한 배신보다 눈에 보이는 변형이 낫다.
`groups.json` 이 겹침을 허용하기로 한 이상 겹친 박스가 서로를 끌어당기는 것은 예외가 아니라
정상 상태다.

---

## 선택한 접근 — 헤더에 pointer 핸들러

| | 방식 | 왜 안 골랐나 |
|---|---|---|
| **A (선택)** | 헤더에 `pointerdown`/`move`/`up` 직접 | — |
| B | 그룹 노드를 React Flow `draggable` 로 두고 `onNodeDrag` 에서 델타 적용 | React Flow 가 래퍼에 `transform` 을 걸어 박스가 **이중 이동**한다. 매 프레임 그룹 노드 위치를 원위치로 되돌려야 하는데, 이는 "박스는 파생, write-back 없음" 불변식과 정면으로 싸운다 |
| C | `pointerdown` 에 멤버를 선택한 뒤 포인터 이벤트를 멤버 노드로 포워딩해 RF 다중 드래그에 태움 | 영속화·스냅이 전부 공짜지만, 합성 이벤트 포워딩이 React Flow 내부 구현에 의존한다. 12.x 마이너 업그레이드에도 조용히 부러질 수 있다 |

### 제스처

```
pointerdown (주 버튼, editMode)
  → setPointerCapture
  → origin  = screenToFlowPosition(clientX, clientY)
  → starts  = 멤버별 현재 position 스냅샷
  → moved   = false

pointermove
  → 화면 거리 < 3px 이고 !moved 면 무시          (클릭 판정 유보)
  → 처음 넘어선 순간: moved = true, 멤버 선택     (기존 클릭과 같은 상태)
  → delta = screenToFlowPosition(현재) - origin
  → 멤버 position = starts[id] + delta

pointerup / pointercancel
  → releasePointerCapture
  → moved === false  → 기존 클릭 동작(멤버 선택)만
  → moved === true   → 위치 영속화 + repositionTableLogEvent
```

**임계값 3px 은 화면 기준**으로 잰다. 플로우 좌표로 재면 줌 200% 에서 1.5px, 50% 에서 6px 이
되어 사용자가 느끼는 "까딱한 정도"가 줌마다 달라진다.

**이동량은 플로우 좌표 델타**다. `screenToFlowPosition` 이 줌·팬을 흡수하므로 별도 보정이 없다.

### 왜 안전한가

- **상대 좌표 멤버** — 일부 테이블은 `parentId: NON_RELATED_TABLE_GROUP_NODE_ID` 를 갖고 있어
  `position` 이 부모 기준 상대값이다. 델타 덧셈은 평행이동이라 부모가 안 움직이는 한 절대·상대
  구분 없이 성립한다. `getNodesBounds` 로 박스를 만드는 기존 코드가 상대 좌표 때문에 손 min/max
  를 포기한 것과 달리, 여기서는 변환이 필요 없다
- **드래그 불가 케이스가 이미 배제됨** — 멤버가 캔버스에 없거나 · 숨김이거나 · 미측정이면
  `resolveGroupMemberIds` 가 `null` 을 반환하고 박스 자체가 렌더되지 않는다. 헤더가 없으니
  드래그도 없다. 별도 가드가 필요 없다
- **읽기 전용 보호** — `editMode` 가 아니면 드래그 핸들러를 아예 붙이지 않는다. 공유 링크가
  실수로 레이아웃을 쓰는 일이 없어야 한다는 기존 규칙(`nodesDraggable={editMode}`,
  `handleDragStopNode` 의 early return)과 같은 선

---

## 영속화 — 기존 경로 재사용

`handleDragStopNode` 가 하는 일 중 위치 저장 부분:

```ts
const stored = rememberTablePositions(tables)
setTablePositions(
  serializeTableLayout({
    ...deserializeTableLayout(tablePositions),   // 들어온 링크의 위치를 남긴다
    ...stored,
  }),
)
```

두 줄이지만 **merge 규칙이 미묘하다** — 공유 링크가 실어온 위치가 로컬 드래그 후에도 살아남아야
한다. 두 군데에 복사하면 한쪽만 고쳐질 자리다. `useCommitTablePositions` 훅으로 뽑아
`handleDragStopNode` 와 그룹 드래그가 같이 쓴다. `repositionTableLogEvent` 도 훅 안에 넣어
일반 드래그와 기록이 갈리지 않게 한다.

훅이 필요로 하는 것은 전부 이미 컨텍스트에 있다 — `tablePositions`/`setTablePositions` 는
`useUserEditingOrThrow`, `version` 은 `useVersionOrThrow`.

---

## 파일

| 파일 | 변경 |
|---|---|
| `features/erd/hooks/useCommitTablePositions/` | **신규** — merge + 직렬화 + GTM |
| `features/erd/hooks/index.ts` | 배럴에 추가 |
| `ERDContent/components/TableGroupNode/TableGroupNode.tsx` | pointer 핸들러 3개, 드래그 상태 ref |
| `ERDContent/components/TableGroupNode/TableGroupNode.module.css` | 헤더 `cursor: grab` / 드래그 중 `grabbing` |
| `ERDContent/ErdContent.tsx` | `handleDragStopNode` 를 훅 사용으로 교체 |

## 검증

**단위 테스트** — `useCommitTablePositions`
- 들어온 `?positions=` 의 항목이 드래그 대상이 아니면 살아남는다
- 같은 테이블이면 새 위치가 이긴다
- 테이블 노드가 0개면 아무것도 쓰지 않는다

드래그 제스처 자체는 pointer capture + 좌표 변환이라 happy-dom 에서 재현 가치가 낮다.
단위 테스트로 덮지 않고 브라우저 스모크로 넘긴다 — 이 판단은 `measured: {0,0}` 이나
`pointer-events` 처럼 **단위 테스트가 원리적으로 못 닿는 항목**을 스모크로 확인해 온 기존
방식과 같다.

**브라우저 스모크** (편집 모드, 빌드 산출물)
1. 라벨 드래그 → 멤버 전원 동시 이동, 박스 실시간 추적, 깜빡임 없음
2. 겹친 그룹 — Payment 라벨을 끌면 Shipping 박스가 `orders` 를 따라 늘어난다
3. 3px 미만 → 이동 없이 멤버 선택만 (기존 클릭 동작 보존)
4. `?showgroups=off` — 박스·라벨이 없으므로 드래그 표면 자체가 없다
5. 읽기 전용(`?edit=1` 없음) → 라벨 드래그 무반응, 클릭 선택은 동작
6. 드래그 후 `?positions=` 갱신 → 새로고침 후 위치 유지
7. 드래그 중 판(pane) 컨텍스트 메뉴 · 박스 안쪽 빈 캔버스 클릭이 여전히 판으로 간다

**정적 게이트** — erd-core `tsc --noEmit` 0, erd-core 테스트 green, `pnpm lint` exit 0,
`turbo build --filter=erdkit --force` 성공.

## 열린 위험

- **드래그 중 다른 그룹 박스가 커지면서 헤더가 포인터 아래로 들어올 수 있다.** 포인터 캡처를
  잡고 있으므로 제스처는 안 끊긴다. 시각적으로만 어수선하고, 겹침 허용의 연장선이라 수용한다
- **라벨 가림 제약은 그대로다** — 라벨 자리에 남의 테이블이 있으면 라벨이 안 보이고, 안 보이면
  끌 수도 없다. 그룹화 문서의 "배치는 사람 책임" 을 그대로 상속한다. 이번 범위에서 고치지 않는다
