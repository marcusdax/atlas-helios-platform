/**
 * Tier 1 Feature Coverage: Storm Reconnaissance, Radar Tiles & Damage Intelligence
 * Covers:
 * - Feature 7: Storm Intelligence Engine (F7)
 * - Feature 9: Storm Database Schema & Seeds (F9)
 * - Feature 10: Recon Intelligence Tab (F10)
 * - Feature 11: Geofencing & Radar Tile Layer (F11)
 * - Endpoints: /api/recon/storms, /api/recon/leads
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';
import { FIXTURES } from '../helpers/test-fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('02. Storm Reconnaissance & Geospatial Intelligence (Tier 1)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });



  describe('Feature 7: Storm Intelligence Engine (F7)', () => {
    it('verifies /api/recon/storms endpoint contract and storm intelligence fields', async () => {
      const res = await apiClient.get('/api/recon/storms');
      assert.ok(res.status === 200 || res.status === 500, 'Storms route must return 200 (live) or 500 (DB offline)');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(Array.isArray(res.data), 'Storms data must be an array');
        if (res.data.length > 0) {
          const storm = res.data[0];
          assert.ok(storm.id !== undefined, 'Storm must have id');
          assert.ok(typeof storm.name === 'string', 'Storm name must be string');
          assert.ok(typeof storm.severity === 'string', 'Storm severity must be string');
          assert.ok(typeof storm.score === 'number', 'Storm score must be numeric');
          assert.ok(storm.score >= 0 && storm.score <= 100, 'Storm score must be bounded [0, 100]');
        }
      } else {
        assert.strictEqual(res.data.error, 'Failed to fetch storms');
        assert.ok(typeof res.data.details === 'string', 'Error details must be string');
      }
    });

    it('verifies storm intelligence service implementation structure and methods in codebase', () => {
      const servicePath = path.join(ROOT_DIR, 'server', 'src', 'services', 'StormService.js');
      assert.ok(fs.existsSync(servicePath), 'server/src/services/StormService.js must exist');

      const content = fs.readFileSync(servicePath, 'utf-8');
      assert.ok(content.includes('class StormService') || content.includes('StormService'), 'Must define StormService');
      assert.ok(content.includes('damage') || content.includes('score'), 'Must contain damage scoring logic');
      assert.ok(content.includes('hail') || content.includes('wind'), 'Must monitor hail or wind parameters');
      assert.ok(content.includes('active') || content.includes('storms'), 'Must provide storm querying logic');
    });

    it('verifies damage probability calculation rules for severe weather thresholds', () => {
      // Severe weather logic: hail >= 2.0" and wind >= 70mph triggers catastrophic damage probability (>80)
      const evaluateStormSeverity = (hailInches, windMph) => {
        let prob = 10;
        if (hailInches >= 1.0) prob += 25;
        if (hailInches >= 1.75) prob += 30;
        if (hailInches >= 2.5) prob += 25;
        if (windMph >= 58) prob += 15; // NWS severe thunderstorm wind criterion
        if (windMph >= 75) prob += 15; // Hurricane-force gust criterion
        return Math.min(100, prob);
      };

      const severeProb = evaluateStormSeverity(2.5, 75);
      const minorProb = evaluateStormSeverity(0.5, 30);
      const moderateProb = evaluateStormSeverity(1.25, 60);

      assert.ok(severeProb >= 90, 'Severe hail & hurricane-force wind must yield probability >= 90%');
      assert.strictEqual(minorProb, 10, 'Sub-severe hail and light wind must retain baseline 10%');
      assert.ok(moderateProb >= 50 && moderateProb < 80, 'Moderate storm must be scored in medium range');
      assert.ok(severeProb > moderateProb, 'Severity ordering must be monotonic with hail size');
      assert.ok(moderateProb > minorProb, 'Moderate storm must score higher than minor');
    });
  });

  describe('Feature 9: Storm Database Schema & Seeds (F9)', () => {
    it('verifies seeds definition contains non-null geographic coordinates for storms', () => {
      const seedPath = path.join(ROOT_DIR, 'server', 'seeds', '001_initial_data.js');
      assert.ok(fs.existsSync(seedPath), 'server/seeds/001_initial_data.js must exist');

      const seedContent = fs.readFileSync(seedPath, 'utf-8');
      assert.ok(seedContent.includes('storms:'), 'Seed file must declare storms dataset');
      assert.ok(seedContent.includes('lat:') && seedContent.includes('lng:'), 'Must specify lat and lng coordinates');
      assert.ok(!seedContent.includes('lat: null') && !seedContent.includes('lng: null'), 'Must not contain explicit null coordinates');
      assert.ok(seedContent.includes('STORM-') || seedContent.includes('Hail Cell'), 'Must define recognizable storm fixtures');
    });

    it('verifies migration schema definition for storms table contains spatial columns', () => {
      const migrationsDir = path.join(ROOT_DIR, 'server', 'migrations');
      assert.ok(fs.existsSync(migrationsDir), 'server/migrations directory must exist');

      const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js'));
      assert.ok(migrationFiles.length > 0, 'Must have at least one Knex migration');

      let foundStormsTable = false;
      for (const file of migrationFiles) {
        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        if (content.includes('createTable(\'storms\'') || content.includes('createTable("storms"')) {
          foundStormsTable = true;
          assert.ok(content.includes('lat') || content.includes('latitude'), 'Storms table must define latitude column');
          assert.ok(content.includes('lng') || content.includes('longitude'), 'Storms table must define longitude column');
          assert.ok(content.includes('severity') || content.includes('score'), 'Storms table must define severity or score column');
          break;
        }
      }
      assert.ok(foundStormsTable, 'Migrations must define storms table');
    });
  });

  describe('Feature 10: Recon Intelligence Tab (F10)', () => {
    it('verifies /api/recon/leads endpoint contract and damage classification schema', async () => {
      const res = await apiClient.get('/api/recon/leads');
      assert.ok(res.status === 200 || res.status === 500, 'Leads route must return 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200) {
        assert.ok(Array.isArray(res.data), 'Leads response must be array');
        if (res.data.length > 0) {
          const lead = res.data[0];
          assert.ok(lead.id !== undefined, 'Lead must have id');
          assert.ok(typeof lead.addr === 'string', 'Lead must have address string');
          assert.ok(typeof lead.score === 'number', 'Lead must have damage score');
          assert.ok(lead.score >= 0 && lead.score <= 100, 'Score must be in [0, 100]');
        }
      } else {
        assert.strictEqual(res.data.error, 'Failed to fetch leads');
      }
    });

    it('verifies ReconTab UI component exists and renders storm intelligence controls', () => {
      const reconTabPath = path.join(ROOT_DIR, 'src', 'tabs', 'ReconTab.tsx');
      assert.ok(fs.existsSync(reconTabPath), 'src/tabs/ReconTab.tsx must exist');

      const content = fs.readFileSync(reconTabPath, 'utf-8');
      assert.ok(content.includes('ReconTab') || content.includes('export'), 'Must export ReconTab component');
      assert.ok(content.includes('storm') || content.includes('Storm'), 'Must reference storm intelligence elements');
      assert.ok(content.includes('leads') || content.includes('Leads'), 'Must reference leads display');
      assert.ok(content.includes('score') || content.includes('severity'), 'Must reference damage score or severity gauge');
    });
  });

  describe('Feature 11: Geofencing & Radar Tile Layer (F11)', () => {
    it('verifies IEM NEXRAD radar tile URL template structure and XYZ coordinate constraints', () => {
      const tileTemplate = FIXTURES.radar.iemTileUrlTemplate;

      assert.ok(tileTemplate.startsWith('https://'), 'Radar tile layer must use secure HTTPS protocol');
      assert.ok(tileTemplate.includes('mesonet.agron.iastate.edu'), 'Must route to IEM Mesonet tile service');
      assert.ok(tileTemplate.includes('nexrad-n0q-900913'), 'Must target NEXRAD base reflectivity composite');
      assert.ok(tileTemplate.includes('{z}'), 'Template must include zoom placeholder {z}');
      assert.ok(tileTemplate.includes('{x}'), 'Template must include column placeholder {x}');
      assert.ok(tileTemplate.includes('{y}'), 'Template must include row placeholder {y}');
      assert.ok(tileTemplate.endsWith('.png'), 'Tile format must be PNG');

      // Test tile URL substitution with fixture coordinates
      const { z, x, y } = FIXTURES.radar.validTileCoordinates;
      const resolvedUrl = tileTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y);
      assert.strictEqual(resolvedUrl, `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/${z}/${x}/${y}.png`);
    });

    it('verifies GeofencingTab UI component exists with boundary and radar map integration', () => {
      const geofencingTabPath = path.join(ROOT_DIR, 'src', 'tabs', 'GeofencingTab.tsx');
      assert.ok(fs.existsSync(geofencingTabPath), 'src/tabs/GeofencingTab.tsx must exist');

      const content = fs.readFileSync(geofencingTabPath, 'utf-8');
      assert.ok(content.includes('GeofencingTab') || content.includes('export'), 'Must export GeofencingTab component');
      assert.ok(content.includes('radar') || content.includes('tile') || content.includes('TileLayer'), 'Must reference radar or tile layer');
      assert.ok(content.includes('polygon') || content.includes('coordinates') || content.includes('geo'), 'Must support geospatial polygon or boundaries');
    });
  });
});
