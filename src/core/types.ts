export type QuizMode = 'random' | 'sequential';

export interface QuizScoreConfig {
  base: number;
  penalty: number;
  comboEnabled: boolean;
  comboBonus: number;
  timeBonusEnabled: boolean;
  timeBonusPerSec: number;
}

export interface QuizSettings {
  timeLimitSec: number;
  score: QuizScoreConfig;
  questionCount: number;
  selectionMode: QuizMode;
  avoidRepeat: boolean;
  shuffleChoices: boolean;
}

export interface QuizQuestion {
  id: string;
  type: string;
  prompt: string;
  question: string;
  answer: string;
  choices: string[];
  difficulty?: number;
  tags?: string[];
  meta?: Record<string, unknown>;
}

export interface QuizQuestionBank {
  version?: number;
  generatedAt?: string;
  count?: number;
  questions: QuizQuestion[];
}

export interface AnswerResult {
  correct: boolean;
  timeMs: number;
  questionId: string;
  scoreDelta: number;
  totalScore: number;
  combo: number;
  difficulty?: number;
}

export interface QuizStateSnapshot {
  settings: QuizSettings;
  totalScore: number;
  combo: number;
  answeredCount: number;
  correctCount: number;
  currentQuestion?: QuizQuestion;
  remainingQuestions: number;
}

export type QuizEvent =
  | { type: 'question'; payload: QuizQuestion }
  | { type: 'answer'; payload: AnswerResult }
  | { type: 'finish'; payload: { totalScore: number; correctCount: number; totalCount: number } };

export type QuizEventListener = (event: QuizEvent) => void;

