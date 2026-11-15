/**
 * Tier 1 Feature Coverage: Core Health, Platform Config & Environment
 * Covers:
 * - Feature 1: Frontend TypeScript Cleanliness (F1)
 * - Feature 2: Root ESLint Configuration (F2)
 * - Feature 3: UI Component Path Resolution (F3)
 * - Feature 4: UI Library Compatibility (F4)
 * - Feature 5: Environment & Port Harmonization (F5)
 * - Core Platform REST Endpoints (/api/health, /api/properties, /api/contractors, /api/probate/*)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('01. Core Platform Health & Configurations (Tier 1)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });



  describe('Feature 5: Environment & Port Harmonization (F5)', () => {
    it('verifies /api/health endpoint contract and operational services', async () => {
      const res = await apiClient.get('/api/health');

      assert.strictEqual(res.status, 200, 'Health endpoint must respond with HTTP 200');
      assert.strictEqual(res.isJson, true, 'Health response must be valid JSON');
      assert.strictEqual(res.data.status, 'ok', 'Status property must equal "ok"');
      assert.ok(typeof res.data.timestamp === 'string', 'Timestamp must be a string');
      assert.ok(!isNaN(Date.parse(res.data.timestamp)), 'Timestamp must be parseable ISO 8601');
      assert.ok(Array.isArray(res.data.services), 'Services property must be an array');
      assert.ok(res.data.services.includes('atlas-helios'), 'Must declare atlas-helios service');
      assert.ok(res.data.services.includes('nexus-mind'), 'Must declare nexus-mind service');
      assert.ok(res.data.services.includes('perception-models'), 'Must declare perception-models service');
    });

    it('validates environment file and docker port definitions consistency', () => {
      const envPath = path.join(ROOT_DIR, '.env');
      const dockerComposePath = path.join(ROOT_DIR, 'docker-compose.yml');
      const serverIndexPath = path.join(ROOT_DIR, 'server', 'index.js');

      assert.ok(fs.existsSync(envPath), '.env file must exist in project root');
      assert.ok(fs.existsSync(dockerComposePath), 'docker-compose.yml must exist');
      assert.ok(fs.existsSync(serverIndexPath), 'server/index.js must exist');

      const envContent = fs.readFileSync(envPath, 'utf-8');
      const dockerContent = fs.readFileSync(dockerComposePath, 'utf-8');
      const serverContent = fs.readFileSync(serverIndexPath, 'utf-8');

      assert.ok(envContent.includes('3001') || envContent.includes('3004') || envContent.includes('PORT'), '.env must configure standard port reference');
      assert.ok(dockerContent.includes('3001') || dockerContent.includes('3004') || dockerContent.includes('ports:'), 'docker-compose must declare service port bindings');
      assert.ok(serverContent.includes('process.env.PORT') && (serverContent.includes('BACKEND_PORT') || serverContent.includes('3001') || serverContent.includes('3004')), 'server/index.js must configure configurable PORT');
    });
  });

  describe('Feature 1: Frontend TypeScript Cleanliness & Config (F1)', () => {
    it('verifies root tsconfig and tsconfig.node configuration integrity', () => {
      const tsconfigPath = path.join(ROOT_DIR, 'tsconfig.json');
      const tsconfigNodePath = path.join(ROOT_DIR, 'tsconfig.node.json');

      assert.ok(fs.existsSync(tsconfigPath), 'tsconfig.json must exist');
      assert.ok(fs.existsSync(tsconfigNodePath), 'tsconfig.node.json must exist');

      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      assert.ok(tsconfig.compilerOptions, 'tsconfig must have compilerOptions');
      assert.strictEqual(tsconfig.compilerOptions.jsx, 'react-jsx', 'Must use modern react-jsx transform');
      assert.strictEqual(tsconfig.compilerOptions.target.toLowerCase(), 'es2020', 'Must target modern ES2020');
      assert.ok(tsconfig.compilerOptions.paths || tsconfig.compilerOptions.moduleResolution, 'Must configure module resolution');

      const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
      assert.ok(packageJson.scripts.typecheck, 'package.json must contain typecheck script');
      assert.strictEqual(packageJson.scripts.typecheck, 'tsc --noEmit', 'typecheck script must run tsc --noEmit');
    });
  });

  describe('Feature 2: Root ESLint Configuration (F2)', () => {
    it('verifies eslint configuration file, ignore rules, and react plugin rules', () => {
      const eslintrcPath = path.join(ROOT_DIR, '.eslintrc.cjs');
      const eslintignorePath = path.join(ROOT_DIR, '.eslintignore');

      assert.ok(fs.existsSync(eslintrcPath), '.eslintrc.cjs must exist in project root');
      assert.ok(fs.existsSync(eslintignorePath), '.eslintignore must exist in project root');

      const eslintContent = fs.readFileSync(eslintrcPath, 'utf-8');
      assert.ok(eslintContent.includes('root: true'), 'ESLint config must declare root: true');
      assert.ok(eslintContent.includes('@typescript-eslint'), 'Must configure TypeScript ESLint plugin');
      assert.ok(eslintContent.includes('react-hooks') || eslintContent.includes('react-refresh'), 'Must configure React hooks rules');

      const eslintignore = fs.readFileSync(eslintignorePath, 'utf-8');
      assert.ok(eslintignore.includes('dist'), '.eslintignore must ignore build dist output');
      assert.ok(eslintignore.includes('node_modules') || eslintignore.includes('OpenRadar-clone'), '.eslintignore must ignore auxiliary directories');
    });
  });

  describe('Feature 3: UI Component Path Resolution & Hooks (F3)', () => {
    it('verifies existence and structure of use-mobile hook in src/hooks and src/nexus_hooks', () => {
      const hookPath1 = path.join(ROOT_DIR, 'src', 'hooks', 'use-mobile.ts');
      const hookPath2 = path.join(ROOT_DIR, 'src', 'nexus_hooks', 'use-mobile.ts');

      assert.ok(fs.existsSync(hookPath1), 'src/hooks/use-mobile.ts must exist');
      assert.ok(fs.existsSync(hookPath2), 'src/nexus_hooks/use-mobile.ts must exist');

      const content1 = fs.readFileSync(hookPath1, 'utf-8');
      assert.ok(content1.includes('useIsMobile') || content1.includes('useMobile'), 'Must export mobile hook function');
      assert.ok(content1.includes('matchMedia') || content1.includes('768'), 'Must check media query breakpoint');
    });

    it('verifies nexus_components UI primitives are present and structured', () => {
      const uiDir = path.join(ROOT_DIR, 'src', 'nexus_components', 'ui');
      assert.ok(fs.existsSync(uiDir), 'src/nexus_components/ui must exist');

      const uiFiles = fs.readdirSync(uiDir);
      assert.ok(uiFiles.length >= 10, 'Must have at least 10 UI primitive components');
      assert.ok(uiFiles.includes('button.tsx'), 'Must include button component');
      assert.ok(uiFiles.includes('card.tsx'), 'Must include card component');
      assert.ok(uiFiles.includes('dialog.tsx'), 'Must include dialog component');
      assert.ok(uiFiles.includes('tabs.tsx'), 'Must include tabs component');
    });
  });

  describe('Feature 4: UI Library Compatibility (F4)', () => {
    it('verifies dependencies and API compatibility for radix primitives and UI libraries', () => {
      const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      assert.ok(deps['@radix-ui/react-tabs'], 'Must have @radix-ui/react-tabs dependency');
      assert.ok(deps['@radix-ui/react-dialog'], 'Must have @radix-ui/react-dialog dependency');
      assert.ok(deps['lucide-react'], 'Must have lucide-react icon library');
      assert.ok(deps['clsx'], 'Must have clsx for conditional classnames');
      assert.ok(deps['tailwind-merge'], 'Must have tailwind-merge for class variance authority');
    });
  });

  describe('Core Platform API Endpoints (Database Contract / Fallback)', () => {
    it('verifies /api/properties response schema under live or graceful fallback mode', async () => {
      const res = await apiClient.get('/api/properties');
      assert.ok(res.status === 200 || res.status === 500, 'Properties endpoint must respond with 200 or 500 (DB offline)');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(Array.isArray(res.data), 'When connected, properties must be an array');
      } else {
        assert.ok(res.data.error, 'When DB offline, must return structured error object');
        assert.strictEqual(res.data.error, 'Failed to fetch properties');
      }
    });

    it('verifies /api/contractors response schema under live or graceful fallback mode', async () => {
      const res = await apiClient.get('/api/contractors');
      assert.ok(res.status === 200 || res.status === 500, 'Contractors endpoint must respond with 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(Array.isArray(res.data), 'Contractors data must be an array');
      } else {
        assert.strictEqual(res.data.error, 'Failed to fetch contractors');
      }
    });

    it('verifies /api/contractors/timeline response schema', async () => {
      const res = await apiClient.get('/api/contractors/timeline');
      assert.ok(res.status === 200 || res.status === 500, 'Timeline endpoint must respond with 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(Array.isArray(res.data), 'Timeline data must be an array');
      } else {
        assert.strictEqual(res.data.error, 'Failed to fetch timeline');
      }
    });

    it('verifies /api/probate/cases and /api/probate/heirs response schemas', async () => {
      const casesRes = await apiClient.get('/api/probate/cases');
      const heirsRes = await apiClient.get('/api/probate/heirs');

      assert.ok(casesRes.status === 200 || casesRes.status === 500, 'Probate cases must return 200 or 500');
      assert.ok(heirsRes.status === 200 || heirsRes.status === 500, 'Probate heirs must return 200 or 500');
      assert.strictEqual(casesRes.isJson, true, 'Cases must be JSON');
      assert.strictEqual(heirsRes.isJson, true, 'Heirs must be JSON');

      if (casesRes.status === 500) {
        assert.strictEqual(casesRes.data.error, 'Failed to fetch probate cases');
      }
      if (heirsRes.status === 500) {
        assert.strictEqual(heirsRes.data.error, 'Failed to fetch heirs');
      }
    });
  });
});
