# Repo Split R7 Release Checklist (Editor -> Runtime)

Date: 2026-02-26  
Scope: `nolquiz-editor` / `nolquiz-runtime` 운영 반영 절차 표준화

Related:
- `docs/repo-split-r6-handoff.md`
- `docs/repo-split-execution-plan.md`

## 1) Purpose

에디터에서 수정한 맵/자산 변경이 runtime 레포에 반영될 때 누락(`publish` 미실행, split 재적용 누락, 검증 누락)을 줄이기 위한 표준 절차.

핵심 원칙:
- editor 원본과 runtime 배포 맵은 분리 관리
- 반영 전/후 검증을 고정 명령으로 수행
- handoff/release 전에는 browser E2E 포함 검증 권장

## 2) Preconditions

- `nolquiz-editor`, `nolquiz-runtime` 로컬 폴더 존재
- 로컬 Node 실행 가능
- (browser E2E 실행 시) Playwright + Chromium 설치 완료

빠른 상태 확인(권장):

```bash
cd /Users/baekjiyun/Desktop/WAN/math-net-master-quiz
node scripts/jumpmap-check-split-repo-readiness.mjs
```

원격 URL/운영값 입력 후 게이팅 모드(권장):

```bash
node scripts/jumpmap-check-split-repo-readiness.mjs --strict
```

체크 포인트:
- split 레포 존재/clean 상태
- latest commit 확인
- `origin` remote 설정 여부
- split 레포 `docs/repo-operations.md`의 `TBD` 잔존 여부

메모:
- 현재 단계(`R7` 준비/이관 중)에서는 `origin` 미설정, `TBD` 잔존이 정상이라 기본 모드에서 `WARN`이 나올 수 있음
- 실제 push/CI 활성화 직전에는 `--strict`가 `PASS`가 되도록 맞추는 것을 권장

## 3) Standard Flow (Recommended)

### 3-1) Edit In Editor

1. `nolquiz-editor` 또는 monorepo editor 경로에서 맵 수정
2. 저장 원본 확인 (`save_map/*.json`)

## 3-2) Publish Runtime Map

Editor 레포에서 runtime 맵 publish (dry-run 먼저 권장):

```bash
cd /Users/baekjiyun/Desktop/WAN/nolquiz-editor
node scripts/jumpmap-publish-runtime-map.mjs --runtime-repo ../nolquiz-runtime --dry-run
node scripts/jumpmap-publish-runtime-map.mjs --runtime-repo ../nolquiz-runtime
```

Expected:
- target: `../nolquiz-runtime/public/shared/maps/jumpmap-01.json`

## 3-3) Re-apply Split Scaffold (If Working From Monorepo)

monorepo(`math-net-master-quiz`)에서 코드/스크립트/문서를 변경했다면 split scaffold 재적용:

```bash
cd /Users/baekjiyun/Desktop/WAN/math-net-master-quiz
node scripts/jumpmap-split-repos.mjs --apply --force-merge
```

Expected (R6 baseline):
- `runtime required 24/24`
- `editor required 17/17`
- `runtime forbidden absent 1/1`

## 3-4) Verification (Minimum)

빠른 검증(권장 최소):

```bash
cd /Users/baekjiyun/Desktop/WAN/math-net-master-quiz
node scripts/jumpmap-verify-split.mjs --skip-smoke
```

Expected (R6 baseline):
- `pass=37 fail=0`

## 3-5) Verification (Recommended Before Handoff/Release)

browser E2E 포함 검증:

```bash
cd /Users/baekjiyun/Desktop/WAN/math-net-master-quiz
node scripts/jumpmap-verify-split.mjs --skip-smoke --with-browser-e2e --browser-e2e-timeout-ms 30000
```

Expected (R6 baseline):
- `pass=38 fail=0`
- `legacy compat browser e2e` PASS (`cases=4`)

추가(강한 기준선 / 필요 시):

```bash
node scripts/jumpmap-verify-split.mjs --with-browser-e2e
```

Expected (R6 strong baseline):
- `pass=66 fail=0`

## 3-6) CI (Optional, Recommended For R7)

Monorepo CI workflow:
- `.github/workflows/repo-split-verify.yml`

Default behavior:
- `push(main)` / `pull_request`: fast verify only (`--skip-smoke`)

Manual dispatch option:
- `with_browser_e2e=true`로 실행하면 browser E2E까지 포함(`--skip-smoke --with-browser-e2e`)
- `browser_e2e_timeout_ms` 입력으로 timeout 조정 가능 (기본 `30000`)

Notes:
- browser E2E job는 CI 내에서 `playwright` 패키지와 `chromium`을 임시 설치함
- split scaffold를 각 job에서 다시 적용하므로 job 간 상태 공유에 의존하지 않음

## 4) Failure Triage (Short)

1. `publish dry-run` 실패
- runtime repo 경로(`--runtime-repo`) 확인
- `save_map/jumpmap-01.json` 존재 여부 확인

2. `runtime forbidden absent` 실패
- `nolquiz-runtime/public/jumpmap-editor`가 다시 생겼는지 확인
- `jumpmap-split-repos.mjs --apply --force-merge` 재실행 후 재확인

3. `legacy compat asset sync/source html sync` 실패
- monorepo에서 sync 스크립트 실행 후 재검증
  - `scripts/jumpmap-sync-runtime-legacy-compat-assets.mjs`
  - `scripts/jumpmap-sync-runtime-legacy-compat-source-html.mjs`

4. browser E2E 실패
- 먼저 `--skip-smoke`가 통과하는지 분리 확인
- `--browser-e2e-headed --browser-e2e-timeout-ms 30000`로 재현
- `legacyCompatDebug=1` 관련 변경이 있으면 host panel telemetry 문구/row assertion 확인

## 5) Commit / Handoff Suggestion (R7)

권장 순서:
1. editor 변경 커밋 (`nolquiz-editor`)
2. runtime publish 결과/운영 변경 커밋 (`nolquiz-runtime`)
3. monorepo 문서/검증 스크립트 변경 커밋 (`math-net-master-quiz`, 해당 시)

handoff에 포함할 최소 정보:
- 실행한 검증 명령
- `pass/fail` 수치
- publish 대상 맵 경로
- 남은 리스크(있으면 1~3줄)
