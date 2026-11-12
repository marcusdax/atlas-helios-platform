'use strict';

/**
 * The weather service's honesty, and the routes that surface it.
 *
 * Every read in NOAAWeatherService used to fall back to a mock generator on any
 * failure and return it through the same field as a real response. A dashboard
 * could not tell a 24-hour forecast from a sine wave, and `/api/weather/alerts`
 * would serve an invented "Severe Thunderstorm Warning ... Take shelter
 * immediately" that no meteorologist had issued.
 *
 * These tests pin the replacement: a failure is reported as a failure, a
 * success says where it came from, and alerts never fabricate - not even with
 * the demo flag on.
 */

process.env.NODE_ENV = 'test';

const express = require('express');
const request = require('supertest');

const service = require('../src/services/NOAAWeatherService');

/** api.weather.gov is unreachable: the state this all hinges on. */
const breakUpstream = () => {
  service.httpClient = {
    get: async () => { throw new Error('getaddrinfo ENOTFOUND api.weather.gov'); }
  };
};

/** api.weather.gov answers, with the shape its hourly forecast really has. */
const workingUpstream = () => {
  service.httpClient = {
    get: async (url) => {
      if (String(url).includes('/points/')) {
        return {
          data: {
            properties: {
              forecast: 'https://api.weather.gov/gridpoints/FWD/80,103/forecast',
              forecastHourly: 'https://api.weather.gov/gridpoints/FWD/80,103/forecast/hourly'
            }
          }
        };
      }
      if (String(url).includes('/alerts/active')) {
        return { data: { type: 'FeatureCollection', features: [] } };
      }
      return {
        data: {
          properties: {
            periods: [
              {
                number: 1,
                startTime: '2026-03-14T18:00:00-05:00',
                temperature: 71,
                temperatureUnit: 'F',
                windSpeed: '15 mph',
                shortForecast: 'Chance Showers And Thunderstorms',
                probabilityOfPrecipitation: { value: 40 }
              }
            ]
          }
        }
      };
    }
  };
};

const realClient = service.httpClient;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/weather', require('../src/routes/weatherRoutes'));
  return app;
}

const app = buildApp();

beforeEach(() => {
  service.cache.flushAll();
  service.allowMock = false;
});

afterAll(() => {
  service.httpClient = realClient;
});

describe('weather service provenance', () => {
  test('a working upstream is stamped as coming from NWS', async () => {
    workingUpstream();
    const forecast = await service.getHourlyForecast(32.7767, -96.797);
    expect(forecast.source).toBe('nws');
    expect(forecast.properties.periods[0].temperature).toBe(71);
  });

  test('an unreachable upstream throws rather than inventing a forecast', async () => {
    breakUpstream();
    await expect(service.getHourlyForecast(32.7767, -96.797)).rejects.toMatchObject({
      code: 'WEATHER_UNAVAILABLE'
    });
    await expect(service.getForecast(32.7767, -96.797)).rejects.toMatchObject({
      code: 'WEATHER_UNAVAILABLE'
    });
  });

  test('the demo flag brings the mock back, stamped so it can be labelled', async () => {
    breakUpstream();
    service.allowMock = true;
    const forecast = await service.getHourlyForecast(32.7767, -96.797);
    expect(forecast.source).toBe('mock');
    expect(forecast.properties.periods).toHaveLength(24);
  });

  test('alerts never fabricate, even with the demo flag on', async () => {
    // The one rule with no opt-out. A warning that tells a person to take
    // shelter is not a degraded experience if it is invented, it is a hazard.
    breakUpstream();
    service.allowMock = true;

    await expect(service.getActiveAlerts()).rejects.toMatchObject({ code: 'WEATHER_UNAVAILABLE' });
    await expect(service.getAlertsByArea(32.7767, -96.797)).rejects.toMatchObject({
      code: 'WEATHER_UNAVAILABLE'
    });
  });

  test('a severe-weather check does not answer "all clear" from a guess', async () => {
    // `isSevere: false` is the dangerous direction of this failure: it reads as
    // an all-clear that nobody actually checked.
    breakUpstream();
    await expect(service.checkSevereWeather(32.7767, -96.797)).rejects.toMatchObject({
      code: 'WEATHER_UNAVAILABLE'
    });
  });
});

describe('weather routes', () => {
  test('a missing coordinate is a 400, not a guess at a location', async () => {
    const res = await request(app).get('/api/weather/forecast/hourly').expect(400);
    expect(res.body.error).toMatch(/lat, lng/);
  });

  test('a non-numeric coordinate is rejected', async () => {
    await request(app)
      .get('/api/weather/forecast/hourly?lat=north&lng=west')
      .expect(400);
  });

  test('an unreachable upstream surfaces as 503 with a branchable code', async () => {
    // 503 + a stable code is what lets the dashboard mark one lane DEGRADED
    // and keep its last known figures, instead of treating it as a bug.
    breakUpstream();
    const res = await request(app)
      .get('/api/weather/forecast/hourly?lat=32.7767&lng=-96.797')
      .expect(503);
    expect(res.body.code).toBe('WEATHER_UNAVAILABLE');
  });

  test('a working upstream answers with the forecast and its provenance', async () => {
    workingUpstream();
    const res = await request(app)
      .get('/api/weather/forecast/hourly?lat=32.7767&lng=-96.797')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.source).toBe('nws');
    expect(res.body.data.properties.periods[0].shortForecast).toMatch(/Thunderstorms/);
    expect(res.body.location).toEqual({ lat: 32.7767, lng: -96.797 });
  });

  test('the alert endpoint 503s rather than serving an invented warning', async () => {
    breakUpstream();
    const res = await request(app).get('/api/weather/alerts').expect(503);
    expect(res.body.code).toBe('WEATHER_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toMatch(/Take shelter/i);
  });
});
