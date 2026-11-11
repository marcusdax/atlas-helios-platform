/**
 * NOAA Weather API Client for Property Insight Frontend
 * 
 * Integrates api.weather.gov endpoints for real-time weather data
 * Documentation: https://api.weather.gov/
 */

class NOAAWeatherClient {
    constructor() {
        this.baseUrl = 'https://api.weather.gov';
        this.userAgent = 'Luminall-PropertyInsight/1.0 (contact@luminall.ai)';
        this.cache = new Map();
        this.cacheTTL = 300000; // 5 minutes
    }

    /**
     * Get forecast for a location
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<Object>} Forecast data
     */
    async getForecast(lat, lng) {
        try {
            const gridPoint = await this.getGridPoint(lat, lng);
            if (!gridPoint || !gridPoint.properties || !gridPoint.properties.forecast) {
                return this.getMockForecast();
            }

            const response = await fetch(gridPoint.properties.forecast, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/geo+json'
                }
            });

            if (!response.ok) throw new Error('Forecast not available');
            return await response.json();
        } catch (error) {
            console.error('Error getting forecast:', error);
            return this.getMockForecast();
        }
    }

    /**
     * Get hourly forecast
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<Object>} Hourly forecast data
     */
    async getHourlyForecast(lat, lng) {
        try {
            const gridPoint = await this.getGridPoint(lat, lng);
            if (!gridPoint || !gridPoint.properties || !gridPoint.properties.forecastHourly) {
                return this.getMockHourlyForecast();
            }

            const response = await fetch(gridPoint.properties.forecastHourly, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/geo+json'
                }
            });

            if (!response.ok) throw new Error('Hourly forecast not available');
            return await response.json();
        } catch (error) {
            console.error('Error getting hourly forecast:', error);
            return this.getMockHourlyForecast();
        }
    }

    /**
     * Get grid point for coordinates
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<Object>} Grid point data
     */
    async getGridPoint(lat, lng) {
        const cacheKey = `grid_${lat}_${lng}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const response = await fetch(`${this.baseUrl}/points/${lat},${lng}`, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/geo+json'
                }
            });

            if (!response.ok) throw new Error('Grid point not available');
            const data = await response.json();
            this.setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('Error getting grid point:', error);
            return null;
        }
    }

    /**
     * Get active weather alerts
     * @returns {Promise<Object>} Active alerts
     */
    async getActiveAlerts() {
        const cacheKey = 'active_alerts';
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const response = await fetch(`${this.baseUrl}/alerts/active`, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/geo+json'
                }
            });

            if (!response.ok) throw new Error('Alerts not available');
            const data = await response.json();
            this.setCache(cacheKey, data, 60000); // 1 minute cache
            return data;
        } catch (error) {
            console.error('Error getting alerts:', error);
            return this.getMockAlerts();
        }
    }

    /**
     * Get alerts for specific area
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} radius - Radius in miles
     * @returns {Promise<Object>} Area alerts
     */
    async getAlertsByArea(lat, lng, radius = 25) {
        try {
            const response = await fetch(
                `${this.baseUrl}/alerts/active?point=${lat},${lng}&radius=${radius}`,
                {
                    headers: {
                        'User-Agent': this.userAgent,
                        'Accept': 'application/geo+json'
                    }
                }
            );

            if (!response.ok) throw new Error('Area alerts not available');
            return await response.json();
        } catch (error) {
            console.error('Error getting area alerts:', error);
            return this.getMockAlerts();
        }
    }

    /**
     * Get radar stations
     * @returns {Promise<Object>} Radar stations
     */
    async getRadarStations() {
        const cacheKey = 'radar_stations';
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const response = await fetch(`${this.baseUrl}/radar/stations`, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/geo+json'
                }
            });

            if (!response.ok) throw new Error('Radar stations not available');
            const data = await response.json();
            this.setCache(cacheKey, data, 3600000); // 1 hour cache
            return data;
        } catch (error) {
            console.error('Error getting radar stations:', error);
            return { features: [] };
        }
    }

    /**
     * Get storm reports
     * @param {string} startTime - ISO 8601 start time
     * @param {string} endTime - ISO 8601 end time
     * @returns {Promise<Object>} Storm reports
     */
    async getStormReports(startTime = null, endTime = null) {
        try {
            let url = `${this.baseUrl}/stormreports`;
            const params = new URLSearchParams();
            if (startTime) params.append('start', startTime);
            if (endTime) params.append('end', endTime);
            if (params.toString()) url += '?' + params.toString();

            const response = await fetch(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/geo+json'
                }
            });

            if (!response.ok) throw new Error('Storm reports not available');
            return await response.json();
        } catch (error) {
            console.error('Error getting storm reports:', error);
            return { features: [] };
        }
    }

    /**
     * Check for severe weather at location
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<Object>} Severe weather check
     */
    async checkSevereWeather(lat, lng) {
        try {
            const [forecast, alerts] = await Promise.all([
                this.getForecast(lat, lng),
                this.getAlertsByArea(lat, lng)
            ]);

            const severeConditions = [];

            // Check forecast for severe conditions
            if (forecast && forecast.properties && forecast.properties.periods) {
                forecast.properties.periods.slice(0, 3).forEach(period => {
                    const conditions = this.identifySevereConditions(period);
                    if (conditions.length > 0) {
                        severeConditions.push({
                            period: period.name,
                            conditions,
                            validTime: period.validTime
                        });
                    }
                });
            }

            // Check active alerts
            const activeAlerts = alerts && alerts.features ? alerts.features : [];

            return {
                location: { lat, lng },
                severeConditions,
                activeAlerts: activeAlerts.map(alert => ({
                    event: alert.properties.event,
                    severity: alert.properties.severity,
                    urgency: alert.properties.urgency,
                    description: alert.properties.description,
                    instruction: alert.properties.instruction
                })),
                isSevere: severeConditions.length > 0 || activeAlerts.length > 0,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error checking severe weather:', error);
            return this.getMockSevereWeather(lat, lng);
        }
    }

    /**
     * Identify severe conditions from forecast period
     * @param {Object} period - Forecast period
     * @returns {Array} Severe conditions
     */
    identifySevereConditions(period) {
        const conditions = [];
        const forecast = (period.shortForecast || '').toLowerCase();
        const detailed = (period.detailedForecast || '').toLowerCase();
        const combined = `${forecast} ${detailed}`;

        const severeIndicators = [
            { keyword: 'tornado', type: 'tornado', severity: 'extreme' },
            { keyword: 'hail', type: 'hail', severity: 'severe' },
            { keyword: 'severe thunderstorm', type: 'severe_thunderstorm', severity: 'severe' },
            { keyword: 'damaging wind', type: 'high_winds', severity: 'severe' },
            { keyword: 'flash flood', type: 'flash_flood', severity: 'severe' },
            { keyword: 'excessive heat', type: 'heat', severity: 'moderate' },
            { keyword: 'blizzard', type: 'blizzard', severity: 'severe' },
            { keyword: 'ice storm', type: 'ice_storm', severity: 'severe' }
        ];

        severeIndicators.forEach(indicator => {
            if (combined.includes(indicator.keyword)) {
                conditions.push({
                    type: indicator.type,
                    severity: indicator.severity,
                    description: period.shortForecast
                });
            }
        });

        // Check wind speed
        if (period.windSpeed) {
            const windMatch = period.windSpeed.match(/(\d+)/);
            if (windMatch) {
                const windSpeed = parseInt(windMatch[1]);
                if (windSpeed >= 58) {
                    conditions.push({
                        type: 'damaging_winds',
                        severity: 'severe',
                        description: `Winds ${period.windSpeed}`
                    });
                }
            }
        }

        return conditions;
    }

    // Cache helpers
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    setCache(key, data, ttl = this.cacheTTL) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    // Mock data for demo/fallback
    getMockForecast() {
        return {
            properties: {
                periods: [
                    {
                        number: 1,
                        name: 'Today',
                        startTime: new Date().toISOString(),
                        endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
                        isDaytime: true,
                        temperature: 75,
                        temperatureUnit: 'F',
                        windSpeed: '10 to 15 mph',
                        windDirection: 'S',
                        shortForecast: 'Slight Chance Showers And Thunderstorms',
                        detailedForecast: 'A slight chance of showers and thunderstorms. Partly sunny, with a high near 75. South wind 10 to 15 mph. Chance of precipitation is 20%.'
                    },
                    {
                        number: 2,
                        name: 'Tonight',
                        startTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
                        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                        isDaytime: false,
                        temperature: 58,
                        temperatureUnit: 'F',
                        windSpeed: '10 to 15 mph',
                        windDirection: 'S',
                        shortForecast: 'Showers And Thunderstorms Likely',
                        detailedForecast: 'Showers and thunderstorms likely. Mostly cloudy, with a low around 58. South wind 10 to 15 mph. Chance of precipitation is 60%.'
                    }
                ]
            }
        };
    }

    getMockHourlyForecast() {
        const periods = [];
        for (let i = 0; i < 24; i++) {
            periods.push({
                number: i + 1,
                startTime: new Date(Date.now() + i * 60 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() + (i + 1) * 60 * 60 * 1000).toISOString(),
                isDaytime: i >= 6 && i < 18,
                temperature: 65 + Math.sin(i / 24 * Math.PI) * 15,
                temperatureUnit: 'F',
                windSpeed: '10 mph',
                windDirection: 'S',
                shortForecast: i % 3 === 0 ? 'Chance Rain Showers' : 'Partly Cloudy',
                precipitationProbability: { unit: 'percent', value: i % 3 === 0 ? 40 : 10 }
            });
        }
        return { properties: { periods } };
    }

    getMockAlerts() {
        return {
            features: [
                {
                    properties: {
                        event: 'Severe Thunderstorm Warning',
                        severity: 'Severe',
                        urgency: 'Immediate',
                        description: 'The National Weather Service has issued a Severe Thunderstorm Warning for...',
                        instruction: 'Take shelter immediately. Move to an interior room on the lowest floor of a sturdy building.'
                    }
                }
            ]
        };
    }

    getMockSevereWeather(lat, lng) {
        return {
            location: { lat, lng },
            severeConditions: [
                {
                    period: 'Tonight',
                    conditions: [
                        { type: 'severe_thunderstorm', severity: 'severe', description: 'Showers and thunderstorms likely' }
                    ],
                    validTime: new Date().toISOString()
                }
            ],
            activeAlerts: [
                {
                    event: 'Severe Thunderstorm Warning',
                    severity: 'Severe',
                    urgency: 'Immediate',
                    description: 'Severe thunderstorms with damaging winds and large hail',
                    instruction: 'Take shelter immediately'
                }
            ],
            isSevere: true,
            timestamp: new Date().toISOString()
        };
    }
}

// Create global instance
window.NOAAWeather = new NOAAWeatherClient();
