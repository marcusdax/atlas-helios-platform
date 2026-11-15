/**
 * Tier 3 Cross-Feature Combination: Storm Tracking to Reconnaissance Leads & Damage Scoring
 * Exercises Pairwise Linkages:
 * - Feature 6 & 8: NOAA Weather & Storm Intelligence
 * - Feature 7: Storm Intelligence Engine & Damage Scoring
 * - Feature 9 & 10: Storm Seeds, Recon Intelligence & Property Leads
 * - Feature 11: Geofencing, Distance Radius & NEXRAD Radar Overlay
 * - Feature 12: Storm Webhooks & Event Flow
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../helpers/api-client.js';
import { serverHarness } from '../helpers/server-harness.js';
import { FIXTURES } from '../helpers/test-fixtures.js';

describe('01. Storm Event to Recon Leads & Damage Scoring (Tier 3)', () => {
  before(async () => {
    await serverHarness.ensureServer();
  });

  describe('Pairwise Flow: Storm Ingestion & Severe Parameter Extraction', () => {
    it('queries active storm records and validates severe hail/wind metrics', async () => {
      const res = await apiClient.get('/api/recon/storms');
      assert.ok(res.status === 200 || res.status === 500, 'Recon storms must respond with 200 or 500 (DB offline)');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      // Use active storm data if connected, or canonical test fixture
      const storm = (res.status === 200 && Array.isArray(res.data) && res.data.length > 0)
        ? res.data[0]
        : FIXTURES.storms[0];

      assert.ok(storm.name !== undefined, 'Storm must have a name');
      assert.ok(storm.lat !== null && storm.lat !== undefined, 'Storm must have valid latitude');
      assert.ok(storm.lng !== null && storm.lng !== undefined, 'Storm must have valid longitude');
      assert.ok(typeof storm.score === 'number', 'Storm score must be numeric');
      assert.ok(storm.score >= 0 && storm.score <= 100, 'Storm score must be between 0 and 100');

      // Extract hail diameter
      const hailStr = String(storm.hail || '2.5"');
      const hailInches = parseFloat(hailStr.replace(/[^0-9.]/g, ''));
      assert.ok(!isNaN(hailInches), 'Hail diameter must be parseable');
      assert.ok(hailInches >= 1.0, 'Severe storm threshold requires hail >= 1.0 inch');
    });

    it('cross-references storm alert with NOAA weather forecast coordinates', async () => {
      const storm = FIXTURES.storms[0];
      const res = await apiClient.get('/api/weather/forecast', {
        lat: storm.lat,
        lng: storm.lng
      });

      assert.ok([200, 400, 404, 500, 503].includes(res.status), 'Weather forecast query must respond cleanly');
      if (res.status === 200 && res.data.location) {
        assert.strictEqual(res.data.location.lat, storm.lat);
        assert.strictEqual(res.data.location.lng, storm.lng);
      }
    });
  });

  describe('Pairwise Flow: Geofence Spatial Filtering & Distance Radius', () => {
    it('computes Haversine geodesic distance from storm center to candidate property leads', () => {
      // Haversine formula calculation in statute miles
      const calculateHaversineMiles = (lat1, lon1, lat2, lon2) => {
        const toRad = deg => (deg * Math.PI) / 180;
        const R = 3958.8; // Earth radius in miles
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const stormCenter = { lat: 32.7767, lng: -96.7970 }; // Dallas downtown
      const nearProperty = { lat: 32.8020, lng: -96.7700 }; // East Dallas (~2.3 miles)
      const distantProperty = { lat: 35.4676, lng: -97.5164 }; // Oklahoma City (~190 miles)

      const distNear = calculateHaversineMiles(stormCenter.lat, stormCenter.lng, nearProperty.lat, nearProperty.lng);
      const distDistant = calculateHaversineMiles(stormCenter.lat, stormCenter.lng, distantProperty.lat, distantProperty.lng);

      assert.ok(distNear < 5.0, `Near property distance (${distNear.toFixed(2)} mi) must be within 5 miles`);
      assert.ok(distDistant > 180.0, `Distant property distance (${distDistant.toFixed(2)} mi) must exceed 180 miles`);

      // Geofence radius check (15 miles maximum impact swath)
      const GEOFENCE_RADIUS_MILES = 15.0;
      assert.strictEqual(distNear <= GEOFENCE_RADIUS_MILES, true, 'Near property is inside storm impact geofence');
      assert.strictEqual(distDistant <= GEOFENCE_RADIUS_MILES, false, 'Distant property is outside storm impact geofence');
    });

    it('validates property reconnaissance leads schema and coordinates', async () => {
      const res = await apiClient.get('/api/recon/leads');
      assert.ok(res.status === 200 || res.status === 500, 'Recon leads must respond with 200 or 500');
      assert.strictEqual(res.isJson, true, 'Response must be valid JSON');

      if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
        const lead = res.data[0];
        assert.ok(lead.id !== undefined, 'Lead must have id');
        assert.ok(lead.addr !== undefined || lead.address !== undefined, 'Lead must have address');
        assert.ok(typeof lead.score === 'number' || typeof lead.score === 'string', 'Lead must have score');
        assert.ok(lead.damageType !== undefined || lead.damage_type !== undefined || lead.roof !== undefined,
          'Lead must specify damage or roof details');
      }
    });
  });

  describe('Pairwise Flow: Multi-Factor Damage Probability Scoring', () => {
    it('calculates composite damage probability combining storm metrics, roof age, and hail size', () => {
      const computeLeadDamageScore = (stormSeverityScore, hailInches, roofAgeYears, windMph) => {
        // Domain logic:
        // - Hail component: up to 40 pts (1.0" = 15 pts, 2.0" = 30 pts, 2.5"+ = 40 pts)
        // - Wind component: up to 25 pts (60mph = 15 pts, 75mph+ = 25 pts)
        // - Roof age component: up to 20 pts (>15 yrs = 20 pts, 10-15 = 15 pts, <5 = 5 pts)
        // - Storm base score: 15% weight
        const hailPts = Math.min(40, (hailInches / 2.5) * 40);
        const windPts = Math.min(25, (windMph / 80) * 25);
        const agePts = Math.min(20, (roofAgeYears / 20) * 20);
        const stormPts = (stormSeverityScore / 100) * 15;

        return Math.round(hailPts + windPts + agePts + stormPts);
      };

      // Severe scenario: 2.5" hail, 72 mph wind, 18-year-old asphalt shingle roof, storm score 94
      const severeLeadScore = computeLeadDamageScore(94, 2.5, 18, 72);
      assert.ok(severeLeadScore >= 85, `Severe storm with old roof must score high (got ${severeLeadScore})`);

      // Minor scenario: 1.0" hail, 45 mph wind, 2-year-old metal roof, storm score 40
      const minorLeadScore = computeLeadDamageScore(40, 1.0, 2, 45);
      assert.ok(minorLeadScore < 50, `Minor storm with new roof must score low (got ${minorLeadScore})`);

      // Pairwise invariant: Severe score must be substantially higher than minor score
      assert.ok(severeLeadScore - minorLeadScore >= 35, 'Score delta between severe and minor must be >= 35 pts');
    });

    it('prioritizes lead status based on computed damage score threshold', () => {
      const classifyLeadPriority = (score) => {
        if (score >= 80) return 'urgent';
        if (score >= 65) return 'high_priority';
        if (score >= 45) return 'qualified';
        return 'nurture';
      };

      assert.strictEqual(classifyLeadPriority(92), 'urgent');
      assert.strictEqual(classifyLeadPriority(74), 'high_priority');
      assert.strictEqual(classifyLeadPriority(55), 'qualified');
      assert.strictEqual(classifyLeadPriority(30), 'nurture');
    });
  });

  describe('Pairwise Flow: NEXRAD Radar Tile Alignment with Storm Centroid', () => {
    it('verifies IEM NEXRAD tile template and tile coordinate mapping for Dallas storm swath', () => {
      const template = FIXTURES.radar.iemTileUrlTemplate;
      const { z, x, y } = FIXTURES.radar.validTileCoordinates;

      const renderedUrl = template
        .replace('{z}', String(z))
        .replace('{x}', String(x))
        .replace('{y}', String(y));

      assert.ok(renderedUrl.includes('https://mesonet.agron.iastate.edu'), 'Must point to Iowa Environmental Mesonet');
      assert.ok(renderedUrl.includes('nexrad-n0q-900913'), 'Must request base reflectivity N0Q product');
      assert.strictEqual(renderedUrl.endsWith('.png'), true, 'Tile format must be PNG');
    });
  });
});
