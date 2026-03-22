# Atlas Helios Platform - Integration Guide

## Overview

The Atlas Helios Platform is now fully integrated with:

1. **G:\nexus-mind-ai** - Cognitive AI engine (Nexus Mind AI)
2. **G:\perception_models** - Facebook's Perception Encoder (Vision)
3. **G:\perception_models_shared** - Shared perception utilities

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Atlas Helios Platform                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Frontend   │  │   Backend    │  │  CV Service  │  │ Storm Service│   │
│  │   (React)    │  │   (Node.js)  │  │   (Node.js)  │  │   (Node.js)  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
└─────────┼─────────────────┼─────────────────┼─────────────────┼─────────────┘
          │                 │                 │                 │
          │                 │   REST API      │                 │
          │                 │◄────────────────►│                 │
          │                 │                 │                 │
          │                 ▼                 │                 │
          │    ┌─────────────────────────┐    │                 │
          │    │   Nexus Mind Bridge     │    │                 │
          │    │     (Python/Flask)      │    │                 │
          │    │     Port: 5051          │    │                 │
          │    └───────────┬─────────────┘    │                 │
          │                │                  │                 │
          └────────────────┼──────────────────┘                 │
                           │                                    │
           ┌───────────────┼───────────────┐                    │
           ▼               ▼               ▼                    │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐     │
│  Nexus Mind AI  │ │Perception Models│ │ Perception      │     │
│  G:\nexus-mind-ai│ │ G:\perception   │ │ Shared          │     │
│                 │ │    _models      │ │ G:\perception   │     │
│ - Cognitive     │ │                 │ │    _models      │     │
│   Pipeline      │ │ - Vision        │ │    _shared      │     │
│ - Storm Intel   │ │   Encoder       │ │                 │     │
│ - Property      │ │ - Image         │ │ - Shared        │     │
│   Analysis      │ │   Classification│ │   Utilities     │     │
└─────────────────┘ └─────────────────┘ └─────────────────┘     │
                                                                │
┌───────────────────────────────────────────────────────────────┘
│
└──► All powered by Nexus Mind AI cognitive engine
```

## Components

### 1. Nexus Bridge Service (`nexus-bridge/nexus_bridge_service.py`)

A Python Flask service that bridges Node.js backend with Python AI modules.

**Features:**
- Storm event cognitive analysis
- Property damage assessment with AI enhancement
- Image encoding via Perception Encoder
- Zero-shot image classification
- Cognitive pipeline processing

**Endpoints:**
- `GET /health` - Health check
- `POST /initialize` - Initialize AI components
- `POST /storm/analyze` - Analyze storm events
- `POST /property/analyze` - Analyze properties
- `POST /vision/encode` - Encode images
- `POST /vision/classify` - Classify images
- `POST /cognitive/process` - Cognitive processing

### 2. Nexus Mind Integration (`backend/src/integrations/NexusMindIntegration.js`)

JavaScript service that connects backend to Nexus Bridge.

**Methods:**
- `initialize(config)` - Initialize the integration
- `processStormEvent(stormData)` - Storm cognitive analysis
- `analyzeProperty(propertyData, cvAnalysis)` - Property AI analysis
- `encodeImage(imagePath)` - Image feature extraction
- `classifyImage(imagePath, labels)` - Zero-shot classification
- `cognitiveProcess(sensorData, context)` - Cognitive pipeline

### 3. Nexus API Routes (`backend/src/routes/nexusRoutes.js`)

REST API endpoints for Nexus Mind functionality.

**Routes:**
- `GET /api/nexus/status` - Integration status
- `POST /api/nexus/storm/analyze` - Storm analysis
- `POST /api/nexus/property/analyze` - Property analysis
- `POST /api/nexus/vision/classify` - Image classification
- `POST /api/nexus/cognitive/process` - Cognitive processing
- `GET /api/nexus/config` - Bridge configuration

## Quick Start

### 1. Start the Integrated System

```powershell
# Start all services (Nexus Bridge + Backend)
.\start-integrated-system.ps1
```

### 2. Verify Integrations

```powershell
# Run verification tests
.\verify-integrations.ps1
```

### 3. Manual Start (Alternative)

```powershell
# Terminal 1: Start Nexus Bridge
python nexus-bridge\nexus_bridge_service.py --port 5051

# Terminal 2: Start Backend
cd backend
npm start

# Terminal 3: Start Frontend (optional)
cd frontend
npm start
```

## Configuration

### Environment Variables (`.env`)

```bash
# Nexus Mind AI Integration
NEXUS_BRIDGE_URL=http://localhost:5051
NEXUS_MIND_PATH=G:\nexus-mind-ai
PERCEPTION_MODELS_PATH=G:\perception_models
PERCEPTION_MODELS_SHARED_PATH=G:\perception_models_shared
ENABLE_NEXUS_COGNITIVE=true
ENABLE_PERCEPTION_ENCODER=true
PERCEPTION_CONFIG=PE-Core-B16-224
```

### Perception Encoder Configurations

Available configs:
- `PE-Core-G14-448` - Largest model, best accuracy
- `PE-Core-L14-336` - Large model
- `PE-Core-B16-224` - Base model (default)
- `PE-Core-S16-384` - Small model
- `PE-Core-T16-384` - Tiny model, fastest

## API Usage Examples

### Storm Analysis with Cognitive Enhancement

```bash
curl -X POST http://localhost:5000/api/nexus/storm/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "id": "storm-001",
    "type": "hail",
    "severity": 85,
    "affectedProperties": 250,
    "alertLevel": "warning",
    "regionName": "Dallas County"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "storm_data": { ... },
    "cognitive_analysis": {
      "anomaly_score": 0.82,
      "intent": "severe_weather_alert"
    },
    "enhanced_risk_score": 78.5,
    "recommendations": [ ... ]
  },
  "enhanced": true
}
```

### Property Analysis

```bash
curl -X POST http://localhost:5000/api/nexus/property/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "property": {
      "id": "prop-001",
      "address": "123 Main St",
      "yearBuilt": 2005,
      "squareFootage": 2400
    },
    "cv_analysis": {
      "damageDetection": { ... },
      "confidence": 0.87
    }
  }'
```

### Image Classification

```bash
curl -X POST http://localhost:5000/api/nexus/vision/classify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "image_path": "uploads/property_001.jpg",
    "labels": ["roof_damage", "water_damage", "wind_damage", "no_damage"]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scores": {
      "roof_damage": 0.82,
      "water_damage": 0.15,
      "wind_damage": 0.03,
      "no_damage": 0.00
    },
    "predicted": "roof_damage"
  }
}
```

## Data Flow

### Storm Intelligence Flow

```
Storm Event → Backend → Nexus Bridge → Nexus Mind AI → Cognitive Analysis
                                               ↓
                                        Enhanced Risk Score
                                               ↓
Storm Alert ← Backend ← Recommendations ← Storm Cache
```

### Property Assessment Flow

```
Property Image → CV Service → Damage Detection
                                    ↓
Property Data → Nexus Bridge → Nexus Mind AI
                                    ↓
                           Enhanced Analysis
                                    ↓
Assessment Result ← Backend ← Recommendations
```

## Troubleshooting

### Bridge Connection Failed

```powershell
# Check if bridge is running
curl http://localhost:5051/health

# Restart bridge
python nexus-bridge\nexus_bridge_service.py
```

### Module Not Found

```powershell
# Verify paths exist
Test-Path G:\nexus-mind-ai
Test-Path G:\perception_models
Test-Path G:\perception_models_shared
```

### Backend Can't Connect

```powershell
# Check backend health
curl http://localhost:5000/health

# Verify environment variables
Get-Content backend\.env
```

## Service Dependencies

```
nexus-bridge
  ├── requires: G:\nexus-mind-ai
  ├── requires: G:\perception_models
  └── requires: G:\perception_models_shared

backend
  ├── requires: PostgreSQL (localhost:5432)
  ├── requires: Redis (localhost:6379)
  └── requires: nexus-bridge (localhost:5051) [optional]

frontend
  └── requires: backend (localhost:5000)
```

## Ports

| Service | Port | Description |
|---------|------|-------------|
| Nexus Bridge | 5051 | Python AI bridge |
| Backend | 5000 | Node.js API server |
| Frontend | 3000 | React development |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache/Sessions |
| pgAdmin | 5050 | DB management |

## File Structure

```
atlas-helios-platform/
├── nexus-bridge/
│   └── nexus_bridge_service.py    # Python bridge service
├── backend/
│   ├── src/
│   │   ├── integrations/
│   │   │   └── NexusMindIntegration.js  # JS integration
│   │   └── routes/
│   │       └── nexusRoutes.js     # API routes
│   └── .env                       # Environment config
├── start-integrated-system.ps1    # Startup script
└── verify-integrations.ps1        # Verification script
```

## Support

For issues or questions:
1. Check logs: `backend/logs/`
2. Run verification: `.\verify-integrations.ps1`
3. Review configuration: `backend/.env`
