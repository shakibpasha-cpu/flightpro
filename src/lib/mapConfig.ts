import L from 'leaflet';

export const CHART_LAYERS = {
  standard: {
    id: 'standard',
    name: 'Standard Map',
    url: (isDark: boolean) => isDark 
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; OpenStreetMap & CARTO',
    maxZoom: 18,
    subdomains: 'abcd',
    tms: false
  },
  sectional: {
    id: 'sectional',
    name: 'VFR Sectional',
    url: "https://tiles.arcgis.com/tiles/ssSGoCbaAsSRiZat/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}",
    attribution: 'FAA VFR Sectional',
    maxZoom: 12,
    tms: false,
    subdomains: []
  },
  enrouteLow: {
    id: 'enrouteLow',
    name: 'IFR Low Enroute',
    url: "https://tiles.arcgis.com/tiles/ssSGoCbaAsSRiZat/arcgis/rest/services/IFR_Low_Enroute/MapServer/tile/{z}/{y}/{x}",
    attribution: 'FAA IFR Low',
    maxZoom: 12,
    tms: false,
    subdomains: []
  },
  enrouteHigh: {
    id: 'enrouteHigh',
    name: 'IFR High Enroute',
    url: "https://tiles.arcgis.com/tiles/ssSGoCbaAsSRiZat/arcgis/rest/services/IFR_High_Enroute/MapServer/tile/{z}/{y}/{x}",
    attribution: 'FAA IFR High',
    maxZoom: 12,
    tms: false,
    subdomains: []
  },
  worldVfr: {
    id: 'worldVfr',
    name: 'World VFR',
    url: "https://{s}.tile.openflightmaps.org/live/vfr/latest/pad/{z}/{x}/{y}.png",
    attribution: '&copy; OpenFlightMaps',
    subdomains: 'abc',
    maxZoom: 12,
    tms: false
  }
};

export const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Helper for bearing calculation
export function getBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360;
}

// Helper for midpoint calculation
export function getMidpoint(lat1: number, lon1: number, lat2: number, lon2: number) {
  return [(lat1 + lat2) / 2, (lon1 + lon2) / 2] as [number, number];
}

// Helper for distance calculation (Great Circle in nm)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3440.065; // Radius of the earth in nm
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in nm
}

/**
 * Spatial Helpers for Airspace Analysis
 */

// Helper to check if a point is inside a polygon (Ray casting algorithm)
export function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lng) !== (yj > lng)) &&
        (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

// Helper to check if two line segments (p1-p2 and p3-p4) intersect
export function doSegmentsIntersect(
  p1: [number, number], p2: [number, number], 
  p3: [number, number], p4: [number, number]
) {
  const det = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (det === 0) return false;
  const lambda = ((p4[1] - p3[1]) * (p4[0] - p1[0]) + (p3[0] - p4[0]) * (p4[1] - p1[1])) / det;
  const gamma = ((p1[1] - p2[1]) * (p4[0] - p1[0]) + (p2[0] - p1[0]) * (p4[1] - p1[1])) / det;
  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

// Check if a leg (start -> end) intersects with a polygon
export function doesLegIntersectPolygon(
  start: {lat: number, lng: number}, 
  end: {lat: number, lng: number}, 
  polygon: [number, number][]
) {
  // 1. Check if either endpoint is inside the polygon
  if (isPointInPolygon(start.lat, start.lng, polygon) || isPointInPolygon(end.lat, end.lng, polygon)) return true;

  // 2. Check if any polygon edge intersects the leg segment
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    if (doSegmentsIntersect([start.lat, start.lng], [end.lat, end.lng], p1, p2)) return true;
  }

  return false;
}
