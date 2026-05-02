import { handleApiError } from './errorService';
import { getAI, handleAiError, isAiInCooldown } from './aiService';

export interface MetarData {
  airport: string;
  metar: string;
  taf: string;
  last_updated: string;
}

export interface NotamData {
  airport: string;
  notams: {
    id: string;
    description: string;
    severity: 'Low' | 'Medium' | 'High';
  }[];
  last_updated: string;
}

// Global caches for weather and NOTAMs
const weatherCache: Record<string, { data: MetarData, timestamp: number }> = {};
const notamCache: Record<string, { data: NotamData, timestamp: number }> = {};
const weatherPendingRequests: Record<string, Promise<MetarData>> = {};
const notamPendingRequests: Record<string, Promise<NotamData>> = {};
const CACHE_TTL = 1800000; // 30 minutes

export async function getLiveWeather(icao: string): Promise<MetarData> {
  const airportCode = icao.toUpperCase();
  const now = Date.now();

  // Return pending request if it exists
  if (weatherPendingRequests[airportCode]) {
    return weatherPendingRequests[airportCode];
  }

  // Check cache
  if (weatherCache[airportCode] && (now - weatherCache[airportCode].timestamp < CACHE_TTL)) {
    return weatherCache[airportCode].data;
  }

  // If AI is in cooldown, return cache (even if stale) or mock
  if (isAiInCooldown()) {
    return weatherCache[airportCode]?.data || {
      airport: icao,
      metar: `${icao} 240400Z 26012KT 9999 SCT030 BKN050 15/10 Q1015 NOSIG`,
      taf: `TAF ${icao} 240500Z 2406/2512 27015KT 9999 BKN030 OVC050`,
      last_updated: new Date().toISOString()
    };
  }

  weatherPendingRequests[airportCode] = (async () => {
    const prompt = `Fetch the current METAR and TAF data for the airport with ICAO code ${icao}.
  Return ONLY a JSON object exactly matching this structure:
  {
    "airport": "${icao}",
    "metar": "Raw METAR string here",
    "taf": "Raw TAF string here",
    "last_updated": "Current ISO timestamp"
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

    const data = JSON.parse(response.text);
    
    // Update cache
    weatherCache[airportCode] = { data, timestamp: now };
    delete weatherPendingRequests[airportCode];
    
    return data;
  } catch (error) {
    handleAiError(error, `getLiveWeather for ${icao}`, true);
    delete weatherPendingRequests[airportCode];
    return {
      airport: icao,
      metar: `${icao} 240400Z 26012KT 9999 SCT030 BKN050 15/10 Q1015 NOSIG`,
      taf: `TAF ${icao} 240500Z 2406/2512 27015KT 9999 BKN030 OVC050`,
      last_updated: new Date().toISOString()
    };
  }
})();

  return weatherPendingRequests[airportCode];
}

export async function getLiveNotams(icao: string, filters?: { keyword?: string; severity?: string }): Promise<NotamData> {
  const airportCode = icao.toUpperCase();
  const now = Date.now();
  const cacheKey = `${airportCode}_${filters?.keyword || ''}`;

  // Return pending request if it exists
  if (notamPendingRequests[cacheKey]) {
    return notamPendingRequests[cacheKey];
  }

  // Check cache
  if (notamCache[cacheKey] && (now - notamCache[cacheKey].timestamp < CACHE_TTL)) {
    return notamCache[cacheKey].data;
  }

  // If AI is in cooldown, return cache or mock
  if (isAiInCooldown()) {
    return notamCache[cacheKey]?.data || {
      airport: icao,
      notams: [
        {
          id: "A0001/24",
          description: "Mock NOTAM: RWY 09/27 WIP (AI Cooldown Active)",
          severity: "Medium"
        }
      ],
      last_updated: new Date().toISOString()
    };
  }

  notamPendingRequests[cacheKey] = (async () => {
    const prompt = `Fetch current significant NOTAMs for the airport with ICAO code ${icao}.
  ${filters?.keyword ? `Focus on keywords: ${filters.keyword}` : ''}
  Return ONLY a JSON object exactly matching this structure:
  {
    "airport": "${icao}",
    "notams": [
      {
        "id": "eg. A1234/23",
        "description": "Brief summary of NOTAM",
        "severity": "Low" | "Medium" | "High"
      }
    ],
    "last_updated": "Current ISO timestamp"
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

    const data = JSON.parse(response.text);
    
    // Update cache
    notamCache[cacheKey] = { data, timestamp: now };
    delete notamPendingRequests[cacheKey];
    
    return data;
  } catch (error) {
    handleAiError(error, `getLiveNotams for ${icao}`, true);
    delete notamPendingRequests[cacheKey];
    return {
      airport: icao,
      notams: [
        {
          id: "A0001/24",
          description: "Mock NOTAM: RWY 09/27 WIP. EXPECT DELAYS.",
          severity: "Medium"
        }
      ],
      last_updated: new Date().toISOString()
    };
  }
})();

  return notamPendingRequests[cacheKey];
}
