const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '50mb' }));

function callHomeHarvestPython(method, data) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'bridge_homeharvest.py');
    const py = spawn('python', [pythonScript, method, JSON.stringify(data)], {
      cwd: __dirname
    });
    
    let output = '';
    let error = '';
    
    py.stdout.on('data', (data) => { output += data.toString(); });
    py.stderr.on('data', (data) => { error += data.toString(); });
    
    py.on('close', (code) => {
      console.error('PYTHON DEBUG: Method:', method);
      console.error('PYTHON DEBUG: Data:', JSON.stringify(data));
      console.error('PYTHON DEBUG: Code:', code);
      console.error('PYTHON DEBUG: Output len:', output.length);
      if (error) console.error('PYTHON DEBUG: Error:', error);
      if (code !== 0) {
        reject(new Error(error || `Python process exited with code ${code}`));
      } else {
        try {
          resolve(JSON.parse(output));
        } catch (e) {
          console.error('PYTHON DEBUG: JSON parse error:', e.message);
          console.error('PYTHON DEBUG: Raw output start:', output.substring(0, 500));
          resolve({ raw_output: output });
        }
      }
    });
  });
}

app.get('/api/harvest/details/:mlsId', async (req, res) => {
  console.error('ROUTE DEBUG: Entered harvest details route');
  console.error('ROUTE DEBUG: mlsId param:', req.params.mlsId);
  try {
    const { mlsId } = req.params;
    console.error('ROUTE DEBUG: Calling Python with mls_id:', mlsId);
    const result = await callHomeHarvestPython('get_property_details', { mls_id: mlsId });
    console.error('ROUTE DEBUG: Got result keys:', Object.keys(result));
    res.json(result);
  } catch (error) {
    console.error('ROUTE ERROR:', error);
    res.status(500).json({ error: 'Failed', details: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => console.log('Test Server on 3001'));