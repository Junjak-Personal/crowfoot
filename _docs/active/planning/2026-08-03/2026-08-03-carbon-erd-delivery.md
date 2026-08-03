---
title: carbon ERD 배포 자동화 재개 (npx 전환 + 변경 감지)
status: planning
topic: carbon-erd-delivery
kind: plan
scope: infra
created: 2026-08-03
updated: 2026-08-03
related:
  - _docs/active/planning/2026-08-03/2026-08-03-cli-distribution.md
  - _docs/complete/erd-viewer/2026-08-03-erd-viewer-impl.md
---

# carbon ERD 배포 자동화 재개

> **차단됨 — 착수 조건 2개**
> 1. **ECR 권한** (인프라 담당자에게 요청 중)
> 2. [CLI npm 퍼블리시](./2026-08-03-cli-distribution.md) 완료 — 이게 선행돼야 워크플로가 단순해진다

## 현재 상태 — 수동 배포

- **stage ERD 라이브** — https://carbon-stage.qesg.co.kr/erd/ (수동 배포, 2026-08-03)
  - 산출물: `carbon-emission-measure-platform-integrated/_workspace/liam-erd/manual-2026-08-03/dist/`
  - 내용: 86 테이블 · FK 128 · 백업 테이블 27개 제외
  - S3: `s3://carbon-estimate-dev/erd-stage/`
- **dev 는 미설정** — CloudFront origin path 가 `/erd-stage` 로 고정이라 dev 도메인도 stage ERD 를 본다.

> CloudFront 서브경로 마운트 함정(접두사 미제거 · default root object · AccessDenied · 301 쿼리스트링 소실 ·
> 무효화 범위)은 `.claude/project-profile/deployment.md` 에 정리돼 있다. 여기서 중복하지 않는다.

## 왜 멈춰 있나 — PR#368 → PR#369 전체 원복

BE 리포(`carbon-emission-measure-platform-backend`)에 PR#368 로 CI 자동화를 넣었다가
**stage 배포를 막아서 PR#369 로 전체 원복**했다.

- **직접 원인**: `docker/flyway.Dockerfile` 의 `COPY --from=amazon/aws-cli:2` 에서 **`:2` 태그가 존재하지 않음**
  (Docker Hub · ECR Public 둘 다 태그 950개 중 `2` 없음. `2.34.x` / `latest` 만 있음)
- **근본 원인은 배치다.** ERD 이미지 빌드를 **배포 임계경로**(`flyway.Dockerfile`)에 넣어서,
  ERD 와 무관한 마이그레이션 · ECS 배포까지 함께 멈췄다.
  → 재개할 때 **ERD 빌드를 배포 임계경로에서 반드시 분리한다.** 태그를 고쳐도 배치가 그대로면 같은 사고가 난다.

## npm 퍼블리시가 이 워크플로를 크게 단순화한다

현재(원복된) 워크플로는 5단계다:

```
checkout liam-custom → corepack → pnpm install → turbo build → node <경로>/cli.js
```

퍼블리시하면 `npx <pkg>@<version> erd build …` **한 줄**이 되고, 부수적으로 두 가지가 해결된다.

**1. `LIAM_CUSTOM_REF` 저장소 변수가 불필요해진다 — 조용한 열화 제거**

지금은 이 변수가 비면 `actions/checkout` 이 빈 `ref` 를 기본 브랜치로 해석해서
**포크의 `main`(= 순정 upstream)을 받아 커스터마이징이 하나도 없는 ERD 를 "성공적으로" 빌드한다.**
실패가 아니라 조용한 열화라 알아채기 어렵다. 버전 핀이 `npx <pkg>@1.2.3` 안으로 들어가면
이 위험이 **구조적으로** 사라진다.

**2. 모노레포 빌드 실패 = 배포 실패 경로가 없어진다**

## 변경 감지 설계 (실측 완료, 미구현)

지문 = `sha256(schema.json)` + `sha256(layout.json/memos.json)` + CLI 버전.
`<prefix>/_build/erd.fingerprint` 에 저장 후 비교, 같으면 **빌드 · 업로드 · 무효화 전부 생략**.

- **tbls 출력은 결정적** — 같은 DB 2회 추출 시 sha256 동일, 타임스탬프 필드 0건 ✅실측
- **행 수(record count)는 안 담긴다** → 데이터가 바뀌어도 지문이 안 흔들린다.
  ⚠️ 나중에 ERD 에 행 수를 표시하고 싶어지면 **이 설계와 충돌한다.**
- 인덱스(253) · 제약(251)이 `schema.json` 안에 있어 **인덱스 변경도 잡힌다** ✅실측
- ❌ **"flyway 가 마이그레이션을 적용했을 때만 실행" 은 금지** — 시드 CLI 가 마이그레이션 밖에서 스키마를 바꾼다

## 실행 계획 (차단 해제 후)

1. ECR 권한 확보 확인
2. [cli-distribution](./2026-08-03-cli-distribution.md) 퍼블리시 완료 확인 (버전 핀 확보)
3. 워크플로를 `npx <pkg>@<version> erd build …` 로 재작성 —
   **`flyway.Dockerfile` 밖, 배포 임계경로와 분리된 독립 job 으로**
4. 지문 기반 변경 감지 추가 (`<prefix>/_build/erd.fingerprint`)
5. 무효화 경로를 `/erd/*` 로 한정 (웹앱과 배포 공유 중 — `/*` 는 웹앱 캐시까지 날린다)
6. dev 환경 결정 — CloudFront origin path 가 `/erd-stage` 고정인 문제를 풀지, dev 를 계속 미설정으로 둘지
