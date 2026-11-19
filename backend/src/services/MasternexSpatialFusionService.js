const crypto = require('crypto');

/**
 * MASTERNEX.os Spatial & Acoustic Fusion Service for Atlas & Helios
 *
 * Implements:
 * 1. GIE (Global Intelligence Engine) Axial/Cube Hexagonal Spatial Indexing
 *    - Converts WGS84 (lat, lng) into axial hex coordinates (q, r, s) where q + r + s === 0
 *    - Computes k-ring neighborhoods and hex-distance decay for storm hail/wind corridors
 * 2. KDA (Kady Dynamic Architecture) Multi-Rate Continuous-Time Sensor Fusion
 *    - Fuses asynchronous NOAA WSR-88D Doppler radar sweeps (5-10 min cadence),
 *      ground barometric IoT stations (1 Hz), and high-cadence drone visual telemetry
 *      using continuous-time exponential state-space decay: h(t + dt) = exp(-A * dt) * h(t) + B(dt) * u(t)
 * 3. GUARDIAN Sub-Millisecond TDOA Acoustic Triangulation
 *    - Time-Difference-of-Arrival (TDOA) acoustic localization of hail strikes and
 *      structural wind impact signatures across multi-microphone sensor arrays, paired
 *      with SHA-256 cryptographic attestation receipts.
 */

const EARTH_RADIUS_METERS = 6371000.0;
const SPEED_OF_SOUND_MPS = 343.2; // 20 C dry air reference
const SQRT3 = Math.sqrt(3);

class MasternexSpatialFusionService {
  constructor(options = {}) {
    this.hexSizeMeters = options.hexSizeMeters || 500.0; // Default 500m hex edge radius
    this.originLat = options.originLat ?? 32.7767; // Dallas / DFW metroplex reference origin
    this.originLng = options.originLng ?? -96.7970;
    this.decayTauSeconds = options.decayTauSeconds || 300.0; // 5-minute continuous-time state decay constant
  }

  /**
   * Project WGS84 (lat, lng) to local East-North-Up (ENU) tangent plane meters
   */
  latLngToMeters(lat, lng, refLat = this.originLat, refLng = this.originLng) {
    const dLat = ((lat - refLat) * Math.PI) / 180.0;
    const dLng = ((lng - refLng) * Math.PI) / 180.0;
    const meanLatRad = (((lat + refLat) * 0.5) * Math.PI) / 180.0;
    const xEast = dLng * Math.cos(meanLatRad) * EARTH_RADIUS_METERS;
    const yNorth = dLat * EARTH_RADIUS_METERS;
    return { x: xEast, y: yNorth };
  }

  /**
   * Inverse projection from local ENU meters to WGS84 (lat, lng)
   */
  metersToLatLng(xEast, yNorth, refLat = this.originLat, refLng = this.originLng) {
    const dLat = yNorth / EARTH_RADIUS_METERS;
    const lat = refLat + (dLat * 180.0) / Math.PI;
    const meanLatRad = (((lat + refLat) * 0.5) * Math.PI) / 180.0;
    const dLng = xEast / (EARTH_RADIUS_METERS * Math.max(1e-6, Math.cos(meanLatRad)));
    const lng = refLng + (dLng * 180.0) / Math.PI;
    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6))
    };
  }

  /**
   * Round fractional cube coordinates (qf, rf, sf) to nearest integer hex (q, r, s)
   * preserving the strict invariant q + r + s === 0.
   */
  cubeRound(qf, rf, sf = -qf - rf) {
    let q = Math.round(qf);
    let r = Math.round(rf);
    let s = Math.round(sf);

    const qDiff = Math.abs(q - qf);
    const rDiff = Math.abs(r - rf);
    const sDiff = Math.abs(s - sf);

    if (qDiff > rDiff && qDiff > sDiff) {
      q = -r - s;
    } else if (rDiff > sDiff) {
      r = -q - s;
    } else {
      s = -q - r;
    }
    // Eliminate -0
    q = q === 0 ? 0 : q;
    r = r === 0 ? 0 : r;
    s = s === 0 ? 0 : s;
    return { q, r, s, hexId: `GIE-HEX:${q}:${r}:${s}` };
  }

  /**
   * Convert WGS84 (lat, lng) into GIE Pointy-Top Axial/Cube Hex Coordinates
   */
  latLngToHex(lat, lng, hexSizeMeters = this.hexSizeMeters) {
    const { x, y } = this.latLngToMeters(lat, lng);
    const qf = ((SQRT3 / 3.0) * x - (1.0 / 3.0) * y) / hexSizeMeters;
    const rf = ((2.0 / 3.0) * y) / hexSizeMeters;
    const rounded = this.cubeRound(qf, rf, -qf - rf);
    const center = this.hexToLatLng(rounded.q, rounded.r, hexSizeMeters);
    return {
      ...rounded,
      hexSizeMeters,
      center
    };
  }

  /**
   * Convert Axial Hex (q, r) back to center WGS84 (lat, lng)
   */
  hexToLatLng(q, r, hexSizeMeters = this.hexSizeMeters) {
    const x = hexSizeMeters * (SQRT3 * q + (SQRT3 / 2.0) * r);
    const y = hexSizeMeters * (1.5 * r);
    return this.metersToLatLng(x, y);
  }

  /**
   * Compute discrete Manhattan distance between two cube hex cells
   */
  hexDistance(hexA, hexB) {
    const sA = hexA.s !== undefined ? hexA.s : -hexA.q - hexA.r;
    const sB = hexB.s !== undefined ? hexB.s : -hexB.q - hexB.r;
    return Math.max(
      Math.abs(hexA.q - hexB.q),
      Math.abs(hexA.r - hexB.r),
      Math.abs(sA - sB)
    );
  }

  /**
   * Generate all hex cells within k rings of center (q, r)
   */
  getHexDisk(q, r, k = 1) {
    const radius = Math.max(0, Math.min(12, Math.floor(k)));
    const cells = [];
    for (let dq = -radius; dq <= radius; dq++) {
      const rMin = Math.max(-radius, -dq - radius);
      const rMax = Math.min(radius, -dq + radius);
      for (let dr = rMin; dr <= rMax; dr++) {
        const ds = -dq - dr;
        const cq = q + dq === 0 ? 0 : q + dq;
        const cr = r + dr === 0 ? 0 : r + dr;
        const cs = -cq - cr === 0 ? 0 : -cq - cr;
        cells.push({
          q: cq,
          r: cr,
          s: cs,
          ringDistance: Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds)),
          hexId: `GIE-HEX:${cq}:${cr}:${cs}`,
          center: this.hexToLatLng(cq, cr)
        });
      }
    }
    return cells;
  }

  /**
   * Index a portfolio of properties against an active storm cell path on the GIE Hex Grid
   */
  evaluateStormHexExposure(stormCenter, properties = [], options = {}) {
    const coreHailInches = Number(stormCenter.hailSizeInches ?? 1.75);
    const maxWindMph = Number(stormCenter.windSpeedMph ?? 65);
    const stormHex = this.latLngToHex(stormCenter.lat, stormCenter.lng);
    const decayRingScale = Number(options.decayRingScale ?? 3.5);

    const indexedProperties = properties.map((prop) => {
      const propHex = this.latLngToHex(prop.lat, prop.lng);
      const ringDist = this.hexDistance(stormHex, propHex);
      const attenuation = Math.exp(-ringDist / decayRingScale);
      const estimatedHailInches = Number((coreHailInches * attenuation).toFixed(2));
      const estimatedWindMph = Number((maxWindMph * Math.pow(attenuation, 0.65)).toFixed(1));

      // Kinetic impact energy proxy proportional to d^4 for terminal velocity ice spheres
      const kineticDamageIndex = Math.min(
        100,
        Number(
          (
            Math.pow(estimatedHailInches / 1.25, 3.2) * 42 +
            Math.max(0, estimatedWindMph - 45) * 1.15
          ).toFixed(1)
        )
      );

      return {
        propertyId: prop.id,
        address: prop.address,
        hexId: propHex.hexId,
        q: propHex.q,
        r: propHex.r,
        s: propHex.s,
        hexRingDistance: ringDist,
        estimatedHailInches,
        estimatedWindMph,
        kineticDamageIndex,
        severityTier:
          kineticDamageIndex >= 70
            ? 'CRITICAL'
            : kineticDamageIndex >= 40
              ? 'MODERATE'
              : 'LOW'
      };
    });

    return {
      stormHex,
      totalPropertiesEvaluated: indexedProperties.length,
      criticalCount: indexedProperties.filter((p) => p.severityTier === 'CRITICAL').length,
      indexedProperties
    };
  }

  /**
   * KDA Continuous-Time Multi-Rate Sensor Fusion
   * Fuses asynchronous observations sorted by timestamp (ms or ISO) using precision-weighted
   * state-space updates and continuous exponential decay across irregular time intervals dt.
   *
   * Supported modalities:
   * - 'radar' (NOAA WSR-88D Doppler sweep, e.g., every 300s, reliability weight 0.70)
   * - 'barometer' (IoT ground station 1Hz pressure drop / gust sensor, weight 0.85)
   * - 'drone_cv' (High-res aerial inspection sweep, weight 0.95)
   */
  fuseMultiRateSensorStream(observations = [], options = {}) {
    const tau = Number(options.decayTauSeconds || this.decayTauSeconds);
    const modalityPrecision = {
      radar: 1.8,
      barometer: 2.5,
      drone_cv: 3.8,
      acoustic: 3.2
    };

    const sorted = [...observations].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let stateHail = 0.0;
    let stateWind = 0.0;
    let stateDamageProb = 0.0;
    let statePrecision = 0.25; // Initial prior precision
    let lastTimeMs = null;
    const trajectory = [];

    for (const obs of sorted) {
      const tMs = new Date(obs.timestamp).getTime();
      const dtSeconds =
        lastTimeMs === null ? 0.0 : Math.max(0.0, (tMs - lastTimeMs) / 1000.0);
      lastTimeMs = tMs;

      // Continuous-time state-space transition: precision decays toward baseline over dt,
      // while physical state retains momentum with mild relaxation
      const alphaDecay = Math.exp(-dtSeconds / tau);
      const predictedPrecision = Math.max(0.2, statePrecision * alphaDecay);

      const obsPrecision =
        (modalityPrecision[obs.modality] || 1.0) * Number(obs.confidence ?? 0.9);
      const kalmanGain = obsPrecision / (predictedPrecision + obsPrecision);

      if (obs.hailInches !== undefined) {
        stateHail = stateHail + kalmanGain * (Number(obs.hailInches) - stateHail);
      }
      if (obs.windMph !== undefined) {
        stateWind = stateWind + kalmanGain * (Number(obs.windMph) - stateWind);
      }
      if (obs.damageProbability !== undefined) {
        stateDamageProb =
          stateDamageProb +
          kalmanGain * (Number(obs.damageProbability) - stateDamageProb);
      } else {
        // Infer structural damage probability from fused hail & wind state
        const impliedDamage = Math.min(
          1.0,
          Math.max(0.0, (stateHail / 2.25) * 0.65 + Math.max(0, stateWind - 40) / 120)
        );
        stateDamageProb = stateDamageProb + kalmanGain * (impliedDamage - stateDamageProb);
      }

      statePrecision = predictedPrecision + obsPrecision;
      const posteriorConfidence = Number(
        (1.0 - 1.0 / (1.0 + statePrecision)).toFixed(4)
      );

      trajectory.push({
        timestamp: new Date(tMs).toISOString(),
        modality: obs.modality || 'unknown',
        dtSeconds: Number(dtSeconds.toFixed(3)),
        kalmanGain: Number(kalmanGain.toFixed(4)),
        fusedHailInches: Number(stateHail.toFixed(3)),
        fusedWindMph: Number(stateWind.toFixed(2)),
        fusedDamageProbability: Number(stateDamageProb.toFixed(4)),
        posteriorConfidence
      });
    }

    const latest = trajectory[trajectory.length - 1] || {
      fusedHailInches: 0,
      fusedWindMph: 0,
      fusedDamageProbability: 0,
      posteriorConfidence: 0
    };

    const digestPayload = JSON.stringify({
      count: trajectory.length,
      latest
    });
    const attestationHash = crypto
      .createHash('sha256')
      .update(digestPayload)
      .digest('hex');

    return {
      engine: 'MASTERNEX-KDA-Continuous-SSM',
      decayTauSeconds: tau,
      observationCount: trajectory.length,
      fusedState: {
        hailInches: latest.fusedHailInches,
        windMph: latest.fusedWindMph,
        damageProbability: latest.fusedDamageProbability,
        posteriorConfidence: latest.posteriorConfidence
      },
      trajectory,
      attestationHash
    };
  }

  /**
   * GUARDIAN Sub-Millisecond TDOA (Time-Difference-of-Arrival) Acoustic Triangulation
   * Given 3+ acoustic sensor positions in local meters (x, y) and arrival timestamps (microseconds or milliseconds),
   * solves via Gauss-Newton non-linear least squares for the hail/impact source coordinates (x, y)
   * and classifies kinetic impact energy.
   */
  triangulateAcousticImpact(sensors = [], options = {}) {
    if (!Array.isArray(sensors) || sensors.length < 3) {
      throw new Error('At least 3 acoustic sensor nodes are required for 2D TDOA triangulation');
    }

    const speedOfSound = Number(options.speedOfSoundMps || SPEED_OF_SOUND_MPS);
    // Sort sensors by arrival time so sensor[0] is the reference first-arrival node
    const ordered = [...sensors].sort(
      (a, b) => Number(a.arrivalTimeMs) - Number(b.arrivalTimeMs)
    );
    const ref = ordered[0];

    // Initial guess: amplitude-weighted or inverse-time-weighted centroid of sensors
    let estX = 0;
    let estY = 0;
    let weightSum = 0;
    for (const s of ordered) {
      const dtMs = Math.max(0.05, Number(s.arrivalTimeMs) - Number(ref.arrivalTimeMs) + 0.1);
      const w = 1.0 / dtMs;
      estX += Number(s.x) * w;
      estY += Number(s.y) * w;
      weightSum += w;
    }
    estX /= weightSum;
    estY /= weightSum;

    // Gauss-Newton iterative refinement on range-difference equations:
    // r_i(x, y) = ||p - s_i|| - ||p - s_0|| - c * (t_i - t_0)
    const maxIterations = 40;
    let residualRmsMeters = 0;

    for (let iter = 0; iter < maxIterations; iter++) {
      let jtj00 = 0;
      let jtj01 = 0;
      let jtj11 = 0;
      let jtr0 = 0;
      let jtr1 = 0;
      let sumSqErr = 0;

      const d0 = Math.max(1e-4, Math.hypot(estX - ref.x, estY - ref.y));
      const u0x = (estX - ref.x) / d0;
      const u0y = (estY - ref.y) / d0;

      for (let i = 1; i < ordered.length; i++) {
        const si = ordered[i];
        const di = Math.max(1e-4, Math.hypot(estX - si.x, estY - si.y));
        const uix = (estX - si.x) / di;
        const uiy = (estY - si.y) / di;

        const measuredRangeDiff =
          ((Number(si.arrivalTimeMs) - Number(ref.arrivalTimeMs)) / 1000.0) *
          speedOfSound;
        const modeledRangeDiff = di - d0;
        const res = modeledRangeDiff - measuredRangeDiff;
        sumSqErr += res * res;

        const jx = uix - u0x;
        const jy = uiy - u0y;

        jtj00 += jx * jx;
        jtj01 += jx * jy;
        jtj11 += jy * jy;
        jtr0 += jx * res;
        jtr1 += jy * res;
      }

      residualRmsMeters = Math.sqrt(sumSqErr / Math.max(1, ordered.length - 1));

      // Levenberg-Marquardt damping for numerical stability
      const lambda = 1e-3;
      const a00 = jtj00 + lambda;
      const a11 = jtj11 + lambda;
      const det = a00 * a11 - jtj01 * jtj01;
      if (Math.abs(det) < 1e-10) break;

      const stepX = -(a11 * jtr0 - jtj01 * jtr1) / det;
      const stepY = -(-jtj01 * jtr0 + a00 * jtr1) / det;

      estX += stepX;
      estY += stepY;

      if (Math.hypot(stepX, stepY) < 1e-4) break;
    }

    const peakDb = Math.max(...ordered.map((s) => Number(s.peakDecibels ?? 88)));
    const dominantFreqHz =
      ordered.reduce((acc, s) => acc + Number(s.dominantFreqHz ?? 1850), 0) /
      ordered.length;

    // Classify impact signature based on acoustic spectral peak and SPL
    const impactClass =
      peakDb >= 95 && dominantFreqHz >= 1400
        ? 'SEVERE_HAIL_CORE_STRIKE'
        : peakDb >= 82
          ? 'MODERATE_HAIL_OR_DEBRIS_IMPACT'
          : 'AMBIENT_RAIN_WIND_EXCITATION';

    const geoLocation = this.metersToLatLng(estX, estY);
    const hexCell = this.latLngToHex(geoLocation.lat, geoLocation.lng);

    const payload = {
      estimatedX: Number(estX.toFixed(3)),
      estimatedY: Number(estY.toFixed(3)),
      residualRmsMeters: Number(residualRmsMeters.toFixed(4)),
      impactClass,
      hexId: hexCell.hexId
    };
    const guardianReceiptHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    return {
      engine: 'MASTERNEX-GUARDIAN-TDOA-v1',
      sensorCount: ordered.length,
      speedOfSoundMps: speedOfSound,
      localizedSourceMeters: {
        x: payload.estimatedX,
        y: payload.estimatedY
      },
      geoLocation,
      hexCell: {
        hexId: hexCell.hexId,
        q: hexCell.q,
        r: hexCell.r,
        s: hexCell.s
      },
      residualRmsMeters: payload.residualRmsMeters,
      subMeterConverged: payload.residualRmsMeters < 1.0,
      acousticSignature: {
        peakDecibels: Number(peakDb.toFixed(1)),
        dominantFreqHz: Number(dominantFreqHz.toFixed(1)),
        impactClass
      },
      guardianReceiptHash
    };
  }
}

module.exports = {
  MasternexSpatialFusionService,
  masternexSpatialFusionService: new MasternexSpatialFusionService()
};
