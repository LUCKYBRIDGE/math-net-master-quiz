# Jumpmap Editor Baseline Checklist (Phase 0)

Date: 2026-02-06

Purpose: 분리 작업 시작 전 현재 동작 기준선을 고정하기 위한 수동 체크리스트.

## A. Editor Interaction
- [ ] 팔레트에서 오브젝트 선택 후 배치 가능
- [ ] 배치 후 오브젝트 선택 가능
- [ ] 오브젝트 이동/크기/회전/반전 동작
- [ ] 선택 대상 전환(오브젝트/히트박스) 동작

## B. Hitbox
- [ ] 히트박스 추가 가능
- [ ] 히트박스 선택/이동/크기 조절 가능
- [ ] 히트박스 잠금/해제 동작
- [ ] 붙어있는 히트박스 합치기 동작
- [ ] 히트박스 프리셋 저장/불러오기 동작

## C. Crop
- [ ] 오브젝트 자르기 핸들 동작
- [ ] 캐릭터 자르기 핸들 동작
- [ ] 자르기 중 원본 고정 동작 확인

## D. Navigation
- [ ] 빠른 이동(시작점/맨위/중간/맨아래) 동작
- [ ] 미니맵 이동 동작
- [ ] 커스텀 스크롤바 드래그 동작

## E. Save/Load
- [ ] 저장 파일 생성 확인
- [ ] 불러오기 후 상태 복원 확인
  - [ ] mapSize
  - [ ] objects + hitboxes
  - [ ] startPoint
  - [ ] playerHitbox + playerCrop
  - [ ] physics

## F. Test Mode
- [ ] 테스트 모드 진입/종료
- [ ] 키보드/가상키 이동
- [ ] 점프/공중점프 규칙 동작
- [ ] 착지 판정 동작
- [ ] 카메라 추적
- [ ] 2~6분할 테스트 동작

## Result
- Baseline Pass: [ ]
- Blockers:
  -
