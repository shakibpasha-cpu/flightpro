import { Type } from "@google/genai";
import { getAI, handleAiError } from "./aiService";

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

export async function predictAircraftAvailability(
  aircraftType: string,
  registration: string,
  history: any[],
  currentStatus: any
): Promise<AIPrediction | null> {
  try {
    const ai = getAI();
    const prompt = `
      Analyze the following aircraft data and predict its availability, idle time, potential empty legs, and upcoming maintenance windows.
      
      Aircraft: ${aircraftType} (${registration})
      Current Status: ${JSON.stringify(currentStatus)}
      Recent Flight History: ${JSON.stringify(history)}
      
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

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'predictAircraftAvailability');
    throw error;
  }
}
