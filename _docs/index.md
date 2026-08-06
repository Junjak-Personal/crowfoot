# _docs 인덱스

프로젝트 문서 버킷. 생성 / 이동 / 병합 / 토픽 개명 시 **아래 3개 섹션을 같은 커밋에서 갱신**한다.

- 이 버킷(`_docs/`) = 프로젝트 소유 — plan / spec / findings
- `_note/` = 사람 소유, **에이전트 읽기 전용**
- `.claude/wiki/` = 에이전트 소유
- `.claude/project-profile/` = 코드 컨벤션·스택·검증 명령의 SSOT (문서 버킷이 아님)

---

## ① 문서 상태

정렬: `(topic, date, kind)`

### Active

| 상태 | 토픽 | 문서 | 요약 |
|---|---|---|---|
| planning | `erd-viewer` | [2026-08-05-erd-viewer-backlog](./active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md) | 그룹화 이후 남은 7건 — E2E · tbls 시드 · 섹션별 표시 · `aria-pressed` 등. **1(노드타입 감사)·2(`liam:*` 개명) 완료.** 번호는 고정. ⚠️ 3번(E2E)은 `@liam-hq/e2e` 삭제로 하네스부터 시작 |

> **`_docs/active/` 는 이제 이 1건뿐이다.** 나머지는 2026-08-06 스윕에서 `complete/` 로 갔거나 제거됐다.

### Complete

| 토픽 | 문서 | 요약 |
|---|---|---|
| `cli-distribution` | [2026-08-03-cli-distribution](./complete/cli-distribution/2026-08-03-cli-distribution.md) | CLI 개명 · Apache-2.0 준수 · npm 배포의 **원래 계획**. `npm publish` 함정 2건(`bin` 의 선행 `./`, `workspace:*` 매니페스트 누출)이 여기 기록돼 있다 |
| `cli-distribution` | [2026-08-05-cli-distribution-debranding](./complete/cli-distribution/2026-08-05-cli-distribution-debranding.md) | 브랜딩 탈-Liam · 리포 분리 · 미사용 upstream 정리. 8단계 전부 완료 — `crowfoot` 0.1.0, 앱 브랜딩·favicon·브랜드색 `#F59E0B`, 워크스페이스 **20→6 패키지**(1,415파일 삭제). §4 귀속 헤더 92개 무손상, `npm pack` 에 LICENSE·NOTICE 유지. 커밋 `6ba524a2f..444f80d` |
| `erd-viewer` | [2026-08-03-erd-viewer-impl](./complete/erd-viewer/2026-08-03-erd-viewer-impl.md) | 위치 영속 · 메모 · 색상 · 편집모드 · MySQL export. 커밋 `ac5b392fa..9af3ab35e` |
| `erd-viewer` | [2026-08-04-table-grouping](./complete/erd-viewer/2026-08-04-table-grouping.md) | 테이블 그룹화 (0.4.0) — 파생 박스 · `groups.json` · 겹침 허용 · 좌측 2모드. 203→281 tests. **브라우저 스모크 완료** — `groups.json` 단독 경로에서 사이드바가 섹션을 안 만들던 결함 1건 발견·수정(`6c112432a`) |
| `erd-viewer` | [2026-08-05-group-label-drag-design](./complete/erd-viewer/2026-08-05-group-label-drag-design.md) | 그룹 라벨을 끌어 멤버 전체 이동 — 박스는 계속 파생, 겹친 멤버도 전부 따라옴. 구현 `3a304c4` |

---

## ② 인수인계 (handoff)

스트림당 최신 1건만 유지.

**현재 없음.** `2026-08-03-erd-viewer-handoff` 는 2026-08-06 스윕에서 삭제했다 — 리포명·브랜치·
패키지명·버전·로컬 경로가 전부 바뀌었고 인용 커밋도 히스토리 재작성으로 사라져, 라우팅 대상이
하나도 안 남아 있었다.

---

## ③ 토픽 어휘 (SSOT)

새 문서의 `topic` 은 **반드시 아래에서 고른다.** 맞는 게 없을 때만 새로 만들고, **같은 커밋에서 여기 추가**한다.

| 토픽 | 범위 |
|---|---|
| `erd-viewer` | 포크의 ERD 뷰어 기능 — 위치 영속, 메모, 색상, 편집모드, export. 작업 표면은 `erd-core` / `schema` |
| `cli-distribution` | `crowfoot`(구 `erdkit`, 구 `@liam-hq/cli`) 패키징 · 개명 · npm 배포 · Apache-2.0 준수 · 미사용 upstream 정리. 작업 표면은 `packages/cli` |

> `carbon-erd-delivery` 는 2026-08-06 에 어휘에서 제거했다. **carbon 은 이 CLI 의 소비자지
> 이 리포가 배포하는 대상이 아니다** — 그 작업은 carbon 리포에 속한다.

> `project-bootstrap` 은 `/team-new` 예약어. 기능 작업에 재사용 금지.
