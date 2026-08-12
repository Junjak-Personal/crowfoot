# URL을 진실로 삼기 — 변경점만 기록하고, 되돌리기는 뒤로가기

- 상태: planning
- 토픽: `erd-viewer`
- 작성: 2026-08-12
- 작업 표면: `frontend/packages/erd-core` (`utils/group` · `utils/memo` · `utils/tableLayout` · `stores/userEditing` · `ERDContent`)

## 목표

**초기 상태는 배포된 다이어그램, URL에는 변경점만.** 되돌리기는 브라우저 뒤로가기.

## 지금 무엇이 어긋나 있나

### ① URL은 SSOT가 아니다

`useGroupNodes.commitGroups`가 한 번에 세 곳에 쓴다.

```ts
const next = change(getNodes())
setNodes(next)                            // ① React Flow 노드 = 작업본
saveStoredGroups(groups)                  // ② localStorage
setGroupEntries(serializeGroups(groups))  // ③ URL
```

주석도 그렇게 말한다 — *"Browser storage and the shareable link are **mirrors** of
that state."* **SSOT는 노드 상태고 URL은 파생 미러다.**

그리고 `?groups=` · `?memos=`는 **마운트 때 한 번만 읽힌다**
(`ErdContent.tsx`의 `useNodesState(initialNodes)` 초기화자). 0.2.1에서 고쳤던 그
경로다 — **지금 URL만 바꾸면 캔버스는 반응하지 않는다.**

반대로 사이드바는 `groupEntries`를 **반응적으로** 읽는다(`LeftPane.tsx`). 캔버스와
사이드바가 서로 다른 소스를 본다.

### ② 셋 중 둘만 diff다

| 파라미터 | 인코딩 | |
|---|---|---|
| `?positions=` | `{...base, ...stored, ...url}` — 드래그한 것만 | ✅ |
| `?schemaedits=` | `{ tables: {건드린 것만}, removed: [이름] }` | ✅ |
| `?groups=` | `url ?? stored ?? base` — 전체 스냅샷이 base를 **대체** | ❌ |
| `?memos=` | 동일 | ❌ |

그룹을 한 번만 건드려도 URL이 전체 집합을 들고 가고, **재배포된 `groups.json`은 그
링크에 영원히 도달하지 못한다.**

`group.ts`에 그 선택의 근거가 적혀 있다 — *"merging would make deletions
inexpressible."* **맞는 지적이고, 답은 병합이 아니라 묘비(tombstone)다.**
`schemaEdit`이 이미 그렇게 한다.

### ③ 버전 장치가 없다

`schemas/hash/`는 무관하다 — `users__columns__id` 형태의 **딥링크 프래그먼트**지
내용 해시가 아니다. 그래서 **`?schemaedits=`도 같은 결함을 갖고 있다**: 배포된
`schema.json`이 바뀐 뒤 옛 링크를 열면 다른 스키마에 편집을 얹으면서 아무 말도 안
한다.

## 결정

| 질문 | 결정 | 근거 |
|---|---|---|
| SSOT | **URL** | 이미 상태 전체가 직렬화된다. 사본을 줄이는 게 어긋남을 없애는 유일한 방법 |
| 되돌리기 스택 | **브라우저 히스토리** (`history.back()`) | 별도 스택을 두면 포인터가 둘이 되고, popstate와 동기화가 모호해진다 |
| 인코딩 | **`schemaEdit` 미러링** | 이 저장소에 이미 있는 검증된 형태. 새 형식을 발명하지 않는다 |
| localStorage | **편집 저장은 제거, base 캐시로 용도 교체** | 편집을 담으면 세 번째 사본이 된다. 사라진 옛 base를 붙잡는 일은 여기서만 가능 |
| 원본 그림 재현 | **범위 밖** | base 스냅샷을 URL에 넣으면 undo 한 칸마다 실린다. 얼려야 하는 그림은 PNG export가 이미 한다 |

## 인코딩

```
base(schema.json · layout.json · groups.json · memos.json)  +  URL diff  =  화면
```

```
?groups= → { groups: { <id>: Group }, removed: [<id>] }
?memos=  → { memos:  { <id>: Memo  }, removed: [<id>] }
```

`getEffectiveGroups = url ?? stored ?? base` → **`applyDiff(base, urlDiff)`**.

base는 움직이지 않고 URL만 오간다. 그래서 **되돌리기가 base를 건드릴 수 없고**,
히스토리 한 칸이 전체 스냅샷이 아니라 작은 diff다 — 뒤로가기를 스택으로 쓰는 게
싸지는 이유가 이것이다.

`?positions=`는 이미 diff지만 **base와 같은 값이면 항목을 지운다**(테이블을 원래
자리로 되돌렸는데 항목이 남는 것을 막는다).

### 데려오는 결과

**공유 링크가 정지된 사진이 아니게 된다.** `groups.json`을 다시 배포하면 사용자가
건드리지 않은 그룹은 새 이름·새 색이 들어온다. 이 프로그램의 정체성(편집으로
갱신하고 export해서 반영)과 맞는 방향이지만, 보장이 바뀌는 것이므로 아래 버전
안내로 드러낸다.

## 버전 가드

`?base=<hash>` — 받아온 네 문서 원문에 대한 가벼운 해시(FNV, 8자). 빌드 git 해시는
안 된다(무관한 릴리스마다 오경보), 스키마만도 안 된다(`groups.json`만 바뀌면 놓친다).
**히스토리 칸마다 실리므로 짧아야 한다.**

```
트리거    : ?base=  vs  방금 받아온 문서들의 해시     ← 캐시 불필요
내용      : diff가 참조하는데 새 base에 없는 것의 개수  ← 캐시 불필요
더 선명하게: 캐시된 옛 base와 새 base의 비교           ← 캐시 있을 때만
```

- **불일치여도 데이터는 그대로 적용한다.** 버리지 않는다.
- **해시를 몰래 갱신하지 않는다.** 다음 편집이 커밋될 때 새 히스토리 칸이 현재 해시를
  달고 나가며 자연히 최신화된다.
- diff는 사라진 것을 참조할 수 있다(없어진 테이블을 든 그룹, 이미 없는 그룹에 대한
  묘비). 적용할 때 걸러내되 **몇 개를 걸러냈는지 세서 알린다.** "버전이 다릅니다"만
  으로는 무시하게 된다.

## cold base 캐시

**정상 경로에서는 읽지도 쓰지도 않는다.**

```
로드         → localStorage 접촉 0회
첫 편집 커밋  → base 스냅샷 1회 저장
이후 편집     → 이미 저장됨, 건너뜀
버전 불일치   → 그때 처음 읽는다
```

편집을 한 번도 안 했으면 설명할 diff가 없으므로 캐시할 이유도 없다.

건너뛰기 판정을 위해 **키를 둘로 나눈다.** 작은 것만 읽어 판정하고, 큰 것은 정말
필요할 때만 만진다.

```
crowfoot:base-hash:<pathname>  →  "a3f19c02"                    (몇 바이트)
crowfoot:base:<pathname>       →  {schema,layout,groups,memos}  (수백 KB)
```

**best-effort.** quota로 실패하면 우리 키만 지우고 한 번 재시도, 그래도 실패하면
조용히 포기한다. 캐시가 없어도 경고는 나온다 — **증강이지 의존이 아니다.**

한계: 캐시는 그 브라우저에만 있다. 남이 링크를 열면 캐시가 없고, 그래도 트리거와
개수 안내까지는 작동한다.

## 되돌리기

```
편집 커밋      → setXxx(v, { history: 'push' })
history.back() → popstate → applyUrlState()
```

**`popstate`가 URL에서 캔버스를 다시 만든다.** 지금 그 자리에서 돌고 있는
`computeAutoLayout` + `fitView`(`useQueryParamsChanged`)를 대체한다 — 되돌리기가
다이어그램을 재배치하고 카메라를 튀게 하면 그건 되돌리기가 아니다. 필요한 역함수는
마운트 경로가 이미 하는 일이라, **새로 만드는 게 아니라 재호출 가능하게 빼는 것**이다.

**제스처 경계에서만 push.** 지금 메모 텍스트는 `onChange`마다 URL을 쓴다
(`MemoNode.tsx`) — `push`로 두면 글자 하나에 히스토리 한 칸이다. 타이핑·드래그
중간은 `replace`, blur·`onNodeDragStop`·메뉴 커밋에서 한 번 `push`. nuqs 2.4.3은
호출별 `history` 오버라이드를 지원한다(`index.d.ts`의 세터 시그니처 `options?: Options`).

`⌘Z` = `history.back()`, `⌘⇧Z` = `history.forward()`.
**메모 textarea 안에서는 비켜준다** — 거기서 `⌘Z`는 글자 되돌리기여야 한다.
기존 `isTyping()` 가드(⌘C/⌘V가 쓰는 것)를 재사용한다.

뷰·네비 파라미터(`active` `show` `hidden` `showgroups` `edit`)는 **push 유지**.
뒤로가기 = "방금 한 일 취소"로 일관되고, 기존 동작을 뺏지 않는다.

## 못 피하는 비용

- **앱 진입점보다 뒤로 가면 페이지를 떠난다.** 되돌리기 깊이가 "이 페이지에 들어온
  뒤"로 제한된다. 정적 뷰어라 받아들인다.
- 뒤로가기 스택에 편집과 뷰 변경이 섞인다. 위 결정에 따라 의도된 것이다.

## 검수 기준

- 단위: `applyDiff(base, diff)` 왕복 · 묘비로 삭제 표현 · 사라진 참조 걸러내기와
  **개수** · base와 같은 위치 항목 제거 · 해시 안정성
- 통합: 편집 → `history.back()` → 편집 전 상태, **재배치 없음**
- 브라우저: 되돌리기 후 **viewport transform 불변** · 메모 타이핑이 히스토리를 한
  칸만 쓰는지 · textarea 안 `⌘Z`가 글자를 되돌리는지

## 커밋 순서

되돌릴 수 있게 세 덩이로 나눈다.

1. **인코딩** — diff 형식 + localStorage 편집 저장 제거
2. **버전 가드** — `?base=` + 안내 + cold 캐시
3. **되돌리기** — 역함수 + popstate + 제스처 경계 push + `⌘Z`

## 범위 밖

옛 base로 그림을 되살리는 기능(캐시가 있으면 `applyDiff(옛 base, diff)`로 가능해지지만
이번엔 안 만든다) · 서버 저장 · 동시 편집.
