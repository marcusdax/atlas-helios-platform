# NOAA Weather API Integration

## Overview

The Atlas Helios Platform now includes the **NOAA Weather API** integration from the Luminall PropertyInsight project. This provides real-time weather data, forecasts, alerts, and severe weather monitoring directly from the National Weather Service API (`api.weather.gov`).

## Features

- **Real-time Weather Data**: Access current conditions and forecasts
- **Severe Weather Alerts**: Monitor active weather alerts and warnings
- **Storm Reports**: Retrieve official storm reports from NWS
- **Radar Stations**: Get radar station information
- **Location-based Forecasts**: Grid-based forecasts for any US location
- **Caching**: Built-in caching to optimize API usage
- **Mock Data**: Fallback mock data for development/testing

## Components

### 1. Backend Service (`backend/src/services/NOAAWeatherService.js`)

A comprehensive Node.js service that wraps the NOAA Weather API.

**Features:**
- Grid point lookup for coordinates
- Daily and hourly forecasts
- Active weather alerts
- Area-specific alerts
- Severe weather detection
- Storm reports
- Radar station data
- Intelligent caching (5 min default, 1 min for alerts, 1 hour for radar)

**Key Methods:**
- `getForecast(lat, lng)` - Get daily forecast
- `getHourlyForecast(lat, lng)` - Get hourly forecast
- `getActiveAlerts()` - Get all active alerts
- `getAlertsByArea(lat, lng, radius)` - Get alerts for specific area
- `checkSevereWeather(lat, lng)` - Check for severe conditions
- `getStormReports(start, end)` - Get storm reports
- `getRadarStations()` - Get radar stations
- `getWeatherZones(lat, lng)` - Get weather zones for location

### 2. API Routes (`backend/src/routes/weatherRoutes.js`)

REST API endpoints for weather data.

**Endpoints:**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/weather/status` | Service status | No |
| GET | `/api/weather/forecast` | Get forecast (lat, lng) | No |
| GET | `/api/weather/forecast/hourly` | Get hourly forecast | No |
| GET | `/api/weather/alerts` | Get active alerts | No |
| GET | `/api/weather/alerts/area` | Get area alerts (lat, lng, radius) | No |
| GET | `/api/weather/severe` | Check severe weather (lat, lng) | No |
| GET | `/api/weather/radar/stations` | Get radar stations | No |
| GET | `/api/weather/stormreports` | Get storm reports | No |
| GET | `/api/weather/zones` | Get weather zones | No |
| POST | `/api/weather/batch/severe` | Batch severe check | Yes |

### 3. Frontend Client (`frontend/public/noaa-weather.js`)

Browser-based NOAA Weather API client for frontend use.

**Features:**
- Same API as backend for consistency
- Browser caching
- Mock data fallback
- Severe weather identification

**Usage:**
```javascript
// Get forecast
const forecast = await window.NOAAWeather.getForecast(32.7767, -96.7970);

// Check severe weather
const severe = await window.NOAAWeather.checkSevereWeather(32.7767, -96.7970);

// Get active alerts
const alerts = await window.NOAAWeather.getActiveAlerts();
```

## API Usage Examples

### Get Weather Forecast

```bash
curl "http://localhost:5000/api/weather/forecast?lat=32.7767&lng=-96.7970"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "properties": {
      "periods": [
        {
          "number": 1,
          "name": "Today",
          "temperature": 75,
          "temperatureUnit": "F",
          "windSpeed": "10 to 15 mph",
          "shortForecast": "Slight Chance Showers And Thunderstorms",
          "detailedForecast": "A slight chance of showers and thunderstorms..."
        }
      ]
    }
  },
  "location": { "lat": 32.7767, "lng": -96.7970 },
  "timestamp": "2026-03-19T17:25:17.529Z"
}
```

### Check Severe Weather

```bash
curl "http://localhost:5000/api/weather/severe?lat=32.7767&lng=-96.7970"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "location": { "lat": 32.7767, "lng": -96.7970 },
    "severeConditions": [
      {
        "period": "Tonight",
        "conditions": [
          { "type": "severe_thunderstorm", "severity": "severe", "description": "..." }
        ]
      }
    ],
    "activeAlerts": [
      {
        "event": "Severe Thunderstorm Warning",
        "severity": "Severe",
        "urgency": "Immediate",
        "description": "...",
        "instruction": "Take shelter immediately"
      }
    ],
    "isSevere": true,
    "timestamp": "2026-03-19T17:25:25.720Z"
  },
  "isSevere": true,
  "timestamp": "2026-03-19T17:25:25.720Z"
}
```

### Get Active Alerts

```bash
curl "http://localhost:5000/api/weather/alerts"
```

**Response:**
```json
{
  "success": true,
  "data": { "features": [...] },
  "count": 42,
  "timestamp": "2026-03-19T17:25:30.000Z"
}
```

### Batch Severe Weather Check

```bash
curl -X POST "http://localhost:5000/api/weather/batch/severe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "locations": [
      { "lat": 32.7767, "lng": -96.7970 },
      { "lat": 29.7604, "lng": -95.3698 },
      { "lat": 30.2672, "lng": -97.7431 }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "totalChecked": 3,
  "severeCount": 1,
  "timestamp": "2026-03-19T17:25:35.000Z"
}
```

## Configuration

### Environment Variables (`.env`)

```bash
# NOAA Weather API Integration
ENABLE_NOAA_WEATHER=true
NOAA_BASE_URL=https://api.weather.gov
NOAA_USER_AGENT=AtlasHelios-Platform/1.0 (contact@atlashelios.ai)
```

### Caching Strategy

| Data Type | Cache TTL | Description |
|-----------|-----------|-------------|
| Grid Points | 1 hour | Location to grid conversion |
| Forecasts | 5 minutes | Weather forecasts |
| Alerts | 1 minute | Active alerts (frequently updated) |
| Radar Stations | 1 hour | Station locations |
| Storm Reports | No cache | Historical data |

## Severe Weather Detection

The service automatically identifies severe weather conditions:

### Detected Conditions

| Condition | Keywords | Severity |
|-----------|----------|----------|
| Tornado | "tornado" | Extreme |
| Hail | "hail" | Severe |
| Severe Thunderstorm | "severe thunderstorm" | Severe |
| High Winds | "damaging wind", wind >= 58 mph | Severe |
| Flash Flood | "flash flood" | Severe |
| Hurricane | "hurricane" | Extreme |
| Tropical Storm | "tropical storm" | Severe |
| Blizzard | "blizzard" | Severe |
| Ice Storm | "ice storm" | Severe |
| Winter Storm | "winter storm" | Severe |
| Excessive Heat | "excessive heat" | Moderate |
| Flood | "flood" | Moderate |

## Integration with Storm Service

The NOAA Weather Service integrates with the existing Storm Service to provide:

1. **Real-time Alert Monitoring**: Automatic checking of active alerts
2. **Forecast-based Storm Prediction**: Identifying potential severe weather
3. **Property Risk Assessment**: Weather-based property risk scoring
4. **Storm Report Correlation**: Matching storm reports with property damage

## Error Handling

The service includes comprehensive error handling:

- **Network Errors**: Returns mock data as fallback
- **Invalid Coordinates**: Returns 400 error with message
- **Service Unavailable**: Returns 503 error
- **API Rate Limits**: Uses caching to minimize requests

## Mock Data

When the NOAA API is unavailable or for development/testing, the service provides mock data:

- Mock forecasts with realistic weather data
- Mock alerts for testing alert handling
- Mock severe weather conditions
- Configurable mock responses

## Health Check

The NOAA Weather Service status is included in the main health check:

```bash
curl http://localhost:5000/health
```

**Response includes:**
```json
{
  "integrations": {
    "noaa_weather": {
      "initialized": true,
      "baseUrl": "https://api.weather.gov",
      "cacheStats": {
        "hits": 10,
        "misses": 5,
        "keys": 3
      }
    }
  }
}
```

## Best Practices

1. **Use Coordinates**: Always provide lat/lng for accurate local weather
2. **Handle Mock Data**: Be prepared for mock data in development
3. **Cache Appropriately**: Don't make excessive API calls
4. **Check Severe Weather**: Regularly check for severe conditions in monitored areas
5. **Batch Requests**: Use batch endpoint for multiple locations

## Rate Limiting

The NOAA Weather API has rate limits. The service handles this by:

- Caching responses appropriately
- Using efficient grid point lookups
- Providing mock data as fallback
- Logging rate limit errors

## Support

For NOAA Weather API issues:
- Check service status: `GET /api/weather/status`
- Review logs: `backend/logs/`
- Test endpoints directly with curl/browser

For more information about the NOAA Weather API:
- Documentation: https://api.weather.gov/
- OpenAPI Spec: https://api.weather.gov/openapi.json
