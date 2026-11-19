const test = require('node:test');
const assert = require('node:assert/strict');
const { MasternexSpatialFusionService } = require('../src/services/MasternexSpatialFusionService');

test('GIE Hex-Grid Indexing preserves q + r + s === 0 invariant and round-trips coordinates', () => {
  const svc = new MasternexSpatialFusionService({ hexSizeMeters: 500 });
  const hex = svc.latLngToHex(32.7901, -96.8023);
  assert.equal(hex.q + hex.r + hex.s, 0);
  assert.ok(hex.hexId.startsWith('GIE-HEX:'));

  const disk = svc.getHexDisk(hex.q, hex.r, 2);
  // k=2 hex disk has 1 + 6*1 + 6*2 = 19 cells
  assert.equal(disk.length, 19);
  for (const cell of disk) {
    assert.equal(cell.q + cell.r + cell.s, 0);
  }
});

test('GIE Storm Hex Exposure ranks properties by hex distance decay and kinetic damage index', () => {
  const svc = new MasternexSpatialFusionService({ hexSizeMeters: 500 });
  const stormCenter = { lat: 32.7767, lng: -96.7970, hailSizeInches: 2.25, windSpeedMph: 78 };
  const properties = [
    { id: 1, address: 'Core Property', lat: 32.7768, lng: -96.7971 },
    { id: 2, address: 'Outer Ring Property', lat: 32.8250, lng: -96.8500 }
  ];

  const report = svc.evaluateStormHexExposure(stormCenter, properties);
  assert.equal(report.totalPropertiesEvaluated, 2);
  assert.ok(
    report.indexedProperties[0].kineticDamageIndex > report.indexedProperties[1].kineticDamageIndex,
    'Core property must have higher kinetic damage index than distant property'
  );
  assert.equal(report.indexedProperties[0].severityTier, 'CRITICAL');
});

test('KDA Multi-Rate Continuous-Time Sensor Fusion combines radar, barometer, and drone_cv streams', () => {
  const svc = new MasternexSpatialFusionService();
  const baseTime = Date.parse('2026-05-10T18:00:00Z');
  const observations = [
    {
      timestamp: new Date(baseTime).toISOString(),
      modality: 'radar',
      hailInches: 1.5,
      windMph: 58,
      confidence: 0.85
    },
    {
      timestamp: new Date(baseTime + 45_000).toISOString(),
      modality: 'barometer',
      windMph: 68,
      confidence: 0.92
    },
    {
      timestamp: new Date(baseTime + 120_000).toISOString(),
      modality: 'drone_cv',
      hailInches: 2.0,
      damageProbability: 0.88,
      confidence: 0.98
    }
  ];

  const fused = svc.fuseMultiRateSensorStream(observations);
  assert.equal(fused.observationCount, 3);
  assert.ok(fused.fusedState.hailInches > 1.6);
  assert.ok(fused.fusedState.windMph > 60);
  assert.ok(fused.fusedState.damageProbability > 0.65);
  assert.ok(fused.fusedState.posteriorConfidence > 0.85);
  assert.equal(fused.attestationHash.length, 64);
});

test('GUARDIAN TDOA Acoustic Triangulation recovers impact source within sub-meter accuracy', () => {
  const svc = new MasternexSpatialFusionService();
  const speedOfSound = 343.2;
  // True impact source at (x = 18.5m, y = -12.0m)
  const trueSource = { x: 18.5, y: -12.0 };
  const sensorCoords = [
    { id: 'mic-1', x: 0, y: 0 },
    { id: 'mic-2', x: 40, y: 0 },
    { id: 'mic-3', x: 20, y: 35 },
    { id: 'mic-4', x: -15, y: -25 }
  ];

  const t0Ms = 1000.0;
  const sensors = sensorCoords.map((s) => {
    const dist = Math.hypot(trueSource.x - s.x, trueSource.y - s.y);
    const travelTimeMs = (dist / speedOfSound) * 1000.0;
    return {
      ...s,
      arrivalTimeMs: t0Ms + travelTimeMs,
      peakDecibels: 98.4,
      dominantFreqHz: 1920
    };
  });

  const result = svc.triangulateAcousticImpact(sensors, { speedOfSoundMps: speedOfSound });
  const errMeters = Math.hypot(
    result.localizedSourceMeters.x - trueSource.x,
    result.localizedSourceMeters.y - trueSource.y
  );
  assert.ok(errMeters < 0.05, `Expected localization error < 0.05m, got ${errMeters}`);
  assert.equal(result.subMeterConverged, true);
  assert.equal(result.acousticSignature.impactClass, 'SEVERE_HAIL_CORE_STRIKE');
  assert.equal(result.guardianReceiptHash.length, 64);
});
