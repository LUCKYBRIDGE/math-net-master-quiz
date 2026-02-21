# Jumpmap Asset Profile Spec

Date: 2026-02-06
Scope: `quiz_plate` 기반 오브젝트 정규화 + 확정 팔레트 재사용 포맷
Status: `Phase 5` 기준 에디터 반영 완료 (`editor.js`, `map-io-utils.js`)

## 1) 목표
- 맵 배치 전에 오브젝트별 `trim/crop/scale/hitbox`를 확정해 재작업을 줄인다.
- 동일 오브젝트를 반복 배치할 때 동일 충돌/크기/자르기 결과를 보장한다.

## 2) 원칙
- 원본 PNG는 수정하지 않는다.
- 정규화 결과는 프로파일(JSON)로 저장한다.
- 프로파일 적용은 idempotent 해야 한다(같은 프로파일 반복 적용 시 결과 동일).

## 3) 권장 데이터 구조
```json
{
  "version": 1,
  "sprites": {
    "plate_A.png": {
      "source": "../quiz_plate/plate_A.png",
      "defaultScale": 0.55,
      "crop": { "x": 0, "y": 0, "w": 512, "h": 320 },
      "hitboxes": [
        { "x": 12, "y": 281, "w": 487, "h": 39, "locked": false }
      ],
      "meta": {
        "updatedAt": "2026-02-06T00:00:00Z",
        "note": "기본 발판"
      }
    }
  }
}
```

## 4) 필드 규칙
- `defaultScale`: `0.05 ~ 20`
- `crop`: 음수 금지, `w/h >= 1`
- `hitboxes`: 최소 1개 권장, 다중 허용
- `source`: 원본 경로(읽기 전용 참조)

## 5) 확정 팔레트 적용 순서
1. 오브젝트 배치
2. 해당 `sprite` 프로파일 조회
3. `defaultScale` 적용
4. `crop` 적용
5. `hitboxes` 깊은 복사 적용
6. 선택 상태 전환

## 6) 충돌 방지 규칙
- 프로파일 없는 sprite는 기존 fallback 유지
- 프로파일 로드 실패 시 전체 중단하지 않고 해당 sprite만 fallback
- 잘못된 hitbox 행은 제외하고 warning 기록

## 7) 다음 구현 대상
- 프로파일 저장/불러오기 버튼
- `hitboxPresets` + `spriteDefaults` + `crop` 통합 저장
- 팔레트 카드에 "프로파일 적용됨" 배지
