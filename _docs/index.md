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
| planning | `carbon-erd-delivery` | [2026-08-03-carbon-erd-delivery](./active/planning/2026-08-03/2026-08-03-carbon-erd-delivery.md) | carbon ERD 배포 자동화 재개 (npx 전환 + 변경 감지). **차단: ECR 권한 + cli-distribution 선행** |
| planning | `cli-distribution` | [2026-08-03-cli-distribution](./active/planning/2026-08-03/2026-08-03-cli-distribution.md) | CLI 개명(`erdkit`) · Apache-2.0 준수 · npm 배포. **1~6 완료, `npm publish` 만 남음 (본인 실행)** |
| planning | `erd-viewer` | [2026-08-05-erd-viewer-backlog](./active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md) | 그룹화 이후 남은 9건 — 노드타입 감사 · `liam:*` 개명 · E2E · tbls 시드 등. **착수 시 항목별 plan 승격** |

### Complete

| 토픽 | 문서 | 요약 |
|---|---|---|
| `erd-viewer` | [2026-08-03-erd-viewer-impl](./complete/erd-viewer/2026-08-03-erd-viewer-impl.md) | 위치 영속 · 메모 · 색상 · 편집모드 · MySQL export. 커밋 `ac5b392fa..9af3ab35e` |
| `erd-viewer` | [2026-08-04-table-grouping](./complete/erd-viewer/2026-08-04-table-grouping.md) | 테이블 그룹화 (0.4.0) — 파생 박스 · `groups.json` · 겹침 허용 · 좌측 2모드. 203→281 tests. **브라우저 스모크 미실시** |

---

## ② 인수인계 (handoff)

스트림당 최신 1건만 유지.

| 스트림 | 문서 | 갱신일 |
|---|---|---|
| `erd-viewer` (포크 전체) | [2026-08-03-erd-viewer-handoff](./handoff/2026-08-03-erd-viewer-handoff.md) | 2026-08-03 |

---

## ③ 토픽 어휘 (SSOT)

새 문서의 `topic` 은 **반드시 아래에서 고른다.** 맞는 게 없을 때만 새로 만들고, **같은 커밋에서 여기 추가**한다.

| 토픽 | 범위 |
|---|---|
| `erd-viewer` | 포크의 ERD 뷰어 기능 — 위치 영속, 메모, 색상, 편집모드, export. 작업 표면은 `erd-core` / `schema` |
| `cli-distribution` | `erdkit`(구 `@liam-hq/cli`) 패키징 · 개명 · npm 배포 · Apache-2.0 준수. 작업 표면은 `packages/cli` |
| `carbon-erd-delivery` | carbon 프로젝트의 ERD 배포 — S3/CloudFront, CI 자동화, 변경 감지 |

> `project-bootstrap` 은 `/team-new` 예약어. 기능 작업에 재사용 금지.
