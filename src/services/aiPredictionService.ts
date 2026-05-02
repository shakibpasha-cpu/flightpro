import { Type } from "@google/genai";
import { getAI, handleAiError, isAiInCooldown } from "./aiService";
import { safeStringify } from "../utils/safeJson";

export interface AIPrediction {
  idleTimePrediction: string;
  emptyLegs: {
    route: string;
    probability: number;
    reason: string;
  }[];
  maintenanceWindowPrediction: string;
  availabilityScore: number;
  confidenceScore: number;
  analysis: string;
}

// Global cache for predictions
const predictionCache: Record<string, { data: AIPrediction, timestamp: number }> = {};
const pendingPredictions: Record<string, Promise<AIPrediction | null>> = {};
const CACHE_TTL = 3600000; // 1 hour

export async function predictAircraftAvailability(
  aircraftType: string,
  registration: string,
  history: any[],
  currentStatus: any
): Promise<AIPrediction | null> {
  const cacheKey = `${aircraftType}_${registration}`.toLowerCase();
  const now = Date.now();

  // Return pending request if it exists
  if (pendingPredictions[cacheKey]) {
    return pendingPredictions[cacheKey];
  }

  // Check cache
  if (predictionCache[cacheKey] && (now - predictionCache[cacheKey].timestamp < CACHE_TTL)) {
    return predictionCache[cacheKey].data;
  }

  // If AI is in cooldown, return cache (even if stale) or null
  if (isAiInCooldown()) {
    return predictionCache[cacheKey]?.data || null;
  }

  pendingPredictions[cacheKey] = (async () => {
    try {
      const ai = getAI();
    const prompt = `
      Analyze the following aircraft data and predict its availability, idle time, potential empty legs, and upcoming maintenance windows.
      
      Aircraft: ${aircraftType} (${registration})
      Current Status: ${safeStringify(currentStatus)}
      Recent Flight History: ${safeStringify(history)}
      
      Based on this data, provide a detailed prediction. 
      - Idle time: When is the aircraft likely to be free next?
      - Empty legs: Based on typical routes and current position, are there likely empty legs?
      - Maintenance: Based on flight frequency and typical maintenance cycles for this type, when is the next window?
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            idleTimePrediction: { type: Type.STRING, description: "Predicted idle time duration and start" },
            emptyLegs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  route: { type: Type.STRING },
                  probability: { type: Type.NUMBER },
                  reason: { type: Type.STRING }
                },
                required: ["route", "probability", "reason"]
              }
            },
            maintenanceWindowPrediction: { type: Type.STRING },
            availabilityScore: { type: Type.NUMBER, description: "0-100 score of current availability" },
            confidenceScore: { type: Type.NUMBER, description: "0-100 score of prediction confidence" },
            analysis: { type: Type.STRING, description: "Brief textual analysis of the prediction" }
          },
          required: ["idleTimePrediction", "emptyLegs", "maintenanceWindowPrediction", "availabilityScore", "confidenceScore", "analysis"]
        }
      }
    });

    const result = JSON.parse(response.text) as AIPrediction;
    
    // Update cache
    predictionCache[cacheKey] = { data: result, timestamp: now };
    delete pendingPredictions[cacheKey];
    
    return result;
  } catch (error) {
    handleAiError(error, 'predictAircraftAvailability', true);
    delete pendingPredictions[cacheKey];
    return null;
  }
})();

  return pendingPredictions[cacheKey];
}
