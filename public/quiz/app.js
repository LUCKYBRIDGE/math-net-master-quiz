import { createQuizEngine } from './core/engine.js';
import { buildWeightedQuestionBank } from './core/bank.js';
import { validateQuestionBank } from './core/validate.js';

const $ = (selector) => document.querySelector(selector);

const settingsCard = $('#settings-card');
const quizCard = $('#quiz-card');
const summaryCard = $('#summary-card');

const progressEl = $('#progress');
const scoreEl = $('#score');
const accuracyEl = $('#accuracy');
const comboEl = $('#combo');
const promptEl = $('#prompt');
const questionImg = $('#question-img');
const choicesEl = $('#choices');
const feedbackEl = $('#feedback');
const timerEl = $('#timer');
const logOutputEl = $('#log-output');
const loadStatusEl = $('#load-status');

const startBtn = $('#start-btn');
const resetBtn = $('#reset-btn');
const restartBtn = $('#restart-btn');
const copyLogBtn = $('#copy-log-btn');
const downloadLogBtn = $('#download-log-btn');

const settingsInputs = {
  count: $('#setting-count'),
  student: $('#setting-student'),
  mode: $('#setting-mode'),
  repeat: $('#setting-repeat'),
  shuffle: $('#setting-shuffle'),
  time: $('#setting-time'),
  score: $('#setting-score'),
  penalty: $('#setting-penalty'),
  combo: $('#setting-combo'),
  comboBonus: $('#setting-combo-bonus'),
  timeBonus: $('#setting-time-bonus'),
  timeBonusPer: $('#setting-time-bonus-per')
};

const typeInputs = {
  facecolor: {
    enabled: $('#type-facecolor-enabled'),
    weight: $('#type-facecolor-weight')
  },
  edgecolor: {
    enabled: $('#type-edgecolor-enabled'),
    weight: $('#type-edgecolor-weight')
  },
  validity: {
    enabled: $('#type-validity-enabled'),
    weight: $('#type-validity-weight')
  }
};

let questionBank = null;
let defaultSettings = null;
let engine = null;
let currentQuestion = null;
let timerId = null;
let locked = false;
let answerLog = [];
let sessionSettings = null;

const banks = {};

const loadJson = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
};

const applyDefaultSettings = (settings) => {
  settingsInputs.count.value = settings.questionCount;
  settingsInputs.student.value = settings.studentId || '01';
  settingsInputs.mode.value = settings.selectionMode;
  settingsInputs.repeat.value = settings.avoidRepeat ? 'true' : 'false';
  settingsInputs.shuffle.value = settings.shuffleChoices ? 'true' : 'false';
  settingsInputs.time.value = settings.timeLimitSec;
  settingsInputs.score.value = settings.score.base;
  settingsInputs.penalty.value = settings.score.penalty;
  settingsInputs.combo.value = settings.score.comboEnabled ? 'true' : 'false';
  settingsInputs.comboBonus.value = settings.score.comboBonus;
  settingsInputs.timeBonus.value = settings.score.timeBonusEnabled ? 'true' : 'false';
  settingsInputs.timeBonusPer.value = settings.score.timeBonusPerSec;

  const defaults = settings.questionTypes || {
    facecolor: { enabled: true, weight: 100 },
    edgecolor: { enabled: false, weight: 0 },
    validity: { enabled: false, weight: 0 }
  };

  Object.entries(typeInputs).forEach(([key, fields]) => {
    const config = defaults[key] || { enabled: false, weight: 0 };
    fields.enabled.value = config.enabled ? 'true' : 'false';
    fields.weight.value = config.weight;
  });
};

const readSettings = () => {
  const studentIdRaw = (settingsInputs.student.value || '').trim();
  const studentId = (/^\d{1,2}$/.test(studentIdRaw) ? studentIdRaw : '01').padStart(2, '0');

  const questionTypes = {};
  Object.entries(typeInputs).forEach(([key, fields]) => {
    questionTypes[key] = {
      enabled: fields.enabled.value === 'true',
      weight: Number(fields.weight.value) || 0
    };
  });

  return {
    studentId,
    questionTypes,
    timeLimitSec: Number(settingsInputs.time.value) || 0,
    score: {
      base: Number(settingsInputs.score.value) || 0,
      penalty: Number(settingsInputs.penalty.value) || 0,
      comboEnabled: settingsInputs.combo.value === 'true',
      comboBonus: Number(settingsInputs.comboBonus.value) || 0,
      timeBonusEnabled: settingsInputs.timeBonus.value === 'true',
      timeBonusPerSec: Number(settingsInputs.timeBonusPer.value) || 0
    },
    questionCount: Number(settingsInputs.count.value) || 10,
    selectionMode: settingsInputs.mode.value,
    avoidRepeat: settingsInputs.repeat.value === 'true',
    shuffleChoices: settingsInputs.shuffle.value === 'true'
  };
};

const setFeedback = (message, type) => {
  feedbackEl.textContent = message;
  feedbackEl.classList.remove('success', 'fail');
  if (type) feedbackEl.classList.add(type);
};

const setLoadStatus = (message, type) => {
  if (!loadStatusEl) return;
  loadStatusEl.textContent = message;
  loadStatusEl.classList.remove('success', 'fail');
  if (type) loadStatusEl.classList.add(type);
};

const clearTimer = () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
};

const startTimer = (limitSec) => {
  clearTimer();
  if (!limitSec) {
    timerEl.textContent = '-';
    return;
  }
  let remaining = limitSec;
  timerEl.textContent = `${remaining}s`;
  timerId = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearTimer();
      timerEl.textContent = '0s';
      handleAnswer(null, true);
      return;
    }
    timerEl.textContent = `${remaining}s`;
  }, 1000);
};

const updateHeader = () => {
  const state = engine.getState();
  const total = state.settings.questionCount;
  progressEl.textContent = `${state.answeredCount}/${total}`;
  scoreEl.textContent = `${state.totalScore}`;
  comboEl.textContent = `${state.combo}`;
  const accuracy = state.answeredCount
    ? Math.round((state.correctCount / state.answeredCount) * 100)
    : 0;
  accuracyEl.textContent = `${accuracy}%`;
};

const renderQuestion = (question) => {
  currentQuestion = question;
  promptEl.textContent = question.prompt;
  questionImg.src = `./nets/${question.question}`;
  choicesEl.innerHTML = '';
  setFeedback('', null);
  locked = false;

  question.choices.forEach((choice) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.dataset.choice = choice;
    const img = document.createElement('img');
    img.src = `./nets/${choice}`;
    img.alt = 'choice';
    btn.appendChild(img);
    btn.addEventListener('click', () => handleAnswer(choice, false));
    choicesEl.appendChild(btn);
  });

  startTimer(engine.getState().settings.timeLimitSec);
};

const finishQuiz = () => {
  settingsCard.classList.add('hidden');
  quizCard.classList.add('hidden');
  summaryCard.classList.remove('hidden');
  const state = engine.getState();
  const total = state.settings.questionCount;
  const accuracy = state.answeredCount
    ? Math.round((state.correctCount / state.answeredCount) * 100)
    : 0;
  $('#summary-text').textContent = `점수 ${state.totalScore}점 · 정답 ${state.correctCount}/${total} (${accuracy}%)`;

  const payload = {
    settings: sessionSettings,
    summary: {
      totalScore: state.totalScore,
      correctCount: state.correctCount,
      totalCount: state.answeredCount,
      accuracy
    },
    answers: answerLog
  };

  if (logOutputEl) {
    logOutputEl.value = JSON.stringify(payload, null, 2);
  }
};

const handleAnswer = (choice, isTimeout) => {
  if (locked || !currentQuestion) return;
  locked = true;
  clearTimer();
  const answerChoice = choice ?? '';
  const result = engine.submitAnswer(answerChoice);
  if (!result) return;

  answerLog.push({
    questionId: currentQuestion.id,
    question: currentQuestion.question,
    answer: currentQuestion.answer,
    choice: choice ?? null,
    correct: result.correct,
    timeMs: result.timeMs,
    scoreDelta: result.scoreDelta,
    totalScore: result.totalScore,
    combo: result.combo,
    type: currentQuestion.type
  });

  const buttons = [...choicesEl.querySelectorAll('.choice-btn')];
  buttons.forEach((btn) => {
    const value = btn.dataset.choice;
    if (value === currentQuestion.answer) btn.classList.add('correct');
    if (value === choice && value !== currentQuestion.answer) btn.classList.add('wrong');
  });

  if (result.correct) {
    setFeedback('정답입니다!', 'success');
  } else {
    setFeedback(isTimeout ? '시간 초과! 오답입니다.' : '오답입니다.', 'fail');
  }

  updateHeader();

  const delay = result.correct ? 800 : 3000;
  setTimeout(() => {
    const next = engine.nextQuestion();
    if (next) {
      renderQuestion(next);
    } else {
      finishQuiz();
    }
  }, delay);
};

const startQuiz = () => {
  const settings = readSettings();
  sessionSettings = settings;
  answerLog = [];
  if (logOutputEl) logOutputEl.value = '';
  questionBank = buildWeightedQuestionBank(banks, settings);
  settings.questionCount = questionBank.questions.length;
  engine = createQuizEngine({
    questionBank,
    settings
  });
  quizCard.classList.remove('hidden');
  summaryCard.classList.add('hidden');
  settingsCard.classList.add('hidden');

  updateHeader();
  const first = engine.nextQuestion();
  if (first) renderQuestion(first);
};

const resetSettings = () => {
  if (defaultSettings) applyDefaultSettings(defaultSettings);
};

const restartQuiz = () => {
  settingsCard.classList.remove('hidden');
  quizCard.classList.add('hidden');
  summaryCard.classList.add('hidden');
  clearTimer();
};

const init = async () => {
  try {
    banks.facecolor = await loadJson('./data/facecolor-questions.json');
    banks.edgecolor = await loadJson('./data/edgecolor-questions.json');
    banks.validity = await loadJson('./data/validity-questions.json');
  } catch (err) {
    console.error(err);
    setLoadStatus('문제 데이터를 불러오지 못했습니다. 새로고침 해주세요.', 'fail');
    startBtn.disabled = true;
    return;
  }

  const validations = Object.entries(banks).flatMap(([key, bank]) => {
    const result = validateQuestionBank(bank);
    if (!result.valid) {
      console.warn(`${key} bank invalid`, result.errors);
    }
    return result.errors.map(err => `${key}: ${err}`);
  });

  if (validations.length) {
    setLoadStatus(`문제 데이터 오류 ${validations.length}건 발견`, 'fail');
    startBtn.disabled = true;
  } else {
    setLoadStatus('문제 데이터 로드 완료', 'success');
  }
  defaultSettings = await loadJson('./data/quiz-settings.default.json');
  applyDefaultSettings(defaultSettings);

  startBtn.addEventListener('click', startQuiz);
  resetBtn.addEventListener('click', resetSettings);
  restartBtn.addEventListener('click', restartQuiz);

  copyLogBtn?.addEventListener('click', async () => {
    if (!logOutputEl?.value) return;
    try {
      await navigator.clipboard.writeText(logOutputEl.value);
      copyLogBtn.textContent = '복사됨!';
      setTimeout(() => (copyLogBtn.textContent = 'JSON 복사'), 1500);
    } catch (err) {
      console.warn('copy failed', err);
    }
  });

  downloadLogBtn?.addEventListener('click', () => {
    if (!logOutputEl?.value) return;
    const blob = new Blob([logOutputEl.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-result-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

init();
