/**
 * Automated Verification Test Suite for Milestone 3 (Helios Property Estimating & Damage Subsystem)
 * Covers:
 *  - ComputerVisionService (initialization, deterministic scoring, null safety)
 *  - POST /api/assessments/analyze
 *  - POST /api/assessments/roof-damage
 *  - GET /api/contractors/boq (CSI MasterFormat price book)
 *  - POST /api/estimate/line-items (Auctum 2.5% fee calculation & ledger persistence)
 *  - GET /api/estimate/line-items
 *  - POST /api/properties (Property creation mutation)
 *  - GET /api/properties
 *  - POST /api/helios/cognitive-analysis (Cognitive loop damage fusion)
 */

const assert = require('assert');
const http = require('http');
const sharp = require('sharp');
const app = require('../index');
const cvService = require('../src/services/ComputerVisionService');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Milestone 3 Helios Subsystem Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function recordPass(testName) {
    passed++;
    console.log(`  ✅ PASS: ${testName}`);
  }

  function recordFail(testName, error) {
    failed++;
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     Error: ${error.message}\n`);
  }

  // -----------------------------------------------------------
  // Tier 1: Unit & Service Tests for ComputerVisionService
  // -----------------------------------------------------------
  console.log('--- Tier 1: ComputerVisionService Unit Verification ---');

  try {
    assert.strictEqual(typeof cvService.initialize, 'function', 'cvService.initialize must be a function');
    await cvService.initialize();
    recordPass('ComputerVisionService initialization and tf.ready guard');
  } catch (err) {
    recordFail('ComputerVisionService initialization', err);
  }

  try {
    // Generate synthetic test image buffer
    const testImageBuffer = await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 3,
        background: { r: 150, g: 120, b: 110 }
      }
    }).jpeg().toBuffer();

    const result = await cvService.analyzePropertyDamage(testImageBuffer, {
      squareFootage: 2800,
      yearBuilt: 2016
    });

    assert.strictEqual(result.success, true, 'Result success must be true');
    assert.ok(result.analysisId, 'Analysis ID must be present');
    assert.ok(Array.isArray(result.damageDetection.areas), 'Damage detection areas must be an array');
    assert.ok(result.damageDetection.areas.length >= 1, 'At least 1 damage area detected');
    assert.ok(result.damageDetection.averageConfidence >= 0.5 && result.damageDetection.averageConfidence <= 1.0, 'Confidence must be between 0.5 and 1.0');
    assert.ok(result.severityAssessment.score >= 0 && result.severityAssessment.score <= 100, `Score ${result.severityAssessment.score} must be 0-100`);
    assert.ok(result.severityAssessment.estimatedCost > 0, 'Estimated repair cost must be greater than 0');

    recordPass('analyzePropertyDamage generates deterministic detection, classifications, and severity');
  } catch (err) {
    recordFail('analyzePropertyDamage deterministic heuristic', err);
  }

  try {
    // Test null/undefined squareFootage graceful fallback
    const costNull = cvService.estimateRepairCost({ score: 50 }, null);
    assert.ok(!isNaN(costNull), 'Cost with null propertyData must not be NaN');
    assert.ok(costNull > 0, 'Cost with null propertyData must fall back to default sqft calculation');

    const costUndefined = cvService.estimateRepairCost({ score: 60 }, {});
    assert.ok(!isNaN(costUndefined), 'Cost with empty propertyData must not be NaN');
    assert.ok(costUndefined > 0, 'Cost with empty propertyData must fall back to default sqft calculation');

    const ageFactor = cvService.calculateAgeFactor(undefined);
    assert.ok(!isNaN(ageFactor) && ageFactor > 0, 'Age factor with undefined yearBuilt must be valid');

    recordPass('estimateRepairCost and calculateAgeFactor null safety without NaN');
  } catch (err) {
    recordFail('Null safety in ComputerVisionService', err);
  }

  // -----------------------------------------------------------
  // Tier 2: API Endpoints Integration Verification
  // -----------------------------------------------------------
  console.log('\n--- Tier 2: Express REST API Endpoints Verification ---');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. GET /api/contractors/boq
    const boqRes = await fetch(`${baseUrl}/api/contractors/boq`);
    assert.strictEqual(boqRes.status, 200, 'GET /api/contractors/boq must return 200');
    const boqData = await boqRes.json();
    assert.ok(Array.isArray(boqData), 'BOQ response must be an array');
    assert.ok(boqData.length >= 8, 'BOQ catalog must have at least 8 CSI MasterFormat items');
    const firstBoq = boqData[0];
    assert.ok(firstBoq.code, 'BOQ item must have code');
    assert.ok(firstBoq.category, 'BOQ item must have category');
    assert.ok(typeof firstBoq.unit_total === 'number' || typeof firstBoq.price === 'number', 'BOQ item must have unit pricing');
    recordPass('GET /api/contractors/boq returns CSI MasterFormat catalog items with unit pricing');
  } catch (err) {
    recordFail('GET /api/contractors/boq', err);
  }

  try {
    // 2. POST /api/assessments/analyze
    const analyzeRes = await fetch(`${baseUrl}/api/assessments/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_data: { squareFootage: 2600, yearBuilt: 2014 }
      })
    });
    assert.strictEqual(analyzeRes.status, 200, 'POST /api/assessments/analyze must return 200');
    const analyzeData = await analyzeRes.json();
    assert.strictEqual(analyzeData.success, true, 'Analyze response must indicate success');
    assert.ok(analyzeData.damageDetection, 'Analyze response must include damageDetection');
    assert.ok(analyzeData.severityAssessment, 'Analyze response must include severityAssessment');
    recordPass('POST /api/assessments/analyze mounts and executes vision pipeline');
  } catch (err) {
    recordFail('POST /api/assessments/analyze', err);
  }

  try {
    // 3. POST /api/assessments/roof-damage
    const roofRes = await fetch(`${baseUrl}/api/assessments/roof-damage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: 101,
        property_data: { squareFootage: 3200, yearBuilt: 2012 }
      })
    });
    assert.strictEqual(roofRes.status, 200, 'POST /api/assessments/roof-damage must return 200');
    const roofData = await roofRes.json();
    assert.ok(roofData.assessmentId, 'Roof assessment must have assessmentId');
    assert.strictEqual(roofData.property_id, 101, 'Roof assessment property_id must match');
    assert.ok(roofData.damageType, 'Roof assessment must return damageType');
    assert.ok(roofData.severity, 'Roof assessment must return severity');
    assert.ok(typeof roofData.severityScore === 'number', 'Roof assessment must return numerical severityScore');
    assert.ok(typeof roofData.confidence === 'number', 'Roof assessment must return numerical confidence');
    assert.ok(typeof roofData.estimatedCost === 'number', 'Roof assessment must return numerical estimatedCost');
    recordPass('POST /api/assessments/roof-damage satisfies carrier damage assessment contract');
  } catch (err) {
    recordFail('POST /api/assessments/roof-damage', err);
  }

  try {
    // 4. POST /api/estimate/line-items (with Auctum 2.5% fee calculation)
    const testItems = [
      { code: 'RFG-240', desc: 'Laminated Architectural Shingle (30yr)', qty: 38.4, unit: 'SQ', price: 142, total: 5452.80, category: 'Roofing' },
      { code: 'RFG-102', desc: '#15 Synthetic Felt Underlayment', qty: 38.4, unit: 'SQ', price: 18, total: 691.20, category: 'Underlayment' },
      { code: 'RFG-310', desc: 'Ice & Water Shield', qty: 180, unit: 'LF', price: 4.20, total: 756.00, category: 'Waterproofing' }
    ];

    const estimateRes = await fetch(`${baseUrl}/api/estimate/line-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineItems: testItems })
    });

    assert.strictEqual(estimateRes.status, 200, 'POST /api/estimate/line-items must return 200');
    const estimateData = await estimateRes.json();
    assert.strictEqual(estimateData.success, true, 'Estimate response must indicate success');
    assert.strictEqual(estimateData.count, 3, 'Must save 3 line items');

    const expectedSubtotal = Math.round((5452.80 + 691.20 + 756.00) * 100) / 100; // 6900.00
    assert.strictEqual(estimateData.subtotal, expectedSubtotal, `Subtotal ${estimateData.subtotal} must equal ${expectedSubtotal}`);

    const expectedOverhead = Math.round(expectedSubtotal * 0.10 * 100) / 100; // 690.00
    assert.strictEqual(estimateData.overheadProfit, expectedOverhead, `O&P must equal ${expectedOverhead}`);

    const expectedScope = Math.round((expectedSubtotal + expectedOverhead) * 100) / 100; // 7590.00
    assert.strictEqual(estimateData.pricedScope, expectedScope, `Priced scope must equal ${expectedScope}`);

    const expectedFee = Math.round(expectedScope * 0.025 * 100) / 100; // 189.75
    assert.strictEqual(estimateData.auctumFee, expectedFee, `Auctum fee must equal 2.5% (${expectedFee})`);

    const expectedGrand = Math.round((expectedScope + expectedFee) * 100) / 100;
    assert.strictEqual(estimateData.grandTotal, expectedGrand, `Grand total must equal ${expectedGrand}`);

    recordPass('POST /api/estimate/line-items saves ledger and calculates Auctum 2.5% platform fee');
  } catch (err) {
    recordFail('POST /api/estimate/line-items', err);
  }

  try {
    // 5. GET /api/estimate/line-items
    const getEstimateRes = await fetch(`${baseUrl}/api/estimate/line-items`);
    assert.strictEqual(getEstimateRes.status, 200, 'GET /api/estimate/line-items must return 200');
    const savedItems = await getEstimateRes.json();
    assert.ok(Array.isArray(savedItems), 'Line items must be an array');
    assert.strictEqual(savedItems.length, 3, 'Line items must reflect saved count');
    recordPass('GET /api/estimate/line-items retrieves persisted scope ledger');
  } catch (err) {
    recordFail('GET /api/estimate/line-items', err);
  }

  try {
    // 6. POST /api/properties & GET /api/properties
    const newPropPayload = {
      address: '742 Evergreen Terrace',
      city: 'Dallas',
      state: 'TX',
      zip_code: '75204',
      value: 1350000,
      type: 'Residential',
      square_feet: 2950,
      year_built: 2019
    };

    const createPropRes = await fetch(`${baseUrl}/api/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPropPayload)
    });
    assert.strictEqual(createPropRes.status, 201, 'POST /api/properties must return 201');
    const createdProp = await createPropRes.json();
    assert.strictEqual(createdProp.address, newPropPayload.address, 'Created property address must match');
    assert.ok(createdProp.id, 'Created property must have an ID');

    // Retrieve via GET /api/properties
    const getPropsRes = await fetch(`${baseUrl}/api/properties`);
    assert.strictEqual(getPropsRes.status, 200, 'GET /api/properties must return 200');
    const allProps = await getPropsRes.json();
    const found = allProps.find(p => p.address === newPropPayload.address);
    assert.ok(found, 'Created property must appear in GET /api/properties');

    recordPass('POST /api/properties mutation creates property and GET /api/properties reflects it');
  } catch (err) {
    recordFail('POST /api/properties and GET /api/properties', err);
  }

  try {
    // 7. POST /api/helios/cognitive-analysis
    const cognitiveRes = await fetch(`${baseUrl}/api/helios/cognitive-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_data: { id: 1, address: '4821 Preston Hollow Dr' },
        cv_analysis: {
          confidence: 0.86,
          severityAssessment: { score: 55, severity: 'moderate' },
          damageDetection: { totalDetected: 2 }
        }
      })
    });
    assert.strictEqual(cognitiveRes.status, 200, 'POST /api/helios/cognitive-analysis must return 200');
    const cognitiveData = await cognitiveRes.json();
    assert.strictEqual(cognitiveData.success, true, 'Cognitive analysis must return success');
    assert.ok(typeof cognitiveData.enhanced_confidence === 'number', 'Must compute enhanced_confidence');
    assert.ok(typeof cognitiveData.enhanced_risk_score === 'number', 'Must compute enhanced_risk_score');
    assert.ok(cognitiveData.cognitive_insights, 'Must include cognitive_insights');
    assert.ok(Array.isArray(cognitiveData.recommendations), 'Must return recommendations array');

    recordPass('POST /api/helios/cognitive-analysis fuses CV with cognitive loop insights');
  } catch (err) {
    recordFail('POST /api/helios/cognitive-analysis', err);
  }

  server.close();

  console.log('\n====================================================');
  console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
