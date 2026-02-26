#!/usr/bin/env node

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_EDITOR_DIR = path.resolve(projectRoot, '..', 'nolquiz-editor');
const DEFAULT_RUNTIME_DIR = path.resolve(projectRoot, '..', 'nolquiz-runtime');

const printHelp = () => {
  console.log(
    [
      'jumpmap-r7-preflight',
      '',
      'Usage:',
      '  node scripts/jumpmap-r7-preflight.mjs [options]',
      '',
      'Runs the common R7 local preflight in order:',
      '  1) split repo readiness check',
      '  2) split scaffold apply',
      '  3) split verification',
      '',
      'Options:',
      '  --editor-dir <dir>            Editor split repo dir (default: ../nolquiz-editor)',
      '  --runtime-dir <dir>           Runtime split repo dir (default: ../nolquiz-runtime)',
      '  --strict-readiness            Run readiness check with --strict',
      '  --with-browser-e2e           Pass through to verify-split',
      '  --browser-e2e-headed         Pass through to verify-split',
      '  --browser-e2e-timeout-ms <n> Pass through to verify-split',
      '  --full-verify                Run verify-split without --skip-smoke',
      '  --help                       Show help'
    ].join('\n')
  );
};

const resolveMaybeRelative = (value, fallback) => {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
};

const parseArgs = (argv) => {
  const opts = {
    editorDir: DEFAULT_EDITOR_DIR,
    runtimeDir: DEFAULT_RUNTIME_DIR,
    strictReadiness: false,
    withBrowserE2E: false,
    browserE2EHeaded: false,
    browserE2ETimeoutMs: 0,
    fullVerify: false,
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
    if (arg === '--strict-readiness') {
      opts.strictReadiness = true;
      continue;
    }
    if (arg === '--with-browser-e2e') {
      opts.withBrowserE2E = true;
      continue;
    }
    if (arg === '--browser-e2e-headed') {
      opts.browserE2EHeaded = true;
      continue;
    }
    if (arg === '--browser-e2e-timeout-ms') {
      opts.browserE2ETimeoutMs = Number(argv[i + 1] || 0);
      i += 1;
      continue;
    }
    if (arg === '--full-verify') {
      opts.fullVerify = true;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
};

const runNodeScript = (scriptRelPath, scriptArgs) => {
  const scriptPath = path.join(projectRoot, scriptRelPath);
  const cmdLabel = ['node', scriptRelPath, ...scriptArgs].join(' ');
  console.log(`\n[preflight] ${cmdLabel}`);
  const result = spawnSync('node', [scriptPath, ...scriptArgs], {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    throw new Error(`step failed (${result.status ?? 'unknown'}): ${cmdLabel}`);
  }
};

const main = () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const sharedDirArgs = [
    '--editor-dir', opts.editorDir,
    '--runtime-dir', opts.runtimeDir
  ];

  const readinessArgs = [...sharedDirArgs, '--summary-lines'];
  if (opts.strictReadiness) readinessArgs.push('--strict');
  runNodeScript('scripts/jumpmap-check-split-repo-readiness.mjs', readinessArgs);

  runNodeScript('scripts/jumpmap-split-repos.mjs', [
    '--apply',
    '--force-merge',
    ...sharedDirArgs
  ]);

  const verifyArgs = [...sharedDirArgs];
  if (!opts.fullVerify) verifyArgs.push('--skip-smoke');
  if (opts.withBrowserE2E) verifyArgs.push('--with-browser-e2e');
  if (opts.browserE2EHeaded) verifyArgs.push('--browser-e2e-headed');
  if (opts.browserE2ETimeoutMs > 0) {
    verifyArgs.push('--browser-e2e-timeout-ms', String(opts.browserE2ETimeoutMs));
  }
  runNodeScript('scripts/jumpmap-verify-split.mjs', verifyArgs);

  console.log('\n[preflight] PASS');
};

try {
  main();
} catch (error) {
  console.error('\n[jumpmap-r7-preflight] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
