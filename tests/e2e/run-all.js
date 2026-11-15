#!/usr/bin/env node
/**
 * Master E2E Test Suite Runner for Atlas & Helios PropertyInsight AI Platform
 * Automatically ensures server availability via server-harness, executes test files,
 * reports formatted results, and exits with standard exit codes.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serverHarness } from './helpers/server-harness.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

async function main() {
  console.log('='.repeat(70));
  console.log(' ATLAS & HELIOS PLATFORM — E2E TEST SUITE RUNNER');
  console.log('='.repeat(70));

  // Determine requested tier or run all available (defaults to all)
  const args = process.argv.slice(2);
  let tierFilter = 'all';
  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      tierFilter = arg.split('=')[1].trim();
    } else if (arg === '--all') {
      tierFilter = 'all';
    }
  }

  // 1. Ensure backend server is running
  console.log('🔍 Probing server status and initializing harness...');
  try {
    const serverInfo = await serverHarness.ensureServer(3099);
    console.log(`✅ Server online at ${serverInfo.baseUrl} (managed: ${serverInfo.isManaged})`);
  } catch (err) {
    console.error(`❌ Server harness failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Discover test files
  const testDirs = [];
  if (tierFilter === 'all' || tierFilter === 'tier1') {
    testDirs.push(path.join(__dirname, 'tier1-coverage'));
  }
  if (tierFilter === 'all' || tierFilter === 'tier2') {
    const p = path.join(__dirname, 'tier2-boundaries');
    if (fs.existsSync(p)) testDirs.push(p);
  }
  if (tierFilter === 'all' || tierFilter === 'tier3') {
    const p = path.join(__dirname, 'tier3-combinations');
    if (fs.existsSync(p)) testDirs.push(p);
  }
  if (tierFilter === 'all' || tierFilter === 'tier4') {
    const p = path.join(__dirname, 'tier4-scenarios');
    if (fs.existsSync(p)) testDirs.push(p);
  }

  const testFiles = [];
  for (const dir of testDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.test.js'))
        .map(f => path.relative(ROOT_DIR, path.join(dir, f)));
      testFiles.push(...files);
    }
  }

  if (testFiles.length === 0) {
    console.warn('⚠️ No test files matched the filter:', tierFilter);
    serverHarness.stopServer();
    process.exit(0);
  }

  console.log(`📋 Running ${testFiles.length} test suite(s):`);
  testFiles.forEach(f => console.log(`   - ${f}`));
  console.log('-'.repeat(70));

  // 3. Execute node --test
  const testProcess = spawn('node', ['--test', ...testFiles], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_API_URL: serverHarness.getBaseUrl()
    }
  });

  testProcess.on('close', (code) => {
    console.log('-'.repeat(70));
    console.log(`🏁 Test run finished with exit code: ${code}`);
    serverHarness.stopServer();
    process.exit(code || 0);
  });

  testProcess.on('error', (err) => {
    console.error('❌ Failed to spawn test process:', err);
    serverHarness.stopServer();
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Unhandled fatal error in run-all.js:', err);
  serverHarness.stopServer();
  process.exit(1);
});
