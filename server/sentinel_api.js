const axios = require('axios');

const SENTINEL_HUB_BASE_URL = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0';

/**
 * Search Sentinel satellite data using STAC API
 * @param {Object} params - Search parameters
 * @param {Array} params.bbox - Bounding box [minLon, minLat, maxLon, maxLat]
 * @param {string} params.datetime - Date range (ISO 8601)
 * @param {Array} params.collections - Collection names
 * @param {number} params.limit - Max results
 * @param {Object} params.filter - CQL2 filter
 * @returns {Promise<Object>} Search results
 */
async function searchSentinelData(params) {
  const {
    bbox,
    datetime,
    collections = ['sentinel-2-l2a'],
    limit = 10,
    filter,
    fields
  } = params;

  const data = {
    bbox,
    datetime,
    collections,
    limit
  };

  if (filter) {
    data.filter = filter;
    data['filter-lang'] = 'cql2-json';
  }

  if (fields) {
    data.fields = fields;
  }

  try {
    const response = await axios.post(
      `${SENTINEL_HUB_BASE_URL}/search`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    return response.data;
  } catch (error) {
    console.error('Sentinel API Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      throw new Error(`Sentinel API: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Get available collections
 * @returns {Promise<Array>} List of collections
 */
async function getCollections() {
  try {
    const response = await axios.get(`${SENTINEL_HUB_BASE_URL}/collections`, {
      headers: { 'Accept': 'application/json' },
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error('Get Collections Error:', error.message);
    throw error;
  }
}

/**
 * Get specific collection details
 * @param {string} collectionId - Collection ID
 * @returns {Promise<Object>} Collection details
 */
async function getCollection(collectionId) {
  try {
    const response = await axios.get(
      `${SENTINEL_HUB_BASE_URL}/collections/${collectionId}`,
      {
        headers: { 'Accept': 'application/json' },
        timeout: 30000
      }
    );
    return response.data;
  } catch (error) {
    console.error('Get Collection Error:', error.message);
    throw error;
  }
}

/**
 * Get distinct values for a property
 * @param {Object} params - Search parameters
 * @param {string} params.distinct - Property name
 * @param {Array} params.bbox - Bounding box
 * @param {string} params.datetime - Date range
 * @param {Array} params.collections - Collections
 * @returns {Promise<Object>} Distinct values
 */
async function getDistinctValues(params) {
  const {
    distinct,
    bbox,
    datetime,
    collections = ['sentinel-2-l2a']
  } = params;

  const data = {
    distinct,
    bbox,
    datetime,
    collections
  };

  try {
    const response = await axios.post(
      `${SENTINEL_HUB_BASE_URL}/search`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    return response.data;
  } catch (error) {
    console.error('Distinct Values Error:', error.message);
    throw error;
  }
}

/**
 * Search for property imagery by address/location
 * Simplified interface for property intelligence
 * @param {Object} params
 * @param {number} params.lat - Latitude
 * @param {number} params.lon - Longitude
 * @param {number} params.radius - Search radius in km
 * @param {string} params.startDate - Start date (YYYY-MM-DD)
 * @param {string} params.endDate - End date (YYYY-MM-DD)
 * @param {number} params.maxCloudCover - Max cloud cover %
 * @returns {Promise<Object>} Imagery results
 */
async function searchPropertyImagery(params) {
  const {
    lat,
    lon,
    radius = 1, // km
    startDate,
    endDate,
    maxCloudCover = 20
  } = params;

  // Convert radius to approximate degrees
  const radiusDeg = radius / 111; // ~111km per degree
  
  const bbox = [
    lon - radiusDeg,
    lat - radiusDeg,
    lon + radiusDeg,
    lat + radiusDeg
  ];

  const datetime = startDate && endDate 
    ? `${startDate}T00:00:00Z/${endDate}T23:59:59Z`
    : '2024-01-01T00:00:00Z/2024-12-31T23:59:59Z';

  const filter = {
    op: 'lte',
    args: [
      { property: 'eo:cloud_cover' },
      maxCloudCover
    ]
  };

  const fields = {
    include: [
      'id',
      'datetime',
      'eo:cloud_cover',
      'sara:resolution',
      'assets'
    ]
  };

  return searchSentinelData({
    bbox,
    datetime,
    collections: ['sentinel-2-l2a'],
    limit: 20,
    filter,
    fields
  });
}

/**
 * Get available dates for a location
 * @param {Object} params
 * @param {number} params.lat - Latitude
 * @param {number} params.lon - Longitude
 * @param {number} params.radius - Search radius in km
 * @param {string} params.startDate - Start date
 * @param {string} params.endDate - End date
 * @returns {Promise<Object>} Available acquisition dates
 */
async function getAvailableDates(params) {
  const {
    lat,
    lon,
    radius = 1,
    startDate,
    endDate
  } = params;

  const radiusDeg = radius / 111;
  
  const bbox = [
    lon - radiusDeg,
    lat - radiusDeg,
    lon + radiusDeg,
    lat + radiusDeg
  ];

  const datetime = startDate && endDate 
    ? `${startDate}T00:00:00Z/${endDate}T23:59:59Z`
    : '2024-01-01T00:00:00Z/2024-12-31T23:59:59Z';

  return getDistinctValues({
    distinct: 'datetime',
    bbox,
    datetime,
    collections: ['sentinel-2-l2a']
  });
}

module.exports = {
  searchSentinelData,
  getCollections,
  getCollection,
  getDistinctValues,
  searchPropertyImagery,
  getAvailableDates
};
