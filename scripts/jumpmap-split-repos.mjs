#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_RUNTIME_DIR = path.resolve(projectRoot, '..', 'nolquiz-runtime');
const DEFAULT_EDITOR_DIR = path.resolve(projectRoot, '..', 'nolquiz-editor');

const RUNTIME_PATHS = [
  'public/index.html',
  'public/.nojekyll',
  'public/play',
  'public/jumpmap-play',
  'public/jumpmap-runtime',
  'public/quiz',
  'public/shared',
  'public/quiz_background',
  'public/quiz_plate',
  'public/quiz_sejong',
  'public/quiz_poster',
  'docs/contracts',
  'docs/jumpmap-runtime-quiz-plan.md',
  'docs/jumpmap-runtime-quiz-checklist.md',
  'docs/repo-split-execution-plan.md',
  'scripts/jumpmap-local-serve.mjs',
  'scripts/jumpmap-phase6-validate.mjs'
];

const EDITOR_PATHS = [
  'public/jumpmap-editor',
  'public/quiz_background',
  'public/quiz_plate',
  'public/quiz_sejong',
  'public/quiz_poster',
  'save_map',
  'scripts/jumpmap-local-serve.mjs',
  'scripts/jumpmap-sync-plates.mjs',
  'scripts/jumpmap-publish-runtime-map.mjs',
  'scripts/jumpmap-sync-runtime-legacy-physics.mjs',
  'scripts/jumpmap-sync-runtime-legacy-compat-source-html.mjs',
  'scripts/jumpmap-sync-runtime-legacy-compat-assets.mjs',
  'scripts/jumpmap-verify-legacy-compat-fallback-logic.mjs',
  'scripts/jumpmap-verify-legacy-compat-inject-logic.mjs',
  'scripts/jumpmap-verify-legacy-compat-pipeline.mjs',
  'scripts/jumpmap-verify-legacy-compat-e2e.mjs',
  'scripts/jumpmap-audit-legacy-play-paths.mjs',
  'scripts/jumpmap-audit-legacy-compat-assets.mjs',
  'scripts/jumpmap-verify-split.mjs',
  'scripts/jumpmap-phase6-validate.mjs',
  'docs/contracts',
  'docs/jumpmap-editor-plan.md',
  'docs/jumpmap-editor-guidelines.md',
  'docs/jumpmap-editor-phase6-checklist.md',
  'docs/jumpmap-local-workflow.md'
];

const RUNTIME_REQUIRED_PATHS = [
  'public/index.html',
  'public/play/index.html',
  'public/play/app.js',
  'public/jumpmap-play/index.html',
  'public/jumpmap-play/app.js',
  'public/jumpmap-runtime/index.html',
  'public/jumpmap-runtime/app.js',
  'public/jumpmap-runtime/legacy/index.html',
  'public/jumpmap-runtime/legacy/app.js',
  'public/jumpmap-runtime/legacy/compat/index.html',
  'public/jumpmap-runtime/legacy/compat/app.js',
  'public/jumpmap-runtime/legacy/compat/runtime-owned/index.html',
  'public/jumpmap-runtime/legacy/compat/runtime-owned/editor.js',
  'public/jumpmap-runtime/legacy/compat/runtime-owned/textures/hanji.svg',
  'public/jumpmap-runtime/legacy/compat/quiz/core/engine.js',
  'public/jumpmap-runtime/legacy/compat/quiz/data/quiz-settings.default.json',
  'public/jumpmap-runtime/legacy/compat/quiz/nets/cube-01.svg',
  'public/jumpmap-runtime/legacy/compat/shared/local-game-records.js',
  'public/jumpmap-runtime/legacy/compat/quiz_background/Geumgangjeondo.jpg',
  'public/jumpmap-runtime/legacy/compat/quiz_plate/plate_canon.png',
  'public/jumpmap-runtime/legacy/compat/quiz_sejong/sejong_walk1.png',
  'public/shared/jumpmap-runtime-launcher.js',
  'public/shared/maps/jumpmap-01.json',
  'scripts/jumpmap-local-serve.mjs'
];

const RUNTIME_PRUNE_PATHS = [
  'public/jumpmap-editor'
];

const EDITOR_PRUNE_PATHS = [
  'docs/jumpmap-editor-status.md'
];

const EDITOR_REQUIRED_PATHS = [
  'public/jumpmap-editor/index.html',
  'public/jumpmap-editor/editor.js',
  'public/jumpmap-editor/map-io-utils.js',
  'scripts/jumpmap-local-serve.mjs',
  'scripts/jumpmap-publish-runtime-map.mjs',
  'scripts/jumpmap-sync-runtime-legacy-physics.mjs',
  'scripts/jumpmap-sync-runtime-legacy-compat-source-html.mjs',
  'scripts/jumpmap-sync-runtime-legacy-compat-assets.mjs',
  'scripts/jumpmap-verify-legacy-compat-fallback-logic.mjs',
  'scripts/jumpmap-verify-legacy-compat-inject-logic.mjs',
  'scripts/jumpmap-verify-legacy-compat-pipeline.mjs',
  'scripts/jumpmap-verify-legacy-compat-e2e.mjs',
  'scripts/jumpmap-audit-legacy-play-paths.mjs',
  'scripts/jumpmap-audit-legacy-compat-assets.mjs',
  'docs/contracts/legacy-play-path-audit.json',
  'docs/contracts/legacy-compat-asset-audit.json',
  'save_map/jumpmap-01.json'
];

const printHelp = () => {
  console.log(`jumpmap-split-repos\n\n` +
    `Usage:\n` +
    `  node scripts/jumpmap-split-repos.mjs [options]\n\n` +
    `Options:\n` +
    `  --apply                  Apply copy (default: dry-run)\n` +
    `  --runtime-dir <dir>      Runtime repo target dir (default: ../nolquiz-runtime)\n` +
    `  --editor-dir <dir>       Editor repo target dir (default: ../nolquiz-editor)\n` +
    `  --force-merge            Allow merge into existing non-empty target directories\n` +
    `  --no-verify              Skip required path verification after apply\n` +
    `  --help                   Show this help\n\n` +
    `Examples:\n` +
    `  node scripts/jumpmap-split-repos.mjs\n` +
    `  node scripts/jumpmap-split-repos.mjs --apply\n` +
    `  node scripts/jumpmap-split-repos.mjs --apply --runtime-dir ../quiz-game-suite --editor-dir ../jumpmap-editor-studio\n`);
};

const resolveMaybeRelative = (value, fallback) => {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
};

const parseArgs = (argv) => {
  const opts = {
    apply: false,
    runtimeDir: DEFAULT_RUNTIME_DIR,
    editorDir: DEFAULT_EDITOR_DIR,
    forceMerge: false,
    noVerify: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--apply') {
      opts.apply = true;
      continue;
    }
    if (arg === '--force-merge') {
      opts.forceMerge = true;
      continue;
    }
    if (arg === '--no-verify') {
      opts.noVerify = true;
      continue;
    }
    if (arg === '--runtime-dir') {
      opts.runtimeDir = resolveMaybeRelative(argv[i + 1], DEFAULT_RUNTIME_DIR);
      i += 1;
      continue;
    }
    if (arg === '--editor-dir') {
      opts.editorDir = resolveMaybeRelative(argv[i + 1], DEFAULT_EDITOR_DIR);
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return opts;
};

const isDirEmpty = (dirPath) => {
  if (!fs.existsSync(dirPath)) return true;
  if (!fs.statSync(dirPath).isDirectory()) return false;
  return fs.readdirSync(dirPath).length === 0;
};

const collectStats = (srcPath) => {
  const stat = fs.statSync(srcPath);
  if (stat.isFile()) return { files: 1, bytes: stat.size };
  if (!stat.isDirectory()) return { files: 0, bytes: 0 };
  let files = 0;
  let bytes = 0;
  const walk = (dirPath) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    entries.forEach((entry) => {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files += 1;
        bytes += fs.statSync(full).size;
      }
    });
  };
  walk(srcPath);
  return { files, bytes };
};

const formatBytes = (n) => {
  const value = Number(n) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const ensureSourcePaths = (paths) => {
  const missing = [];
  const existing = [];
  paths.forEach((rel) => {
    const src = path.join(projectRoot, rel);
    if (fs.existsSync(src)) existing.push(rel);
    else missing.push(rel);
  });
  return { missing, existing };
};

const copyPath = (relPath, targetRoot) => {
  const src = path.join(projectRoot, relPath);
  const dst = path.join(targetRoot, relPath);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, {
    recursive: true,
    force: true,
    errorOnExist: false,
    preserveTimestamps: true
  });
};

const writeSplitReadme = (targetRoot, mode, paths) => {
  const targetFile = path.join(targetRoot, 'SPLIT_SCAFFOLD.md');
  const content = [
    `# ${mode === 'runtime' ? '놀퀴즈 Runtime' : '놀퀴즈 Jumpmap Editor'} (scaffold)`,
    '',
    `생성 시각: ${new Date().toISOString()}`,
    `소스: ${projectRoot}`,
    '',
    '## 포함 경로',
    ...paths.map((item) => `- ${item}`),
    '',
    '이 스캐폴드는 자동 복제 결과이며, 레포 분리 후 경로/배포/검증 스크립트를 이어서 정리해야 합니다.'
  ].join('\n');
  const nextContent = `${content}\n`;
  if (fs.existsSync(targetFile)) {
    const prevContent = fs.readFileSync(targetFile, 'utf8');
    const normalize = (text) => String(text || '').replace(/^생성 시각: .*$/m, '생성 시각: <normalized>');
    if (normalize(prevContent) === normalize(nextContent)) {
      return;
    }
  }
  fs.writeFileSync(targetFile, nextContent, 'utf8');
};

const verifyRequiredPaths = (targetRoot, requiredPaths) => {
  const missing = [];
  requiredPaths.forEach((relPath) => {
    const absolute = path.join(targetRoot, relPath);
    if (!fs.existsSync(absolute)) {
      missing.push(relPath);
    }
  });
  return missing;
};

const verifyForbiddenPaths = (targetRoot, forbiddenPaths) => {
  const present = [];
  forbiddenPaths.forEach((relPath) => {
    const absolute = path.join(targetRoot, relPath);
    if (fs.existsSync(absolute)) {
      present.push(relPath);
    }
  });
  return present;
};

const prunePaths = (targetRoot, relPaths) => {
  const removed = [];
  relPaths.forEach((relPath) => {
    const absolute = path.join(targetRoot, relPath);
    if (!fs.existsSync(absolute)) return;
    fs.rmSync(absolute, { recursive: true, force: true });
    removed.push(relPath);
  });
  return removed;
};

const runSide = ({ label, targetRoot, paths, apply, forceMerge }) => {
  const { existing, missing } = ensureSourcePaths(paths);
  const summary = {
    label,
    targetRoot,
    selected: paths.length,
    existingCount: existing.length,
    missing,
    files: 0,
    bytes: 0
  };

  existing.forEach((rel) => {
    const stat = collectStats(path.join(projectRoot, rel));
    summary.files += stat.files;
    summary.bytes += stat.bytes;
  });

  if (!apply) return summary;

  if (!isDirEmpty(targetRoot) && !forceMerge) {
    throw new Error(`${label} target is not empty: ${targetRoot} (use --force-merge to allow merge)`);
  }

  fs.mkdirSync(targetRoot, { recursive: true });
  existing.forEach((rel) => copyPath(rel, targetRoot));
  if (label === 'runtime') {
    prunePaths(targetRoot, RUNTIME_PRUNE_PATHS);
  }
  if (label === 'editor') {
    prunePaths(targetRoot, EDITOR_PRUNE_PATHS);
  }
  writeSplitReadme(targetRoot, label === 'runtime' ? 'runtime' : 'editor', existing);
  return summary;
};

const main = () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const runtimeSummary = runSide({
    label: 'runtime',
    targetRoot: opts.runtimeDir,
    paths: RUNTIME_PATHS,
    apply: opts.apply,
    forceMerge: opts.forceMerge
  });

  const editorSummary = runSide({
    label: 'editor',
    targetRoot: opts.editorDir,
    paths: EDITOR_PATHS,
    apply: opts.apply,
    forceMerge: opts.forceMerge
  });

  const title = opts.apply
    ? '[jumpmap-split-repos] scaffold applied'
    : '[jumpmap-split-repos] dry-run';
  console.log(title);

  [runtimeSummary, editorSummary].forEach((item) => {
    console.log(`- ${item.label}`);
    console.log(`  target : ${item.targetRoot}`);
    console.log(`  paths  : ${item.existingCount}/${item.selected} available`);
    console.log(`  files  : ${item.files}`);
    console.log(`  bytes  : ${formatBytes(item.bytes)}`);
    if (item.missing.length) {
      console.log(`  missing: ${item.missing.join(', ')}`);
    }
  });

  if (opts.apply && !opts.noVerify) {
    const runtimeMissing = verifyRequiredPaths(opts.runtimeDir, RUNTIME_REQUIRED_PATHS);
    const editorMissing = verifyRequiredPaths(opts.editorDir, EDITOR_REQUIRED_PATHS);
    const runtimeForbiddenPresent = verifyForbiddenPaths(opts.runtimeDir, RUNTIME_PRUNE_PATHS);
    const editorForbiddenPresent = verifyForbiddenPaths(opts.editorDir, EDITOR_PRUNE_PATHS);
    console.log('[jumpmap-split-repos] required-path verification');
    console.log(`- runtime required: ${RUNTIME_REQUIRED_PATHS.length - runtimeMissing.length}/${RUNTIME_REQUIRED_PATHS.length}`);
    console.log(`- editor required : ${EDITOR_REQUIRED_PATHS.length - editorMissing.length}/${EDITOR_REQUIRED_PATHS.length}`);
    console.log(`- runtime forbidden absent: ${RUNTIME_PRUNE_PATHS.length - runtimeForbiddenPresent.length}/${RUNTIME_PRUNE_PATHS.length}`);
    console.log(`- editor forbidden absent : ${EDITOR_PRUNE_PATHS.length - editorForbiddenPresent.length}/${EDITOR_PRUNE_PATHS.length}`);
    if (runtimeMissing.length) {
      console.log(`  runtime missing: ${runtimeMissing.join(', ')}`);
    }
    if (editorMissing.length) {
      console.log(`  editor missing : ${editorMissing.join(', ')}`);
    }
    if (runtimeForbiddenPresent.length) {
      console.log(`  runtime forbidden present: ${runtimeForbiddenPresent.join(', ')}`);
    }
    if (editorForbiddenPresent.length) {
      console.log(`  editor forbidden present : ${editorForbiddenPresent.join(', ')}`);
    }
    if (runtimeMissing.length || editorMissing.length || runtimeForbiddenPresent.length || editorForbiddenPresent.length) {
      throw new Error('required-path verification failed');
    }
  }
};

try {
  main();
} catch (error) {
  console.error('[jumpmap-split-repos] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
