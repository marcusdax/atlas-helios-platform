/**
 * Bridge Runner Helper for Atlas & Helios E2E Test Suite
 * Executes Python CLI bridges (bridge_homeharvest.py, bridge_nexus.py, bridge_perception.py)
 * via child_process.execFile and safely parses JSON responses.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.resolve(__dirname, '../../../server');

/**
 * Execute a python bridge script with method and JSON arguments
 * @param {string} scriptName - e.g. 'bridge_homeharvest.py'
 * @param {string} method - method name
 * @param {Object} params - parameters dictionary
 * @param {Object} options - additional exec options (timeout, cwd, etc.)
 */
export async function runBridge(scriptName, method, params = {}, options = {}) {
  const scriptPath = path.join(SERVER_DIR, scriptName);
  const jsonParam = typeof params === 'string' ? params : JSON.stringify(params);
  const timeoutMs = options.timeoutMs || 25000;

  try {
    const { stdout, stderr } = await execFileAsync(
      'python',
      [scriptPath, method, jsonParam],
      {
        cwd: SERVER_DIR,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PYTHONIOENCODING: 'utf-8'
        }
      }
    );

    let parsedData = null;
    let isJson = false;

    try {
      parsedData = JSON.parse(stdout);
      isJson = true;
    } catch {
      // Sometimes stdout contains preamble before JSON
      const firstBrace = stdout.indexOf('{');
      const firstBracket = stdout.indexOf('[');
      const startIdx = (firstBrace !== -1 && firstBracket !== -1)
        ? Math.min(firstBrace, firstBracket)
        : (firstBrace !== -1 ? firstBrace : firstBracket);

      if (startIdx !== -1) {
        try {
          parsedData = JSON.parse(stdout.slice(startIdx));
          isJson = true;
        } catch {
          parsedData = null;
        }
      }
    }

    return {
      success: true,
      exitCode: 0,
      data: parsedData,
      isJson,
      rawOutput: stdout,
      stderr: stderr || ''
    };
  } catch (error) {
    let parsedData = null;
    if (error.stdout) {
      try {
        parsedData = JSON.parse(error.stdout);
      } catch {
        parsedData = null;
      }
    }

    return {
      success: false,
      exitCode: error.code || 1,
      data: parsedData,
      isJson: parsedData !== null,
      rawOutput: error.stdout || '',
      stderr: error.stderr || error.message,
      errorMessage: error.message
    };
  }
}

/**
 * Convenient typed wrapper for HomeHarvest bridge
 */
export async function runHomeHarvest(method, params = {}, options = {}) {
  return runBridge('bridge_homeharvest.py', method, params, options);
}

/**
 * Convenient typed wrapper for Nexus Mind bridge
 */
export async function runNexus(method, params = {}, options = {}) {
  return runBridge('bridge_nexus.py', method, params, options);
}

/**
 * Convenient typed wrapper for Perception Models bridge
 */
export async function runPerception(method, params = {}, options = {}) {
  return runBridge('bridge_perception.py', method, params, options);
}
