const axios = require('axios');

const MAPILLY_BASE_URL = 'https://services.mapillary.com/api/v1';
const MAPILLY_TOKEN = process.env.MAPILLY_TOKEN || '';

/**
 * Mapillary Street Imagery Service
 * Provides access to Mapillary's open street-level imagery via API.
 *
 * Endpoints used:
 *   GET /images/:imageKey - Image details by key
 *   GET /images?bbox=[minLon,minLat,maxLon,maxLat] - Search images in bbox
 *   GET /images?client_id=... - Client-credential search (when no token)
 *
 * @see https://docs.mapillary.com/api/ v4
 */
class MapillaryService {
  constructor() {
    this.token = MAPILLY_TOKEN;
    this.hasToken = Boolean(this.token && this.token.trim().length > 0);
  }

  /**
   * Search Mapillary images within a bounding box.
   * @param {Object} params
   * @param {Array} params.bbox - [minLon, minLat, maxLon, maxLat]
   * @param {number} params.limit - Max images to return
   * @param {number} params.radius - Radius in meters (alternative to bbox)
   * @param {number} params.lat - Latitude center
   * @param {number} params.lon - Longitude center
   * @param {number} params.perPage - Pagination size
   * @param {number} params.page - Page number
   * @param {string} params.startTime - ISO start datetime filter
   * @param {string} params.endTime - ISO end datetime filter
   * @returns {Promise<Object>} Mapillary image results
   */
  async getImages(params = {}) {
    const {
      bbox,
      limit = 50,
      radius,
      lat,
      lon,
      perPage = 50,
      page = 1,
      startTime,
      endTime,
    } = params;

    const headers = {
      'Accept': 'application/json',
    };

    if (this.hasToken) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const queryParams = {};

    if (bbox) {
      queryParams.bbox = bbox.join(',');
    } else if (lat && lon) {
      const radiusDeg = (radius || 1000) / 111320; // meters to degrees
      queryParams.bbox = [
        lon - radiusDeg,
        lat - radiusDeg,
        lon + radiusDeg,
        lat + radiusDeg,
      ].join(',');
    }

    if (limit) queryParams.per_page = Math.min(limit, 200);
    if (perPage) queryParams.per_page = perPage;
    if (page) queryParams.page = page;
    if (startTime) queryParams.start_time = startTime;
    if (endTime) queryParams.end_time = endTime;

    try {
      const response = await axios.get(`${MAPILLY_BASE_URL}/images`, {
        headers,
        params: queryParams,
        timeout: 30000,
      });

      const images = response.data || [];
      return {
        success: true,
        count: images.length,
        images: images.map((img) => ({
          key: img.key,
          id: img.id,
          latitude: img.latitude,
          longitude: img.longitude,
          capturedAt: img.captured_at,
          thumbnailUrl: img.thumbnail_url,
          imageUrl: img.image_url,
          organization: img.organization,
          sequenceId: img.sequence_id,
          cameraType: img.camera_type,
          cameraMake: img.camera_make,
          cameraModel: img.camera_model,
          computedRotation: img.computed_rotation,
          computedAltitude: img.computed_altitude,
          exifOrientation: img.exif_orientation,
          mergedViewsFromKey: img.merged_views_from_key,
          pano: img.pano,
          panoKeys: img.pano_keys,
        })),
        hasToken: this.hasToken,
      };
    } catch (error) {
      console.error('[Mapillary] Error fetching images:', error.message);
      return {
        success: false,
        count: 0,
        images: [],
        error: error.message,
        hasToken: this.hasToken,
        fallback: true,
      };
    }
  }

  /**
   * Get a single Mapillary image by key.
   * @param {string} imageKey - Mapillary image key
   * @returns {Promise<Object>} Image details
   */
  async getImage(imageKey) {
    if (!this.hasToken) {
      return {
        success: false,
        error: 'Mapillary token required for image details',
        hasToken: false,
      };
    }

    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/json',
    };

    try {
      const response = await axios.get(
        `${MAPILLY_BASE_URL}/images/${imageKey}`,
        { headers, timeout: 30000 }
      );
      return {
        success: true,
        image: response.data,
        hasToken: true,
      };
    } catch (error) {
      console.error(`[Mapillary] Error fetching image ${imageKey}:`, error.message);
      return {
        success: false,
        imageKey,
        error: error.message,
        hasToken: true,
      };
    }
  }
}

module.exports = new MapillaryService();
