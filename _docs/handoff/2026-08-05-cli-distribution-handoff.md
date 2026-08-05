---
title: cli-distribution handoff — 브랜딩 탈-Liam + 별도 리포 분리
status: processing
topic: cli-distribution
kind: handoff
scope: fullstack
created: 2026-08-05
updated: 2026-08-05
related:
  - _docs/active/planning/2026-08-03/2026-08-03-cli-distribution.md
  - _docs/complete/erd-viewer/2026-08-04-table-grouping.md
  - _docs/active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md
---

# 브랜딩 탈-Liam + 별도 리포 분리

포크가 커스터마이즈 범위를 넘어섰다. upstream 추종을 그만두고 **독립 제품으로 떼어낸다.**
이 문서는 그 작업의 상태 문서다 — 설계는 없다, 아직 설계된 적이 없다.

## 왜 지금

`erdkit` 은 이미 자기 이름·자기 스토리지 네임스페이스(`erdkit:*`)·자기 기능(위치 영속 · 메모 ·
색상 · 그룹화 · 편집모드)을 갖고 npm 에 배포될 준비가 끝났다. 그런데 **앱이 여전히 남의 제품명과
로고를 자기 브랜딩으로 띄운다.** 이건 Apache-2.0 §6 이 허용하는 "출처 설명" 범위 밖이다.

> **§4 귀속 고지와 §6 상표를 혼동하지 말 것.** 아래 "절대 지우면 안 되는 것" 을 먼저 읽어라.

---

## State

### 완료 (증거 있음)

| | 커밋 |
|---|---|
| 스토리지 네임스페이스 `liam:*` → `erdkit:*` (+레거시 1회 마이그레이션) | `8608b1d30` |
| 콘솔 헬퍼 `window.liamGroups` → `erdkitGroups` 등 | `8608b1d30` |
| CLI 배너·`--help` 에 "A fork of Liam ERD (Apache-2.0, ROUTE06, Inc.)" 귀속 | 기존 |
| `LICENSE`·`NOTICE` 를 npm 타르볼에 동봉 (`scripts/pack-cli.js`) | 기존 |
| 수정 파일 헤더 고지 | 전 파일 |

`master` 단일 브랜치 운영, `main` 삭제됨, upstream 은 remote 로만(`git remote -v` 에 `upstream`).

### 미완료

**브랜딩이 그대로다.** 앱 헤더에 `Liam ERD` 텍스트와 `LiamLogoMark` 가 뜨고, 사이드바·헬프
메뉴의 링크가 전부 upstream 자산을 가리킨다. 아래 인벤토리가 전부다 (2026-08-05 기준, 배포되는
패키지 소스만 — `apps/app` 등 미배포 패키지는 제외).

| 파일 | 내용 |
|---|---|
| `erd-core/.../ERDRenderer/AppBar/AppBar.tsx` | `<h1>Liam ERD</h1>`, `LiamLogoMark`, `href="https://liambx.com"` |
| `erd-core/.../AppBar/HelpButton/HelpButton.tsx` | `liambx.com/docs`, `liam-hq/liam/discussions` |
| `erd-core/.../AppBar/GithubButton/GithubButton.tsx` | `liam-hq/liam` |
| `erd-core/.../AppBar/ReleaseNoteButton/ReleaseNoteButton.tsx` | `liam-hq/liam/releases` |
| `erd-core/.../ERDRenderer/LeftPane/LeftPane.tsx` | 메뉴 5개 전부 upstream + `LiamLogoMark` |
| `erd-core/.../ErrorDisplay/ParseErrorDisplay.tsx` | `liambx.com/docs/parser/troubleshooting`, discussions |
| `erd-core/.../ErrorDisplay/ErrorDisplay.test.tsx` | 위 URL 을 단언 — 같이 고쳐야 함 |
| `erd-core/.../CommandPalette/CommandPalettePreview/CommandPreview.tsx` | `assets.liambx.com` 의 동영상·이미지 6개 **(핫링크)** |
| `cli/src/cli/urls.ts` | `DocsUrl` 등 upstream 문서 |
| `cli/public/favicon.ico`, `cli/index.html` | 파비콘·`<title>` 미확인 |

상표(이름·마크)는 **본인이 직접 만들기로 함.** 그게 정해지기 전까지 이 작업은 시작할 수 없다.

---

## Remaining work

1. **상표 결정** — 이름 + 마크. 본인 담당. 나머지 전부의 선행 조건
2. **앱 브랜딩 교체** — 위 인벤토리대로. `AppBar` 의 `<h1>` 과 로고가 최우선(가장 눈에 띄고
   가장 명확한 §6 위반 표면)
3. **링크 정리** — upstream 문서 링크는 두 갈래다:
   - *포크에도 여전히 정확한 것*(파서 포맷 문서 등) → 남겨도 되지만 "upstream 문서" 라고
     읽히게 라벨링. `cli/src/cli/urls.ts:4` 에 이미 그런 주석이 있다
   - *제품 정체성을 참칭하는 것*(Homepage, GitHub, Release Notes, Discussions) → 교체 또는 제거
4. **`assets.liambx.com` 핫링크 제거** — CommandPalette 프리뷰 6개. 남의 CDN 에 의존 중이고
   브랜딩 이전에 **가용성 문제**다. 자체 호스팅하거나 프리뷰 기능을 걷어낸다
5. **별도 리포 분리** — 히스토리 유지한 채 새 리포로 push (귀속이 커밋 로그에 남아 §4(c) 에
   유리). 그 다음 미사용 upstream 패키지 정리
6. **분리 후 §4 재검증** — 정리 과정에서 `LICENSE`/`NOTICE`/파일 헤더가 빠지지 않았는지.
   `npm pack --dry-run` 으로 타르볼에 `LICENSE`·`NOTICE` 가 여전히 들어가는지 확인
7. **README 귀속 한 줄** — "Based on Liam ERD by ROUTE06, Inc., Apache-2.0"

---

## 절대 지우면 안 되는 것

전 파일 상단의

```
// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// Added in erdkit; not part of the original Liam ERD source.
```

는 **§4(b)/§4(c) 가 요구하는 귀속 고지**다. "Liam" 을 일괄 치환하는 스크립트를 돌리면 이게 같이
날아가고 그 순간 라이선스 위반이 된다. 브랜딩(§6)과 귀속(§4)은 정반대 방향의 의무다 —
**브랜딩은 지우고, 귀속은 남긴다.**

`LICENSE`, `NOTICE`, `docs/packages-license.md`, `scripts/pack-cli.js` 도 같은 이유로 보존.

---

## How to resume

```
cd /Users/jun/develop/personal/liam-custom
git checkout master          # 단일 브랜치. main 없음
git log --oneline -8
```

작업 표면은 `frontend/packages/erd-core/src` 와 `frontend/packages/cli/src`.

**검증 명령** (`.claude/project-profile/` 가 SSOT):

```
cd frontend/packages/erd-core && pnpm exec vitest run && pnpm exec tsc --noEmit
cd frontend/packages/cli      && pnpm exec vitest run && pnpm exec tsc --noEmit
pnpm lint                     # 루트. turbo + syncpack + knip
```

**빌드 산출물로 육안 확인:**

```
pnpm exec turbo build --filter=erdkit --force
cd <scratch> && node <repo>/frontend/packages/cli/dist-cli/bin/cli.js \
  erd build --input ./schema.sql --format postgres --output-dir ./erd-out
cd erd-out && python3 -m http.server 5199 --bind 127.0.0.1
```

---

## 이 저장소를 만지기 전에 알아야 할 함정

1. **`turbo build --filter=erdkit` 는 `--force` 없이 믿으면 안 된다.** erd-core 를 TS 소스로
   소비하는 구조라 erd-core 의 파일이 erdkit 의 캐시 키에 안 들어간다. erd-core 만 고치면
   **옛 번들이 캐시에서 나온다.** 릴리즈 워크플로에도 `--force` 가 박혀 있다
2. **브라우저 테스트 중 탭이 백그라운드로 밀리면 ResizeObserver 가 멈춘다.** React Flow 가
   노드를 측정 못 해 `data-loading` 이 `true` 에 영원히 머물고, 캔버스가 빈 화면으로 보인다.
   **제품 결함으로 오진하기 쉽다** — `document.visibilityState` 를 먼저 확인하라. 스크린샷도
   같은 이유로 낡은 프레임을 반환한다
3. **단위 테스트가 원리적으로 못 닿는 표면이 있다.** CSS Modules 가 happy-dom 에 주입되지 않아
   `pointer-events` · z-index · 커서는 클래스명 존재만 확인된다. 실제 동작은 브라우저 스모크가
   유일한 검증 수단이다. 이 세션에서 그렇게 찾은 결함이 2건(`6c112432a`, `68e37114c`)
4. **`_docs/index.md` 는 문서 생성·이동·개명 시 같은 커밋에서 갱신**한다 (3개 섹션)

---

## 미결 / 리스크

- **상표 범위가 미결.** "출처 설명" 은 §6 예외로 허용되고 "자기 제품 브랜딩" 은 아닌데, 그
  사이 어디에 선을 그을지는 판단이 필요하다. 본인이 직접 확인하기로 함. 이 문서를 쓴 에이전트는
  변호사가 아니며 위 내용은 라이선스 본문(§4·§6)을 읽은 결과다
- **어느 패키지를 버릴지 미결.** 모노레포에 `apps/app`·`agent`·`db`·`docs` 등 포크가 안 쓰는
  upstream 코드가 대량으로 있다. 지우면 가볍지만, 남기는 파일의 헤더는 유지해야 하고 루트
  `pnpm lint`(turbo 20 패키지 · syncpack · knip)가 그 구성에 묶여 있다 — 통째로 걷어내면
  lint 설정도 같이 손봐야 한다
- **`v0.4.2` 태그가 낡았다.** `82f2db018` 을 가리키는데 master 는 그보다 앞서 있다. 0.4.3
  릴리즈 시 정리 대상
- **0.4.3 릴리즈가 Trusted Publisher 등록 대기 중이다** — 아래 참조

---

## 인접 스트림 — 릴리즈 (이 핸드오프의 범위 밖이지만 물릴 수 있음)

`master` 에 미푸시 커밋이 쌓여 있고 `v0.4.3` 은 아직 태그되지 않았다. npm 배포는
**Trusted Publishing(OIDC)** 으로 가기로 했고, 본인이 npmjs.com 에서 erdkit 패키지에
Trusted Publisher(GitHub Actions / `Junjak-Personal` / `erdkit` / `release-erdkit.yml`)를
등록하면 `git push` → `v0.4.3` 태그 → 자동 배포로 끝난다. 토큰은 쓰지 않는다
(`ERDKITDEPLOY` 시크릿은 삭제 예정).

브랜딩 교체가 0.5.0 급 변경이면 릴리즈를 먼저 내보내고 시작하는 편이 히스토리가 깨끗하다.

---

## Pointers

- `_docs/active/planning/2026-08-03/2026-08-03-cli-distribution.md` — 개명·Apache-2.0 준수·
  npm 배포의 원래 계획. §4 의무를 어떻게 충족했는지가 여기 있다
- `_docs/complete/erd-viewer/2026-08-04-table-grouping.md` — 그룹화 구현 기록. "왜 이렇게
  만들었나" 절이 특히 중요하다. 함부로 "정리" 하면 깨지는 것들의 목록이다
- `_docs/active/planning/2026-08-05/2026-08-05-erd-viewer-backlog.md` — 기능 백로그. 브랜딩과
  무관하지만 같은 파일을 만진다
- `.claude/project-profile/` — 스택·컨벤션·검증 명령의 SSOT
