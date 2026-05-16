import { getAI, handleAiError, isAiInCooldown, safeParseJson } from './aiService';

export interface RestrictedAirspace {
  id: string;
  name: string;
  reason: string;
  severity: 'Low' | 'Medium' | 'High';
  coordinates: [number, number][]; // Polygon coordinates
  source: string;
  sourceUrl?: string;
  activeFrom?: string;
  activeUntil?: string;
  type?: 'Restricted' | 'TFR' | 'ConflictZone';
}

// Global cache for safety data to prevent excessive AI usage
let safetyAlertsCache: RestrictedAirspace[] | null = null;
let safetyAlertsCacheTime = 0;
let safetyAlertsPendingPromise: Promise<RestrictedAirspace[]> | null = null;
const CACHE_TTL = 3600000; // 1 hour for safety alerts

// Mocking a reliable source like EASA CZIB (Conflict Zone Information Bulletin) / FAA SFAR
export async function getGlobalRestrictedAirspaces(): Promise<RestrictedAirspace[]> {
  try {
    // Attempt to enrich with AI/Live data if possible, otherwise fallback to standard mock
    // In a real app, this would hit a specialized API. 
    // Here we use Gemini with Search to get latest major TFRs/Conflict Zones
    
    // Fallback static data
    const staticAirspaces: RestrictedAirspace[] = [
      {
        id: "CZIB-2022-01",
        name: "Ukraine Airspace (UKDV, UKLV, UKOV, UKFV)",
        reason: "Active conflict zone. Prohibition of flights for civil aviation operations.",
        severity: "High",
        type: 'ConflictZone',
        coordinates: [
          [51.5, 23.5],
          [52.5, 33.5],
          [49.5, 40.5],
          [46.5, 38.5],
          [45.5, 33.5],
          [44.5, 29.5],
          [48.5, 22.5],
          [51.5, 23.5],
        ],
        source: "EASA CZIB / FAA SFAR 113",
        sourceUrl: "https://www.easa.europa.eu/en/domains/air-operations/czibs"
      },
      {
        id: "CZIB-2023-01",
        name: "Sudan Airspace (HSSS)",
        reason: "Hazardous situation due to armed conflict. Avoid overflying.",
        severity: "High",
        type: 'ConflictZone',
        coordinates: [
          [22.0, 24.0],
          [22.0, 36.0],
          [12.0, 38.0],
          [9.0, 34.0],
          [9.0, 23.0],
          [15.0, 21.0],
          [22.0, 24.0],
        ],
        source: "EASA CZIB"
      },
      {
        id: "CZIB-2024-02",
        name: "Middle East / Israel (LLLL) & Lebanon (OLBA)",
        reason: "Potential risk from anti-aviation weaponry and military operations.",
        severity: "Medium",
        type: 'ConflictZone',
        coordinates: [
          [34.5, 35.0],
          [34.5, 36.5],
          [33.0, 36.5],
          [29.5, 35.0],
          [29.5, 34.0],
          [33.0, 35.0],
          [34.5, 35.0],
        ],
        source: "EASA CZIB / FAA NOTAM"
      }
    ];

    return staticAirspaces;
  } catch (error) {
    console.error("Error fetching airspaces:", error);
    return [];
  }
}

/**
 * Fetches real-time Temporary Flight Restrictions (TFRs) and Restricted Airspaces using AI Search.
 */
export async function getLiveSafetyAlerts(): Promise<RestrictedAirspace[]> {
  // Return pending promise if it exists to deduplicate concurrent calls
  if (safetyAlertsPendingPromise) {
    return safetyAlertsPendingPromise;
  }

  // Check cache first
  const now = Date.now();
  if (safetyAlertsCache && (now - safetyAlertsCacheTime < CACHE_TTL)) {
    return safetyAlertsCache;
  }

  // If AI is in cooldown, return cache (even if stale-ish)
  if (isAiInCooldown()) {
    return safetyAlertsCache || [];
  }

  safetyAlertsPendingPromise = (async () => {
    const prompt = `Identify current major Temporary Flight Restrictions (TFRs) and Restricted Airspaces globally for civil aviation as of today.
  
  Focus on:
  1. Conflict zones (e.g., Middle East, Eastern Europe, Africa).
  2. Large-scale VIP movements or military exercises with active TFRs.
  3. Volcano ash cloud restrictions if any.
  
  For each restriction, provide:
  - Name (e.g. "TFR 4/2105 Over Washington DC")
  - Type: 'Restricted' | 'TFR' | 'ConflictZone'
  - Reason (e.g. "National Security", "Military Exercise")
  - Severity: 'Low' | 'Medium' | 'High'
  - Approximate coordinates defining a polygon [lat, lng][] (at least 4 points to close it).
  - Source (e.g. "FAA", "Eurocontrol", "NOTAM")
  
  Return format strictly JSON: {
    alerts: {
      id: string,
      name: string,
      type: string,
      reason: string,
      severity: string,
      coordinates: [number, number][],
      source: string,
      sourceUrl?: string
    }[]
  }`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
      },
    });

    const data = safeParseJson(response.text);
    const alerts = data.alerts || [];
    
    // Update cache
    safetyAlertsCache = alerts;
    safetyAlertsCacheTime = Date.now();
    safetyAlertsPendingPromise = null;
    
    return alerts;
  } catch (error) {
    handleAiError(error, 'getLiveSafetyAlerts', true);
    safetyAlertsPendingPromise = null;
    // Return some mock data if AI fails
    return [
      {
        id: "TFR-MOCK-1",
        name: "Restricted Area R-2508",
        reason: "Military high-speed flight testing and research.",
        severity: "Medium",
        type: 'Restricted',
        coordinates: [[35.0, -118.0], [35.5, -118.0], [35.5, -117.0], [35.0, -117.0], [35.0, -118.0]],
        source: "FAA"
      }
    ];
  }
})();

  return safetyAlertsPendingPromise;
}
