/**
 * Server Lifecycle Harness for Atlas & Helios E2E Test Suite
 * Detects if the backend server is running on localhost:3001 or localhost:3099.
 * If offline, safely and atomically spawns `node server/index.js` on port 3099,
 * synchronizes across concurrent test files via lockfile, and provides cleanup.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiClient } from './api-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const LOCK_FILE = path.join(ROOT_DIR, '.server.lock');
const PID_FILE = path.join(ROOT_DIR, '.server.pid');

class ServerHarness {
  constructor() {
    this.serverProcess = null;
    this.port = 3001;
    this.baseUrl = 'http://localhost:3001';
    this.isReady = false;
  }

  /**
   * Probe /api/health on a given port
   */
  async probeHealth(port, timeoutMs = 1200) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        return body && body.status === 'ok';
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Ensure server is available, auto-spawning if offline
   */
  async ensureServer(preferredPort = 3099) {
    if (this.isReady) {
      return { baseUrl: this.baseUrl, port: this.port };
    }

    // 1. Check if standard port 3001 is already running
    if (await this.probeHealth(3001)) {
      this.port = 3001;
      this.baseUrl = 'http://localhost:3001';
      this.isReady = true;
      apiClient.setBaseUrl(this.baseUrl);
      return { baseUrl: this.baseUrl, port: this.port };
    }

    // 2. Check if preferred test port (3099) is already running
    if (await this.probeHealth(preferredPort)) {
      this.port = preferredPort;
      this.baseUrl = `http://localhost:${preferredPort}`;
      this.isReady = true;
      apiClient.setBaseUrl(this.baseUrl);
      return { baseUrl: this.baseUrl, port: this.port };
    }

    // 3. Atomically acquire lock to spawn server
    this.port = preferredPort;
    this.baseUrl = `http://localhost:${preferredPort}`;
    let isSpawner = false;

    try {
      // 'wx' flag fails if file already exists
      const fd = fs.openSync(LOCK_FILE, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      isSpawner = true;
    } catch (e) {
      if (e.code === 'EEXIST') {
        isSpawner = false;
      } else {
        throw e;
      }
    }

    if (isSpawner) {
      try {
        this.serverProcess = spawn('node', ['server/index.js'], {
          cwd: ROOT_DIR,
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env,
            PORT: String(this.port),
            NODE_ENV: 'development'
          }
        });

        if (this.serverProcess && this.serverProcess.pid) {
          fs.writeFileSync(PID_FILE, String(this.serverProcess.pid));
          this.serverProcess.unref();
        }
      } catch (err) {
        try { fs.unlinkSync(LOCK_FILE); } catch {}
        throw err;
      }
    }

    // 4. Poll /api/health until server is up (up to 20s)
    const startTime = Date.now();
    const maxWaitMs = 20000;
    while (Date.now() - startTime < maxWaitMs) {
      if (await this.probeHealth(this.port, 1000)) {
        this.isReady = true;
        apiClient.setBaseUrl(this.baseUrl);
        if (isSpawner) {
          try { fs.unlinkSync(LOCK_FILE); } catch {}
        }
        return { baseUrl: this.baseUrl, port: this.port };
      }
      await new Promise(r => setTimeout(r, 250));
    }

    if (isSpawner) {
      try { fs.unlinkSync(LOCK_FILE); } catch {}
      this.stopServer();
    }

    throw new Error(`Failed to connect to server on port ${this.port} within ${maxWaitMs}ms`);
  }

  /**
   * Stop the background server process if spawned
   */
  stopServer() {
    // 1. Kill from stored PID file
    if (fs.existsSync(PID_FILE)) {
      try {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
        if (pid && !isNaN(pid)) {
          process.kill(pid, 'SIGTERM');
        }
      } catch {
        try {
          const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
          if (pid && !isNaN(pid)) {
            process.kill(pid, 'SIGKILL');
          }
        } catch {}
      }
      try { fs.unlinkSync(PID_FILE); } catch {}
    }

    // 2. Kill local reference if exists
    if (this.serverProcess) {
      try { this.serverProcess.kill('SIGTERM'); } catch {}
      this.serverProcess = null;
    }

    try { fs.unlinkSync(LOCK_FILE); } catch {}
    this.isReady = false;
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  getPort() {
    return this.port;
  }
}

export const serverHarness = new ServerHarness();
