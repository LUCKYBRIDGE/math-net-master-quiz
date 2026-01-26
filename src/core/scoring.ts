import type { QuizSettings } from './types';

export interface ScoreResult {
  scoreDelta: number;
  nextCombo: number;
}

const roundScore = (value: number) => Math.round(value);

export const computeScore = (
  correct: boolean,
  timeMs: number,
  combo: number,
  settings: QuizSettings
): ScoreResult => {
  const { score, timeLimitSec } = settings;

  if (!correct) {
    const penalty = score.penalty > 0 ? -score.penalty : 0;
    return { scoreDelta: penalty, nextCombo: 0 };
  }

  const nextCombo = combo + 1;
  const comboBonus = score.comboEnabled ? score.comboBonus * Math.max(0, nextCombo - 1) : 0;

  let timeBonus = 0;
  if (score.timeBonusEnabled && timeLimitSec > 0 && score.timeBonusPerSec > 0) {
    const remainingSec = Math.max(0, timeLimitSec - timeMs / 1000);
    timeBonus = remainingSec * score.timeBonusPerSec;
  }

  const scoreDelta = roundScore(score.base + comboBonus + timeBonus);
  return { scoreDelta, nextCombo };
};
