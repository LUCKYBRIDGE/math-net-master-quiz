import type { QuizQuestion, QuizQuestionBank } from './types';

const isString = (value: unknown): value is string => typeof value === 'string';
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const validateQuestion = (question: QuizQuestion, index: number, errors: string[]) => {
  if (!question.id) errors.push(`questions[${index}].id is required`);
  if (!isString(question.type)) errors.push(`questions[${index}].type must be string`);
  if (!isString(question.prompt)) errors.push(`questions[${index}].prompt must be string`);
  if (!isString(question.question)) errors.push(`questions[${index}].question must be string`);
  if (!isString(question.answer)) errors.push(`questions[${index}].answer must be string`);
  if (!isStringArray(question.choices) || question.choices.length < 2) {
    errors.push(`questions[${index}].choices must be string array (length >= 2)`);
  }
};

export const validateQuestionBank = (bank: QuizQuestionBank) => {
  const errors: string[] = [];
  if (!bank || !Array.isArray(bank.questions)) {
    return { valid: false, errors: ['questions array is required'] };
  }

  bank.questions.forEach((question, index) => validateQuestion(question, index, errors));
  return { valid: errors.length === 0, errors };
};
