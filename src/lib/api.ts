/**
 * ATLAS-HELIOS Frontend API Client
 *
 * Typed client for every backend server endpoint.
 *
 * Base URL: `VITE_API_BASE_URL` (defaults to `/api`). The Vite dev server
 * proxies `/api` to `http://localhost:3001` (see vite.config.ts), so relative
 * paths work in development and production alike.
 *
 * Endpoint reference (server/index.js and server/src/routes/weatherRoutes.js):
 *   Core:       GET    /api/health, /api/properties, /api/contractors, /api/probate/cases
 *   Nexus:      POST   /api/nexus/inference, /api/nexus/cognitive/step
 *               GET    /api/nexus/status
 *   Perception: POST   /api/perception/encode-image, /api/perception/classify,
 *               /api/perception/similarity
 *               GET    /api/perception/configs
 *   Sentinel:   GET    /api/sentinel/collections, /api/sentinel/collections/:id
 *               POST   /api/sentinel/search, /api/sentinel/property-imagery,
 *               /api/sentinel/available-dates, /api/sentinel/distinct
 *   Harvest:    GET    /api/harvest/methods, /api/harvest/search,
 *               /api/harvest/details/:mlsId, /api/harvest/nearby
 *   Mapillary:  GET    /api/mapillary/images
 *   Weather:    GET    /api/weather/{status,forecast,forecast/hourly,alerts,
 *               alerts/area,severe,radar/stations,zones}, /api/weather/stormreports
 *               POST   /api/weather/batch/severe
 *
 * Note: the weather routes exist in server/src/routes/weatherRoutes.js but are
 * not mounted in server/index.js; they will 404 until the router is registered.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function buildUrl(path: string, params?: unknown): string {
  if (!params || typeof params !== 'object') return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.append(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let body: unknown;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, body);
  }

  if (res.status !== 204 && !contentType.includes('application/json')) {
    throw new ApiError(res.status, 'Expected JSON response from API', body);
  }

  return body as T;
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface Property {
  id: number;
  address: string;
  city: string;
  state: string;
  status: string;
  value: number;
}

export interface Contractor {
  id: number;
  name: string;
  specialty: string;
  rating: number;
  projects: number;
}

export interface ProbateCase {
  id: number;
  caseNumber: string;
  decedent: string;
  status: string;
  progress: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  services: string[];
}

export interface NexusInferenceRequest {
  sensor_data?: unknown;
  geo_data?: unknown;
  behavior_data?: unknown;
}

export interface NexusInferenceResponse {
  [key: string]: unknown;
}

export interface NexusStatusResponse {
  [key: string]: unknown;
}

export interface NexusCognitiveStepRequest {
  [key: string]: unknown;
}

export interface NexusCognitiveStepResponse {
  [key: string]: unknown;
}

export interface PerceptionEncodeImageRequest {
  image_path: string;
  config?: unknown;
}

export interface PerceptionClassifyRequest {
  image_path: string;
  labels: string[];
}

export interface PerceptionSimilarityRequest {
  image_path: string;
  texts: string[];
}

export interface PerceptionConfigsResponse {
  [key: string]: unknown;
}

export interface SentinelSearchRequest {
  [key: string]: unknown;
}

export interface SentinelPropertyImageryRequest {
  lat: number;
  lon: number;
  radius?: number;
  startDate?: string;
  endDate?: string;
  maxCloudCover?: number;
}

export interface SentinelAvailableDatesRequest {
  lat: number;
  lon: number;
  radius?: number;
  startDate?: string;
  endDate?: string;
}

export interface SentinelDistinctRequest {
  [key: string]: unknown;
}

export interface HarvestSearchParams {
  location: string;
  radius?: number;
  limit?: number;
}

export interface HarvestNearbyParams {
  lat: number;
  lon: number;
  radius?: number;
}

export interface MapillaryImagesParams {
  bbox?: string;
  lat?: number;
  lon?: number;
  radius?: number;
  limit?: number;
}

export interface WeatherForecastParams {
  lat: number;
  lng: number;
}

export interface WeatherAlertsAreaParams {
  lat: number;
  lng: number;
  radius?: number;
}

export interface StormReportsParams {
  start?: string;
  end?: string;
}

export interface BatchSevereWeatherRequest {
  locations: Array<{ lat: number; lng: number }>;
}

/* -------------------------------------------------------------------------- */
/* Core                                                                       */
/* -------------------------------------------------------------------------- */

export const healthApi = {
  getHealth: () => request<HealthResponse>('/api/health'),
};

export const propertiesApi = {
  getProperties: () => request<Property[]>('/api/properties'),

  getValuationHistory: () =>
    request<ValuationHistoryEntry[]>('/api/property/valuation-history').catch(() => DEFAULT_VALUATION_HISTORY),
};

export const contractorsApi = {
  getContractors: () =>
    request<Contractor[]>('/api/contractors').catch(() => DEFAULT_CONTRACTORS),
};

export const probateApi = {
  getProbateCases: () =>
    request<ProbateCaseView[]>('/api/probate/cases').catch(() => DEFAULT_PROBATE_CASES),

  getHeirs: () =>
    request<Heir[]>('/api/probate/heirs').catch(() => DEFAULT_HEIRS),
};

/* -------------------------------------------------------------------------- */
/* Nexus Mind AI                                                              */
/* -------------------------------------------------------------------------- */

export const nexusApi = {
  inference: (data: NexusInferenceRequest) =>
    request<NexusInferenceResponse>('/api/nexus/inference', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  status: () => request<NexusStatusResponse>('/api/nexus/status'),

  cognitiveStep: (body: NexusCognitiveStepRequest) =>
    request<NexusCognitiveStepResponse>('/api/nexus/cognitive/step', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

/* -------------------------------------------------------------------------- */
/* Perception Models                                                          */
/* -------------------------------------------------------------------------- */

export const perceptionApi = {
  encodeImage: (data: PerceptionEncodeImageRequest) =>
    request<unknown>('/api/perception/encode-image', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  classify: (data: PerceptionClassifyRequest) =>
    request<unknown>('/api/perception/classify', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  similarity: (data: PerceptionSimilarityRequest) =>
    request<unknown>('/api/perception/similarity', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  configs: () => request<PerceptionConfigsResponse>('/api/perception/configs'),
};

/* -------------------------------------------------------------------------- */
/* Sentinel Satellite                                                         */
/* -------------------------------------------------------------------------- */

export const sentinelApi = {
  getCollections: () => request<unknown>('/api/sentinel/collections'),

  getCollection: (collectionId: string) =>
    request<unknown>(`/api/sentinel/collections/${encodeURIComponent(collectionId)}`),

  search: (body: SentinelSearchRequest) =>
    request<unknown>('/api/sentinel/search', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  searchPropertyImagery: (data: SentinelPropertyImageryRequest) =>
    request<unknown>('/api/sentinel/property-imagery', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAvailableDates: (data: SentinelAvailableDatesRequest) =>
    request<unknown>('/api/sentinel/available-dates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDistinctValues: (body: SentinelDistinctRequest) =>
    request<unknown>('/api/sentinel/distinct', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

/* -------------------------------------------------------------------------- */
/* HomeHarvest Property Data                                                  */
/* -------------------------------------------------------------------------- */

export const harvestApi = {
  getMethods: () => request<unknown>('/api/harvest/methods'),

  search: (params: HarvestSearchParams) =>
    request<unknown>(buildUrl('/api/harvest/search', params)),

  getDetails: (mlsId: string) =>
    request<unknown>(`/api/harvest/details/${encodeURIComponent(mlsId)}`),

  getNearby: (params: HarvestNearbyParams) =>
    request<unknown>(buildUrl('/api/harvest/nearby', params)),
};

/* -------------------------------------------------------------------------- */
/* Mapillary Street Imagery                                                   */
/* -------------------------------------------------------------------------- */

export const mapillaryApi = {
  getImages: (params: MapillaryImagesParams) =>
    request<unknown>(buildUrl('/api/mapillary/images', params)),
};

/* -------------------------------------------------------------------------- */
/* NOAA Weather (routes defined but not mounted in server/index.js)           */
/* -------------------------------------------------------------------------- */

export const weatherApi = {
  getStatus: () => request<unknown>('/api/weather/status'),

  getForecast: (params: WeatherForecastParams) =>
    request<unknown>(buildUrl('/api/weather/forecast', params)),

  getHourlyForecast: (params: WeatherForecastParams) =>
    request<unknown>(buildUrl('/api/weather/forecast/hourly', params)),

  getAlerts: () => request<unknown>('/api/weather/alerts'),

  getAlertsByArea: (params: WeatherAlertsAreaParams) =>
    request<unknown>(buildUrl('/api/weather/alerts/area', params)),

  checkSevereWeather: (params: WeatherForecastParams) =>
    request<unknown>(buildUrl('/api/weather/severe', params)),

  getRadarStations: () => request<unknown>('/api/weather/radar/stations'),

  getStormReports: (params?: StormReportsParams) =>
    request<unknown>(buildUrl('/api/weather/stormreports', params)),

  getZones: (params: WeatherForecastParams) =>
    request<unknown>(buildUrl('/api/weather/zones', params)),

  batchSevere: (body: BatchSevereWeatherRequest) =>
    request<unknown>('/api/weather/batch/severe', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

/* -------------------------------------------------------------------------- */
/* Extended core types (optional UI-only fields)                              */
/* -------------------------------------------------------------------------- */

export interface Contractor {
  id: number;
  name: string;
  specialty: string;
  rating: number;
  projects: number;
  location?: string;
  availability?: string;
  insurance?: string;
  bond?: string;
  score?: number;
}

export interface Property {
  id: number;
  address: string;
  city: string;
  state: string;
  status: string;
  value: number;
  type?: string;
  avmConfidence?: number;
  lastInspection?: string;
  condition?: string;
  riskScore?: number;
  lat?: number;
  lng?: number;
}

/* -------------------------------------------------------------------------- */
/* Tab Datasets                                                               */
/* -------------------------------------------------------------------------- */

export interface ProjectTimelinePhase {
  phase: string;
  start: number;
  duration: number;
  status: string;
}

export interface LineItem {
  code: string;
  desc: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
  category: string;
}

export interface FlywheelStep {
  step: number;
  icon: string;
  title: string;
  desc: string;
}

export interface IntelCard {
  label: string;
  value: string;
  delta: string;
  icon: string;
  color: string;
  trend: number[];
}

export interface RoofPlane {
  id: string;
  label: string;
  sqft: number;
  pitch: string;
  color: string;
  border: string;
  damage: string;
}

export interface Heir {
  id: number;
  name: string;
  relationship: string;
  confidence: number;
  status: string;
  location: string;
  contact: string;
  claimShare: string;
}

export interface ValuationHistoryEntry {
  month: string;
  value: number;
  low: number;
  high: number;
}

export interface Mission {
  id: string;
  addr: string;
  type: string;
  reward: number;
  tier: string;
  status: string;
  eta: string;
  difficulty: string;
}

export interface Storm {
  id: number;
  name: string;
  severity: string;
  hail: string;
  wind: string;
  lat: number;
  lng: number;
  leads: number;
  score: number;
  time: string;
  affectedArea: number;
  properties: number;
}

export interface Lead {
  id: number;
  addr: string;
  score: number;
  roof: string;
  sqft: number;
  status: string;
  val: string;
  lat: number;
  lng: number;
  damageType: string;
  lastContact: string | null;
}

export interface ProbateCaseView {
  id: string | number;
  decedent: string;
  status: string;
  complexity: string;
  heirs: number;
  properties: number;
  assets: string;
  progress: number;
  attorney: string;
  dateOfDeath: string;
}

/* -------------------------------------------------------------------------- */
/* Color helpers                                                              */
/* -------------------------------------------------------------------------- */

export const severityColor: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

export function scoreColor(score: number): string {
  if (score >= 90) return "#ef4444";
  if (score >= 75) return "#f59e0b";
  if (score >= 60) return "#eab308";
  return "#22c55e";
}

/* -------------------------------------------------------------------------- */
/* Fallback data (mirrors the datasets formerly in src/data/constants.ts)     */
/* -------------------------------------------------------------------------- */

export const DEFAULT_CONTRACTORS: Contractor[] = [
  { id: 1, name: "Elite Roofing Solutions", rating: 4.8, projects: 247, specialty: "Residential Roofing", location: "Dallas, TX", availability: "2 weeks", insurance: "$2M", bond: "$500K", score: 96 },
  { id: 2, name: "Premier Restoration Group", rating: 4.6, projects: 189, specialty: "Storm Damage", location: "Plano, TX", availability: "1 week", insurance: "$5M", bond: "$1M", score: 92 },
  { id: 3, name: "Heritage Roofing & Construction", rating: 4.9, projects: 312, specialty: "Historic Preservation", location: "Fort Worth, TX", availability: "3 weeks", insurance: "$3M", bond: "$750K", score: 94 },
  { id: 4, name: "Atlas Commercial Roofing", rating: 4.5, projects: 156, specialty: "Commercial", location: "Dallas, TX", availability: "Immediate", insurance: "$10M", bond: "$2M", score: 89 },
];

export const DEFAULT_PROPERTIES: Property[] = [
  { id: 1, address: "4821 Preston Hollow Dr", city: "Dallas", state: "TX", status: "Active", type: "Residential", value: 1200000, avmConfidence: 94, lastInspection: "2024-01-15", condition: "Good", riskScore: 23, lat: 32.7767, lng: -96.7970 },
  { id: 2, address: "1203 Westlake Ave", city: "Dallas", state: "TX", status: "Active", type: "Residential", value: 890000, avmConfidence: 91, lastInspection: "2024-02-01", condition: "Fair", riskScore: 45, lat: 32.7901, lng: -96.8023 },
  { id: 3, address: "7730 Ridgecrest Blvd", city: "Dallas", state: "TX", status: "Active", type: "Residential", value: 1500000, avmConfidence: 96, lastInspection: "2024-01-28", condition: "Excellent", riskScore: 15, lat: 32.7654, lng: -96.7856 },
  { id: 4, address: "5550 Oak Cliff Terr", city: "Dallas", state: "TX", status: "Active", type: "Multi-Family", value: 2100000, avmConfidence: 88, lastInspection: "2023-12-10", condition: "Fair", riskScore: 52, lat: 32.7432, lng: -96.8234 },
];

export const DEFAULT_PROJECT_TIMELINE: ProjectTimelinePhase[] = [
  { phase: "Inspection", start: 0, duration: 3, status: "complete" },
  { phase: "Estimate Approval", start: 3, duration: 5, status: "complete" },
  { phase: "Permits", start: 8, duration: 7, status: "active" },
  { phase: "Material Delivery", start: 12, duration: 3, status: "pending" },
  { phase: "Tear-off", start: 15, duration: 2, status: "pending" },
  { phase: "Installation", start: 17, duration: 5, status: "pending" },
  { phase: "Final Inspection", start: 22, duration: 2, status: "pending" },
];

export const DEFAULT_LINE_ITEMS: LineItem[] = [
  { code: "RFG-240", desc: "Laminated Architectural Shingle (30yr)", qty: 38.4, unit: "SQ", price: 142, total: 5452.80, category: "Roofing" },
  { code: "RFG-102", desc: "#15 Synthetic Felt Underlayment", qty: 38.4, unit: "SQ", price: 18, total: 691.20, category: "Underlayment" },
  { code: "RFG-310", desc: "Ice & Water Shield (First 6\")", qty: 180, unit: "LF", price: 4.20, total: 756.00, category: "Waterproofing" },
  { code: "RFG-415", desc: "Ridge Cap Shingles", qty: 120, unit: "LF", price: 6.80, total: 816.00, category: "Roofing" },
  { code: "RFG-501", desc: "Drip Edge – Aluminum (2x4)", qty: 210, unit: "LF", price: 2.10, total: 441.00, category: "Flashing" },
  { code: "RFG-610", desc: "Remove & Haul – Existing Shingles", qty: 38.4, unit: "SQ", price: 55, total: 2112.00, category: "Labor" },
  { code: "GEN-101", desc: "Dumpster / Debris Removal", qty: 1, unit: "EA", price: 380, total: 380.00, category: "General" },
  { code: "GEN-205", desc: "Permits & Admin", qty: 1, unit: "EA", price: 250, total: 250.00, category: "General" },
  { code: "RFG-720", desc: "Chimney Flashing Replacement", qty: 1, unit: "EA", price: 485, total: 485.00, category: "Flashing" },
  { code: "RFG-830", desc: "Skylight Seal & Flashing", qty: 2, unit: "EA", price: 320, total: 640.00, category: "Flashing" },
];

export const DEFAULT_MISSIONS: Mission[] = [
  { id: "M-4821", addr: "4821 Preston Hollow Dr", type: "Roof Verification", reward: 20, tier: "T2", status: "open", eta: "0.4mi", difficulty: "Medium" },
  { id: "M-1203", addr: "1203 Westlake Ave", type: "Damage Documentation", reward: 15, tier: "T1", status: "active", eta: "1.2mi", difficulty: "Easy" },
  { id: "M-7730", addr: "7730 Ridgecrest Blvd", type: "Expert Audit (Live)", reward: 85, tier: "T3", status: "open", eta: "2.1mi", difficulty: "Hard" },
  { id: "M-5550", addr: "5550 Oak Cliff Terr", type: "Roof Verification", reward: 20, tier: "T2", status: "complete", eta: "3.0mi", difficulty: "Medium" },
  { id: "M-3400", addr: "3400 Highland Park Dr", type: "3D Scan Capture", reward: 45, tier: "T2", status: "open", eta: "1.8mi", difficulty: "Medium" },
  { id: "M-9020", addr: "902 Mockingbird Ln", type: "Rapid Assessment", reward: 12, tier: "T1", status: "open", eta: "0.9mi", difficulty: "Easy" },
];

export const DEFAULT_FLYWHEEL: FlywheelStep[] = [
  { step: 1, icon: "🛰️", title: "Capture & Ingest", desc: "NEXUS SPARK citizens capture raw geospatial data, storms trigger automated satellite re-tasking." },
  { step: 2, icon: "🧠", title: "Process & Analyze", desc: "NEXUS MIND detects anomalies, scores properties 0-100, fuses NOAA + CoreLogic + Aerial layers." },
  { step: 3, icon: "🔍", title: "Refine & Verify", desc: "NEXUS C.O.M.M.S dispatches gig workers for human ground-truth; Remote Expert tier signs off." },
  { step: 4, icon: "💰", title: "Monetize & Deliver", desc: "Verified reports sold to insurers, contractors, REITs via PropertyInsight API. Revenue recycled to verifiers." },
];

export const DEFAULT_INTEL_CARDS: IntelCard[] = [
  { label: "Properties Analyzed", value: "124,847", delta: "+2.4%", icon: "🏠", color: "#06b6d4", trend: [65, 68, 72, 75, 78, 82, 85, 88, 91, 94] },
  { label: "AI Confidence Score", value: "96.2%", delta: "+1.1%", icon: "🎯", color: "#fbbf24", trend: [88, 89, 90, 91, 92, 93, 94, 95, 95.5, 96.2] },
  { label: "Damage Prob Score", value: "847", delta: "+38", icon: "⚡", color: "#ef4444", trend: [720, 745, 760, 778, 790, 805, 815, 825, 835, 847] },
  { label: "Revenue Pipeline", value: "$4.2M", delta: "+18%", icon: "💎", color: "#22c55e", trend: [2.8, 3.0, 3.2, 3.4, 3.6, 3.75, 3.9, 4.0, 4.1, 4.2] },
];

export const DEFAULT_ROOF_PLANES: RoofPlane[] = [
  { id: "A", label: "Front Slope", sqft: 1240, pitch: "5/12", color: "rgba(6,182,212,0.3)", border: "#06b6d4", damage: "Moderate" },
  { id: "B", label: "Rear Slope", sqft: 1180, pitch: "5/12", color: "rgba(251,191,36,0.3)", border: "#fbbf24", damage: "Light" },
  { id: "C", label: "Left Hip", sqft: 420, pitch: "5/12", color: "rgba(139,92,246,0.3)", border: "#8b5cf6", damage: "None" },
  { id: "D", label: "Right Hip", sqft: 420, pitch: "5/12", color: "rgba(34,197,94,0.3)", border: "#22c55e", damage: "None" },
  { id: "E", label: "Dormer Front", sqft: 240, pitch: "8/12", color: "rgba(249,115,22,0.3)", border: "#f97316", damage: "Severe" },
  { id: "F", label: "Dormer Rear", sqft: 240, pitch: "8/12", color: "rgba(236,72,153,0.3)", border: "#ec4899", damage: "Moderate" },
];

export const DEFAULT_PROBATE_CASES: ProbateCaseView[] = [
  { id: "EST-2024-001", decedent: "Robert J. Anderson", status: "Active", complexity: "High", heirs: 7, properties: 4, assets: "$2.4M", progress: 65, attorney: "Sarah Mitchell", dateOfDeath: "2024-01-15" },
  { id: "EST-2024-002", decedent: "Margaret L. Chen", status: "Heir Search", complexity: "Medium", heirs: 3, properties: 2, assets: "$890K", progress: 35, attorney: "David Park", dateOfDeath: "2024-02-03" },
  { id: "EST-2024-003", decedent: "William T. Henderson", status: "Asset Discovery", complexity: "Critical", heirs: 12, properties: 8, assets: "$5.7M", progress: 20, attorney: "Jennifer Walsh", dateOfDeath: "2024-01-28" },
  { id: "EST-2024-004", decedent: "Dorothy K. Martinez", status: "Distribution", complexity: "Low", heirs: 2, properties: 1, assets: "$425K", progress: 85, attorney: "Michael Torres", dateOfDeath: "2024-03-01" },
];

export const DEFAULT_HEIRS: Heir[] = [
  { id: 1, name: "James Anderson", relationship: "Son", confidence: 98, status: "Verified", location: "Dallas, TX", contact: "james.a@email.com", claimShare: "25%" },
  { id: 2, name: "Susan Anderson-Brown", relationship: "Daughter", confidence: 98, status: "Verified", location: "Houston, TX", contact: "susan.brown@email.com", claimShare: "25%" },
  { id: 3, name: "Michael Anderson", relationship: "Son", confidence: 87, status: "Pending", location: "Austin, TX", contact: "Unknown", claimShare: "25%" },
  { id: 4, name: "Patricia Anderson-Wilson", relationship: "Daughter", confidence: 94, status: "Verified", location: "San Antonio, TX", contact: "p.wilson@email.com", claimShare: "25%" },
  { id: 5, name: "Robert Anderson Jr.", relationship: "Grandson", confidence: 72, status: "Research", location: "Unknown", contact: "Unknown", claimShare: "Contingent" },
];

export const DEFAULT_VALUATION_HISTORY: ValuationHistoryEntry[] = [
  { month: "Jan", value: 1.18, low: 1.12, high: 1.24 },
  { month: "Feb", value: 1.21, low: 1.15, high: 1.27 },
  { month: "Mar", value: 1.19, low: 1.13, high: 1.25 },
  { month: "Apr", value: 1.23, low: 1.17, high: 1.29 },
  { month: "May", value: 1.26, low: 1.20, high: 1.32 },
  { month: "Jun", value: 1.28, low: 1.22, high: 1.34 },
  { month: "Jul", value: 1.31, low: 1.25, high: 1.37 },
  { month: "Aug", value: 1.33, low: 1.27, high: 1.39 },
  { month: "Sep", value: 1.30, low: 1.24, high: 1.36 },
  { month: "Oct", value: 1.27, low: 1.21, high: 1.33 },
  { month: "Nov", value: 1.25, low: 1.19, high: 1.31 },
  { month: "Dec", value: 1.29, low: 1.23, high: 1.35 },
];

export const DEFAULT_STORMS: Storm[] = [
  { id: 1, name: "Hail Cell TX-7", severity: "critical", hail: "2.5\"", wind: "68mph", lat: 32.7, lng: -97.3, leads: 47, score: 96, time: "2h ago", affectedArea: 1240, properties: 2847 },
  { id: 2, name: "Wind Event OK-3", severity: "high", hail: "1.2\"", wind: "55mph", lat: 35.4, lng: -97.5, leads: 23, score: 78, time: "5h ago", affectedArea: 890, properties: 1523 },
  { id: 3, name: "Storm Front AR-1", severity: "medium", hail: "0.9\"", wind: "42mph", lat: 34.7, lng: -92.3, leads: 11, score: 62, time: "9h ago", affectedArea: 560, properties: 987 },
  { id: 4, name: "Tornado Watch KS-2", severity: "critical", hail: "3.0\"", wind: "85mph", lat: 37.7, lng: -97.3, leads: 89, score: 98, time: "45m ago", affectedArea: 2100, properties: 4521 },
];

export const DEFAULT_LEADS: Lead[] = [
  { id: 1, addr: "4821 Preston Hollow Dr", score: 97, roof: "25yr Arch Shingle", sqft: 3840, status: "Uncontacted", val: "$18,400", lat: 32.7767, lng: -96.7970, damageType: "Hail Impact", lastContact: null },
  { id: 2, addr: "1203 Westlake Ave", score: 94, roof: "22yr 3-Tab", sqft: 2940, status: "Contacted", val: "$12,200", lat: 32.7901, lng: -96.8023, damageType: "Wind Lift", lastContact: "2d ago" },
  { id: 3, addr: "7730 Ridgecrest Blvd", score: 91, roof: "18yr Arch Shingle", sqft: 3120, status: "Inspecting", val: "$14,800", lat: 32.7654, lng: -96.7856, damageType: "Hail + Wind", lastContact: "5h ago" },
  { id: 4, addr: "902 Mockingbird Ln", score: 88, roof: "15yr Metal", sqft: 2200, status: "Uncontacted", val: "$9,600", lat: 32.7823, lng: -96.8123, damageType: "Denting", lastContact: null },
  { id: 5, addr: "5550 Oak Cliff Terr", score: 85, roof: "28yr 3-Tab", sqft: 1980, status: "Won", val: "$11,300", lat: 32.7432, lng: -96.8234, damageType: "Age + Storm", lastContact: "1w ago" },
  { id: 6, addr: "3400 Highland Park Dr", score: 93, roof: "20yr Clay Tile", sqft: 4560, status: "Contacted", val: "$22,100", lat: 32.7987, lng: -96.7890, damageType: "Cracked Tiles", lastContact: "1d ago" },
];

/* -------------------------------------------------------------------------- */
/* Tab dataset API                                                            */
/* -------------------------------------------------------------------------- */

export const timelineApi = {
  getProjectTimeline: () =>
    request<ProjectTimelinePhase[]>('/api/contractors/timeline').catch(() => DEFAULT_PROJECT_TIMELINE),
};

export const estimateApi = {
  getLineItems: () =>
    request<LineItem[]>('/api/estimate/line-items').catch(() => DEFAULT_LINE_ITEMS),
};

export const flywheelApi = {
  getFlywheel: () =>
    request<FlywheelStep[]>('/api/flywheel').catch(() => DEFAULT_FLYWHEEL),
};

export const intelApi = {
  getIntelCards: () =>
    request<IntelCard[]>('/api/intel/cards').catch(() => DEFAULT_INTEL_CARDS),
};

export const measureApi = {
  getRoofPlanes: () =>
    request<RoofPlane[]>('/api/measure/roof-planes').catch(() => DEFAULT_ROOF_PLANES),
};

export const prospectApi = {
  getMissions: () =>
    request<Mission[]>('/api/prospect/missions').catch(() => DEFAULT_MISSIONS),
};

export const reconApi = {
  getStorms: () =>
    request<Storm[]>('/api/recon/storms').catch(() => DEFAULT_STORMS),

  getLeads: () =>
    request<Lead[]>('/api/recon/leads').catch(() => DEFAULT_LEADS),
};
