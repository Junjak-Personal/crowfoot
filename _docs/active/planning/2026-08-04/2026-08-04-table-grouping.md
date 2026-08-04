---
title: 테이블 그룹화 (시각적 묶음 + 그룹 단위 이동)
status: planning
topic: erd-viewer
kind: plan
scope: frontend
created: 2026-08-04
updated: 2026-08-04
related:
  - _docs/complete/erd-viewer/2026-08-03-erd-viewer-impl.md
---

# 테이블 그룹화

> **설계만 확정. 구현은 착수하지 않았다.**
> 선행 조건인 캔버스 다중 선택은 커밋 완료 (아래 [선행 상태](#선행-상태) 참고).

## 목표

기능 단위로 테이블을 묶어 **보기 편하게** 만든다. 그룹은 데이터 모델이 아니라 **뷰 레이어**다.

1. **시각 효과** — 묶인 테이블을 테두리 박스로 감싸고 그룹명을 붙인다
2. **논리적 그룹화** — "결제", "배송" 처럼 기능 단위로 사람이 직접 묶는다
3. **그룹 단위 이동** — 그룹을 잡고 끌면 멤버 테이블이 함께 움직인다
4. **그룹 보기 모드** — 테두리 + 그룹명 표시를 켜고 끈다

## 비목표

- 그룹을 스키마·ERD 의미론에 반영하지 않는다. FK·관계선·export 결과에 영향 없음
- 접기(collapse) — 그룹을 하나의 박스로 축약하고 내부를 숨기는 동작은 **하지 않는다**.
  관계선 집계 규칙이 따라붙어 범위가 몇 배로 커진다. 필요해지면 별도 과제
- 자동 그룹 추론(FK 클러스터링 등). 사람이 명시적으로 묶는다
- 중첩 그룹. 한 테이블은 최대 한 그룹에 속한다

---

## 아키텍처 결정

### 1. RF 노드로 그리되 `parentId` 는 쓰지 않는다

React Flow 의 `parentId` 를 쓰면 자식 노드 좌표가 **부모 기준 상대좌표**로 바뀐다.
`layout.json` 과 `?positions=` 는 절대좌표 `name:x:y` 이므로 포맷이 깨지고,
`from-link` · `dumpTableLayout` · ELK 자동배치까지 전부 좌표계를 의식해야 한다.
**`parentId` 는 쓰지 않는다.**

대신 `type: 'group'` 인 **평범한 RF 노드**로 그린다. 메모가 이미 같은 방식이므로
(`memoNode.ts` / `MemoNode.tsx`) 전례를 그대로 따르면 된다.

- 노드의 position/width/height 는 **멤버 테이블의 bounding box 에서 파생**한다.
  박스 좌표를 저장하지 않으므로 저장된 박스와 실제 테이블이 어긋날 수 없다
- `draggable: false`, `selectable: false` — 박스 자체는 RF 선택에 참여하지 않는다.
  헤더 클릭은 아래 4번대로 멤버를 선택하는 것으로 처리한다
- `zIndex` 는 테이블 아래 (`zIndex.nodeDefault - 1`). 메모는 위(`+1`)에 있다
- ELK 제외 · `layout.json` 오염 방지는 **메모용으로 이미 뚫어둔 두 곳**을 재사용한다:
  `computeAutoLayout` 의 `node.type === 'memo'` 분기와 `tableLayout.ts` 의 `tableNodesOnly`.
  둘 다 그룹 타입을 추가하는 한 줄이면 된다

> **2026-08-04 갱신**: 원안은 `MemoLayer` 오버레이를 전례로 삼았으나, 메모가 RF 노드로
> 전환되면서 오버레이가 사라졌다. `MemoLayer.tsx` 의 "Like the group boxes this is an
> overlay" 주석도 함께 삭제됐다.

### 2. 그룹은 새 사이드카 `groups.json` 에 산다

`layout.json` 에 얹지 않는다. `layout.json` 은 **테이블당 한 항목**인 반면 그룹은
**테이블 여러 개를 참조**하는 역방향 관계라, 같은 파일에 넣으면 두 스키마가 섞인다.

```json
[
  { "id": "payment", "name": "결제", "tableNames": ["orders", "payments"], "color": "gold" },
  { "id": "shipping", "name": "배송", "tableNames": ["shipments"] }
]
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | ✅ | 빈 문자열 불가. 생성 시 `crypto.randomUUID()` |
| `name` | string | ✅ | 박스 좌상단에 표시. 빈 문자열 허용 |
| `tableNames` | string[] | ✅ | 멤버. 빈 배열이면 항목 자체를 버린다 |
| `color` | string | | 팔레트 키. 목록 밖 값은 무시 |

`memos.json` 과 동일한 파싱 정책: **필수 필드가 어긋난 항목은 조용히 버리고**,
파일 전체가 깨져도 ERD 로딩을 막지 않는다.

기존 세 갈래 우선순위를 그대로 따른다:

```
?groups= (링크)  >  브라우저 저장소(liam:groups)  >  groups.json  >  없음
```

### 3. 스키마에 없는 테이블 이름은 렌더 시점에 버린다

`groups.json` 을 커밋한 뒤 테이블이 삭제·개명될 수 있다. 파싱 단계에서 거르지 않고
**렌더 단계에서 현재 노드와 교집합**을 잡는다. 파싱에서 버리면 스키마를 되돌렸을 때
그룹이 이미 파일에서 사라져 복구가 안 된다.

멤버가 0개로 줄어든 그룹은 그리지 않는다(데이터는 남긴다).

### 4. 그룹 이동은 기존 다중 선택 위에 얹는다

새 드래그 로직을 만들지 않는다. **그룹 박스 헤더를 클릭하면 멤버 테이블 전체를
React Flow 선택 상태로 만든다.** 그 다음부터는 이미 동작하는 다중 선택 드래그가
그대로 처리하고, `onNodeDragStop` 이 위치를 영속화한다.

- 새 좌표 저장 경로 없음 — `layout.json` / `?positions=` 그대로
- 박스가 파생값이라 드래그 중에도 자동으로 따라 움직인다

### 5. 보기 모드는 표시 토글 하나뿐

접기가 비목표이므로 모드는 **테두리 + 그룹명을 그리느냐 마느냐** 한 가지다.

- 툴바 토글 + `?groups=on|off`
- **기본 on.** 그룹이 하나도 없으면 아무것도 안 그려지므로 기본 on 이 안전하다
- off 여도 그룹 데이터는 유지된다. 표시만 꺼진다

---

## 구현 계획

### 파일

| 파일 | 상태 | 내용 |
|---|---|---|
| `features/erd/utils/group/group.ts` | 신규 | 타입 · `parseGroups` · 저장소 · 직렬화 · `getEffectiveGroups` · `dumpGroups` |
| `features/erd/utils/group/groupNode.ts` | 신규 | `isGroupNode` · bounding box 파생 · 노드 변환 (`memoNode.ts` 대응물) |
| `features/erd/utils/group/group.test.ts` | 신규 | 파싱 · 우선순위 · bounding box · 라운드트립 |
| `features/erd/utils/index.ts` | 수정 | re-export |
| `components/ERDContent/components/GroupNode/` | 신규 | RF 커스텀 노드 + CSS (`MemoNode/` 대응물) |
| `features/erd/hooks/useGroupNodes/` | 신규 | `commitGroups` (`useMemoNodes` 대응물) |
| `features/erd/utils/computeAutoLayout/computeAutoLayout.ts` | 수정 | ELK 제외 분기에 `'group'` 추가 |
| `features/erd/utils/tableLayout/tableLayout.ts` | 수정 | `tableNodesOnly` 가 이미 막아줌 — 확인만 |
| `components/ERDContent/ErdContent.tsx` | 수정 | 그룹 노드 합류, bounding box 재계산, 컨텍스트 메뉴 항목 |
| `stores/userEditing/{context,Provider}.tsx` | 수정 | `groupEntries` · `setGroupEntries` · `showGroups` |
| `packages/cli/src/App.tsx` | 수정 | `groups.json` 로드 → `setBaseGroups` |
| `packages/cli/src/cli/erdCommand/fromLinkCommand/index.ts` | 수정 | `?groups=` → `groups.json` |
| `AppBar/ExportDropdown/ExportDropdown.tsx` | 수정 | `Download groups.json` (편집 모드) |
| `Toolbar/` | 수정 | 그룹 표시 토글 |

### 단계

1. **데이터 계층** — `group.ts` + 테스트. UI 없이 파싱·우선순위·직렬화만
2. **렌더** — `GroupNode` RF 노드. bounding box 파생, 테두리 + 라벨 + 색상
3. **편집** — 컨텍스트 메뉴로 그룹 생성/해제/개명/색상
4. **이동** — 헤더 클릭 → 멤버 선택
5. **모드 토글** — 툴바 + `?groups=`
6. **영속화** — `App.tsx` 로드, `from-link`, Export 다운로드
7. **문서** — `docs/usage.md` · `docs/usage_en.md` · `NOTICE` 갱신

각 단계가 독립적으로 동작 가능하다. 1~2 만 해도 `groups.json` 을 손으로 써서 볼 수 있다.

### 컨텍스트 메뉴 (편집 모드, `Ctrl`/`Cmd` + 우클릭)

| 대상 | 항목 |
|---|---|
| 테이블 (2개 이상 선택된 상태) | `Group selected tables` |
| 테이블 (그룹에 속함) | `Remove from group` |
| 그룹 헤더 | 색상 팔레트 · `Rename group` · `Ungroup` |

### bounding box

```
padding = 24
box = { 멤버 노드들의 렌더 좌표·크기 합집합 } + padding
라벨은 box 좌상단 바깥에 붙인다 (박스 안에 넣으면 첫 테이블과 겹친다)
```

노드 크기는 React Flow 의 측정값(`node.measured`)을 쓴다. 측정 전(첫 렌더)에는
그리지 않는다 — 0 크기로 잡으면 박스가 한 점으로 튀었다가 펼쳐진다.

---

## 열린 질문

| # | 질문 | 결정 필요 시점 |
|---|---|---|
| Q1 | 그룹 색상과 테이블 색상이 둘 다 있을 때 테이블 헤더는 어느 쪽을 따르나? (제안: 테이블 색상 우선, 그룹 색은 박스에만) | 2단계 |
| Q2 | 겹치는 두 그룹의 박스가 시각적으로 포개질 때 처리 (제안: 그대로 둔다. 배치는 사람 책임) | 2단계 |
| Q3 | 그룹 박스를 끌 때 그룹 밖 테이블이 함께 선택돼 있으면? (제안: 헤더 클릭이 선택을 **교체**한다) | 4단계 |
| Q4 | 숨긴 테이블(`?hidden=`)이 멤버일 때 bounding box 에 포함하나? (제안: 제외) | 2단계 |

---

## 선행 상태

이 과제의 전제는 전부 구현됐다.

- `selectionOnDrag={editMode}` + `SelectionMode.Partial` — 편집 모드에서 좌드래그가 선택 박스
- 수식키 클릭은 네비게이션(fitView)을 건너뛴다 — `handleNodeClickEvent`
- `onNodeDragStop` 이 드래그된 노드 **배열 전체**를 받아 테이블과 메모를 각각 저장한다
  → 그룹 이동에 새 저장 경로가 필요 없다
- `.react-flow__node.selected` 에 선택 아웃라인
- **메모가 RF 노드로 전환됨** — 캔버스에 표시되는 비-테이블 요소를 RF 노드로 얹는
  패턴(`memoNode.ts` · `MemoNode.tsx` · `useMemoNodes.ts`)이 이미 있고, ELK·layout.json
  오염을 막는 두 지점도 뚫려 있다. 그룹은 이 3개 파일의 대응물을 만들면 된다

즉 4단계(이동)는 "멤버를 selected 로 만들기" 한 가지만 하면 된다.
