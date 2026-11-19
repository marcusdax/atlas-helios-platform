const express = require('express');
const router = express.Router();
const { masternexSpatialFusionService } = require('../services/MasternexSpatialFusionService');

/**
 * POST /api/masternex/spatial/hex-index
 * Convert WGS84 (lat, lng) into GIE Axial/Cube Hex Coordinates and optional k-ring disk
 */
router.post('/hex-index', (req, res) => {
  try {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const kRing = Number(req.body.kRing ?? 1);
    const hexSizeMeters = Number(req.body.hexSizeMeters || 500);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Valid WGS84 lat (-90..90) and lng (-180..180) are required' });
    }

    const hex = masternexSpatialFusionService.latLngToHex(lat, lng, hexSizeMeters);
    const neighborhood = masternexSpatialFusionService.getHexDisk(hex.q, hex.r, kRing);

    res.json({
      status: 'ok',
      engine: 'MASTERNEX-GIE-HexGrid',
      hex,
      neighborhoodCount: neighborhood.length,
      neighborhood
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/masternex/spatial/storm-exposure
 * Evaluate portfolio property exposure against a storm core on the GIE Hex Grid
 */
router.post('/storm-exposure', (req, res) => {
  try {
    const { stormCenter, properties, options } = req.body || {};
    if (!stormCenter || !Number.isFinite(Number(stormCenter.lat)) || !Number.isFinite(Number(stormCenter.lng))) {
      return res.status(400).json({ error: 'stormCenter with valid lat and lng is required' });
    }
    const result = masternexSpatialFusionService.evaluateStormHexExposure(
      stormCenter,
      Array.isArray(properties) ? properties : [],
      options || {}
    );
    res.json({ status: 'ok', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/masternex/spatial/kda-fusion
 * Fuse multi-rate sensor streams (Doppler radar, ground barometers, drone CV)
 */
router.post('/kda-fusion', (req, res) => {
  try {
    const { observations, options } = req.body || {};
    if (!Array.isArray(observations) || observations.length === 0) {
      return res.status(400).json({ error: 'Non-empty observations array is required' });
    }
    const result = masternexSpatialFusionService.fuseMultiRateSensorStream(observations, options || {});
    res.json({ status: 'ok', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/masternex/spatial/guardian-tdoa
 * Triangulate hail/structural impact location from 3+ acoustic sensor arrival timestamps
 */
router.post('/guardian-tdoa', (req, res) => {
  try {
    const { sensors, options } = req.body || {};
    if (!Array.isArray(sensors) || sensors.length < 3) {
      return res.status(400).json({ error: 'At least 3 acoustic sensor readings are required' });
    }
    const result = masternexSpatialFusionService.triangulateAcousticImpact(sensors, options || {});
    res.json({ status: 'ok', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
