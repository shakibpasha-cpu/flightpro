import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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
    firs: { name: string, country: string, rules: string, overflightCharge: number, navigationCharge: number }[],
    permits: { country: string, type: 'Overflight' | 'Landing', leadTime: string, estimatedFee: number }[],
    restrictedAreas: { name: string, reason: string, severity: 'Low' | 'Medium' | 'High' }[],
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
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}


export async function getOptimizedRoute(departure: string, destination: string, currentFirs: any[]) {
  const prompt = `Analyze the flight route from ${departure} to ${destination} (currently crossing FIRs: ${JSON.stringify(currentFirs)}).
  
  CRITICAL OPTIMIZATION GOALS:
  1. COST REDUCTION: Suggest a route that minimizes FIR (Flight Information Region) overflight charges. Identify specific high-cost FIRs to avoid.
  2. FUEL STOPS: Suggest optimal fuel stops (ICAO codes) if refueling at a mid-point airport with lower fuel rates significantly reduces total mission cost, even if the aircraft has the range.
  3. SAFETY & NOTAMs: Search for current NOTAMs (Notice to Air Missions) affecting these FIRs or the route.
  4. WEATHER: Check current and forecast weather conditions (SIGMETs, turbulence, thunderstorms, icing) along the route.
  
  Provide:
  - Suggested FIRs for the new route (be specific about which FIRs to add/avoid)
  - Suggested Fuel Stops (if any) with reasoning (e.g., "Fuel at OBBI is 30% cheaper than OOMS")
  - Estimated cost savings or safety improvements
  - Detailed reasoning mentioning specific NOTAM IDs or weather phenomena found.
  - Impact analysis: Identify exactly how the primary route is affected.
  
  Return the result as a JSON object: { 
    suggestedRoute: { 
      firs: { name: string, country: string, rules: string, overflightCharge: number, navigationCharge: number }[], 
      fuelStops: { icao: string, reason: string, estimatedSavings: number }[],
      totalCost: number 
    }, 
    savings: number, 
    reasoning: string,
    impactedBy: { type: 'NOTAM' | 'Weather' | 'Cost' | 'Fuel', description: string }[]
  }.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  return JSON.parse(response.text);
}


export async function getSuggestedAircraft(passengers: number, distance: number, aircraftList: any[], departureIcao: string) {
  const prompt = `Given these aircraft: ${JSON.stringify(aircraftList)}, suggest three distinct aircraft options for ${passengers} passengers and a mission distance of ${distance} nautical miles starting from ${departureIcao}.
  
  CRITICAL SELECTION CRITERIA:
  1. Nearest Available: Prioritize aircraft with the shortest positioning distance (from their currentLocation to ${departureIcao}).
  2. Cheapest: The most cost-effective option based on hourly rate, fuel burn, and positioning costs.
  3. Recommended: A balanced option considering comfort, speed, range, and total mission feasibility including positioning.
  
  FLEET CATEGORIES TO CONSIDER:
  - Light Jet (for short/medium range, smaller groups)
  - Midsize Jet (for medium/long range, standard groups)
  - Heavy Jet (for long range, large groups or VIP comfort)
  - Turboprop (for shorter regional hops)
  
  VALIDATION:
  - PASSENGER CAPACITY: Selected aircraft MUST have maxPassengers >= ${passengers}.
  - RANGE: Consider aircraft range vs distance. If distance > 85% of range, mention required fuel stops.
  - RUNWAY LIMITATIONS: Aircraft must be suitable for typical airports at this distance (consider takeoffDistance and landingDistance).
  
  For each option, provide realistic aviation-grade notes regarding:
  - Positioning distance from current location to ${departureIcao}.
  - Fuel stops (if distance exceeds 80% of aircraft range)
  - Permit requirements (overflight/landing permits based on typical international routes)
  - Operational considerations (runway requirements, etc.)
 
  Return a JSON object: {
    cheapest: { type: string, notes: string },
    fastest: { type: string, notes: string },
    recommended: { type: string, notes: string }
  }`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}

export async function getWindImpact(departure: string, destination: string) {
  const prompt = `Based on current and forecast wind data for the route from ${departure} to ${destination}, calculate the average wind component (headwind or tailwind) in knots. 
  Return a JSON object: { windComponent: number, description: string }. 
  A positive windComponent indicates a tailwind, and a negative value indicates a headwind.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
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
    "tripType": "one-way" | "round-trip" | "multi-day",
    "returnDate": "string (optional, YYYY-MM-DDTHH:mm)",
    "aircraftPreference": "string (optional)"
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${systemPrompt}\n\nUser Input: "${prompt}"`,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}

export async function generateCharterQuotes(params: {
  departure: string;
  destination: string;
  stops?: string;
  dateTime: string;
  returnDate?: string;
  tripType: string;
  passengers: number;
  cargoWeight: number;
  aircraftPreference?: string;
  brokerMargin: number;
  operatorMargin: number;
  currentDate: string;
  airportsContext?: any[];
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
  - Return Date: ${params.returnDate || 'N/A'}
  - Passengers: ${params.passengers}
  - Cargo Weight: ${params.cargoWeight} kg
  - Aircraft Preference: ${params.aircraftPreference || 'None'}
  - Broker Margin: ${params.brokerMargin}%
  - Operator Margin: ${params.operatorMargin}%

  Available Fleet Data:
  ${JSON.stringify(aircraftList)}

  Available Empty Legs (Check for matches):
  ${JSON.stringify(emptyLegs)}

  Airport Operational Data (Use for fees, handling status, and runway checks):
  ${JSON.stringify(params.airportsContext || [])}

  CORE AI LOGIC REQUIREMENTS:
  1. MULTI-LEG COSTING: Calculate costs for all legs (Departure -> Stops -> Destination). If round-trip, calculate the return leg as well.
  2. ROUND-TRIP DISCOUNT: If tripType is 'round-trip', apply a 5% to 10% discount on the total operator base cost for the return leg (due to reduced positioning/crew efficiency).
  3. EMPTY LEG DETECTION: If any available empty leg matches the route (departure/destination) and date, highlight it as a special "Empty Leg" option with significantly reduced pricing (30-50% off standard rates).
  4. ROUTE ENGINE: Calculate Great Circle distance + 5-10% for realistic routing. Detect required fuel stops and FIR regions crossed.
  5. AIRCRAFT SELECTION ENGINE (CRITICAL):
     - Suggest THREE distinct aircraft options for the mission:
       - Cheapest: Most economical option.
       - Fastest: Highest speed option.
       - Recommended: Best balance for this specific mission.
     - FLEET CATEGORIES TO CONSIDER: Light Jet, Midsize Jet, Heavy Jet, Cargo Aircraft.
     - PASSENGER CAPACITY: Selected aircraft MUST have maxPassengers >= ${params.passengers}.
     - RANGE: Consider aircraft range vs routing distance. If distance exceeds 85% of range, plan a fuel stop.
     - RUNWAY LIMITATIONS: Ensure aircraft can operate at all airports in the plan.
  6. COSTING ENGINE: Calculate FULL breakdown including Fuel, Crew, Maintenance, Airport fees, Airspace fees, and Operational costs.
  7. POSITIONING LOGIC: Detect the nearest available aircraft. Calculate empty leg positioning from its currentLocation to ${params.departure} and repositioning back to homeBase.
  8. PRICING STRATEGY:
     - Final Total Price = Base Cost (with round-trip discount if applicable) + Margins + Dynamic Adjustments.
     - Apply DYNAMIC PRICING based on Demand, Season, and Urgency.
  9. AI OPTIMIZATION: Suggest cheaper routes, fuel stops, or best aircraft for profit vs price balance.

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
        "option_type": "Cheapest" | "Fastest" | "Recommended" | "Empty Leg",
        "aircraft_name": "string",
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
        "commercial_viability_score": number
      }
    ],
    "general_notes": ["string"]
  }`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview", // Upgraded to Pro for complex pricing logic
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
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
  
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
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
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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

export async function planComplexFlight(userInput: string, aircraftList: any[], optimization: 'cheapest' | 'fastest' | 'balanced' = 'balanced') {
  const prompt = `You are a senior flight operations expert. A user says: "${userInput}".
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
     - FIRs crossed
     - Required permits (country, type, leadTime, estimatedFee)
     - Restricted airspaces (name, reason, severity)
     - Detailed costs:
    - Fuel cost (based on REAL-TIME airport rates found)
    - Overflight charges (per FIR)
    - Navigation charges (en-route)
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
     - RANGE: Consider aircraft range vs routing distance. If distance exceeds 85% of range, plan a fuel stop.
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
      firs: any[], 
      permits: { country: string, type: 'Overflight' | 'Landing', leadTime: string, estimatedFee: number }[],
      restrictedAreas: { name: string, reason: string, severity: 'Low' | 'Medium' | 'High' }[],
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  return JSON.parse(response.text);
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
      restrictedAreas: { name: string, reason: string, severity: 'Low' | 'Medium' | 'High' }[],
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
  }.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  return JSON.parse(response.text);
}

export async function searchAirports(query: string) {
  const prompt = `Search for airports matching the query: "${query}". 
  Provide a list of up to 5 matching airports with their:
  - ICAO (4-letter)
  - IATA (3-letter)
  - Name
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
  
  Return JSON: {
    airports: {
      icao: string,
      iata: string,
      name: string,
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
      parkingSpots: number
    }[]
  }.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}

export async function getAirportDetails(airportCode: string) {
  const prompt = `Provide the following details for airport ${airportCode}: 
  - Runway length (in feet, as a number)
  - Elevation (in feet, as a number)
  - Fuel availability (as a string)
  
  Return the result as a JSON object: { runwayLength: number, elevation: number, fuelAvailability: string }.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
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
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}

export async function analyzeFlightPlan(plan: any) {
  const prompt = `Analyze the following flight plan:
  ${JSON.stringify(plan)}
  
  CRITICAL ANALYSIS GOALS:
  1. RISK ASSESSMENT: Identify potential operational, safety, or financial risks (e.g., tight turnarounds, high-cost FIRs, weather threats, permit lead times).
  2. EFFICIENCY GAINS: Highlight where the plan excels or where minor adjustments could save more time or fuel.
  3. ALTERNATIVE STRATEGIES: Suggest at least two alternative strategies (e.g., "Use a different aircraft for better fuel economy" or "Change the stopover to avoid high navigation fees").
  
  Provide:
  - A list of specific risks with severity (Low, Medium, High).
  - A list of efficiency highlights.
  - A list of alternative strategies with estimated impact.
  
  Return JSON: {
    "risks": [
      { "risk": "string", "severity": "Low" | "Medium" | "High", "mitigation": "string" }
    ],
    "efficiencyGains": [
      { "gain": "string", "impact": "string" }
    ],
    "alternatives": [
      { "strategy": "string", "estimatedImpact": "string" }
    ],
    "overallAssessment": "string"
  }`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}

export async function fetchSpecificCharge(firCode: string, firName: string, chargeType: 'overflight' | 'navigation'): Promise<number> {
  const prompt = `Find the current ${chargeType} charge in USD for the FIR (Flight Information Region) ${firCode} - ${firName}.
  Return ONLY a JSON object with a single key "charge" containing the numeric value in USD.
  If you cannot find the exact value, estimate it based on typical charges for that region.
  Example: { "charge": 150.50 }`;

  try {
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
    console.error(`Failed to fetch ${chargeType} charge for ${firCode}:`, error);
    return 0;
  }
}

export async function fetchFIRRules(firCode: string, firName: string): Promise<string> {
  const prompt = `Find the current regulatory information and specific operating rules for the FIR (Flight Information Region) ${firCode} - ${firName}.
  Return ONLY a JSON object with a single key "rules" containing a string of the rules and regulations.
  Keep it concise but informative, focusing on key operational restrictions, required equipment (e.g., CPDLC, ADS-B), and specific procedures.
  Example: { "rules": "RVSM airspace. CPDLC required above FL290. Strict adherence to assigned levels." }`;

  try {
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
    console.error(`Failed to fetch rules for ${firCode}:`, error);
    return "Failed to fetch rules.";
  }
}

export async function getAirportCoords(icao: string) {
  const prompt = `Provide the latitude and longitude for the airport with ICAO code: ${icao}.
  Return JSON: { "lat": number, "lng": number, "name": "string", "city": "string" }`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  return JSON.parse(response.text);
}

export async function searchHandlingAgents(icao: string) {
  const prompt = `Find ground handling companies at airport ${icao}. 
  Provide a list of up to 3 companies with their:
  - Company Name
  - Contact Email
  - Contact Phone
  - Website
  - Estimated Base Handling Fee (USD)
  - Additional Services
  
  Return JSON: {
    agents: {
      companyName: string,
      email: string,
      phone: string,
      website: string,
      baseFee: number,
      additionalServices: string
    }[]
  }.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  return JSON.parse(response.text);
}

export async function getFIRDetails(firCode: string, firName: string) {
  const prompt = `Provide detailed information for the Flight Information Region (FIR) with code ${firCode} and name ${firName}.
  
  Include:
  1. Contact information for the relevant aviation authority (Address, Phone, Email, Website).
  2. Standard Operating Procedures (SOPs) for overflight and entry.
  3. Links to official documentation (AIP, Charts, or Authority website).
  4. Current overflight and navigation charges in USD (if available, otherwise 0).
  
  Return JSON: {
    address: string,
    phone: string,
    email: string,
    website: string,
    sop: string,
    documentationUrl: string,
    overflightCharge: number,
    navigationCharge: number
  }.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  return JSON.parse(response.text);
}
