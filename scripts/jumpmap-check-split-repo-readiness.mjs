#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_EDITOR_DIR = path.resolve(projectRoot, '..', 'nolquiz-editor');
const DEFAULT_RUNTIME_DIR = path.resolve(projectRoot, '..', 'nolquiz-runtime');

const printHelp = () => {
  console.log(`jumpmap-check-split-repo-readiness\n\n` +
    `Usage:\n` +
    `  node scripts/jumpmap-check-split-repo-readiness.mjs [options]\n\n` +
    `Options:\n` +
    `  --editor-dir <dir>    Editor repo dir (default: ../nolquiz-editor)\n` +
    `  --runtime-dir <dir>   Runtime repo dir (default: ../nolquiz-runtime)\n` +
    `  --require-clean       Fail if any split repo worktree is dirty\n` +
    `  --require-origin      Fail if any split repo has no origin remote\n` +
    `  --require-ops-doc-no-tbd  Fail if repo-operations.md still contains (TBD)\n` +
    `  --strict              Enable all readiness gates above\n` +
    `  --help                Show help\n`);
};

const resolveMaybeRelative = (value, fallback) => {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
};

const parseArgs = (argv) => {
  const opts = {
    editorDir: DEFAULT_EDITOR_DIR,
    runtimeDir: DEFAULT_RUNTIME_DIR,
    requireClean: false,
    requireOrigin: false,
    requireOpsDocNoTbd: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--editor-dir') {
      opts.editorDir = resolveMaybeRelative(argv[i + 1], DEFAULT_EDITOR_DIR);
      i += 1;
      continue;
    }
    if (arg === '--runtime-dir') {
      opts.runtimeDir = resolveMaybeRelative(argv[i + 1], DEFAULT_RUNTIME_DIR);
      i += 1;
      continue;
    }
    if (arg === '--require-clean') {
      opts.requireClean = true;
      continue;
    }
    if (arg === '--require-origin') {
      opts.requireOrigin = true;
      continue;
    }
    if (arg === '--require-ops-doc-no-tbd') {
      opts.requireOpsDocNoTbd = true;
      continue;
    }
    if (arg === '--strict') {
      opts.requireClean = true;
      opts.requireOrigin = true;
      opts.requireOpsDocNoTbd = true;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
};

const runGit = (cwd, args) => {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trimEnd();
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).trim() : '';
    const stdout = error?.stdout ? String(error.stdout).trim() : '';
    const message = stderr || stdout || (error instanceof Error ? error.message : String(error));
    throw new Error(message);
  }
};

const inspectRepo = (label, dirPath) => {
  const out = {
    label,
    dirPath,
    exists: fs.existsSync(dirPath),
    isGitRepo: false,
    branch: '',
    latestCommit: '',
    clean: false,
    statusLines: [],
    remotes: [],
    originConfigured: false,
    opsDocExists: false,
    opsDocHasTbd: false
  };

  if (!out.exists) return out;

  const opsDoc = path.join(dirPath, 'docs', 'repo-operations.md');
  out.opsDocExists = fs.existsSync(opsDoc);
  if (out.opsDocExists) {
    const text = fs.readFileSync(opsDoc, 'utf8');
    out.opsDocHasTbd = text.includes('(TBD)');
  }

  try {
    runGit(dirPath, ['rev-parse', '--is-inside-work-tree']);
    out.isGitRepo = true;
  } catch {
    return out;
  }

  out.branch = runGit(dirPath, ['branch', '--show-current']);
  out.latestCommit = runGit(dirPath, ['log', '--oneline', '-1']);

  const status = runGit(dirPath, ['status', '--short', '--branch']);
  out.statusLines = status ? status.split('\n') : [];
  out.clean = out.statusLines.filter((line) => !line.startsWith('## ')).length === 0;

  const remotes = runGit(dirPath, ['remote', '-v']);
  out.remotes = remotes ? remotes.split('\n') : [];
  out.originConfigured = out.remotes.some((line) => line.startsWith('origin\t'));

  return out;
};

const mark = (ok, text, { required = false } = {}) => {
  if (ok) return `PASS ${text}`;
  return `${required ? 'FAIL' : 'WARN'} ${text}`;
};

const printRepo = (repo) => {
  console.log(`- ${repo.label}`);
  console.log(`  path      : ${repo.dirPath}`);
  console.log(`  exists    : ${repo.exists ? 'yes' : 'no'}`);
  if (!repo.exists) return;

  console.log(`  git repo  : ${repo.isGitRepo ? 'yes' : 'no'}`);
  if (!repo.isGitRepo) return;

  console.log(`  branch    : ${repo.branch || '(unknown)'}`);
  console.log(`  latest    : ${repo.latestCommit || '(none)'}`);
  console.log(`  clean     : ${repo.clean ? 'yes' : 'no'}`);
  console.log(`  origin    : ${repo.originConfigured ? 'configured' : 'missing'}`);
  console.log(`  ops doc   : ${repo.opsDocExists ? 'present' : 'missing'}${repo.opsDocExists ? (repo.opsDocHasTbd ? ' (TBD pending)' : '') : ''}`);
  if (repo.remotes.length) {
    console.log('  remotes   :');
    repo.remotes.forEach((line) => console.log(`    ${line}`));
  }
};

const main = () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const editor = inspectRepo('editor', opts.editorDir);
  const runtime = inspectRepo('runtime', opts.runtimeDir);
  const repos = [editor, runtime];

  console.log('[jumpmap-check-split-repo-readiness]');
  repos.forEach(printRepo);

  const allExist = repos.every((repo) => repo.exists);
  const allGit = repos.every((repo) => repo.isGitRepo);
  const allClean = repos.every((repo) => repo.isGitRepo && repo.clean);
  const allOpsDocs = repos.every((repo) => repo.opsDocExists);
  const allOrigin = repos.every((repo) => repo.originConfigured);
  const allOpsDocNoTbd = repos.every((repo) => repo.opsDocExists && !repo.opsDocHasTbd);

  console.log('[summary]');
  console.log(mark(allExist, 'split repo directories exist'));
  console.log(mark(allGit, 'split repos are git worktrees'));
  console.log(mark(allClean, 'split repos are clean', { required: opts.requireClean }));
  console.log(mark(allOpsDocs, 'repo operations docs present', { required: opts.requireOpsDocNoTbd }));
  console.log(mark(allOrigin, 'origin remotes configured', { required: opts.requireOrigin }));
  console.log(mark(allOpsDocNoTbd, 'repo operations docs have no (TBD) markers', { required: opts.requireOpsDocNoTbd }));

  const requiredFailures = (
    (opts.requireClean && !allClean) ||
    (opts.requireOrigin && !allOrigin) ||
    (opts.requireOpsDocNoTbd && (!allOpsDocs || !allOpsDocNoTbd))
  );

  if (!allExist || !allGit || requiredFailures) {
    process.exitCode = 1;
  }
};

try {
  main();
} catch (error) {
  console.error('[jumpmap-check-split-repo-readiness] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
