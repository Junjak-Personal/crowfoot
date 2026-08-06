# crowfoot 사용 가이드

> English: [usage_en.md](./usage_en.md) · 요약은 [README](../README.md) 참고

`crowfoot` 은 스키마 파일에서 정적 ERD 웹앱을 생성하는 CLI 다.
[Liam ERD](https://github.com/liam-hq/liam)(Apache-2.0, ROUTE06, Inc.)의 포크이며,
upstream 커밋 `92156eac5` 에 핀되어 있고 추종하지 않는다.

upstream 원본 사용법은 <https://liambx.com/docs> 에 있고, 이 문서는 **포크 기준**이다.
바뀐 내용의 전체 목록은 [`NOTICE`](../NOTICE) 에 있다.

---

## 목차

1. [빠른 시작](#빠른-시작)
2. [CLI 레퍼런스](#cli-레퍼런스)
3. [산출물 구조](#산출물-구조)
4. [뷰어 사용법](#뷰어-사용법)
5. [편집 모드](#편집-모드)
6. [레이아웃 영속화](#레이아웃-영속화)
7. [사이드카 파일 스키마](#사이드카-파일-스키마)
8. [쿼리 파라미터](#쿼리-파라미터)
9. [배포](#배포)
10. [트러블슈팅](#트러블슈팅)

---

## 빠른 시작

```bash
npx crowfoot erd build --input schema.sql --format postgres --output-dir dist
npx serve dist/
```

브라우저에서 `http://localhost:3000` 을 연다.

> **`file://` 로는 열리지 않는다.** 산출물은 `fetch('./schema.json')` 으로 스키마를
> 읽는 SPA 라 반드시 HTTP 로 서빙해야 한다.

처음이라 어떤 포맷을 써야 할지 모르겠으면 대화형 셋업을 쓴다.

```bash
npx crowfoot init
```

---

## CLI 레퍼런스

```
crowfoot [command]

Commands:
  erd build       스키마 파일에서 ERD 웹앱 생성
  erd from-link   공유 링크에서 layout.json / memos.json / groups.json 복원
  init            대화형 셋업 안내

Options:
  -V, --version   버전 출력
  -h, --help      도움말
```

### `crowfoot erd build`

스키마 파일을 읽어 `schema.json` 을 만들고, 뷰어 정적 파일 일체를 출력 디렉터리에 복사한다.

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--input <path\|url>` | (없음) | 스키마 파일 경로 또는 URL. 로컬 경로는 glob 패턴을 지원한다. |
| `--format <format>` | 자동 감지 | 입력 포맷. 아래 표 참고. |
| `--output-dir <path>` | `dist` | 출력 디렉터리. |

예시:

```bash
# 로컬 파일
npx crowfoot erd build --input db/schema.sql --format postgres

# glob — 여러 파일을 하나의 스키마로 합친다
npx crowfoot erd build --input 'db/migrations/*.sql' --format postgres

# 원격 URL
npx crowfoot erd build \
  --input https://raw.githubusercontent.com/user/repo/main/schema.sql \
  --format postgres

# 출력 위치 지정
npx crowfoot erd build --input schema.prisma --output-dir public/erd
```

#### 지원 포맷

| 소스 | `--format` | 자동 감지되는 파일명 / 확장자 |
|---|---|---|
| PostgreSQL | `postgres` | `.sql` |
| Ruby on Rails | `schemarb` | `schema.rb`, `Schemafile`, `.rb` |
| Prisma | `prisma` | `prisma.schema`, `.prisma` |
| Drizzle | `drizzle` | `schema.ts`, `db.ts`, `database.ts`, `drizzle.ts`, `.ts`, `.js` |
| tbls | `tbls` | `schema.json`, `.json` |
| Liam JSON | `liam` | (자동 감지 없음 — 명시 필요) |

`--format` 을 생략하면 **파일명·확장자로만** 판정한다. 내용은 보지 않으므로,
확장자가 애매하거나(`.json` → `tbls` 로 판정) 원격 URL 이 확장자를 안 가지면
명시하는 편이 안전하다. 감지에 실패하면 다음 에러로 종료한다.

```
--format is missing, invalid, or specifies an unsupported format.
```

#### MySQL · SQLite · BigQuery

직접 파서가 없다. [tbls](https://github.com/k1LoW/tbls) 로 `schema.json` 을 뽑아
`--format tbls` 로 넣거나, PostgreSQL 로 덤프해서 `--format postgres` 로 넣는다.

> 반대로 **MySQL DDL 로 내보내는 것**은 이 포크가 지원한다. [Export 메뉴](#export-메뉴) 참고.

### `crowfoot erd from-link`

편집 모드에서 만든 배치를 `layout.json` / `memos.json` / `groups.json` 으로 되돌린다.
[레이아웃 영속화](#레이아웃-영속화)의 핵심 명령.

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--input <url>` | (없음) | 공유할 ERD URL. **따옴표로 감쌀 것** — `&` 가 들어있다. |
| `--output-dir <path>` | `dist` | 출력 디렉터리. |

```bash
npx crowfoot erd from-link --input 'https://example.com/erd/?edit=1&positions=...' --output-dir dist
```

동작 규칙:

- 링크가 **실제로 담고 있는 파일만** 쓴다. 메모가 없는 링크는 기존 `memos.json` 을 덮어쓰지 않는다.
- `positions` / `colors` / `memos` / `groups` 가 하나도 없으면 아무것도 쓰지 않고 에러로 끝난다.
- 팔레트에 없는 색상 키는 검증하지 않고 그대로 쓴다 — 뷰어가 로드 시 버린다.
- `groups` 도 마찬가지로 검증 없이 그대로 쓴다 — CLI 는 검증 경계가 아니다. 실제 검증은
  뷰어의 `parseGroups` 가 로드 시점에 한다. `?showgroups=` 는 순수 뷰 설정이라 `from-link` 는
  아예 읽지 않는다.

### `crowfoot init`

대화형으로 DB/ORM 을 고르면 그에 맞는 `erd build` 명령을 안내한다.
`MySQL (via tbls)` 처럼 우회가 필요한 항목도 선택지에 있다.

---

## 산출물 구조

```
dist/
├── index.html          뷰어 진입점
├── assets/             JS · CSS (경로는 전부 상대경로)
├── schema.json         erd build 가 생성 — 파싱된 스키마
├── layout.json         (선택) 고정된 테이블 위치와 색상
├── memos.json          (선택) 캔버스 메모
└── groups.json         (선택) 테이블 그룹
```

- `layout.json` / `memos.json` / `groups.json` 은 **선택**이다. 없으면 자동 배치 + 메모·그룹 없음으로 동작한다.
- 셋 다 `index.html` 과 **같은 디렉터리**에서 로드된다. 다른 곳에 두면 안 읽힌다.
- `erd build` 는 출력 디렉터리에 덮어쓰기 때문에, 사이드카 파일은 **소스에 커밋해 두고
  빌드 후 복사**하는 흐름이 안전하다.

---

## 뷰어 사용법

### 탐색

| 조작 | 동작 |
|---|---|
| 마우스 휠 / 트랙패드 | 캔버스 이동 (pan) |
| `Ctrl` + 휠 | 확대·축소 |
| 가운데·우클릭 드래그 | 캔버스 이동 |
| 더블클릭 | 확대 |
| 테이블 클릭 | 우측 상세 패널 열기 (`?active=` 에 반영) |
| 테이블 드래그 | 위치 이동 *(편집 모드에서만)* |
| 좌클릭 드래그 | 여러 테이블·메모 선택 *(편집 모드에서만)* |
| `Ctrl`/`Cmd`/`Shift` + 클릭 | 선택에 추가·제외 *(편집 모드에서만)* |

좌측 사이드바에서 테이블 목록을 보고 개별로 숨기거나 표시할 수 있다.
숨김 상태는 `?hidden=` 에 반영되므로 링크로 공유된다.

### 표시 모드

컬럼을 얼마나 보여줄지 3단계로 고른다. 툴바에서 고르거나 URL 로 지정한다.

| `?show=` | 내부 이름 | 표시 |
|---|---|---|
| `all` | `ALL_FIELDS` | 모든 컬럼 **(기본값)** |
| `table` | `TABLE_NAME` | 테이블 이름만 |
| `key` | `KEY_ONLY` | 키 컬럼만 |

### 커맨드 팔레트

`⌘K` / `Ctrl+K` 로 열어 테이블 이름을 검색하고 바로 이동한다. 실시간 프리뷰가 붙는다.

### 단축키

| 키 | 동작 |
|---|---|
| `⌘K` / `Ctrl+K` | 커맨드 팔레트 |
| `⌘C` / `Ctrl+C` | 선택된 메모 복사 *(편집 모드에서만)* |
| `⌘V` / `Ctrl+V` | 복사한 메모를 커서 위치에 붙여넣기 *(편집 모드에서만)* |
| `⇧1` | 화면에 맞추기 |
| `⇧2` | 모든 컬럼 표시 |
| `⇧3` | 테이블 이름만 |
| `⇧4` | 키만 |
| `⇧T` | 자동 배치 다시 실행 (Tidy up) |
| `⇧A` | 모든 테이블 표시 |
| `⇧H` | 모든 테이블 숨김 |

> 링크 공유는 우상단 **Copy Link** 버튼이다. 배치·색상·메모·그룹이 전부 URL 에 실려 있으므로
> **이 한 번의 복사가 곧 공유**다. 링크 복사에는 단축키가 없다 — `⌘C` 는 캔버스 선택
> (메모 복사)에 양보했다.

### Export 메뉴

우상단 `Export` 드롭다운.

| 항목 | 출력 |
|---|---|
| Copy MySQL | MySQL DDL 을 클립보드로 |
| Download MySQL (.sql) | `schema.mysql.sql` 다운로드 |
| Copy PostgreSQL | PostgreSQL DDL 을 클립보드로 |
| Copy YAML | 스키마를 YAML 로 |
| Download layout.json | 현재 위치·색상 *(편집 모드에서만 노출)* |
| Download memos.json | 현재 메모 *(편집 모드에서만 노출)* |
| Download groups.json | 현재 그룹 *(편집 모드에서만 노출)* |

MySQL export 는 이 포크가 추가한 것이다. upstream 은 PostgreSQL·YAML 만 지원한다.

---

## 편집 모드

### 활성화

```
https://your-host/erd/?edit=1
```

`?edit=1` 또는 `?edit=true`. 이게 없으면 **읽기 전용**이라 테이블을 끌 수도, 메모를
만들 수도 없다. 공유 링크가 실수로 흐트러지는 것을 막기 위한 기본값이다.

편집 모드에서는 캔버스 상단에 안내 배지가 뜬다:
`Edit mode · drag to select · Ctrl/Cmd + right-click for the menu`

`editMode` 는 저장되지 않고 URL 에서 파생만 된다. 파라미터를 떼면 즉시 읽기 전용으로 돌아간다.

### 테이블 이동

편집 모드에서만 드래그된다. 놓는 즉시 브라우저 저장소와 `?positions=` 양쪽에 반영된다.

**여러 개를 한꺼번에** 옮기려면 빈 캔버스를 좌클릭으로 드래그해 선택 상자를 그리거나,
`Ctrl`/`Cmd`/`Shift` + 클릭으로 하나씩 더한다. 선택 상자에 **일부만 걸쳐도** 선택된다.
선택된 것 중 아무거나 끌면 전부 함께 움직이고, 전부 한 번에 저장된다.

테이블과 메모는 **같은 선택 상자에 함께 잡힌다.** 섞여 있어도 한 번에 끌 수 있고,
테이블 위치는 `?positions=` 로, 메모는 `?memos=` 로 각각 저장된다.

> 선택 상자는 편집 모드에서만 좌드래그를 가져간다. 읽기 전용에서는 좌드래그가 그대로 비어 있다.
> 캔버스 이동은 두 모드 모두 휠·가운데·우클릭 드래그로 한다.

### 컨텍스트 메뉴

> **`Ctrl`(또는 macOS 의 `Cmd`) + 우클릭.** 그냥 우클릭은 React Flow 의 캔버스 이동
> 제스처라, 편집 메뉴는 수식키 뒤에 숨겨 두었다.

| 클릭 대상 | 메뉴 |
|---|---|
| 빈 캔버스 | `Add memo here` — 클릭한 지점에 메모 생성 |
| 테이블 | 색상 팔레트 |
| 메모 | 색상 팔레트 + 폰트 크기(`−` / 숫자 입력 / `+`) + `Duplicate memo` + `Delete memo` |

메뉴는 **선택 전체**에 적용된다. 선택 안에 있는 것을 우클릭하면 선택이 그대로 유지되고,
선택 밖의 것을 우클릭하면 선택이 그것 하나로 좁혀진다 — 좌클릭과 같은 규칙이다.
즉 테이블 5개를 선택하고 그중 하나를 우클릭해 색을 고르면 5개가 함께 칠해진다.

### 메모

메모는 테이블과 **같은 종류의 캔버스 요소**다. 선택·다중 선택·드래그·리사이즈가
테이블과 완전히 동일하게 동작한다.

- 편집 모드에서 메모 본문은 textarea 가 되어 바로 타이핑할 수 있다.
- 선택하면 네 모서리에 리사이즈 핸들이 나온다. 최소 `100 × 60`, 기본 `220 × 120`.
- 폰트 크기는 `10`~`96`, 기본 `13`. 증감 버튼의 폭은 크기를 따라간다 —
  24 미만은 2, 48 미만은 4, 그 위는 8씩 움직인다.
- 색상·폰트 크기·삭제·복제는 **선택된 메모 전체**에 한 번에 적용된다.

### 메모 복사·붙여넣기

세 가지 방법이 있고 결과는 모두 **새 id 를 가진 완전한 사본**이다. 색상·폰트 크기·박스 크기가 그대로 승계된다.

| 방법 | 동작 |
|---|---|
| 컨텍스트 메뉴 `Duplicate memo` | 선택된 메모 전부를 오른쪽 아래로 24px 어긋난 자리에 복제 |
| `⌘C` → `⌘V` | 커서 위치를 중심으로 붙여넣기. 여러 개를 복사하면 **서로의 간격이 유지된다** |
| 다른 탭에서 `⌘V` | 같은 뷰어를 연 다른 탭에도 붙여넣을 수 있다 |

메모를 클릭하면 선택되고 초록 테두리가 생긴다. 선택을 풀려면 빈 캔버스를 클릭한다.
메모 본문에 커서가 들어가 있을 때는 `⌘C`/`⌘V` 가 평범한 텍스트 복사·붙여넣기로 동작한다.

복사·붙여넣기가 되면 `Memo copied` / `3 memos pasted` 처럼 **토스트 알림**이 뜬다.
`⌘C` 를 눌렀는데 아무 알림도 없으면 선택된 메모가 없다는 뜻이다.

메모는 OS 클립보드에 마커가 붙은 JSON 으로 실린다. 그래서 일반 텍스트를 붙여넣어도
메모로 둔갑하지 않고, 붙여넣기가 무시된다.

### 색상 팔레트

12색 고정. 전부 `@liam-hq/ui` 의 기존 디자인 토큰에서 가져왔다.

| 키 | 색상 | 키 | 색상 |
|---|---|---|---|
| `green` | `#5ec692` | `sand` | `#c3b476` |
| `mint` | `#b0f9d4` | `yellow` | `#e7ddb3` |
| `teal` | `#87e2eb` | `gold` | `#ffbf36` |
| `sky` | `#cce8f2` | `orange` | `#dd6502` |
| `blue` | `#97bdcb` | `vermilion` | `#d55235` |
| `steel` | `#5f6366` | `red` | `#ea928e` |

`layout.json` / `memos.json` 및 `?colors=` 에는 색상값이 아니라 **키**가 들어간다.
목록에 없는 키는 로드 시 조용히 버려진다.

### 그룹

그룹은 사람이 직접 묶은 테이블 집합으로, 이름표가 붙은 점선 상자로 캔버스에 그려진다.
FK 로 자동 추론하지 않는다 — 언제나 사람이 명시적으로 묶는다. **한 테이블이 여러 그룹에
동시에 속할 수 있다** (다중 소속). 결제·정산처럼 도메인이 겹치는 테이블을 그대로 표현할 수
있고, 겹치는 상자·이름표는 자연스러운 상태로 취급된다.

- **만들기** — 테이블 2개 이상 선택 후 `Ctrl`/`Cmd` + 우클릭 → `Group selected tables`.
- **그룹 헤더 클릭** — 멤버 테이블 전체가 선택되어 함께 옮길 수 있다. 헤더는 상자 왼쪽 위
  바깥에 이름표로 뜬다.
- **그룹 헤더 우클릭** — 색상 팔레트, 이름 변경, `Ungroup` (그룹만 해제, 테이블은 그대로).
- **그룹에 속한 테이블 우클릭** — `Remove from "이름"` 으로 그 테이블만 해당 그룹에서 뺀다.
  다른 그룹 소속은 그대로 남는다.

#### 단일 보기 / 그룹 보기

툴바 토글 버튼(또는 `?showgroups=on|off`)이 캔버스와 사이드바를 **함께** 전환한다.

| | 단일 보기 (`showgroups=off`) | 그룹 보기 (`showgroups=on`, 기본값) |
|---|---|---|
| 캔버스 | 상자·이름표 없음 | 상자·이름표 표시 |
| 좌측 사이드바 | 알파벳순 평면 목록, 테이블마다 한 줄 | 그룹별로 나뉜 목록, "Ungrouped" 는 항상 맨 아래 |
| N개 그룹에 속한 테이블 | 목록에 **1번** | 목록에 **N번** — 그룹마다 한 번씩 |

그룹이 하나도 없으면(또는 있던 그룹의 멤버가 전부 사라졌으면) 두 모드의 사이드바는
**완전히 동일**하다 — 그룹 보기라도 "Ungrouped" 헤더가 뜨지 않는다.

한 테이블이 사이드바에 여러 번 나오는 게 헷갈리면 **단일 보기가 탈출구다**: 토글 한 번으로
오늘까지의 평면 목록으로 돌아간다. 사이드바의 `(n/m visible)` 카운트는 두 모드 모두 실제
테이블 수 기준이라, 중복된 행이 두 번 세어지지 않는다.

---

## 레이아웃 영속화

### 해석 우선순위

```
?positions= (링크)  >  브라우저 저장소  >  layout.json  >  자동 배치(ELK)
```

메모도 같은 구조다: `?memos=` > 브라우저 저장소 > `memos.json` > 없음.
그룹도 마찬가지: `?groups=` > 브라우저 저장소 > `groups.json` > 없음.

`?showgroups=` (단일 보기/그룹 보기)는 이 우선순위와 무관한 별도의 뷰 설정이다 —
그룹 데이터 자체를 바꾸지 않고, 어떻게 보여줄지만 바꾼다.

여기서 중요한 건 **어디에도 고정되지 않은 테이블은 자동 배치로 폴백**한다는 점이다.
그래서 스키마에 테이블이 새로 생겨도 기존 배치가 깨지지 않는다. 수동 레이아웃을
전부 관리해야 하는 부채가 생기지 않도록 의도한 설계다.

브라우저 저장소 키:

| 키 | 내용 |
|---|---|
| `crowfoot:tableLayout` | 이 브라우저에서 옮기거나 칠한 테이블 |
| `crowfoot:memos` | 이 브라우저의 메모 작업본 |
| `crowfoot:groups` | 이 브라우저의 그룹 작업본 |

> 0.4.0 까지는 `liam:*`, 그 뒤로는 `erdkit:*` 이었다. 예전 키 어느 쪽에든 값이 남아
> 있으면 **처음 읽을 때 현재 키로 한 번 옮기고 예전 키를 지운다** — 배치를 다시 만들
> 필요는 없다. 콘솔 헬퍼도 `liamLayout` → `erdkitLayout` → `crowfootLayout` 으로
> 함께 바뀌었다.

> 브라우저 저장소는 **내 브라우저에만** 남는다. 팀에 보여주려면 링크를 공유하거나
> 아래 방법으로 사이드카 파일에 고정해야 한다.

### 배치를 팀에 고정하는 3가지 방법

**A. 링크 → 파일 (권장)**

```bash
# 1. ?edit=1 로 열어 배치·색상·메모·그룹 정리
# 2. 우상단 Copy Link 버튼으로 링크 복사
# 3. 링크를 파일로 되돌린다
npx crowfoot erd from-link --input '<복사한 URL>' --output-dir dist
# 4. dist/layout.json, dist/memos.json, dist/groups.json 을 소스에 커밋
```

**B. Export 메뉴에서 다운로드**

편집 모드에서 `Export` → `Download layout.json` / `Download memos.json` / `Download groups.json`.
링크를 거치지 않는다는 점만 다르고 결과는 같다.

**C. 브라우저 콘솔**

```js
crowfootLayout.dump()    // 현재 레이아웃을 출력 + 클립보드 복사
crowfootLayout.reset()   // 이 브라우저의 레이아웃 편집 내역 삭제 후 새로고침
crowfootMemos.dump()     // 메모도 동일
crowfootMemos.reset()
crowfootGroups.dump()    // 그룹도 동일
crowfootGroups.reset()
```

`dump()` 는 콘솔 출력과 클립보드 복사를 같이 한다. HTTPS 가 아닌 컨텍스트에서는
클립보드가 막히므로 콘솔 출력에서 복사한다.

---

## 사이드카 파일 스키마

### `layout.json`

테이블 이름을 키로 하는 객체.

```json
{
  "users": { "x": 0, "y": 0 },
  "orders": { "x": 420, "y": 160, "color": "teal" },
  "order_items": { "x": 840, "y": 160, "color": "sand" }
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `x` | number | ✅ | 캔버스 X 좌표 |
| `y` | number | ✅ | 캔버스 Y 좌표 |
| `color` | string | | 팔레트 키. 목록 밖 값은 무시된다. |

`x` 또는 `y` 가 없거나 숫자가 아닌 항목은 통째로 버려지고, 해당 테이블은 자동 배치로 간다.

### `memos.json`

메모 객체의 배열.

```json
[
  {
    "id": "5c9f1b7a-1b7e-4e6a-9c3f-2a1d5e8b0c44",
    "text": "결제 도메인은 여기부터",
    "x": 120,
    "y": -240,
    "width": 260,
    "height": 140,
    "color": "gold",
    "fontSize": 15
  }
]
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | string | ✅ | | 빈 문자열 불가. 새 메모는 `crypto.randomUUID()` 로 생성된다. |
| `text` | string | ✅ | | 본문. 빈 문자열 허용. |
| `x` | number | ✅ | | 캔버스 X 좌표 |
| `y` | number | ✅ | | 캔버스 Y 좌표 |
| `width` | number | | `220` | 최소 `100` |
| `height` | number | | `120` | 최소 `60` |
| `color` | string | | (없음) | 팔레트 키 |
| `fontSize` | number | | `13` | `10`~`96` 으로 잘린다 |

필수 필드가 빠졌거나 타입이 맞지 않는 항목은 조용히 건너뛴다. 파일 전체가 깨져도
ERD 자체는 정상적으로 뜬다 — 사이드카 로딩이 스키마 로딩을 막지 않도록 되어 있다.

### `groups.json`

그룹 객체의 배열.

```json
[
  { "id": "payment", "name": "결제", "tableNames": ["orders", "payments"], "color": "gold" },
  { "id": "shipping", "name": "배송", "tableNames": ["shipments"] }
]
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | ✅ | 빈 문자열 불가. 새 그룹은 `crypto.randomUUID()` 로 생성된다. `id` 가 중복되면 먼저 나온 항목이 유지된다. |
| `name` | string | ✅ | 그룹 이름. 빈 문자열 허용. |
| `tableNames` | string[] | ✅ | 멤버 테이블 이름. **같은 테이블 이름이 여러 항목(다른 그룹)에 나타날 수 있다** — 한 테이블이 여러 그룹에 동시에 속하는 다중 소속을 표현한다. 빈 배열이면 항목 전체가 버려진다. 같은 항목 안의 중복 이름은 하나로 합쳐진다. |
| `color` | string | | 팔레트 키. 목록 밖 값은 무시된다. |

필수 필드가 빠졌거나 타입이 맞지 않는 항목은 조용히 건너뛴다. 스키마에 없어진 테이블
이름이나 숨겨진(`?hidden=`) 테이블은 화면에 그릴 때 제외되며, 멤버가 하나도 안 남은
그룹은 **그려지지 않을 뿐 파일에서 지워지지는 않는다** — 스키마가 다시 바뀌면 되살아난다.

---

## 쿼리 파라미터

거의 모든 UI 상태가 URL 에 반영되므로, 링크 하나가 화면을 그대로 재현한다.

| 파라미터 | 값 | 설명 | 히스토리 |
|---|---|---|---|
| `show` | `all` \| `table` \| `key` | 표시 모드. 기본 `all`. | push |
| `active` | 테이블 이름 | 해당 테이블 상세 패널을 연다. | push |
| `hidden` | 압축 목록 | 숨긴 테이블 이름들. | push |
| `positions` | 압축 `name:x:y` 목록 | 테이블 위치. `layout.json` 보다 우선한다. | replace |
| `colors` | 압축 `name:colorkey` 목록 | 테이블 색상. | replace |
| `memos` | 압축 JSON | 메모 전체. | replace |
| `groups` | 압축 JSON | 그룹 전체. | replace |
| `showgroups` | `on` \| `off` | 단일 보기 / 그룹 보기 전환 — 캔버스의 상자·이름표와 사이드바 구분 둘 다에 적용된다. 기본 `on`. | push |
| `edit` | `1` \| `true` | 편집 활성화. 없으면 읽기 전용. | — |

### 인코딩

`positions` / `colors` / `memos` / `groups` 는 **deflate 압축 + URL-safe base64**(`+`→`-`,
`/`→`_`, `=` 제거)다. 사람이 읽을 수는 없지만, 그 대신:

- CloudFront 등 CDN 이 쿼리스트링을 재조립해도 무손실로 통과한다.
- `positions` 는 **실제로 옮긴 테이블만** 인코딩한다. 나머지는 `layout.json` 과
  결정론적 자동 배치로 재현되므로 링크가 필요 이상으로 길어지지 않는다.
- `memos` 와 `groups` 는 목록이 아니라 단일 JSON blob 이다. 메모 본문과 그룹 이름
  모두 자유 형식이라 목록 파서의 `split(',')` 에 잘려나가기 때문.
- `showgroups` 는 그룹 데이터가 아니라 **보기 방식**이라 압축하지 않고 `on`/`off` 그대로 실린다.

### 히스토리 동작

`push` 는 뒤로가기 스택에 쌓이고 `replace` 는 쌓이지 않는다.
탐색(`active`/`show`/`hidden`/`showgroups`)은 뒤로가기가 동작해야 하고,
편집(`positions`/`colors`/`memos`/`groups`)은 드래그 한 번마다 히스토리를 채우면 안 되기
때문에 의도적으로 나눴다.

---

## 배포

### 정적 호스팅

산출물은 순수 정적 파일이라 S3+CloudFront, GitHub Pages, Netlify, Vercel, nginx 어디에나 올라간다.

```bash
npx crowfoot erd build --input schema.sql --format postgres --output-dir dist
aws s3 sync dist/ s3://my-bucket/erd/ --delete
```

### 서브 경로 마운트

에셋 경로(`./assets/…`)와 스키마 fetch(`./schema.json`)가 **전부 상대경로**라,
`/erd/` 같은 서브 경로에 그대로 올려도 **재빌드가 필요 없다.**

### 캐시 헤더

`layout.json` / `memos.json` / `groups.json` 은 뷰어가 `cache: 'no-cache'` 로 요청해
브라우저 캐시를 재검증한다. 하지만 **CDN 캐시는 별개**다. 배포 후 즉시 반영되게 하려면
CDN 쪽에서 이 세 파일의 TTL 을 짧게 잡거나 무효화(invalidation)를 걸어야 한다.

`assets/` 는 파일명에 해시가 붙으므로 길게 캐시해도 안전하다.

### CI 에 붙이기

```bash
# 스키마가 바뀌었을 때만 다시 빌드하고, 사이드카는 소스에서 복사
npx crowfoot erd build --input db/schema.sql --format postgres --output-dir dist
cp docs/erd/layout.json docs/erd/memos.json dist/
```

`erd build` 는 출력 디렉터리를 덮어쓰므로 **복사는 빌드 뒤**여야 한다.

---

## 트러블슈팅

**화면이 비어 있고 콘솔에 fetch 에러가 난다**
`file://` 로 열었을 가능성이 높다. HTTP 로 서빙한다 (`npx serve dist/`).

**테이블이 매번 자동 배치로 돌아간다**
`layout.json` 이 `schema.json` 과 같은 디렉터리에 있는지 확인한다.
`erd build` 를 다시 돌리면서 사이드카를 복사하지 않았을 수도 있다.

**메모가 안 보인다**
`memos.json` 위치를 확인한다. 항목의 `id` / `text` / `x` / `y` 중 하나라도 빠지면
그 항목은 조용히 버려진다.

**그룹 상자가 안 보인다**
`?showgroups=off` 인지 확인한다 (`?showgroups=on` 이 기본값). 켜져 있다면
`groups.json` 위치를 확인하거나, 멤버 테이블이 전부 숨김(`?hidden=`) 상태가 아닌지 본다 —
보이는 멤버가 0명이면 그 그룹은 그려지지 않는다.

**드래그가 안 된다 / 메모를 못 만든다**
URL 에 `?edit=1` 이 없다. 읽기 전용이 기본값이다.

**우클릭해도 메뉴가 안 나온다**
`Ctrl`(macOS 는 `Cmd`)를 같이 눌러야 한다. 그냥 우클릭은 캔버스 이동 제스처다.
편집 모드가 아니면 수식키를 눌러도 나오지 않는다.

**`⌘C` 가 아무것도 안 한다 (토스트가 안 뜼다)**
메모가 선택돼 있지 않다. 메모를 한 번 클릭해 초록 테두리를 확인하고 다시 누른다.
테이블만 선택된 상태도 마찬가지다 — 테이블은 복사 대상이 아니다.
링크를 복사하려던 것이라면 우상단 **Copy Link** 버튼을 쓴다.

**`⌘V` 가 아무것도 안 한다**
`?edit=1` 이 없거나, 클립보드에 든 것이 이 뷰어가 복사한 메모가 아니다.
일반 텍스트는 의도적으로 무시한다.

**좌드래그가 캔버스를 안 움직이고 선택 상자를 그린다**
편집 모드의 정상 동작이다. 캔버스 이동은 휠·가운데·우클릭 드래그로 한다.

**내 브라우저에서만 배치가 유지된다**
브라우저 저장소에만 있는 상태다. [배치를 팀에 고정하는 3가지 방법](#배치를-팀에-고정하는-3가지-방법) 참고.

**`from-link` 가 "carries no positions, colors, memos or groups" 로 실패한다**
링크에 편집 결과가 안 실려 있다. `?edit=1` 로 열어 실제로 뭔가를 옮기거나 만든 뒤
우상단 **Copy Link** 버튼으로 다시 복사한다.

**`from-link` 에 URL 을 넣었더니 일부만 반영된다**
셸이 `&` 에서 명령을 끊었다. URL 전체를 작은따옴표로 감싼다.

**색상을 지정했는데 무시된다**
[팔레트 12색](#색상-팔레트) 밖의 키다. 로드 시 버려진다.

**`--format is missing, invalid...` 로 종료된다**
확장자로 포맷을 판정하지 못했다. `--format` 을 명시한다.

**배포했는데 예전 배치가 보인다**
CDN 캐시다. `layout.json` / `memos.json` / `groups.json` 을 무효화한다.

**초기화하고 싶다**
브라우저 콘솔에서 `crowfootLayout.reset()` / `crowfootMemos.reset()` / `crowfootGroups.reset()`.
이 브라우저의 편집 내역만 지우고 `layout.json` / `memos.json` / `groups.json` 상태로 돌아간다.

---

## 원본 Liam ERD 사용법

이 포크가 아니라 원본 도구를 쓰려면:

- 공개 저장소: 스키마 파일 URL 에 `liambx.com/erd/p/` 를 끼워 넣는다.
  `https://liambx.com/erd/p/github.com/user/repo/blob/master/db/schema.rb`
- 비공개 저장소: `npx @liam-hq/cli init`
- 문서: <https://liambx.com/docs> — [UI Features](https://liambx.com/docs/ui-features) ·
  [Web](https://liambx.com/docs/web) · [CLI](https://liambx.com/docs/cli) ·
  [Parser](https://liambx.com/docs/parser)

원본에는 위치 영속화, 메모, 그룹, 색상, 편집 모드, MySQL export 가 없다.
