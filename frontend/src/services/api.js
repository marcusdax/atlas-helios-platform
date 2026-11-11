/**
 * Atlas Helios Platform - API Service
 * Connects all frontend components to backend endpoints
 */

import axios from 'axios';

// Base API URL - uses proxy in development
const API_URL = process.env.REACT_APP_API_URL || '';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH API ====================
export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  logout: (data) => api.post('/api/auth/logout', data),
  refresh: (data) => api.post('/api/auth/refresh', data),
  me: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/profile', data),
  verifyEmail: (data) => api.post('/api/auth/verify-email', data),
  forgotPassword: (data) => api.post('/api/auth/forgot-password', data),
  resetPassword: (data) => api.post('/api/auth/reset-password', data),
};

// ==================== PROPERTIES API ====================
export const propertiesAPI = {
  getAll: (params) => api.get('/api/properties', { params }),
  getById: (id) => api.get(`/api/properties/${id}`),
  create: (data) => api.post('/api/properties', data),
  update: (id, data) => api.put(`/api/properties/${id}`, data),
  delete: (id) => api.delete(`/api/properties/${id}`),
  uploadImages: (id, data) => api.post(`/api/properties/${id}/images`, data),
  analyze: (id, data) => api.post(`/api/properties/${id}/analyze`, data),
  getValuations: (id) => api.get(`/api/properties/${id}/valuations`),
  getAssessments: (id) => api.get(`/api/properties/${id}/assessments`),
  search: (params) => api.get('/api/properties/search/query', { params }),
  getRisk: (id) => api.get(`/api/properties/${id}/risk`),
  getReport: (id, params) => api.get(`/api/properties/${id}/report`, { params }),
};

// ==================== ASSESSMENTS API ====================
export const assessmentsAPI = {
  getAll: (params) => api.get('/api/assessments', { params }),
  getById: (id) => api.get(`/api/assessments/${id}`),
  create: (data) => api.post('/api/assessments', data),
  update: (id, data) => api.put(`/api/assessments/${id}`, data),
  delete: (id) => api.delete(`/api/assessments/${id}`),
  uploadImages: (id, data) => api.post(`/api/assessments/${id}/images`, data),
  analyzeDamage: (id, data) => api.post(`/api/assessments/${id}/analyze-damage`, data),
  getStats: (params) => api.get('/api/assessments/stats/overview', { params }),
  getTimeline: (id) => api.get(`/api/assessments/${id}/timeline`),
  getReport: (id, params) => api.get(`/api/assessments/${id}/report`, { params }),
  submit: (id, data) => api.post(`/api/assessments/${id}/submit`, data),
  getRecommendations: (id) => api.get(`/api/assessments/${id}/recommendations`),
};

// ==================== LEADS API ====================
export const leadsAPI = {
  getAll: (params) => api.get('/api/leads', { params }),
  getById: (id) => api.get(`/api/leads/${id}`),
  create: (data) => api.post('/api/leads', data),
  update: (id, data) => api.put(`/api/leads/${id}`, data),
  delete: (id) => api.delete(`/api/leads/${id}`),
  updateStatus: (id, data) => api.patch(`/api/leads/${id}/status`, data),
  addNote: (id, data) => api.post(`/api/leads/${id}/notes`, data),
  getActivities: (id) => api.get(`/api/leads/${id}/activities`),
  scheduleFollowUp: (id, data) => api.post(`/api/leads/${id}/followup`, data),
  getScore: (id) => api.get(`/api/leads/${id}/score`),
  getStats: (params) => api.get('/api/leads/stats/overview', { params }),
  convert: (id, data) => api.post(`/api/leads/${id}/convert`, data),
  getPipeline: (params) => api.get('/api/leads/pipeline/status', { params }),
  bulkUpdate: (data) => api.patch('/api/leads/bulk/update', data),
};

// ==================== ESTIMATES API ====================
export const estimatesAPI = {
  getAll: (params) => api.get('/api/estimates', { params }),
  getById: (id) => api.get(`/api/estimates/${id}`),
  create: (data) => api.post('/api/estimates', data),
  update: (id, data) => api.put(`/api/estimates/${id}`, data),
  delete: (id) => api.delete(`/api/estimates/${id}`),
  fromAssessment: (data) => api.post('/api/estimates/from-assessment', data),
  addLineItem: (id, data) => api.post(`/api/estimates/${id}/items`, data),
  updateLineItem: (id, itemId, data) => api.put(`/api/estimates/${id}/items/${itemId}`, data),
  removeLineItem: (id, itemId) => api.delete(`/api/estimates/${id}/items/${itemId}`),
  calculate: (id) => api.get(`/api/estimates/${id}/calculate`),
  getPdf: (id, params) => api.get(`/api/estimates/${id}/pdf`, { params, responseType: 'blob' }),
  send: (id, data) => api.post(`/api/estimates/${id}/send`, data),
  getTemplates: (params) => api.get('/api/estimates/templates/list', { params }),
  fromTemplate: (data) => api.post('/api/estimates/from-template', data),
  getStats: (params) => api.get('/api/estimates/stats/overview', { params }),
  convert: (id, data) => api.post(`/api/estimates/${id}/convert`, data),
  getHistory: (id) => api.get(`/api/estimates/${id}/history`),
};

// ==================== STORMS API ====================
export const stormsAPI = {
  getAll: (params) => api.get('/api/storms', { params }),
  getById: (id) => api.get(`/api/storms/${id}`),
  getTrack: (id) => api.get(`/api/storms/${id}/track`),
  getPropertiesAtRisk: (id, params) => api.get(`/api/storms/${id}/properties-at-risk`, { params }),
  getUserAlerts: () => api.get('/api/storms/alerts/user'),
  subscribe: (data) => api.post('/api/storms/alerts/subscribe', data),
  getPredictions: (id, params) => api.get(`/api/storms/${id}/predictions`, { params }),
  getHistory: (region, params) => api.get(`/api/storms/history/region/${region}`, { params }),
  getImpactReport: (id, params) => api.get(`/api/storms/${id}/impact-report`, { params }),
  deleteSubscription: (id) => api.delete(`/api/storms/alerts/${id}`),
};

// ==================== WEATHER API ====================
export const weatherAPI = {
  getStatus: () => api.get('/api/weather/status'),
  getForecast: (lat, lng) => api.get('/api/weather/forecast', { params: { lat, lng } }),
  getHourlyForecast: (lat, lng) => api.get('/api/weather/forecast/hourly', { params: { lat, lng } }),
  getAlerts: () => api.get('/api/weather/alerts'),
  getAlertsByArea: (lat, lng, radius) => api.get('/api/weather/alerts/area', { params: { lat, lng, radius } }),
  checkSevere: (lat, lng) => api.get('/api/weather/severe', { params: { lat, lng } }),
  getRadarStations: () => api.get('/api/weather/radar/stations'),
  getStormReports: (params) => api.get('/api/weather/stormreports', { params }),
  getZones: (lat, lng) => api.get('/api/weather/zones', { params: { lat, lng } }),
  batchSevere: (data) => api.post('/api/weather/batch/severe', data),
};

// ==================== NEXUS MIND API ====================
export const nexusAPI = {
  getStatus: () => api.get('/api/nexus/status'),
  analyzeStorm: (data) => api.post('/api/nexus/storm/analyze', data),
  analyzeProperty: (data) => api.post('/api/nexus/property/analyze', data),
  classifyImage: (data) => api.post('/api/nexus/vision/classify', data),
  cognitiveProcess: (data) => api.post('/api/nexus/cognitive/process', data),
  getConfig: () => api.get('/api/nexus/config'),
};

// ==================== HEALTH API ====================
export const healthAPI = {
  check: () => api.get('/health'),
};

// Export default api instance
export default api;

// Export all APIs as a single object
export const atlasAPI = {
  auth: authAPI,
  properties: propertiesAPI,
  assessments: assessmentsAPI,
  leads: leadsAPI,
  estimates: estimatesAPI,
  storms: stormsAPI,
  weather: weatherAPI,
  nexus: nexusAPI,
  health: healthAPI,
};
