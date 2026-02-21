# Jumpmap Editor Analysis (2026-02-07)

Scope: `public/jumpmap-editor/*`

## 1) Current Structure
- UI/상태/이벤트 허브: `public/jumpmap-editor/editor.js`
- 유틸 분리:
  - `public/jumpmap-editor/hitbox-utils.js`
  - `public/jumpmap-editor/geometry-utils.js`
  - `public/jumpmap-editor/map-io-utils.js`
- 테스트 런타임 분리:
  - `public/jumpmap-editor/test-runtime.js`
  - `public/jumpmap-editor/test-physics-utils.js`
- 데이터:
  - `public/jumpmap-editor/data/plates.json`

## 2) Strengths
- 저장/불러오기 경로가 `map-io-utils`로 분리되어 스키마 검증 지점이 명확함.
- 테스트 런타임과 물리 계산이 분리되어 에디터 코드와 결합도가 이전보다 낮음.
- `spriteProfiles`(scale/crop/hitboxes) 중심으로 배치 재사용성이 확보됨.
- Phase 6 자동 검증 스크립트(`scripts/jumpmap-phase6-validate.mjs`)로 회귀 확인이 가능함.

## 3) Weaknesses / Risks
- `editor.js` 단일 파일이 여전히 크고, 포인터 상태(`dragState`, `hitboxDrag`, `cropDrag`, `playerHitboxDrag`)가 한 파일에 집중됨.
- 이벤트 우선순위(오브젝트/히트박스/자르기/플레이어)가 겹칠 때 회귀 가능성이 큼.
- DOM 렌더가 전체 재생성(`renderWorld`) 기반이라 대량 오브젝트에서 프레임 저하 위험이 남아 있음.
- 프로젝트 루트에 `package.json`이 없어 빌드 기반 CI 체크를 바로 적용하기 어려움.

## 4) Immediate Stabilization Priorities
1. 선택 대상 전환 안정성 수동 QA 완료
- 오브젝트 선택 -> 히트박스 선택 -> 플레이어 선택 -> 되돌리기 반복
- 기대: 선택 꼬임/모드 오염 없이 독립 동작

2. 자르기/이동 충돌 회귀 점검
- 자르기 모드에서 오브젝트 원점이 의도치 않게 이동하는지 반복 점검
- 기대: 크롭 핸들 조작 시 타 편집 상태(이동/회전/히트박스)가 개입하지 않음

3. 대량 맵 편집 성능 점검
- 오브젝트 100~200개 기준 배치/선택/스크롤/미니맵 이동
- 기대: 작업 불가 수준 프리즈 없음

## 5) Next Refactor Direction (No Behavior Change First)
- Step A: `editor.js`의 pointer-event 분기만 별도 모듈로 추출
- Step B: 렌더 계층 분리(오브젝트 레이어, 컨트롤 레이어, 히트박스 레이어)
- Step C: 저장 전용 상태 정규화 함수와 화면 상태(선택/드래그) 분리

위 3단계는 동작 변경 없이 분리만 수행하고, 각 단계마다 `scripts/jumpmap-phase6-validate.mjs` + 수동 체크리스트를 실행하는 방식이 안전함.

## 6) Verification Baseline
- 자동:
  - `node scripts/jumpmap-phase6-validate.mjs`
- 수동:
  - `docs/jumpmap-editor-phase6-checklist.md`
