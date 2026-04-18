import { GoogleGenAI } from "@google/genai";
import { db } from "../firebase";
import { collection, getDocs, query, where, limit, addDoc, setDoc, doc } from "firebase/firestore";
import { handleApiError } from "./errorService";

let quotaCooldownUntil = 0;

export const getAI = () => {
  if (Date.now() < quotaCooldownUntil) {
    throw new Error("Gemini AI Quota Exceeded. Cooldown in effect.");
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

export const isAiServiceUnavailable = (err: any) => {
  if (!err) return false;
  const str = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
  const isQuota = 
    str.includes('429') || 
    str.includes('RESOURCE_EXHAUSTED') || 
    str.toLowerCase().includes('quota') || 
    str.toLowerCase().includes('exceeded quota') ||
    str.includes('Cooldown in effect') ||
    err?.status === 429 || 
    err?.code === 429 || 
    err?.error?.code === 429;

  const isTransient = 
    str.includes('500') || 
    str.includes('Rpc failed') || 
    str.includes('xhr error') ||
    err?.status === 500 ||
    err?.code === 500 ||
    err?.error?.code === 500;
  
  const shouldCooldown = isQuota || isTransient;

  if (shouldCooldown && !str.includes('Cooldown in effect')) {
    // Set cooldown for 60 seconds if it's a fresh error
    quotaCooldownUntil = Date.now() + 60000;
  }
  
  return shouldCooldown;
};

export const handleAiError = (error: any, endpoint: string) => {
  const isUnavailable = isAiServiceUnavailable(error);
  const message = error instanceof Error ? error.message : String(error);
  const isCooldown = message.includes('Cooldown in effect');

  if (isUnavailable) {
    if (!isCooldown) {
      console.warn(`Gemini AI Service Unavailable for ${endpoint}. Cooldown in effect for 60s.`);
    }
  }
  handleApiError(error, 'Gemini AI', endpoint);
};

export async function searchNearbyAirports(lat: number, lng: number, radius: number = 50) {
  try {
    const response = await fetch(`/api/airports/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
    if (!response.ok) throw new Error("Failed to fetch nearby airports");
    return await response.json();
  } catch (error) {
    console.error("Error searching nearby airports:", error);
    return { airports: [] };
  }
}

export async function getFlightRouteDetails(departure: string, destination: string) {
  const prompt = `Calculate the flight details between ${departure} and ${destination}.
  
  CRITICAL ROUTE ENGINE REQUIREMENTS:
  1. Calculate Great Circle (GC) distance (in nautical miles).
  2. Calculate Realistic Routing distance (GC distance + 5% to 10% buffer for standard airways).
  3. Identify all FIRs (Flight Information Regions) crossed, their associated countries, rules, and estimated charges.
  4. Identify required permits (Overflight, Landing) for each country/FIR.
  5. Identify restricted airspaces or conflict zones along the route.
  
  Calculate detailed costs:
  - Fuel cost (based on current airport rates at ${departure} and ${destination})
  - Landing fees
  - Handling charges
  - Parking fees (if required)
  - Crew cost
  - Overflight charges (per FIR)
  - Navigation charges (terminal and en-route)
  - Terminal navigation fees (per airport)
  - Operational costs: Catering, Ground transport, De-icing (if applicable)
  - Positioning Costs: Empty leg positioning from aircraft's currentLocation and Repositioning back to homeBase.
  
  Return JSON: {
    gcDistance: number,
    routingDistance: number,
    departureCoords: { lat: number, lng: number },
    destinationCoords: { lat: number, lng: number },
    legs: {
      segment: string, // e.g. "EGLL to LFFF"
      fir: string,
      distance: number,
      estimatedTime: string,
      altitude: string,
      restrictedAirspaceNotes: string
    }[],
    firs: { name: string, code: string, country: string, rules: string, overflightCharge: number, navigationCharge: number }[],
    permits: { country: string, type: 'Overflight' | 'Landing', leadTime: string, estimatedFee: number }[],
    restrictedAreas: { name: string, reason: string, severity: 'Low' | 'Medium' | 'High', coordinates?: [number, number][] }[],
    operationalSummaryNote: string, // Detailed breakdown following this EXACT structure: 
    // DEP: [Name] / [ICAO] / [IATA] / Handling: [Agency Name] / Fees: Nav: [Cost], Term: [Cost], Prk: [Cost], Fuel: [Cost]
    // ROUTE: Total Distance: [NM] / FIRs: [Name(Code): Charge, ...] / Rules: [Brief summary]
    // ARR: [Name] / [ICAO] / [IATA] / Handling: [Agency Name] / Fees: Nav: [Cost], Term: [Cost], Prk: [Cost], Fuel: [Cost]
    // TOTAL FLIGHT CHARGES: [Grand Total]
    costs: {
      fuel: number,
      landingFees: number,
      handling: number,
      parking: number,
      crew: number,
      overflight: number,
      navigation: number,
      terminalNavigation: number,
      catering: number,
      groundTransport: number,
      deicing: number,
      positioning: number,
      repositioning: number,
      total: number
    }
  }.`;
  
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

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'getFlightRouteDetails');
    throw error;
  }
}


export async function getOptimizedRoute(departure: string, destination: string, currentFirs: any[], aircraftPerformance?: any, optimizationCriteria?: string) {
  const prompt = `Analyze the flight route from ${departure} to ${destination}.
  Current FIRs: ${JSON.stringify(currentFirs)}
  Aircraft Performance: ${JSON.stringify(aircraftPerformance)}
  User Preferred Optimization Criteria: ${optimizationCriteria || 'balanced (consider cost, time, and fuel)'}
  
  🤖 AI BEHAVIOR RULES:
  - Never leave fields empty → estimate intelligently based on aviation standards.
  - Always explain assumptions briefly in the notes.
  - Be realistic (not random) with pricing, flight times, and routing.
  - Prefer aviation-standard terminology (e.g., block time, positioning, ACMI, dry lease).
  - Keep output clean, professional, and client-ready.
 
  🚀 ADVANCED FEATURES TO INCLUDE:
  - Suggest alternative flight paths (e.g., Time-Optimized, Cost-Optimized, Weather-Avoidance).
  - Analyze current weather patterns (SIGMETs, turbulence, thunderstorms, icing) along the route.
  - Analyze FIR (Flight Information Region) overflight charges and suggest avoidance of high-cost airspaces.
  - Analyze aircraft performance (climb rate, cruise speed, fuel flow) and suggest optimal flight levels.
  - Detect and flag high-cost routes (e.g., expensive overflight fees, high landing fees).

  CRITICAL OPTIMIZATION GOALS:
  1. COST REDUCTION: Suggest a route that minimizes FIR overflight charges. Identify specific high-cost FIRs to avoid.
  2. FUEL EFFICIENCY: Suggest optimal flight levels and speeds based on aircraft performance data.
  3. SAFETY & WEATHER: Check current and forecast weather conditions along the route. Suggest rerouting to avoid severe weather.
  4. TIME OPTIMIZATION: Suggest routes that take advantage of favorable winds (jet streams) or shorter airway segments.
  
  Provide:
  - Multiple alternative flight paths (at least 2).
  - For each alternative:
    - List of FIRs (name, country, overflightCharge, navigationCharge).
    - Routing changes (e.g., "Via L602 instead of M747").
    - Weather avoidance notes.
    - FIR optimization notes.
    - Performance notes (optimal FL, speed).
    - Estimated total cost and time.
    - Total savings compared to the primary route.
  - A final recommendation on which route to choose and why.
  
  Return the result as a JSON object: { 
    "alternatives": [
      {
        "name": string, // e.g. "Cost Optimized", "Time Optimized", "Weather Avoidance"
        "firs": { "name": string, "country": string, "rules": string, "overflightCharge": number, "navigationCharge": number }[], 
        "routingChanges": string,
        "weatherAvoidance": string,
        "firOptimization": string,
        "performanceNotes": string,
        "totalCost": number,
        "totalTime": string,
        "totalSavings": number,
        "recommendation": string
      }
    ],
    "summary": string
  }.`;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text.replace(/```json\n?/, '').replace(/```/, '');
    return JSON.parse(text);
  } catch (error) {
    handleAiError(error, 'getOptimizedRoute');
    return null;
  }
}


export async function getSuggestedAircraft(
  passengers: number,
  cargoWeight: number,
  distance: number,
  aircraftList: any[],
  departureIcao: string,
  missionType: string = 'Passenger'
) {
  const prompt = `Given these aircraft: ${JSON.stringify(aircraftList)}, suggest three distinct aircraft options for a ${missionType} mission with ${passengers} passengers, ${cargoWeight}kg cargo, and a mission distance of ${distance} nautical miles starting from ${departureIcao}.
  
  CRITICAL SELECTION CRITERIA:
  1. Mission Type Alignment: Prioritize aircraft that are best suited for ${missionType} (e.g., dedicated freighters for Cargo, ultra-long-range/luxury jets for VIP, high-capacity airliners for ACMI).
  2. Range Capability: Aircraft MUST have range > ${distance} nautical miles. If the mission distance exceeds 85% of the aircraft's range, you MUST explicitly plan for optimal fuel stops and mention them in the reasoning.
  3. Passenger Capacity: Aircraft MUST have maxPassengers >= ${passengers}.
  4. Payload Capacity: Aircraft MUST have maxPayload > (${passengers} * 90kg + ${cargoWeight}kg).
  5. Runway Requirements: Aircraft takeoff/landing distance MUST be <= runway length at ${departureIcao} and destination.
  
  If an exact match is not available, suggest the closest alternatives.
  
  PRIORITIZATION:
  1. Fuel Efficiency: Prioritize aircraft with lower fuelBurnPerHour.
  2. Availability Likelihood: Prioritize aircraft with shortest positioning distance.
  3. Cost-Effectiveness: Prioritize aircraft with lower hourlyRate.
  
  Return a JSON object: {
    options: {
      type: string,
      aircraftName: string,
      reasoning: string,
      fuelEfficiencyScore: number,
      availabilityScore: number,
      costEffectivenessScore: number,
      totalScore: number
    }[]
  }

  🤖 AI BEHAVIOR RULES:
  - Never leave fields empty → estimate intelligently based on aviation standards.
  - Always explain assumptions briefly in the reasoning.
  - Be realistic (not random) with aircraft selection.
  - Prefer aviation-standard terminology.
  - Keep output clean, professional, and client-ready.

  🚀 ADVANCED FEATURES TO INCLUDE:
  - Suggest a cheaper aircraft alternative if applicable.
  - Highlight empty leg opportunities if any match the route.`;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error: any) {
    console.warn("Using fallback aircraft suggestions due to API error:", error?.message);
    
    if (isAiServiceUnavailable(error)) {
      return {
        options: [
          {
            type: "Light Jet",
            aircraftName: "Phenom 300",
            reasoning: "SERVICE UNAVAILABLE: Sample suggestion for light jet missions.",
            fuelEfficiencyScore: 85,
            availabilityScore: 90,
            costEffectivenessScore: 80,
            totalScore: 85
          },
          {
            type: "Midsize Jet",
            aircraftName: "Citation Latitude",
            reasoning: "SERVICE UNAVAILABLE: Sample suggestion for midsize jet missions.",
            fuelEfficiencyScore: 80,
            availabilityScore: 85,
            costEffectivenessScore: 75,
            totalScore: 80
          },
          {
            type: "Heavy Jet",
            aircraftName: "Global 6000",
            reasoning: "SERVICE UNAVAILABLE: Sample suggestion for heavy jet missions.",
            fuelEfficiencyScore: 75,
            availabilityScore: 80,
            costEffectivenessScore: 70,
            totalScore: 75
          }
        ]
      };
    }
    return null;
  }
}

export async function getWindImpact(departure: string, destination: string) {
  const prompt = `Based on current and forecast wind data for the route from ${departure} to ${destination}, calculate the average wind component (headwind or tailwind) in knots. 
  Return a JSON object: { windComponent: number, description: string }. 
  A positive windComponent indicates a tailwind, and a negative value indicates a headwind.`;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error: any) {
    handleAiError(error, 'getWindImpact');
    return { windComponent: 0, description: "Service temporarily unavailable. Defaulting to zero wind component." };
  }
}

export async function parseNaturalLanguageQuote(prompt: string) {
  const systemPrompt = `You are an AI assistant for an aviation charter broker. 
  Extract the flight request details from the user's natural language input.
  
  Return ONLY a JSON object matching this structure:
  {
    "departure": "string (ICAO/IATA or City)",
    "destination": "string (ICAO/IATA or City)",
    "dateTime": "string (YYYY-MM-DDTHH:mm format, guess based on input like 'tomorrow')",
    "passengers": number,
    "cargoWeight": number (in kg),
    "tripType": "one-way" | "round-trip" | "multi-day",
    "returnDate": "string (optional, YYYY-MM-DDTHH:mm)",
    "aircraftPreference": "string (optional)"
  }`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `${systemPrompt}\n\nUser Input: "${prompt}"`,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.warn("Using fallback parsed quote due to API error:", error);
    return {
      departure: "EGLL",
      destination: "KJFK",
      dateTime: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      passengers: 4,
      tripType: "one-way",
    };
  }
}

export async function optimizeRoute(params: {
  departure: string;
  destination: string;
  stops?: string;
  dateTime: string;
  aircraftType?: string;
  currentDate: string;
  passengers: number;
  payload: number;
  aircraftPerformance?: any;
  optimizationCriteria?: string;
}) {
  const prompt = `You are a Senior Flight Dispatcher and Route Optimization Expert.
  Optimize the flight route from ${params.departure} to ${params.destination} ${params.stops ? `via ${params.stops}` : ''} for a ${params.aircraftType || 'standard business jet'}.
  
  Current Date: ${params.currentDate}
  Departure Date/Time: ${params.dateTime}
  Mission: ${params.passengers} PAX, ${params.payload}kg Cargo.
  Aircraft Performance: ${JSON.stringify(params.aircraftPerformance || 'Standard performance')}
  User Preferred Optimization Criteria: ${params.optimizationCriteria || 'balanced (consider cost, time, and fuel)'}

  🤖 AI BEHAVIOR RULES:
  - Never leave fields empty → estimate intelligently based on aviation standards.
  - Always explain assumptions briefly in the notes.
  - Be realistic (not random) with pricing, flight times, and routing.
  - Prefer aviation-standard terminology (e.g., block time, positioning, ACMI, dry lease).
  - Keep output clean, professional, and client-ready.

  🚀 OPTIMIZATION CRITERIA:
  1. REAL-TIME WEATHER: Analyze current and forecast weather (SIGMETs, turbulence, thunderstorms, wind components). Suggest routing to avoid hazardous weather.
  2. FIR CHARGES: Analyze overflight and navigation charges for all FIRs crossed. Suggest alternative routings to avoid high-cost FIRs if the distance trade-off is beneficial.
  3. AIRCRAFT PERFORMANCE: Analyze the specific performance characteristics of the ${params.aircraftType || 'selected aircraft'} (climb rate, cruise speed at different altitudes, fuel flow). Suggest optimal flight levels.
  4. EMPTY LEG OPPORTUNITIES: Identify potential empty leg matches that could reduce positioning costs.
  5. OPERATIONAL EFFICIENCY: Recommend optimal departure timing to avoid airport congestion or peak-hour fees.

  Return a JSON object:
  {
    "originalRoute": {
      "distanceNm": number,
      "flightTimeHours": number,
      "estimatedCost": number,
      "fuelBurnKg": number
    },
    "alternatives": [
      {
        "label": "e.g., Time-Optimized, Cost-Optimized, Weather-Avoidance",
        "distanceNm": number,
        "flightTimeHours": number,
        "estimatedCost": number,
        "fuelBurnKg": number,
        "routingChanges": "string",
        "weatherAvoidance": "string",
        "firOptimization": "string",
        "performanceNotes": "string",
        "totalSavings": number,
        "profitabilityMetrics": {
          "brokerProfit": number,
          "profitPerHour": number,
          "marginPercentage": number
        },
        "recommendation": "string"
      }
    ],
    "weatherAlerts": { "severity": "Low" | "Medium" | "High", "description": "string", "impact": "string" }[],
    "summary": "string"
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

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'optimizeRoute');
    return null;
  }
}

export async function getFuelStopSuggestions(params: {
  legs: any[];
  aircraft: any;
  missionType: string;
  currentDate: string;
}) {
  const prompt = `You are a Senior Flight Dispatcher. Analyze the following flight legs and suggest optimal fuel stop locations.
  
  Aircraft: ${JSON.stringify(params.aircraft)}
  Current Legs: ${JSON.stringify(params.legs)}
  Mission Type: ${params.missionType}
  Current Date: ${params.currentDate}

  CRITICAL ANALYSIS RULES:
  1. RANGE CHECK: If any leg distance exceeds 85% of the aircraft's max range (${params.aircraft.range || 'unknown'} nm), you MUST insert a fuel stop.
  2. FUEL PRICE OPTIMIZATION: Even if range is sufficient, suggest a stop if a major fuel hub with significantly lower prices (e.g., Shannon EINN, Gander CYQX, Keflavik BIKF, Dubai OMDB, Singapore WSSS) is near the route.
  3. OPERATIONAL FEASIBILITY: Ensure the suggested stop airport has a runway long enough for the ${params.aircraft.type} and 24/7 fuel/handling availability.
  4. MINIMIZE DEVIATION: The stop should be as close to the great circle path as possible to minimize extra distance.

  Return a JSON object with the updated legs:
  {
    "suggestedLegs": [
      {
        "departure": "string (ICAO)",
        "destination": "string (ICAO)",
        "departureCoords": { "lat": number, "lng": number },
        "destinationCoords": { "lat": number, "lng": number },
        "stopType": "fuel" | "mission"
      }
    ],
    "reasoning": "string explaining why these stops were chosen and the estimated fuel savings."
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

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'getFuelStopSuggestions');
    return null;
  }
}

export async function getOperationalRiskAssessment(params: {
  departure: string;
  destination: string;
  aircraftType: string;
  dateTime: string;
}) {
  const prompt = `Perform a comprehensive Operational Risk Assessment for a flight from ${params.departure} to ${params.destination} using a ${params.aircraftType} on ${params.dateTime}.
  
  Analyze:
  1. AIRPORT CONSTRAINTS: Runway length vs aircraft requirement, PCN/ACN compatibility, slot availability, and operating hours.
  2. GROUND HANDLING: Turnaround time feasibility, specialized equipment availability (e.g., high-loader for cargo).
  3. CREW DUTY: Potential crew duty limit issues for the total block time.
  4. GEOPOLITICAL: High-risk FIRs, permit lead times, and current geopolitical stability.
  5. WEATHER RISKS: Seasonal weather patterns (e.g., fog in winter, thunderstorms in summer).

  Return a JSON object:
  {
    "overallRiskScore": number (0-100, where 100 is highest risk),
    "riskLevel": "Low" | "Medium" | "High" | "Critical",
    "risks": [
      { "category": "string", "severity": "Low" | "Medium" | "High", "description": "string", "mitigation": "string" }
    ],
    "operationalReadiness": number (0-100),
    "dispatcherNotes": "string"
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

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'getOperationalRiskAssessment');
    return null;
  }
}

export async function generateCharterQuotes(params: {
  departure: string;
  destination: string;
  stops?: string;
  dateTime: string;
  returnDate?: string;
  tripType: string;
  missionType: string;
  passengers: number;
  cargoWeight: number;
  aircraftPreference?: string;
  brokerMargin: number;
  operatorMargin: number;
  currentDate: string;
  airportsContext?: any[];
  specialInstructions?: string;
  customWaypoints?: {lat: number, lng: number}[];
}, aircraftList: any[]) {
  // Fetch available empty legs to check for matches
  const emptyLegs = await getEmptyLegs();

  const prompt = `You are a Senior Aviation Pricing Expert and Charter Broker.
  Generate a REAL-WORLD, aviation-grade charter quotation for the following request:
  
  - Current Date: ${params.currentDate}
  - Departure: ${params.departure}
  - Destination: ${params.destination}
  - Stops/Via: ${params.stops || 'None'}
  - Date & Time: ${params.dateTime}
  - Trip Type: ${params.tripType}
  - Mission Type: ${params.missionType}
  - Return Date: ${params.returnDate || 'N/A'}
  - Passengers: ${params.passengers}
  - Cargo Weight: ${params.cargoWeight} kg
  - Aircraft Preference: ${params.aircraftPreference || 'None'}
  - Broker Margin: ${params.brokerMargin}%
  - Operator Margin: ${params.operatorMargin}%
  - Special Routing Instructions: ${params.specialInstructions || 'None'}
  - Custom Waypoints (Lat/Lng): ${params.customWaypoints && params.customWaypoints.length > 0 ? JSON.stringify(params.customWaypoints) : 'None'}

  Available Fleet Data:
  ${JSON.stringify(aircraftList)}

  Available Empty Legs (Check for matches):
  ${JSON.stringify(emptyLegs)}

  Airport Operational Data (Use for fees, handling status, and runway checks):
  ${JSON.stringify(params.airportsContext || [])}

  CRITICAL SELECTION CRITERIA:
  1. Passenger Capacity: Selected aircraft MUST have maxPassengers >= ${params.passengers}. Do not suggest aircraft with fewer seats than requested.
  2. Payload Capacity: Aircraft MUST have maxPayload > (${params.passengers} * 90kg + ${params.cargoWeight}kg).
  3. Fleet Restriction: You MUST ONLY select aircraft types that exist in the "Available Fleet Data" provided above. Do not invent or suggest aircraft types that are not in the list.

  🤖 AI BEHAVIOR RULES:
  - Never leave fields empty → estimate intelligently based on aviation standards.
  - Always explain assumptions briefly in the notes.
  - Be realistic (not random) with pricing, flight times, and routing.
  - Prefer aviation-standard terminology (e.g., block time, positioning, ACMI, dry lease).
  - Keep output clean, professional, and client-ready.

  🚀 ADVANCED FEATURES TO INCLUDE:
  - Suggest a cheaper aircraft alternative if applicable.
  - Highlight empty leg opportunities if any match the route.
  - Recommend optimal departure timing based on typical airport congestion or weather patterns.
  - Detect and flag high-cost routes (e.g., expensive overflight fees, high landing fees).

  CORE AI LOGIC REQUIREMENTS:
  1. MULTI-LEG COSTING: Calculate costs for all legs (Departure -> Stops -> Destination). If round-trip, calculate the return leg as well.
  2. ROUND-TRIP DISCOUNT: If tripType is 'round-trip', apply a 5% to 10% discount on the total operator base cost for the return leg (due to reduced positioning/crew efficiency).
  3. EMPTY LEG DETECTION: If any available empty leg matches the route (departure/destination) and date, highlight it as a special "Empty Leg" option with significantly reduced pricing (30-50% off standard rates).
  4. ROUTE ENGINE: Calculate Great Circle distance + 5-10% for realistic routing. Detect required fuel stops and FIR regions crossed. MUST STRICTLY FOLLOW "Special Routing Instructions" (e.g., avoiding certain FIRs) and route through "Custom Waypoints" if provided.
  5. AIRCRAFT SELECTION ENGINE (CRITICAL):
     - Suggest THREE distinct aircraft options for the mission:
       - Cheapest: Most economical option.
       - Fastest: Highest speed option.
       - Recommended: Best balance for this specific mission.
     - FLEET CATEGORIES TO CONSIDER: Light Jet, Midsize Jet, Heavy Jet, Cargo Aircraft.
     - PASSENGER CAPACITY: Selected aircraft MUST have maxPassengers >= ${params.passengers}. If passengers == 0, this is a PURE CARGO mission.
     - CARGO CAPACITY: Selected aircraft MUST have maxPayload >= ${params.cargoWeight}. If cargoWeight > 0 or passengers == 0, prioritize aircraft with high payload capacity or dedicated cargo aircraft.
     - MISSION CONTEXT: If passengers == 0, the aircraft_options SHOULD focus on cargo-specific aircraft (e.g., Boeing 747-8F, A330-200F, IL-76, or passenger aircraft with significant belly space). The option_type "Cargo" should be used where appropriate.
     - RANGE & FUEL STOPS: You MUST check if any leg distance exceeds 85% of the aircraft's maximum range. If it does, you MUST suggest at least one optimal fuel stop (ICAO code) at a strategic midpoint or high-traffic hub to ensure safety reserves.
     - RUNWAY LIMITATIONS: Ensure aircraft can operate at all airports in the plan.
  6. COSTING ENGINE: Calculate FULL breakdown including Fuel, Crew, Maintenance, Airport fees, Airspace fees, and Operational costs.
  7. POSITIONING LOGIC: Detect the nearest available aircraft. Calculate empty leg positioning from its currentLocation to ${params.departure} and repositioning back to homeBase.
  8. PRICING STRATEGY (PRODUCTION READY ACMI MODEL):
     - BASE ACMI RATE MODEL: 
        ACMI Rate = (Lease Cost / Monthly Hours) + Crew Cost per Hour + Maintenance Cost per Hour + Insurance Cost per Hour + Operator Margin (30-60%).
     - BLOCK HOURS MODEL:
        Block Hours = (Distance / Cruise Speed) * 1.15 + Taxi Time (0.3 - 0.6 hrs).
     - FULL MASTER FORMULA:
        TOTAL COST = [ (Block Hours * Adjusted ACMI Rate) + Fuel Cost + FIR Charges + Airport Charges + Crew Cost + Positioning Cost ] * Risk Multiplier + Contingency + Broker Margin.
     - FUEL COST: Block Hours * Fuel Burn * Fuel Price.
     - FIR CHARGES: Distance * FIR Rate * sqrt(MTOW / 50).
     - POSITIONING: Mandatory if Aircraft Distance > 1000 km.
     - RISK MULTIPLIERS: Normal (1.0), Africa/Remote (1.10), Conflict Zone (1.25 - 1.60).
     - MARKET MULTIPLIER: Demand * Season * Urgency * Region.
     - BROKER MARGIN: ACMI Lease (5-10%), Charter (10-20%), Urgent (20%+).
  
  9. AI OPTIMIZATION: Suggest cheaper routes, fuel stops, or best aircraft for profit vs price balance.
  10. AVAILABILITY ESTIMATION: Classify aircraft availability as 'Confirmed', 'Likely Available', or 'On Request'.
      - Use logic:
        - Major hub airports → lower availability (higher demand).
        - Low traffic regions → higher availability.
        - Consider aircraft idle patterns if available.

  OUTPUT FORMAT (STRICT JSON ONLY):
  {
    "route": {
      "distance_nm": number,
      "routing_distance_nm": number,
      "firs_crossed": ["string"],
      "route_notes": "string",
      "optimization_suggestions": {
        "cheaper_route": "string",
        "fuel_stop_recommendation": "string"
      }
    },
    "aircraft_options": [
      {
        "option_type": "Cheapest" | "Fastest" | "Recommended" | "Empty Leg" | "Cargo",
        "aircraft_name": "string",
        "passenger_capacity": number,
        "cargo_capacity_kg": number,
        "flight_time_hours": number,
        "total_price": number,
        "profit": number,
        "profit_margin": number,
        "optimization_rank": number,
        "is_empty_leg": boolean,
        "round_trip_discount_applied": number, // Amount in USD
        "cost_breakdown": {
          "operator_base_cost": number,
          "flight_costs": { "fuel": number, "crew": number, "maintenance": number },
          "airport_costs": { "landing": number, "parking": number, "handling": number, "terminal_navigation": number },
          "airspace_costs": { "overflight": number, "navigation": number },
          "operational_costs": { "catering": number, "ground_transport": number, "deicing": number, "positioning": number, "repositioning": number, "other": number },
          "margins": { 
            "broker_margin": number, 
            "operator_margin": number, 
            "dynamic_pricing_adjustment": number,
            "dynamic_pricing_factors": { "demand_impact": number, "season_impact": number, "urgency_impact": number }
          }
        },
        "waypoints": [
          { "name": "string", "icao": "string", "lat": number, "lng": number, "altitude": number, "type": "departure" | "destination" | "fuel_stop" | "stopover" }
        ],
        "notes": ["string"],
        "commercial_viability_score": number,
        "availability_status": "Confirmed" | "Likely Available" | "On Request"
      }
    ],
    "general_notes": ["string"] // MUST include: "Subject to aircraft availability", "Final price may vary based on operator confirmation", "Fuel price fluctuations not included", "Slots & permits not included unless specified", plus any other relevant notes.
  }`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Upgraded to Pro for complex pricing logic
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return { data: JSON.parse(response.text), isFallback: false };
  } catch (error: any) {
    console.warn("Using fallback charter quotes data due to API error:", error?.message || "Rate limit exceeded");
    
    // Fallback data
    const fallbackData = {
      "route": {
        "distance_nm": 3500,
        "routing_distance_nm": 3850,
        "firs_crossed": ["EGTT", "LFFF", "EDWW"],
        "route_notes": "Standard routing applied. No major weather disruptions detected.",
        "optimization_suggestions": {
          "cheaper_route": "Direct routing over NAT tracks if applicable.",
          "fuel_stop_recommendation": "None required for this route."
        }
      },
      "aircraft_options": [
        {
          "option_type": "Recommended",
          "aircraft_name": "Global 6000",
          "cargo_capacity_kg": 2631,
          "flight_time_hours": 7.5,
          "total_price": 125000,
          "profit": 12500,
          "profit_margin": 10,
          "optimization_rank": 1,
          "is_empty_leg": false,
          "round_trip_discount_applied": 0,
          "cost_breakdown": {
            "operator_base_cost": 100000,
            "flight_costs": { "fuel": 35000, "crew": 5000, "maintenance": 10000 },
            "airport_costs": { "landing": 2500, "parking": 1000, "handling": 1500, "terminal_navigation": 500 },
            "airspace_costs": { "overflight": 3000, "navigation": 1500 },
            "operational_costs": { "catering": 2000, "ground_transport": 500, "deicing": 0, "positioning": 0, "repositioning": 0, "other": 0 },
            "margins": { 
              "broker_margin": 10, 
              "operator_margin": 15, 
              "dynamic_pricing_adjustment": 5000,
              "dynamic_pricing_factors": { "demand_impact": 2, "season_impact": 1, "urgency_impact": 0 }
            }
          },
          "waypoints": [
            { "name": "Departure", "icao": params.departure, "lat": 51.4700, "lng": -0.4543, "altitude": 0, "type": "departure" },
            { "name": "Destination", "icao": params.destination, "lat": 40.6413, "lng": -73.7781, "altitude": 0, "type": "destination" }
          ],
          "notes": ["Optimal balance of speed and comfort.", "Non-stop capability."],
          "commercial_viability_score": 95,
          "availability_status": "Confirmed"
        },
        {
          "option_type": "Cheapest",
          "aircraft_name": "Challenger 350",
          "cargo_capacity_kg": 1542,
          "flight_time_hours": 8.2,
          "total_price": 95000,
          "profit": 9500,
          "profit_margin": 10,
          "optimization_rank": 2,
          "is_empty_leg": false,
          "round_trip_discount_applied": 0,
          "cost_breakdown": {
            "operator_base_cost": 75000,
            "flight_costs": { "fuel": 25000, "crew": 4000, "maintenance": 8000 },
            "airport_costs": { "landing": 2000, "parking": 800, "handling": 1200, "terminal_navigation": 400 },
            "airspace_costs": { "overflight": 2500, "navigation": 1200 },
            "operational_costs": { "catering": 1500, "ground_transport": 500, "deicing": 0, "positioning": 0, "repositioning": 0, "other": 0 },
            "margins": { 
              "broker_margin": 10, 
              "operator_margin": 15, 
              "dynamic_pricing_adjustment": 3000,
              "dynamic_pricing_factors": { "demand_impact": 1, "season_impact": 1, "urgency_impact": 0 }
            }
          },
          "waypoints": [
            { "name": "Departure", "icao": params.departure, "lat": 51.4700, "lng": -0.4543, "altitude": 0, "type": "departure" },
            { "name": "Fuel Stop", "icao": "BIA", "lat": 63.9850, "lng": -22.6056, "altitude": 0, "type": "fuel_stop" },
            { "name": "Destination", "icao": params.destination, "lat": 40.6413, "lng": -73.7781, "altitude": 0, "type": "destination" }
          ],
          "notes": ["Requires one fuel stop.", "Most economical option."],
          "commercial_viability_score": 88,
          "availability_status": "Likely Available"
        },
        {
          "option_type": "Cargo",
          "aircraft_name": "Boeing 747-8F",
          "cargo_capacity_kg": 134200,
          "flight_time_hours": 7.8,
          "total_price": 185000,
          "profit": 35000,
          "profit_margin": 18.9,
          "optimization_rank": 9,
          "is_empty_leg": false,
          "round_trip_discount_applied": 0,
          "cost_breakdown": {
            "operator_base_cost": 140000,
            "flight_costs": { "fuel": 65000, "crew": 8000, "maintenance": 15000 },
            "airport_costs": { "landing": 5000, "parking": 2000, "handling": 8000, "terminal_navigation": 1000 },
            "airspace_costs": { "overflight": 4500, "navigation": 2000 },
            "operational_costs": { "catering": 500, "ground_transport": 1000, "deicing": 0, "positioning": 0, "repositioning": 0, "other": 0 },
            "margins": { 
              "broker_margin": 12, 
              "operator_margin": 15, 
              "dynamic_pricing_adjustment": 10000,
              "dynamic_pricing_factors": { "demand_impact": 1, "season_impact": 1, "urgency_impact": 0 }
            }
          },
          "waypoints": [
            { "name": "Departure", "icao": params.departure, "lat": 51.4700, "lng": -0.4543, "altitude": 0, "type": "departure" },
            { "name": "Destination", "icao": params.destination, "lat": 40.6413, "lng": -73.7781, "altitude": 0, "type": "destination" }
          ],
          "notes": ["Dedicated cargo aircraft.", "High payload capacity.", "Direct flight."],
          "commercial_viability_score": 92,
          "availability_status": "On Request"
        }
      ],
      "general_notes": ["Prices are estimates and subject to availability.", "Weather may impact final routing."]
    };
    
    return { data: fallbackData, isFallback: true };
  }
}

export async function getCommercialViabilitySuggestion(quotesData: any, params: any) {
  const prompt = `Analyze the following charter quotes and route data:
  ${JSON.stringify(quotesData)}
  
  Request parameters:
  ${JSON.stringify(params)}
  
  CRITICAL ANALYSIS:
  1. BEST AIRCRAFT: Suggest the aircraft that offers the best balance between Broker Profit and Client Price. High profit for the broker is good, but if the price is too high, the client won't book.
  2. ROUTE STRATEGY: Suggest fuel stops or route adjustments (avoiding high-cost FIRs) that improve the commercial viability.
  3. PROFITABILITY: Identify which option has the highest margin for the broker while remaining competitive.
  
  Provide:
  - Best Aircraft Option (Name and why)
  - Best Route/Fuel Stop Strategy (Specific ICAO codes and cost impact)
  - Commercial Reasoning: Explain why this balance is optimal for both broker and client.
  
  Return JSON: {
    bestAircraft: string,
    bestRouteStrategy: string,
    commercialReasoning: string,
    estimatedProfitMargin: number,
    clientPriceCompetitiveness: 'High' | 'Medium' | 'Low'
  }`;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.warn("Using fallback commercial viability suggestion due to API error:", error);
    return {
      bestAircraft: "Global 6000",
      bestRouteStrategy: "Direct routing",
      commercialReasoning: "Fallback suggestion due to rate limit. The Global 6000 offers a good balance of range and comfort.",
      estimatedProfitMargin: 10,
      clientPriceCompetitiveness: 'Medium'
    };
  }
}

export interface EmptyLegSearchParams {
  searchType: 'anywhere' | 'radius' | 'between' | 'specific';
  radiusLocation?: string;
  radiusDistance?: number;
  betweenStart?: string;
  betweenEnd?: string;
  specificDeparture?: string;
  specificDestination?: string;
}

export async function getEmptyLegs(params?: EmptyLegSearchParams) {
  // 1. Try fetching from Firestore first (Manual/Scraped data)
  try {
    const emptyLegsRef = collection(db, 'empty_legs');
    let q = query(emptyLegsRef, limit(20));
    
    // Simple filtering if params exist
    if (params?.specificDeparture) {
      q = query(emptyLegsRef, where('departure', '==', params.specificDeparture.toUpperCase()), limit(20));
    }
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const dbData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return { data: dbData, isFallback: false };
    }
  } catch (dbError) {
    console.warn("Firestore fetch for empty legs failed, falling back to AI search:", dbError);
  }

  // 2. Fallback to AI Search if no DB data found
  let searchContext = 'Search the web for current, real-world "empty leg" private jet flights available this week or upcoming.';
  
  if (params) {
    if (params.searchType === 'radius' && params.radiusLocation && params.radiusDistance) {
      searchContext = `Search the web for current "empty leg" private jet flights departing from or arriving within a ${params.radiusDistance} nautical mile radius of ${params.radiusLocation}.`;
    } else if (params.searchType === 'between' && params.betweenStart && params.betweenEnd) {
      searchContext = `Search the web for current "empty leg" private jet flights operating in the area between ${params.betweenStart} and ${params.betweenEnd}.`;
    } else if (params.searchType === 'specific' && (params.specificDeparture || params.specificDestination)) {
      searchContext = `Search the web for current "empty leg" private jet flights `;
      if (params.specificDeparture) searchContext += `departing from ${params.specificDeparture} `;
      if (params.specificDeparture && params.specificDestination) searchContext += `and `;
      if (params.specificDestination) searchContext += `arriving at ${params.specificDestination}.`;
    }
  }

  const prompt = `${searchContext}
  Find at least 6 to 9 real empty legs from various charter brokers or operators (e.g., Victor, Jettly, VistaJet, Air Partner, LunaJets, etc.). Include at least 2 cargo empty legs.
  
  For each empty leg, extract:
  - departure (City or IATA/ICAO)
  - destination (City or IATA/ICAO)
  - date (e.g., "Mar 25 - Mar 28" or specific date)
  - aircraft (e.g., "Citation XLS", "Global 6000", "Boeing 747-8F")
  - seats (estimated number of passenger seats, e.g., 8. Use 0 for cargo)
  - category (choose one: "Executive", "Cargo", "Passenger", "Space")
  - cargoType (if category is Cargo, choose one: "Full", "Pallets", "Kgs". Otherwise null)
  - cargoCapacity (if category is Cargo, provide the capacity number, e.g., 100000 for Kgs, 14 for Pallets, or 1 for Full. Otherwise null)
  - price (if available, as a number. If not available, estimate a highly discounted price in USD based on the route and aircraft type)
  - operator (the name of the broker or operator offering it)
  - link (the URL to the source or operator's empty leg page)
  
  Return a JSON array of objects:
  [
    {
      "id": "unique_string",
      "departure": "string",
      "destination": "string",
      "date": "string",
      "aircraft": "string",
      "seats": number,
      "category": "string",
      "cargoType": "string | null",
      "cargoCapacity": "number | null",
      "price": number,
      "operator": "string",
      "link": "string"
    }
  ]`;

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
    return { data: JSON.parse(response.text), isFallback: false };
  } catch (error: any) {
    console.warn("Using fallback empty legs data due to API error:", error?.message || "Rate limit exceeded");
    // Fallback to sample data if the live fetch fails
    return {
      isFallback: true,
      data: [
        { id: '1', departure: 'LHR', destination: 'DXB', date: '2026-03-20', aircraft: 'Global 7500', seats: 14, category: 'Executive', cargoType: null, cargoCapacity: null, price: 45000, operator: 'VistaJet', link: 'https://www.vistajet.com/empty-legs' },
        { id: '2', departure: 'JFK', destination: 'VKO', date: '2026-03-22', aircraft: 'Gulfstream G650', seats: 13, category: 'Executive', cargoType: null, cargoCapacity: null, price: 65000, operator: 'LunaJets', link: 'https://www.lunajets.com/empty-legs' },
        { id: '3', departure: 'SIN', destination: 'SYD', date: '2026-03-25', aircraft: 'Challenger 350', seats: 8, category: 'Executive', cargoType: null, cargoCapacity: null, price: 25000, operator: 'Air Partner', link: 'https://www.airpartner.com/empty-legs' },
        { id: '4', departure: 'FRA', destination: 'JFK', date: '2026-03-26', aircraft: 'Boeing 747-8F', seats: 0, category: 'Cargo', cargoType: 'Full', cargoCapacity: 1, price: 120000, operator: 'Atlas Air', link: 'https://www.atlasair.com' },
        { id: '4b', departure: 'HKG', destination: 'ANC', date: '2026-03-27', aircraft: 'Boeing 777F', seats: 0, category: 'Cargo', cargoType: 'Pallets', cargoCapacity: 12, price: 45000, operator: 'FedEx', link: 'https://www.fedex.com' },
        { id: '4c', departure: 'MIA', destination: 'BOG', date: '2026-03-28', aircraft: 'Airbus A330-200F', seats: 0, category: 'Cargo', cargoType: 'Kgs', cargoCapacity: 5000, price: 15000, operator: 'Avianca Cargo', link: 'https://www.aviancacargo.com' },
        { id: '5', departure: 'MIA', destination: 'LAX', date: '2026-03-28', aircraft: 'Airbus A320', seats: 150, category: 'Passenger', cargoType: null, cargoCapacity: null, price: 85000, operator: 'Global Charter', link: 'https://www.globalcharter.com' },
      ]
    };
  }
}

export async function planComplexFlight(userInput: string, aircraftList: any[], optimization: 'cheapest' | 'fastest' | 'balanced' | 'fuel-efficient' = 'balanced', missionType: string = 'Passenger') {
  const prompt = `You are a senior flight operations expert. A user says: "${userInput}".
  The mission type is "${missionType}".
  The user prefers a "${optimization}" optimization strategy.
  Based on this request and the available aircraft: ${JSON.stringify(aircraftList)}, build a complete flight plan.
  
  CRITICAL REAL-TIME DATA SEARCH:
  1. Search for current NOTAMs (Notice to Air Missions) for all departure, destination, and stopover airports.
  2. Search for current METAR/TAF and SIGMETs (weather) along the route.
  3. Search for the latest available Jet A-1 fuel prices at each airport.
  4. If any airspace is closed or hazardous weather is detected, adjust the route or flag it in the restrictedAreas.
  
  Requirements:
  1. Identify all legs (departure, destination, stopovers).
  2. For each leg, calculate:
     - Great Circle (GC) distance (nm)
     - Realistic Routing distance (GC distance + 5% to 10% buffer for standard airways)
     - Estimated flight time (hours): Use formula (Routing Distance / Cruise Speed) + Taxi Time (20 min) + Climb/Descent Buffer (15 min).
     - Fuel burn
     - FIRs crossed (Identify each FIR and calculate specific charges based on the selected aircraft's MTOW and routing)
     - Required permits (country, type, leadTime, estimatedFee)
     - Restricted airspaces (name, reason, severity, and approximate coordinates as an array of [lat, lng] points if it's a specific zone)
     - Available handling agents (FBOs) at the destination airport (companyName, email, phone, website, baseFee, additionalServices)
     - Detailed costs:
    - Fuel cost (based on REAL-TIME airport rates found)
    - Overflight charges (per FIR, specifically calculated for the selected aircraft)
    - Navigation charges (en-route, specifically calculated for the selected aircraft)
    - Landing charges
    - Parking charges
    - Handling charges (per airport)
    - Terminal navigation fees (per airport)
    - Operational costs: Catering, Ground transport, De-icing (if applicable)
    - Positioning Costs: Empty leg positioning from aircraft's currentLocation and Repositioning back to homeBase.
    - Crew costs
  3. AIRCRAFT SELECTION ENGINE (CRITICAL):
     - Suggest the best aircraft for the entire trip, prioritizing those nearest to the departure airport.
     - FLEET CATEGORIES TO CONSIDER:
       - Light Jet (for short/medium range, smaller groups)
       - Midsize Jet (for medium/long range, standard groups)
       - Heavy Jet (for long range, large groups or VIP comfort)
       - Cargo Aircraft (if mission involves cargo)
     - PASSENGER CAPACITY: Selected aircraft MUST have maxPassengers >= (total passengers in request).
     - RANGE & FUEL STOPS: You MUST check if any leg distance exceeds 85% of the aircraft's maximum range. If it does, you MUST suggest at least one optimal fuel stop (ICAO code) at a strategic midpoint or high-traffic hub to ensure safety reserves.
     - RUNWAY LIMITATIONS: Search for runway lengths at all airports in the plan. Selected aircraft MUST have takeoffDistance and landingDistance within airport capabilities.
     - COST EFFICIENCY: Use hourlyRate and fuelBurnPerHour to optimize for the "${optimization}" strategy.
  4. Provide a detailed fuel plan:
     - Trip Fuel: (Fuel Burn/hr * Flight Time)
     - Contingency: (5% to 10% of Trip Fuel)
     - Alternate: (Fuel to reach alternate)
     - Final Reserve: (45 minutes of holding fuel)
     - Total Fuel Required: (Sum of all components)
  5. Detect if fuel stops are needed based on the aircraft's range and the route.
  6. Suggest optimal fuel stops (ICAO codes) if needed.
  7. Provide operational notes (permits, runway requirements).
  8. Safety Section: List specific NOTAMs and Weather phenomena found during your search.
  9. FIR ANALYSIS: For each FIR crossed, provide a detailed breakdown of charges (overflight and navigation) specifically for the selected aircraft type.

  Return a JSON object: {
    legs: { 
      departure: string, 
      destination: string, 
      departureCoords: { lat: number, lng: number },
      destinationCoords: { lat: number, lng: number },
      gcDistance: number, 
      routingDistance: number, 
      distance: number, 
      flightTime: number, 
      fuelBurn: number, 
      altitude: number,
      operationalNotes: string,
      firs: { name: string, country: string, overflightCharge: number, navigationCharge: number, rules: string }[], 
      permits: { country: string, type: 'Overflight' | 'Landing', leadTime: string, estimatedFee: number }[],
      restrictedAreas: { name: string, reason: string, severity: 'Low' | 'Medium' | 'High', coordinates?: [number, number][] }[],
      handlingAgents: { companyName: string, email: string, phone: string, website: string, baseFee: number, additionalServices: string }[],
      costs: {
        fuel: number,
        overflight: number,
        navigation: number,
        landing: number,
        parking: number,
        handling: number,
        terminalNavigation: number,
        catering: number,
        groundTransport: number,
        deicing: number,
        positioning: number,
        repositioning: number,
        crew: number,
        maintenance: number,
        total: number
      } 
    }[],
    suggestedAircraft: string,
    totalCost: number,
    fuelPlan: { trip: number, contingency: number, alternate: number, reserve: number, total: number, stopsNeeded: boolean, suggestedStops: string[] },
    safety: {
      notams: { id: string, airport: string, description: string, severity: 'Low' | 'Medium' | 'High' }[],
      weather: { location: string, condition: string, impact: string, severity: 'Low' | 'Medium' | 'High' }[]
    },
    notes: string
  }`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
      },
    });

    return { ...JSON.parse(response.text), isFallback: false };
  } catch (error: any) {
    console.error('AI Planning Error:', error);
    
    // Check if it's a quota error (429) or service error
    if (isAiServiceUnavailable(error)) {
      // Return a professional fallback "Demo Plan"
      return {
        isFallback: true,
        legs: [
          {
            from: "LHR",
            to: "DXB",
            distance: 2970,
            time: 6.5,
            restrictedAreas: [],
            costs: {
              fuel: 12000,
              overflight: 1500,
              navigation: 800,
              landing: 2500,
              parking: 500,
              handling: 1200,
              terminalNavigation: 300,
              catering: 800,
              groundTransport: 400,
              deicing: 0,
              positioning: 0,
              repositioning: 0,
              crew: 3500,
              maintenance: 2000,
              total: 25500
            }
          }
        ],
        suggestedAircraft: "Global 6000",
        totalCost: 25500,
        fuelPlan: { trip: 12000, contingency: 1200, alternate: 2500, reserve: 1500, total: 17200, stopsNeeded: false, suggestedStops: [] },
        safety: {
          notams: [{ id: "A1234/26", airport: "LHR", description: "RWY 27R CLOSED FOR MAINTENANCE", severity: "Medium" }],
          weather: [{ location: "Enroute", condition: "Light Turbulence", impact: "Minimal", severity: "Low" }]
        },
        notes: "QUOTA EXCEEDED: This is a sample flight plan generated as a fallback. Please check your Gemini API quota at ai.google.dev/gemini-api/docs/rate-limits."
      };
    }
    handleAiError(error, 'planComplexFlight');
    return null;
  }
}

export async function getMultiLegRouteDetails(airports: string[]) {
  const prompt = `Calculate the flight details for a multi-leg journey: ${airports.join(' -> ')}.
  
  CRITICAL:
  1. Search for current NOTAMs (Notice to Air Missions) and weather conditions (SIGMETs, turbulence, thunderstorms) along the route.
  2. If any airspace is closed or hazardous weather is detected, adjust the routing or flag it in the restrictedAreas.
  
  For each leg, provide:
  - Great Circle (GC) distance (nm)
  - Realistic Routing distance (GC distance + 5% to 10% buffer for standard airways)
  - Estimated flight time (hours): Use formula (Routing Distance / Cruise Speed) + Taxi Time (20 min) + Climb/Descent Buffer (15 min).
  - Departure and destination coordinates
  - FIRs crossed (name, country, rules, overflightCharge, navigationCharge)
  - Required permits (country, type, leadTime, estimatedFee)
  - Restricted airspaces (name, reason, severity) - include NOTAM and Weather-based restrictions here.
  - Available handling agents (FBOs) at the destination airport (companyName, email, phone, website, baseFee, additionalServices)
  - Detailed costs:
    - Fuel cost (based on airport rates)
    - Overflight charges (per FIR)
    - Navigation charges (en-route)
    - Landing charges (based on specific airport fees)
    - Parking charges (based on specific airport fees per night)
    - Handling charges (based on specific airport fees for aircraft type)
    - Terminal navigation fees (per airport)
    - Operational costs: Catering, Ground transport, De-icing (if applicable)
    - Positioning Costs: Empty leg positioning from aircraft's currentLocation and Repositioning back to homeBase.
    - Crew costs
  
  Return JSON: {
    legs: {
      departure: string,
      destination: string,
      gcDistance: number,
      routingDistance: number,
      departureCoords: { lat: number, lng: number },
      destinationCoords: { lat: number, lng: number },
      altitude: number,
      firs: { name: string, country: string, rules: string, overflightCharge: number, navigationCharge: number }[],
      permits: { country: string, type: 'Overflight' | 'Landing', leadTime: string, estimatedFee: number }[],
      restrictedAreas: { name: string, reason: string, severity: 'Low' | 'Medium' | 'High', coordinates?: [number, number][] }[],
      handlingAgents: { companyName: string, email: string, phone: string, website: string, baseFee: number, additionalServices: string }[],
      costs: {
        fuel: number,
        overflight: number,
        navigation: number,
        landing: number,
        parking: number,
        handling: number,
        terminalNavigation: number,
        catering: number,
        groundTransport: number,
        deicing: number,
        positioning: number,
        repositioning: number,
        crew: number,
        maintenance: number,
        total: number
      }
    }[],
    totalDistance: number,
    totalCosts: {
      fuel: number,
      overflight: number,
      navigation: number,
      landing: number,
      parking: number,
      handling: number,
      terminalNavigation: number,
      catering: number,
      groundTransport: number,
      deicing: number,
      positioning: number,
      repositioning: number,
      crew: number,
      total: number
    }
  }

  🤖 AI BEHAVIOR RULES:
  - Never leave fields empty → estimate intelligently based on aviation standards.
  - Always explain assumptions briefly in the notes.
  - Be realistic (not random) with pricing, flight times, and routing.
  - Prefer aviation-standard terminology (e.g., block time, positioning, ACMI, dry lease).
  - Keep output clean, professional, and client-ready.

  🚀 ADVANCED FEATURES TO INCLUDE:
  - Suggest a cheaper aircraft alternative if applicable.
  - Highlight empty leg opportunities if any match the route.
  - Recommend optimal departure timing based on typical airport congestion or weather patterns.
  - Detect and flag high-cost routes (e.g., expensive overflight fees, high landing fees).`;

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

    return JSON.parse(response.text);
  } catch (error: any) {
    console.warn("Using fallback route details due to API error:", error?.message);
    if (isAiServiceUnavailable(error)) {
      return {
        legs: airports.slice(0, -1).map((from, i) => ({
          from,
          to: airports[i+1],
          distance: 500,
          time: 1.5,
          restrictedAreas: [],
          costs: {
            fuel: 2000,
            overflight: 500,
            navigation: 200,
            landing: 1000,
            parking: 200,
            handling: 500,
            terminalNavigation: 100,
            catering: 200,
            groundTransport: 100,
            deicing: 0,
            positioning: 0,
            repositioning: 0,
            crew: 1000,
            maintenance: 500,
            total: 6300
          }
        })),
        totalDistance: (airports.length - 1) * 500,
        totalCosts: { total: (airports.length - 1) * 6300 },
        notes: "QUOTA EXCEEDED: Sample route details generated as a fallback."
      };
    }
    handleAiError(error, 'getMultiLegRouteDetails');
    return null;
  }
}

export async function getNegotiationStrategy(aircraft: any, missionData: any, currentPrice: number) {
  const prompt = `You are a Senior Aviation Contract Negotiator and ACMI Specialist. 
  Analyze this ACMI/Charter mission and the selected aircraft to provide a winning negotiation strategy.
  
  Mission: ${JSON.stringify(missionData)}
  Aircraft: ${JSON.stringify(aircraft)}
  Current Quoted Price: $${currentPrice}
  
  CRITICAL ANALYSIS:
  1. MARKET POSITION: Is the current price above or below market average for this aircraft type and route? Consider if it's a short-term charter or a long-term ACMI lease.
  2. OPERATOR LEVERAGE: Does the operator have high fleet utilization? Is this a base-to-base flight (repositioning)? For ACMI, consider crew duty limits and maintenance cycles.
  3. NEGOTIATION TARGETS: Provide a "Target Price" (realistic) and a "Walk-away Price".
  4. COUNTER-OFFER STRATEGY: Suggest specific points to mention (e.g., "High fuel burn for this tail", "Low demand season", "Quick payment terms", "Guaranteed block hours for ACMI").
  5. ALTERNATIVE LEVERS: Suggest non-monetary concessions (e.g., "Waive handling fees", "Include extra crew duty hours", "Flexible cancellation", "Reduced monthly guarantee for ACMI").
  
  Return JSON: {
    marketAnalysis: string,
    targetPrice: number,
    walkAwayPrice: number,
    strategyPoints: string[],
    concessionsToAsk: string[],
    negotiationScript: string
  }`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'getNegotiationStrategy');
    return null;
  }
}

export async function generateACMIQuote(params: {
  departure: string;
  destination: string;
  alternate?: string;
  aircraftType: string;
  missionType: 'Passenger' | 'Cargo' | 'VIP' | 'ACMI Lease';
  departureDate: string;
  returnDate?: string;
  payload: number; // kg or pax
  specialRequirements?: string;
  currentDate: string;
}) {
  const prompt = `You are an advanced AI-powered ACMI (Aircraft, Crew, Maintenance, Insurance) Quote Engine.
  Generate a professional ACMI quotation based on these inputs:
  - Current Date: ${params.currentDate}
  - Departure: ${params.departure}
  - Destination: ${params.destination}
  - Alternate: ${params.alternate || 'None'}
  - Aircraft Type: ${params.aircraftType}
  - Mission Type: ${params.missionType}
  - Departure Date & Time: ${params.departureDate}
  - Return Date: ${params.returnDate || 'N/A'}
  - Payload: ${params.payload}
  - Special Requirements: ${params.specialRequirements || 'None'}

  🤖 AI BEHAVIOR RULES:
  - Never leave fields empty → estimate intelligently based on aviation standards.
  - Always explain assumptions briefly in the notes.
  - Be realistic (not random) with pricing, flight times, and routing.
  - Prefer aviation-standard terminology (e.g., block time, positioning, ACMI, dry lease).
  - Keep output clean, professional, and client-ready.

  🚀 ADVANCED FEATURES TO INCLUDE:
  - Suggest a cheaper aircraft alternative if applicable.
  - Highlight empty leg opportunities if any match the route.
  - Recommend optimal departure timing based on typical airport congestion or weather patterns.
  - Detect and flag high-cost routes (e.g., expensive overflight fees, high landing fees).

  🧠 CORE OBJECTIVE:
  1. Suggest the best available aircraft (or confirm the requested type).
  2. Estimate hourly ACMI rates using REAL-WORLD MARKET DATA:
     ✈️ Narrowbody Aircraft (Passenger):
     - A319: $2,200 – $3,200/hr (Fuel: 2,200 kg/hr, 120–140 seats, 6,900 km)
     - A320: $2,800 – $4,200/hr (Fuel: 2,500 kg/hr, 150–180 seats, 6,100 km)
     - A321: $3,500 – $5,200/hr (Fuel: 2,900 kg/hr, 180–220 seats, 7,400 km)
     - B737-700: $2,500 – $3,800/hr (Fuel: 2,400 kg/hr, 130–150 seats, 6,200 km)
     - B737-800: $3,000 – $4,500/hr (Fuel: 2,600 kg/hr, 160–189 seats, 5,800 km)
     - B737-900: $3,800 – $5,500/hr (Fuel: 2,900 kg/hr, 180–220 seats, 5,900 km)
     ✈️ Widebody Passenger Aircraft:
     - A330-200: $6,000 – $8,500/hr (Fuel: 5,500 kg/hr, 250–270 seats, 13,400 km)
     - A330-300: $7,000 – $9,500/hr (Fuel: 6,000 kg/hr, 280–300 seats, 11,700 km)
     - B767-300: $5,500 – $8,000/hr (Fuel: 5,200 kg/hr, 218–269 seats, 12,200 km)
     - B777-200: $9,000 – $13,000/hr (Fuel: 7,500 kg/hr, 300–350 seats, 15,800 km)
     - B787-8: $8,000 – $11,500/hr (Fuel: 5,800 kg/hr, 240–260 seats, 13,600 km)
     ✈️ Cargo Aircraft:
     - B737-400F: $3,500 – $5,000/hr (Fuel: 2,800 kg/hr, Payload: 18,000 kg, 3,700 km)
     - B737-800BCF: $4,000 – $6,500/hr (Fuel: 3,000 kg/hr, Payload: 23,000 kg, 3,900 km)
     - ATR72F: $1,500 – $2,800/hr (Fuel: 1,200 kg/hr, Payload: 8,000 kg, 1,500 km)
     - A321P2F: $5,500 – $8,000/hr (Fuel: 3,200 kg/hr, Payload: 27,000 kg, 4,000 km)
     - B757F: $6,500 – $9,500/hr (Fuel: 4,500 kg/hr, Payload: 32,000 kg, 5,800 km)
     - B767-300F: $8,000 – $12,000/hr (Fuel: 6,000 kg/hr, Payload: 52,000 kg, 6,000 km)
     - B777F: $10,000 – $16,000/hr (Fuel: 8,500 kg/hr, Payload: 102,000 kg, 9,000 km)
     ✈️ VIP / Private Jets:
     - Gulfstream G450: $5,500 – $8,000/hr (Fuel: 1,200 kg/hr, 12–16 seats, 8,000 km)
     - Gulfstream G650: $8,000 – $12,000/hr (Fuel: 1,500 kg/hr, 14–18 seats, 12,000 km)
     - Global 6000: $7,500 – $11,000/hr (Fuel: 1,400 kg/hr, 12–16 seats, 11,000 km)
     - ATR72: $1,200 – $2,500/hr
     ADJUSTMENT FACTORS (CRITICAL):
     - Region: Adjust for high-cost vs low-cost operating environments.
     - Demand: Increase for high-demand routes/hubs.
     - Seasonality: Adjust for peak vs off-peak seasons based on departure date.
     - Urgency: Apply a premium (10-25%) for short-notice requests (if departure date is close to current date).
  3. Calculate total operational cost using the FINAL MASTER EQUATION:
     TOTAL COST = [ (Block Hours × Adjusted ACMI Rate) + (Fuel Burn × Block Hours × Fuel Price) + FIR Charges + Airport Charges + Crew Cost + Positioning Cost ] × Insurance Multiplier + Contingency
  4. Apply REAL BROKER INSIGHT (CRITICAL):
      - Add a HIDDEN BROKER MARGIN (5% – 15%) to the total cost.
      - ALWAYS provide a PRICE RANGE (± 5-10%) instead of an exact figure in the final quotation.
  5. Output a professional, client-ready quotation.

  🔍 LOGIC STEPS:
  - AIRCRAFT SELECTION: Match based on range, payload, and runway. Suggest alternatives if needed.
  - ACMI RATE: Adjust based on region, demand, and seasonality.
  - FLIGHT CALCULATION: GC distance, block hours, and fuel consumption.
  - TOTAL COST FORMULA: Strictly follow the FINAL MASTER EQUATION above.
    - Sum = (Block Hours * Adjusted ACMI Rate) + (Fuel Burn * Block Hours * Fuel Price) + FIR Charges + Airport Charges + Crew Cost + Positioning Cost
    - Base Total = (Sum * Insurance Multiplier) + Contingency (3-7% of Sum)
    - Final Total = Base Total * (1 + Broker Margin)
    - Quote Range = Final Total ± 7%
  - OVERFLIGHT/NAV: Estimate based on countries crossed and MTOW.
  - AIRPORT COSTS: Landing/Parking/Handling ($500-$8k depending on hub size).
  - CREW COSTS: $300-$800 per crew per day (duty/hotel/transport).
  - INSURANCE: Basic included, add surcharge for high-risk zones.
  - AVAILABILITY: Classify as Confirmed, Likely Available, or On Request based on hub traffic logic.

  📄 OUTPUT FORMAT (STRICT JSON):
  {
    "quotation": {
      "route": "string",
      "aircraft": "string",
      "operator": "string",
      "availability": "Confirmed" | "Likely Available" | "On Request",
      "missionSummary": "string"
    },
    "breakdown": {
      "estimatedPriceRange": "string (e.g. '$45,000 - $52,000')",
      "acmiRatePerHour": number,
      "acmiCost": number,
      "fuelCost": number,
      "overflightCharges": number,
      "landingFees": number,
      "groundHandling": number,
      "crewCost": number,
      "insurance": number,
      "brokerMarginPercentage": number,
      "dynamicPricingFactor": number,
      "contingency": number,
      "totalEstimatedCost": number
    },
    "operationalDetails": {
      "distanceNm": number,
      "blockHours": number,
      "fuelBurnLiters": number,
      "suggestedAlternative": string | null,
      "highCostRouteAlert": boolean
    },
    "notes": ["string"] // MUST include: "Subject to aircraft availability", "Final price may vary based on operator confirmation", "Fuel price fluctuations not included", "Slots & permits not included unless specified", plus any other relevant notes.
  }`;


  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return { ...JSON.parse(response.text), isFallback: false };
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    
    if (isAiServiceUnavailable(error)) {
      return {
        isFallback: true,
        summary: {
          route: "Sample Route",
          aircraft: "Global 6000",
          operator: "Demo Operator",
          availability: "Likely Available",
          missionSummary: "QUOTA EXCEEDED: This is a sample analysis generated as a fallback."
        },
        breakdown: {
          estimatedPriceRange: "$25,000 - $30,000",
          acmiRatePerHour: 4500,
          acmiCost: 18000,
          fuelCost: 5000,
          overflightCharges: 1000,
          landingFees: 500,
          groundHandling: 500,
          crewCost: 1500,
          insurance: 500,
          brokerMarginPercentage: 15,
          dynamicPricingFactor: 1.1,
          contingency: 1000,
          totalEstimatedCost: 25500
        },
        operationalDetails: {
          distanceNm: 2970,
          blockHours: 6.5,
          fuelBurnLiters: 8000,
          suggestedAlternative: "Challenger 650",
          highCostRouteAlert: false
        },
        notes: ["Sample analysis due to API quota limits."]
      };
    }
    handleAiError(error, 'analyzeFlightPlan');
    return null;
  }
}

export async function searchAirports(query: string) {
  const prompt = `Search for airports matching the query: "${query}". 
  Provide a list of up to 5 matching airports with their:
  - ICAO (4-letter)
  - IATA (3-letter)
  - Name
  - City
  - Latitude and Longitude
  - Runway length (ft)
  - Elevation (ft)
  - Fuel availability (Jet A1, Avgas)
  - Estimated Fuel Rate (USD per Liter)
  - Estimated Landing Fee (USD for mid-size jet)
  - Estimated Parking Fee (USD per day)
  - Estimated Handling Fee (USD)
  - Estimated Terminal Navigation Fee (USD)
  - Handling availability (boolean)
  - Parking spots (integer)
  - ATIS frequency (as a string, e.g., "128.725" or "Not available")
  
  Return JSON: {
    airports: {
      icao: string,
      iata: string,
      name: string,
      city: string,
      lat: number,
      lng: number,
      runwayLength: number,
      elevation: number,
      fuelAvailability: string[],
      fuelRate: number,
      landingFee: number,
      parkingFee: number,
      handlingFee: number,
      terminalNavigationFee: number,
      handlingAvailable: boolean,
      parkingSpots: number,
      atisFrequency: string
    }[]
  }.`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'searchAirports');
    return { airports: [] };
  }
}

export async function getAirportDetails(code: string) {
  const prompt = `Provide detailed information for the airport with ICAO or IATA code: ${code}.
  
  Include:
  1. Latitude and Longitude.
  2. Full Name and City.
  3. Runway length (in feet).
  4. Elevation (in feet).
  5. Fuel types available (e.g., Jet A-1, Avgas).
  6. Handling availability (boolean or description).
  7. ATIS frequency (as a string, e.g., "128.725" or "Not available").
  
  Return JSON: { 
    "icao": "string",
    "iata": "string",
    "lat": number, 
    "lng": number, 
    "name": "string", 
    "city": "string",
    "runwayLength": number,
    "elevation": number,
    "fuelTypes": string[],
    "handlingAvailable": boolean,
    "handlingDescription": "string",
    "atisFrequency": string
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

    const details = JSON.parse(response.text);

    // Update Firestore if necessary
    try {
      const airportsRef = collection(db, 'airports');
      const q = query(airportsRef, where('icao', '==', details.icao.toUpperCase()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Add new airport to database
        await addDoc(airportsRef, {
          ...details,
          icao: details.icao.toUpperCase(),
          iata: details.iata?.toUpperCase() || '',
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error updating airport database:", error);
    }

    return details;
  } catch (error) {
    handleAiError(error, 'getAirportDetails');
    return null;
  }
}

export async function optimizeFlightSchedule(schedule: any) {
  const prompt = `Analyze the following flight schedule for potential optimizations:
  ${JSON.stringify(schedule)}
  
  CRITICAL OPTIMIZATION GOALS:
  1. MINIMIZE TOTAL FLIGHT TIME: Analyze the current flight legs and suggest REORDERING or adjustments to minimize total airborne time. Consider the aircraft's cruise speed (${schedule.aircraft?.cruiseSpeed || 'N/A'} kts) and range (${schedule.aircraft?.range || 'N/A'} nm).
  2. FUEL EFFICIENCY: Suggest optimal refueling stops or speed adjustments to minimize fuel burn based on the aircraft's fuel burn rate (${schedule.aircraft?.fuelBurnPerHour || 'N/A'} L/h).
  3. TURNAROUND OPTIMIZATION: Identify excessively long or dangerously short turnarounds. Suggest adjustments to improve turnaround efficiency without compromising safety.
  4. CREW DUTY & PRODUCTIVITY: Optimize the sequence to stay well within duty limits while maximizing aircraft productivity.
  
  Provide:
  - Specific leg-by-leg optimization suggestions, including REORDERING if beneficial.
  - Estimated time (minutes) and fuel (units) savings.
  - A revised schedule if significant improvements are possible.
  - Detailed reasoning for each suggestion, mentioning aircraft performance and turnaround constraints.
  
  Return JSON: {
    "suggestions": [
      { "legIndex": number, "suggestion": "string", "impact": "string" }
    ],
    "estimatedSavings": { "timeMinutes": number, "fuelUnits": number },
    "revisedSchedule": [
      { 
        "departure": "string", 
        "destination": "string", 
        "etd": "HH:mm", 
        "eta": "HH:mm", 
        "flightTimeMinutes": number, 
        "flightDurationHours": number, 
        "turnaroundTime": number, 
        "altitude": number,
        "handlingAgent": {
          "companyName": "string",
          "email": "string",
          "phone": "string",
          "baseFee": number
        }
      }
    ],
    "generalNotes": "string"
  }`;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'optimizeFlightSchedule');
    return null;
  }
}

export async function analyzeFlightPlan(plan: any) {
  const prompt = `Analyze the following flight plan:
  ${JSON.stringify(plan)}
  
  CRITICAL ANALYSIS GOALS:
  1. RISK ASSESSMENT: Identify potential operational, safety, or financial risks (e.g., tight turnarounds, high-cost FIRs, weather threats, permit lead times).
  2. WEATHER IMPACT: Analyze current and forecast weather patterns along the route (e.g., jet streams, turbulence, thunderstorms).
  3. FIR & OVERFLIGHT CHARGES: Identify high-cost airspaces and suggest avoidance strategies if applicable.
  4. EFFICIENCY GAINS: Highlight where the plan excels or where minor adjustments could save more time or fuel.
  5. ALTERNATIVE STRATEGIES: Suggest at least two alternative strategies (e.g., "Use a different aircraft for better fuel economy" or "Change the stopover to avoid high navigation fees").
  
  Provide:
  - A list of specific risks with severity (Low, Medium, High).
  - A detailed weather impact assessment.
  - A detailed FIR charge analysis.
  - A list of efficiency highlights.
  - A list of alternative strategies with estimated impact.
  
  Return JSON: {
    "risks": [
      { "risk": "string", "severity": "Low" | "Medium" | "High", "mitigation": "string" }
    ],
    "weatherImpact": {
      "assessment": "string",
      "threats": string[],
      "favorableConditions": string[]
    },
    "firAnalysis": {
      "highCostFirs": string[],
      "totalEstimatedCharges": number,
      "optimizationPotential": "string"
    },
    "efficiencyGains": [
      { "gain": "string", "impact": "string" }
    ],
    "alternatives": [
      { "strategy": "string", "estimatedImpact": "string", "reasoning": "string" }
    ],
    "overallAssessment": "string"
  }`;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'analyzeFlightPlan');
    return null;
  }
}

export async function fetchSpecificCharge(firCode: string, firName: string, chargeType: 'overflight' | 'navigation'): Promise<number> {
  const prompt = `Find the current ${chargeType} charge in USD for the FIR (Flight Information Region) ${firCode} - ${firName}.
  Return ONLY a JSON object with a single key "charge" containing the numeric value in USD.
  If you cannot find the exact value, estimate it based on typical charges for that region.
  Example: { "charge": 150.50 }`;

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
    return data.charge || 0;
  } catch (error) {
    handleAiError(error, 'fetchSpecificCharge');
    return 0;
  }
}

export async function fetchFIRRules(firCode: string, firName: string): Promise<string> {
  const prompt = `Find the current regulatory information and specific operating rules for the FIR (Flight Information Region) ${firCode} - ${firName}.
  Return ONLY a JSON object with a single key "rules" containing a string of the rules and regulations.
  Keep it concise but informative, focusing on key operational restrictions, required equipment (e.g., CPDLC, ADS-B), and specific procedures.
  Example: { "rules": "RVSM airspace. CPDLC required above FL290. Strict adherence to assigned levels." }`;

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
    return data.rules || "No specific rules found.";
  } catch (error) {
    handleAiError(error, 'fetchFIRRules');
    return "Failed to fetch rules.";
  }
}

export async function getAirportCoords(icao: string) {
  const details = await getAirportDetails(icao);
  return { lat: details.lat, lng: details.lng, name: details.name, city: details.city };
}

export async function getOptimizationAlternatives(plan: any, criteria: string) {
  const prompt = `You are a senior flight operations optimizer. 
  Analyze the following flight plan and suggest 3 alternative optimizations based on the criteria: "${criteria}".
  
  Current Plan: ${JSON.stringify(plan)}
  
  CRITICAL FACTORS TO CONSIDER:
  1. WEATHER: Consider jet streams, turbulence, and severe weather avoidance.
  2. FIR CHARGES: Analyze overflight and navigation fees for each airspace.
  3. PERFORMANCE: Consider aircraft-specific fuel burn and speed profiles.
  
  For each alternative, provide:
  1. A descriptive title (e.g., "Alternative Route via Istanbul", "Switch to Light Jet")
  2. The specific changes made (e.g., "Changed stopover from DXB to IST", "Reduced cruise speed to optimize fuel")
  3. Estimated impact on:
     - Total Cost (Savings or Increase in USD, use negative for savings)
     - Total Flight Time (Hours saved or added, use negative for savings)
     - Fuel Consumption (Liters saved or added, use negative for savings)
  4. A detailed explanation of how it addresses weather and FIR charges.
  5. The new total cost, total time, and total fuel.
  6. The updated legs for the flight plan.

  Return a JSON object:
  {
    "alternatives": [
      {
        "title": "string",
        "changes": "string",
        "impacts": {
          "cost": number,
          "time": number,
          "fuel": number
        },
        "weatherAndFirNotes": "string",
        "explanation": "string",
        "newTotals": {
          "cost": number,
          "time": number,
          "fuel": number
        },
        "updatedLegs": array (of flight leg objects)
      }
    ]
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

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'getOptimizationAlternatives');
    return { alternatives: [] };
  }
}

export async function searchHandlingAgents(icao: string, airportName?: string, city?: string, aircraftType?: string) {
  // 1. Try to fetch from Firestore cache
  const agentsRef = collection(db, 'handling_agents');
  const q = query(agentsRef, where('icao', '==', icao), limit(1));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return snapshot.docs[0].data() as { agents: any[] };
  }

  // 2. If not in cache, use Gemini
  const prompt = `Find real, active ground handling companies at ${airportName || icao} (${icao})${city ? ` in ${city}` : ''}${aircraftType ? ` for a ${aircraftType} aircraft` : ''}. 
  Use Google Search to find the most accurate and up-to-date information.
  Provide a list of up to 3 companies with their:
  - Company Name
  - Contact Email (real business email if possible)
  - Contact Phone (with country code)
  - Website URL
  - Estimated Base Handling Fee (USD) - provide a realistic estimate based on the airport and aircraft type
  - Additional Services (e.g., VIP lounge, fuel, catering, customs)
  
  Return strictly as a JSON object, with no other text, matching this structure: {
    "agents": [
      {
        "companyName": "string",
        "email": "string",
        "phone": "string",
        "website": "string",
        "baseFee": 0,
        "additionalServices": "string"
      }
    ]
  }.`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text.replace(/```json\n?/, '').replace(/```/, '');
    const data = JSON.parse(text);

    // 3. Cache result in Firestore
    await setDoc(doc(db, 'handling_agents', icao), {
      icao,
      ...data,
      updatedAt: new Date().toISOString()
    });

    return data;
  } catch (error) {
    handleAiError(error, 'searchHandlingAgents');
    return { agents: [] };
  }
}


export async function suggestFuelStop(departure: string, destination: string, aircraftType: string) {
  const prompt = `Suggest the 3 most optimal intermediate fuel stop airports (ICAO codes) for a flight from ${departure} to ${destination} using a ${aircraftType}.
  
  CRITICAL CRITERIA:
  1. Strategic Location: Midpoint or slightly before midpoint of the route.
  2. Infrastructure: Must have sufficient runway length for ${aircraftType} and reliable fuel availability (Jet A-1).
  3. Efficiency: Low landing fees and quick turnaround times preferred.
  4. Popularity: Prefer major regional hubs or well-known tech-stop airports (e.g., Shannon, Gander, Keflavik, Dubai, Singapore, etc. depending on the route).
  
  For each suggested stop, provide:
  - ICAO code
  - Airport Name
  - Reason for selection
  - Estimated fuel price (USD/L)
  - Estimated landing fee (USD)
  
  Return JSON: {
    suggestions: {
      icao: string,
      name: string,
      reason: string,
      fuelPrice: number,
      landingFee: number
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

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'suggestFuelStop');
    return { suggestions: [] };
  }
}

const safeParseJson = (text: string) => {
  try {
    // Attempt standard parse first
    return JSON.parse(text);
  } catch (initialError) {
    try {
      // Look for JSON block patterns (```json ... ``` or just { ... })
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw initialError;
    } catch (finalError) {
      console.error("JSON Parse Failure. Raw text:", text);
      throw finalError;
    }
  }
};

export async function searchAirportsByCountry(country: string) {
  const prompt = `Provide a comprehensive airport list for ${country}.
  Find all international and domestic airports.
  
  Return strictly as a JSON object matching this structure: {
    "internationalAirports": [{ "name": "string", "icao": "string", "iata": "string" }],
    "domesticAirports": [{ "name": "string", "icao": "string", "iata": "string" }],
    "totalCount": number
  }.
  
  IMPORTANT: Do not include any text before or after the JSON block. Return ONLY the JSON.`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return safeParseJson(response.text);
  } catch (error) {
    handleAiError(error, 'searchAirportsByCountry');
    return { internationalAirports: [], domesticAirports: [], totalCount: 0 };
  }
}

export async function predictAvailability(aircraftId: string, liveData: any, utilizationData: any, context?: { departureIcao?: string, registration?: string }) {
  const prompt = `You are an AI Aviation Availability Intelligence Engine.
  Based on the following live tracking, historical utilization, and mission context, predict aircraft availability for a charter/ACMI mission today.
  
  Live Tracking Data (OpenSky): ${JSON.stringify(liveData || 'None')}
  Historical Utilization Data (Aviationstack): ${JSON.stringify(utilizationData || 'None')}
  Mission Context: ${JSON.stringify(context || 'None')}
  
  🧠 AVAILABILITY INTELLIGENCE LOGIC:
  🔥 RULE 1: Idle Aircraft
  - If Last Flight > 24-48 hrs ago (check last_contact in liveData or recent flights in utilizationData)
  → Likely Available
  
  🔥 RULE 2: High Utilization
  - If 5-6 flights/day (check daily_flights or active_missions in utilizationData)
  → NOT Available (On Request)
  
  🔥 RULE 3: Base Airport Matching
  - If Aircraft's current location (est_departure_airport or last_seen_airport) matches the mission departure (${context?.departureIcao || 'Unknown'})
  → HIGH availability probability (Confirmed Available)
  
  🔥 RULE 4: Night Parking Pattern
  - If the aircraft consistently returns to the same airport every night (check is_base_consistent in utilizationData)
  → Likely base aircraft → easier ACMI (Confirmed Available if at base)
  
  CRITICAL LOGIC OVERRIDE:
  - If the aircraft is currently in flight (!on_ground), it is ALWAYS "On Request" (busy).
  
  Return a JSON object:
  {
    "status": "Confirmed Available" | "Likely Available" | "On Request",
    "reason": "A short, professional explanation of the reasoning based on the 4 rules above.",
    "intelligence": {
      "isIdle": boolean,
      "isHighUtilization": boolean,
      "isAtBase": boolean,
      "hasConsistentPattern": boolean
    }
  }`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error: any) {
    handleAiError(error, 'predictAvailability');
    return null;
  }
}

export async function analyzePermits(plan: any) {
  const prompt = `You are a world-class flight operations permit specialist.
  Analyze the following flight plan and identify ALL countries the flight will enter (including departure, destination, and overflight based on FIRs).
  
  Flight Plan: ${JSON.stringify(plan)}
  
  For EACH country identified, determine if an Overflight or Landing permit is required for a private charter flight.
  
  CRITICAL REQUIREMENTS:
  1. Identify every country crossed.
  2. For each country, specify if it's an Overflight or Landing permit.
  3. Provide accurate estimated Lead Times (e.g., '72 hours', '5 business days').
  4. Provide realistic Estimated Fees in USD.
  5. List all Required Documentation (e.g., 'AOC', 'Insurance', 'Noise Certificate', 'Registration').
  6. Specify the Validity Period (e.g., '+/- 24 hours', '72 hours').
  
  Return a JSON object with:
  {
    "permits": [
      {
        "country": "string",
        "type": "Overflight" | "Landing",
        "leadTime": "string",
        "estimatedFee": number,
        "requiredDocs": string[],
        "validityPeriod": "string"
      }
    ],
    "restrictedAreas": [
      {
        "name": "string",
        "reason": "string",
        "severity": "Low" | "Medium" | "High"
      }
    ]
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

    return JSON.parse(response.text);
  } catch (error: any) {
    handleAiError(error, 'analyzePermits');
    return null;
  }
}

export async function getPermitDetails(country: string, type: string) {
  const prompt = `Provide detailed information for obtaining a ${type} permit in ${country}.
  
  Include:
  1. Required documentation.
  2. Estimated lead time.
  3. Estimated fee in USD.
  4. Validity period.
  
  Return JSON: {
    requiredDocs: string[],
    leadTime: string,
    estimatedFee: number,
    validityPeriod: string
  }.`;
  
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
    return JSON.parse(response.text);
  } catch (error) {
    console.error(`Failed to fetch permit details for ${country}:`, error);
    return {
      requiredDocs: ["Standard aircraft documents", "Insurance certificate"],
      leadTime: "3-5 days",
      estimatedFee: 500,
      validityPeriod: "72 hours"
    };
  }
}

export async function calculateACMIQuote(params: {
  departure: string;
  destination: string;
  aircraftType: string;
  distanceNm: number;
  fuelPricePerKg: number;
  seasonMultiplier: number;
  urgencyMultiplier: number;
  regionMultiplier: number;
}) {
  const prompt = `You are an ACMI Pricing Engine. Calculate a detailed ACMI quote based on the following:
  
  - Route: ${params.departure} to ${params.destination}
  - Distance: ${params.distanceNm} NM
  - Aircraft Type: ${params.aircraftType}
  - Fuel Price: $${params.fuelPricePerKg}/kg
  - Multipliers: Season(${params.seasonMultiplier}), Urgency(${params.urgencyMultiplier}), Region(${params.regionMultiplier})

  REAL MARKET DATA (Use these as base if not specified otherwise):
  - A320: Rate $4500-6500/hr, Burn 2500kg/hr, Speed 450kt
  - B737-800: Rate $4000-6000/hr, Burn 2600kg/hr, Speed 450kt
  - A330: Rate $8000-12000/hr, Burn 5500kg/hr, Speed 470kt
  - B777: Rate $12000-18000/hr, Burn 7000kg/hr, Speed 490kt
  - ATR72: Rate $2000-3000/hr, Burn 1000kg/hr, Speed 280kt

  ACMI PRICING FORMULA:
  Total Cost = (ACMI Rate × Flight Hours) + Fuel Cost + Overflight Charges + Handling + Crew Cost

  CALCULATION STEPS:
  1. Flight Time = Distance / Cruise Speed
  2. Fuel Cost = Fuel Burn × Flight Hours × Fuel Price
  3. Overflight Charges = $300 - $1000 per country (estimate based on route)
  4. Crew Cost = $500 - $1500 (extra duty/per diem)
  5. Handling + Landing = $500 - $3000 depending on airport (include terminal and parking)

  SPECIFIC SEARCH REQUIREMENTS:
  - Find the actual names of ${params.departure} and ${params.destination}.
  - Identify major handling agencies at both airports.
  - Estimate specific FIRs (Flight Information Regions) along the route from ${params.departure} to ${params.destination} and their respective nav charges.

  Apply the multipliers to the base ACMI Rate.

  Return a JSON object:
  {
    "flightTimeHours": number,
    "acmiRatePerHour": number,
    "acmiBaseCost": number,
    "fuelCost": number,
    "overflightCharges": number,
    "handlingLandingFees": number,
    "crewCost": number,
    "totalCost": number,
    "detailedBreakdown": {
      "departure": {
        "name": "string",
        "icao": "string",
        "iata": "string",
        "handlingAgency": "string",
        "navigational": number,
        "terminal": number,
        "parking": number,
        "fuel": number
      },
      "arrival": {
        "name": "string",
        "icao": "string",
        "iata": "string",
        "handlingAgency": "string",
        "navigational": number,
        "terminal": number,
        "parking": number,
        "fuel": number
      },
      "route": {
        "totalDistanceNm": number,
        "firs": [{
          "name": "string",
          "code": "string",
          "charge": number
        }]
      }
    },
    "breakdown": {
      "timeCalculation": "string",
      "fuelCalculation": "string",
      "acmiCalculation": "string"
    },
    "aiAdjustments": {
      "seasonImpact": number,
      "urgencyImpact": number,
      "regionImpact": number
    }
  }`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'calculateACMIQuote');
    return null;
  }
}

export async function getOperatorDetails(operatorName: string, country?: string) {
  const prompt = `Provide detailed information for the aviation operator: ${operatorName}${country ? ` based in ${country}` : ''}.
  
  Include:
  1. Official website URL.
  2. Public contact email address (or a standard format like info@...).
  3. Public contact phone number.
  4. 3-letter ICAO code (e.g., 'UAE', 'QTR').
  5. 2-letter IATA code (e.g., 'EK', 'QR').
  6. A short profile summary (2-3 sentences).
  
  Return JSON: {
    website: string,
    email: string,
    phone: string,
    icao_code: string,
    iata_code: string,
    summary: string
  }.`;

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

    return JSON.parse(response.text);
  } catch (error) {
    handleAiError(error, 'getOperatorDetails');
    return null;
  }
}

export async function getAirportFIR(icao: string): Promise<{ firCode: string, firName: string } | null> {
  const prompt = `Determine the Flight Information Region (FIR) code and name for the airport: ${icao}.
  Return JSON: { "firCode": "string", "firName": "string" }.`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text.replace(/```json\n?/, '').replace(/```/, '');
    return JSON.parse(text);
  } catch (error) {
    handleAiError(error, 'getAirportFIR');
    return null;
  }
}

export async function getFIRDetails(firCode: string, firName: string, aircraftType?: string) {
  const prompt = `Perform a live search for the latest Flight Information Region (FIR) data.
  FIR Code: ${firCode}
  FIR Name: ${firName}
  Aircraft Type (Context): ${aircraftType || 'Commercial/Business Aircraft'}
  
  CRITICAL DATA FETCHING REQUIREMENTS:
  1. CONTACT INFO: Find the official point of contact for the Civil Aviation Authority (CAA) of this FIR. Include physical address, dedicated phone numbers for flight plan filing/NOTAMs, official email for overflight permits, and the primary AIP/AIC website.
  2. OPERATIONAL RULES/SOPs: Summarize the current overflight requirements. Include specific lead times for permits (e.g., 72 hours), mandatory equipment (TCAS, ADS-B), and any unique regional entry procedures.
  3. CHARGES: Retrieve current navigation and overflight fee structures. For the ${aircraftType || 'specified'} aircraft, calculate the estimated total navigation charge based on weight/distance factors for this airspace.
  4. DOCUMENTATION: Provide direct links to official AICs, fee schedules, or AIP portals.
  
  Return the exactly structured JSON object: {
    address: string,
    phone: string,
    email: string,
    website: string,
    sop: string,
    documentationUrl: string,
    overflightCharge: number,
    navigationCharge: number
  }. Use search results to provide the MOST ACCURATE and CURRENT information possible.`;
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text.replace(/```json\n?/, '').replace(/```/, '');
    return JSON.parse(text);
  } catch (error) {
    handleAiError(error, 'getFIRDetails');
    return null;
  }
}
