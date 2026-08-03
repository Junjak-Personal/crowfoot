---
title: liam-custom 포크 인수인계
status: planning
topic: erd-viewer
kind: handoff
scope: fullstack
created: 2026-08-03
updated: 2026-08-03
related:
  - _docs/complete/erd-viewer/2026-08-03-erd-viewer-impl.md
  - _docs/active/planning/2026-08-03/2026-08-03-cli-distribution.md
  - _docs/active/planning/2026-08-03/2026-08-03-carbon-erd-delivery.md
---

# liam-custom 포크 인수인계

> **이 문서는 라우팅만 한다.** 사실은 아래 링크된 문서와 `.claude/project-profile/` 에 있다.
> 여기에 내용을 복사해오지 말 것.

## 한 줄

Liam ERD 포크에 **위치 영속 · 메모 · 색상 · MySQL export · 편집모드**를 얹어 동작 검증까지 끝냈다.
다음 할 일은 **개인 계정으로 옮기고 npm 에 공개 배포**해서, carbon 말고 개인/타사 프로젝트에서도
`npx` 로 쓰게 만드는 것.

## 리포 사실

| 항목 | 값 |
|---|---|
| 리포 | `Junjak-Personal/erdkit` (공개 포크. 구 `junhyeon-qesg/liam-custom`) |
| 브랜치 | `feature/erd-view-customization` |
| 최신 기능 커밋 | **`9af3ab35e`** (push 완료) — 이후 커밋은 문서·프로필뿐 |
| upstream pin | **`92156eac5`** (2026-06-18) — 추종하지 않음 |
| CLI 패키지 | `frontend/packages/cli` = `@liam-hq/cli` 0.7.24 |
| 로컬 경로 | `C:\Users\harin\dev\carbon\liam-custom` |

## 지금 어디까지 왔나

| 스트림 | 상태 | 문서 |
|---|---|---|
| 뷰어 커스터마이징 | ✅ **완료** — 테스트·DB대조·브라우저까지 검증 | [erd-viewer-impl](../complete/erd-viewer/2026-08-03-erd-viewer-impl.md) |
| CLI npm 배포 | 📋 **planning** — 다음 착수 대상 | [cli-distribution](../active/planning/2026-08-03/2026-08-03-cli-distribution.md) |
| carbon 배포 자동화 | 🚧 **차단** — ECR 권한 + 위 배포 선행 | [carbon-erd-delivery](../active/planning/2026-08-03/2026-08-03-carbon-erd-delivery.md) |

## 이어서 하려면

1. **`.claude/project-profile/index.md` 를 먼저 읽는다.** 컨벤션·검증 명령·함정의 SSOT다.
   특히 Apache-2.0 파일 헤더 규칙(§4(b))과 authoritative 검증 명령(루트 `tsc` 는 무의미)을 확인할 것.
2. [cli-distribution](../active/planning/2026-08-03/2026-08-03-cli-distribution.md) 의 `[FILL: 미정]`
   3개(새 리포명 / npm 패키지명 / bin 이름)를 결정한다. 이게 정해지기 전엔 나머지가 못 움직인다.
3. 그 문서의 "순서" 1~7 을 따른다.

## 착수 전에 알아야 할 것

- ⚠️ **개명 전에 `main` 을 건드리지 말 것.** `.github/workflows/release.yml` 이 `main` push 시
  `@liam-hq/cli` 를 npm 에 퍼블리시한다 (npmjs.com Trusted Publisher 에 파일명이 등록돼 있음).
- ⚠️ **npm 배포 경로는 한 번도 실행된 적이 없다.** 자립 패키지라는 판단은 코드 리딩 기반이다.
- ⚠️ **포크 기능의 E2E 커버리지가 0 이다.** 단위 테스트만 있다.

## 검증 기준선 (2026-08-03 `d2fb6638c`)

`@liam-hq/schema` 562 pass · `@liam-hq/erd-core` 195 pass + 4 todo · `tsc --noEmit` 두 패키지 exit 0 · lint 0.
net-new 는 이 기준선 대비로 판단한다.
