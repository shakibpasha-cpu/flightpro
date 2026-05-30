import { getAI, safeParseJson } from './aiService';

export interface SafetyRisk {
  id: string;
  category: 'Airspace' | 'Weather' | 'Crew' | 'Aircraft' | 'Other';
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  mitigation: string;
}

export interface SafetyRiskAnalysisResult {
  overallRiskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  summary: string;
  risks: SafetyRisk[];
}

export async function getSafetyRiskAnalysis(
  departure: string,
  destination: string,
  aircraftType: string,
  date: string,
  flightTimeHours: number
): Promise<SafetyRiskAnalysisResult> {
  const ai = getAI();
  
  const prompt = `Act as an expert Aviation Safety Analyst.
Provide a comprehensive safety risk analysis for the following flight:
- Departure: ${departure}
- Destination: ${destination}
- Aircraft: ${aircraftType}
- Date: ${date}
- Estimated Flight Time: ${flightTimeHours.toFixed(2)} hours

Analyze the route for:
1. Airspace restrictions, geopolitical conflict zones, or FIR congestion.
2. Expected seasonal weather hazards (turbulence, icing, storms).
3. Crew duty time limitations (FTL) or fatigue risks based on flight length.
4. Aircraft-specific operational limitations (e.g. range capabilities on this route).

Respond strictly in JSON format matching the following schema:
{
  "overallRiskLevel": "Low" | "Medium" | "High" | "Critical",
  "summary": "Brief overall safety summary",
  "risks": [
    {
      "id": "RISK-1",
      "category": "Airspace" | "Weather" | "Crew" | "Aircraft" | "Other",
      "description": "Clear description of the risk",
      "severity": "Low" | "Medium" | "High" | "Critical",
      "mitigation": "Actionable suggestion to mitigate the risk"
    }
  ]
}`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });
    
    if (result.text) {
        return safeParseJson(result.text);
    } else {
        throw new Error('Empty response');
    }
  } catch (error) {
    console.error("Error generating safety risk analysis:", error);
    return {
      overallRiskLevel: 'Medium',
      summary: 'Standard operational procedures apply. Full AI analysis unavailable.',
      risks: [
        {
          id: 'SYS-001',
          category: 'Other',
          description: 'Automated risk analysis failed to retrieve complete data.',
          severity: 'Low',
          mitigation: 'Consult manual NOTAMs and localized weather data.'
        }
      ]
    };
  }
}
