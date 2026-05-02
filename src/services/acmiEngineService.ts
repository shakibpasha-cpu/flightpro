import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { getFlightRouteDetails, getAI, handleAiError } from './aiService';
import { Type } from "@google/genai";
import { REAL_WORLD_ACMI_RATES } from '../constants/aircraftData';
import { 
  calculateBlockHours, 
  calculateBaseACMIRate, 
  calculateFuelCost, 
  calculateFIRCharges, 
  calculateAirportCharges, 
  calculateCrewCosts, 
  calculatePositioningCost, 
  calculateMarketMultiplier, 
  calculateRiskFactor,
  calculateBrokerMarginRate,
  calculateTotalProjectedCost,
  ACMIRateComponents,
  A320_ACMI_DEFAULTS 
} from './flightCalculationService';

export interface MissionParams {
  departure: string;
  destination: string;
  date: string;
  passengers: number;
  payload: number;
  missionType: string;
  hoursParked?: number;
  crewCount?: number;
  crewDailyRate?: number;
  numberOfDays?: number;
  hotelsCost?: number;
  transportCost?: number;
  riskLevel?: 'Normal' | 'War Zone' | 'High Risk';
  aircraftBase?: string;
  isEmptyLeg?: boolean;
  leaseTermMonths?: number;
  monthlyGuaranteedHours?: number;
  totalBudget?: number;
}

export interface LeaseParams {
  aircraftListingId: string;
  leaseTermMonths: number;
  monthlyGuaranteedHours: number;
  startDate: string;
  region?: string;
}

export interface LeaseResult {
  monthlyFixedFee: number;
  mghCost: number;
  totalMonthlyCost: number;
  totalLeaseCost: number;
  depositAmount: number;
  hourlyRateAboveMGH: number;
  currency: string;
  listingData: any;
  masterData: any;
  availabilityConflict?: boolean;
  aiPrediction?: {
    predictedMonthlyFixedFee: number;
    predictedHourlyRate: number;
    confidenceScore: number;
    marketDemand: string;
    availabilityScore: number;
    reasoning: string;
  };
}

export interface CostBreakdown {
  acmiRate: number;
  fuel: number;
  overflight: number;
  airport: number;
  landingFee: number;
  handlingFee: number;
  parkingFee: number;
  crew: number;
  positioning: number;
  catering: number;
  marketAdjustment: number;
  riskAdjustment: number;
  insurance: number;
  contingency: number;
  brokerMargin: number;
  total: number;
}

export interface ACMIEngineResult {
  finalRate: number;
  flightHours: number;
  blockHours: number;
  fuelBurnRate: number;
  fuelPrice: number;
  costs: CostBreakdown;
  routeDetails: any;
  multipliers: {
    demand: number;
    urgency: number;
    season: number;
    region: number;
    insurance: number;
    strategy?: 'Premium' | 'Competitive' | 'Optimization' | 'Normal';
  };
  aiAnalysis?: string;
  intelligence?: {
    isEmptyLeg: boolean;
    discountApplied: number;
    marketRatePrediction: number;
    availabilityScore: number;
    pricingStrategy?: 'Premium' | 'Competitive' | 'Optimization' | 'Normal';
  };
  brokerMarginRate: number;
  priceRange?: {
    min: number;
    max: number;
  };
}

async function estimatePricingFactors(params: MissionParams, aircraftType: string): Promise<{ 
  demand: number, 
  urgency: number, 
  season: number, 
  region: number, 
  availabilityScore: number, 
  analysis: string,
  strategy: 'Premium' | 'Competitive' | 'Optimization' | 'Normal'
}> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the market demand, urgency, seasonality, and regional risk for an ACMI mission:
      Route: ${params.departure} to ${params.destination}
      Date: ${params.date}
      Aircraft: ${aircraftType}
      Mission Type: ${params.missionType}
      Client Budget: ${params.totalBudget ? '$' + params.totalBudget : 'Not specified'}
      
      Strictly follow these multiplier ranges and logic:
      1. Demand Factor:
         - Low Demand (Oversupply): 0.8 - 0.9 (Strategy: Competitive)
         - Normal: 1.0
         - High Demand (Peak): 1.2 - 1.4 (Strategy: Premium if Urgency High)
      2. Urgency Factor:
         - >7 days from today: 1.0
         - 3-7 days from today: 1.1 - 1.2
         - <48 hours from today: 1.25 - 1.6
      3. Season Factor:
         - Low Season: 0.8 - 0.9
         - Peak Season: 1.2 - 1.4
      4. Region Factor:
         - Stable Region: 1.0
         - High-risk zone: 1.3 - 1.6
      
      Determine a PRICING STRATEGY:
      - 'Premium': High demand + High urgency.
      - 'Competitive': Low demand (oversupply).
      - 'Optimization': If Budget specified and tight.
      - 'Normal': Standard conditions.

      Current Date: ${new Date().toISOString()}
      
      Format as JSON: { 
        "demand": number, 
        "urgency": number, 
        "season": number, 
        "region": number, 
        "availabilityScore": number, 
        "analysis": string,
        "strategy": string 
      }`,
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text);
    
    // Clamp values to user-defined ranges
    const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

    return {
      demand: clamp(result.demand || 1.0, 0.8, 1.5),
      urgency: clamp(result.urgency || 1.0, 1.0, 1.6),
      season: clamp(result.season || 1.0, 0.8, 1.4),
      region: clamp(result.region || 1.0, 1.0, 1.6),
      availabilityScore: clamp(result.availabilityScore || 75, 0, 100),
      analysis: result.analysis || "Standard market conditions applied.",
      strategy: (['Premium', 'Competitive', 'Optimization', 'Normal'].includes(result.strategy) ? result.strategy : 'Normal') as any
    };
  } catch (error) {
    handleAiError(error, 'estimatePricingFactors');
    return { demand: 1.0, urgency: 1.0, season: 1.0, region: 1.0, availabilityScore: 75, analysis: "AI estimation unavailable.", strategy: 'Normal' };
  }
}

export async function calculateACMIMission(
  params: MissionParams, 
  aircraftListingId: string, 
  preFetchedData?: { 
    routeDetails?: any, 
    listingData?: any, 
    masterData?: any,
    multipliers?: { demand: number, urgency: number, season: number, region: number, availabilityScore: number, analysis: string, strategy?: 'Premium' | 'Competitive' | 'Optimization' | 'Normal' }
  }
): Promise<ACMIEngineResult> {
  // 1. Fetch Aircraft Listing Data
  let listingData = preFetchedData?.listingData;
  if (!listingData) {
    const listingRef = doc(db, 'aircraft_listings', aircraftListingId);
    const listingSnap = await getDoc(listingRef);
    if (listingSnap.exists()) {
      listingData = listingSnap.data();
    } else {
      const aircraftRef = doc(db, 'aircraft', aircraftListingId);
      const aircraftSnap = await getDoc(aircraftRef);
      if (aircraftSnap.exists()) {
        listingData = aircraftSnap.data();
      }
    }
    
    if (!listingData) {
      throw new Error('Aircraft data not found');
    }
  }
  
  const baseRate = listingData.acmi_rate_per_hr || listingData.acmiRate || 0;
  const aircraftId = listingData.aircraft_id || aircraftListingId;
  const crewIncluded = listingData.crew_included ?? listingData.crewIncluded ?? true;
  const baseAirport = params.aircraftBase || listingData.base_airport || listingData.baseAirport;

  // 2. Fetch Aircraft Master Data
  let masterData = preFetchedData?.masterData;
  if (!masterData) {
    const masterRef = doc(db, 'aircraft_master', aircraftId);
    const masterSnap = await getDoc(masterRef);
    masterData = masterSnap.exists() ? masterSnap.data() : listingData;
  }

  const aircraftType = masterData.aircraft_type || masterData.type || 'Unknown';
  const marketRef = REAL_WORLD_ACMI_RATES.find(r => r.type === aircraftType);

  // 2.5 Fetch Market Rates from Firestore for dynamic calculation
  let marketRateData: any = null;
  try {
    const ratesQuery = query(collection(db, 'aircraft_rates'), where('aircraft_type', '==', aircraftType), limit(1));
    const ratesSnap = await getDocs(ratesQuery);
    if (!ratesSnap.empty) {
      marketRateData = ratesSnap.docs[0].data();
    }
  } catch (e) {
    console.warn('Market rates fetch failed, falling back to constants', e);
  }

  const mtow = masterData.mtow_kg || masterData.mtow || 77000;
  const mtowFactor = mtow / 50000;

  // 3. Get Route Details
  let routeDetails = preFetchedData?.routeDetails;
  if (!routeDetails) {
    routeDetails = await getFlightRouteDetails(params.departure, params.destination);
  }
  
  // Fallback for distance calculation if routeDetails is null or missing distance
  const distance = routeDetails?.routingDistance || routeDetails?.gcDistance || 0;
  
  if (distance === 0) {
    console.warn('Flight distance calculation returned 0. This may lead to inaccurate pricing.');
  }

  const cruiseSpeed = masterData.cruise_speed_kts || masterData.cruiseSpeed || 450;
  
  // 3.1 Calculate Block Hours with operational buffer (1.15) and Taxi (0.45 avg)
  const blockHours = calculateBlockHours(distance, cruiseSpeed, 0.45);
  const flightHours = distance / cruiseSpeed;

  // 4. Calculate Dynamic Multipliers
  let aiFactors: { 
    demand: number, 
    urgency: number, 
    season: number, 
    region: number, 
    availabilityScore: number, 
    analysis: string,
    strategy: 'Premium' | 'Competitive' | 'Optimization' | 'Normal'
  };

  if (preFetchedData?.multipliers) {
    aiFactors = {
      ...preFetchedData.multipliers,
      strategy: preFetchedData.multipliers.strategy || 'Normal'
    };
  } else {
    aiFactors = await estimatePricingFactors(params, aircraftType);
  }

  const { 
    demand: demandMultiplier, 
    urgency: urgencyMultiplier, 
    season: seasonMultiplier, 
    region: regionMultiplier, 
    availabilityScore: aiAvailabilityScore, 
    analysis: aiAnalysis,
    strategy: pricingStrategy 
  } = aiFactors;

  // 4.1 Master Multiplier (AI Layer)
  const marketMultiplier = calculateMarketMultiplier({
    demand: demandMultiplier,
    season: seasonMultiplier,
    urgency: urgencyMultiplier,
    region: regionMultiplier
  });

  // 4.2 Adjusted ACMI Rate
  // Industry Standard Component Model
  let rateConfig: ACMIRateComponents = {
    leaseMonthlyCost: marketRateData?.lease_cost || (mtow > 150000 ? 500000 : 200000),
    utilizationMonthlyHours: 300,
    crewCostPerHour: mtow > 150000 ? 800 : 500,
    maintenanceCostPerHour: mtow > 150000 ? 1200 : 700,
    insuranceCostPerHour: 200,
    operatorProfitMargin: 0.45,
  };

  if (aircraftType.includes('A320')) {
    rateConfig = { ...A320_ACMI_DEFAULTS };
  }

  const baseCalculatedRate = calculateBaseACMIRate(rateConfig);
  const finalRate = baseCalculatedRate * marketMultiplier;

  // B. Detect Empty Legs
  let discountApplied = 0;
  const isEmptyLeg = params.isEmptyLeg || false;
  if (isEmptyLeg) {
    discountApplied = 0.3 + (Math.random() * 0.4); // 30% - 70%
  }

  // 5. Calculate Additional Costs
  
  // A. Fuel Cost Model (Accurate)
  let fuelPrice = 0.95; // Default per KG ($ / KG roughly)
  try {
    const fuelRef = doc(db, 'fuel_prices', params.departure);
    const fuelSnap = await getDoc(fuelRef);
    if (fuelSnap.exists()) {
      fuelPrice = fuelSnap.data().fuel_price_per_kg || 0.95;
    }
  } catch (e) { console.warn('Fuel price fetch failed', e); }
  
  const fuelBurnRate = masterData.fuel_burn_kg_per_hr || masterData.fuelBurnPerHour || (marketRef?.fuelBurnPerHour) || 2500;
  const fuelCost = calculateFuelCost({
    blockHours,
    fuelBurnKgPerHour: fuelBurnRate,
    fuelPricePerKg: fuelPrice,
    isAdvanced: true,
    mtowKg: mtow
  });

  // B. FIR (Overflight) Charges Model
  let overflightCost = calculateFIRCharges(distance, mtow);
  if (routeDetails?.firs && routeDetails.firs.length > 0) {
    const preciseOverflight = routeDetails.firs.reduce((acc: number, fir: any) => {
      return acc + (fir.overflightCharge || 0) + (fir.navigationCharge || 0);
    }, 0);
    if (preciseOverflight > 0) {
      overflightCost = preciseOverflight;
    }
  }

  // C. Airport Charges Model
  const airportResult = calculateAirportCharges(
    mtow, 
    1500, // Base rate
    50000, 
    1500, // Fixed handling
    params.passengers || 0,
    25 // Per pax
  );
  
  const landingFee = airportResult.landingFee;
  const handlingFee = airportResult.handlingFee;
  const parkingFee = (params.hoursParked || 4) * 80; // $80/hr avg
  const airportTotal = landingFee + handlingFee + parkingFee;

  // D. Crew Cost Model
  const crewCost = calculateCrewCosts(blockHours, 1200, 10, params.numberOfDays || 1);
  
  // E. Catering Cost Model
  const missionLower = params.missionType?.toLowerCase() || '';
  const isPassenger = missionLower.includes('passenger') || missionLower.includes('pax');
  const isVip = missionLower.includes('vip');
  
  let cateringCost = 0;
  if (isPassenger || isVip) {
    const paxCount = params.passengers || (mtow > 150000 ? 50 : 15);
    const perPaxRate = isVip ? 150 : 25;
    cateringCost = paxCount * perPaxRate;
  }
  
  // F. Positioning Cost Model
  let positioningCost = 0;
  const posDist = Math.random() * 1200; // Simulated positioning distance if base unknown
  positioningCost = calculatePositioningCost(posDist, cruiseSpeed, finalRate, fuelBurnRate, fuelPrice);

  // F. Insurance & Risk Model
  const riskMultiplier = calculateRiskFactor(params.riskLevel || 'Normal');
  
  // 5.1 AI SMART PRICING LOGIC (SECRET SAUCE 🔥)
  let brokerMarginRate = calculateBrokerMarginRate({
    missionType: params.missionType,
    urgencyMultiplier: urgencyMultiplier,
    isLease: !!params.leaseTermMonths
  });

  let strategyNotes = [];
  
  // A. Competitive Pricing (Oversupply)
  if (pricingStrategy === 'Competitive' && demandMultiplier < 1.0) {
    strategyNotes.push("Applying Competitive Pricing due to market oversupply.");
  }

  // B. Premium Pricing (Urgent + High Demand)
  if (pricingStrategy === 'Premium' && urgencyMultiplier > 1.2 && demandMultiplier > 1.1) {
    strategyNotes.push("Aviation Intelligence: Premium surcharge applied for critical-mission priority.");
  }

  // C. Price Optimization (Budget Fit)
  if (params.totalBudget && pricingStrategy === 'Optimization') {
    strategyNotes.push("Pricing optimized for client budget targets.");
    // If we're over budget, slice the margin slightly (Smart Negotiation)
    if (brokerMarginRate > 0.10) {
      brokerMarginRate -= 0.03;
    }
  }

  // G. Total Projected Cost Calculation
  const projectResult = calculateTotalProjectedCost({
    blockHours,
    baseAcmiRate: baseCalculatedRate,
    fuelCost,
    firCharges: overflightCost,
    airportCharges: airportTotal,
    crewCost,
    positioningCost,
    cateringCost,
    marketMultiplier,
    riskMultiplier,
    contingencyRate: 0.05,
    brokerMarginRate
  });

  const finalTotal = projectResult.finalClientPrice;
  const priceRange = {
    min: Math.round(finalTotal * 0.95),
    max: Math.round(finalTotal * 1.10)
  };

  return {
    finalRate: (projectResult.coreFlightCost + projectResult.marketAdjustment) / blockHours * (1 - discountApplied),
    flightHours,
    blockHours,
    fuelBurnRate,
    fuelPrice,
    multipliers: {
      demand: demandMultiplier,
      urgency: urgencyMultiplier,
      season: seasonMultiplier,
      region: regionMultiplier,
      insurance: riskMultiplier
    },
    routeDetails,
    aiAnalysis: aiAnalysis + (strategyNotes.length > 0 ? " | STICKY INTEL: " + strategyNotes.join(" ") : ""),
    intelligence: {
      isEmptyLeg,
      discountApplied,
      marketRatePrediction: baseCalculatedRate,
      availabilityScore: aiAvailabilityScore || 85,
      pricingStrategy: pricingStrategy as 'Premium' | 'Competitive' | 'Optimization' | 'Normal'
    },
    brokerMarginRate,
    priceRange,
    costs: {
      acmiRate: Math.round(projectResult.flightTimeCost),
      fuel: Math.round(fuelCost),
      overflight: Math.round(overflightCost),
      airport: Math.round(airportTotal),
      landingFee: Math.round(landingFee),
      handlingFee: Math.round(handlingFee),
      parkingFee: Math.round(parkingFee),
      crew: Math.round(crewCost),
      positioning: Math.round(positioningCost),
      catering: Math.round(cateringCost),
      marketAdjustment: Math.round(projectResult.marketAdjustment),
      riskAdjustment: Math.round(projectResult.riskAdjustment),
      insurance: Math.round(projectResult.riskAdjustment),
      contingency: Math.round(projectResult.contingency),
      brokerMargin: Math.round(projectResult.brokerMargin),
      total: Math.round(finalTotal)
    }
  };
}

export async function suggestCheaperAlternatives(params: MissionParams, currentAircraftId: string, allListings: any[]): Promise<any[]> {
  try {
    // 1. Fetch Route Details and Multipliers ONCE
    const routeDetails = await getFlightRouteDetails(params.departure, params.destination);
    
    // Get current aircraft master data for AI estimation
    const currentListing = allListings.find(l => l.id === currentAircraftId);
    const multipliers = await estimatePricingFactors(params, currentListing?.type || 'Unknown');

    // 2. Calculate current mission with pre-fetched data
    const currentResult = await calculateACMIMission(params, currentAircraftId, { routeDetails, multipliers });
    const currentTotal = currentResult.costs.total;

    const alternatives = [];
    
    // 3. Filter out the current aircraft and only look at others
    const otherListings = allListings.filter(l => l.id !== currentAircraftId);

    // Fetch all master data at once to avoid individual getDoc calls
    const masterSnapshot = await getDocs(collection(db, 'aircraft_master'));
    const masterMap = new Map(masterSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));

    for (const listing of otherListings) {
      try {
        const masterData = masterMap.get(listing.aircraft_id) as any;
        if (!masterData) continue;

        // CRITICAL CAPACITY CHECK: Ensure alternative aircraft actually fits the requirement
        const capacityMatches = params.missionType === 'Cargo' 
          ? (masterData.payload_kg || 0) >= params.payload
          : (masterData.passenger_capacity || 0) >= params.passengers;

        if (!capacityMatches) continue;

        const result = await calculateACMIMission(params, listing.id, { 
          routeDetails, 
          multipliers,
          listingData: listing,
          masterData
        });
        
        if (result.costs.total < currentTotal) {
          const reasons = [];
          const masterFuel = (masterData as any).fuel_burn_kg_per_hr || (masterData as any).fuelBurnPerHour || 0;
          const currentFuel = currentListing?.fuelBurnPerHour || 0;
          
          if (masterFuel < currentFuel) reasons.push('Lower Fuel Burn');
          if ((listing as any).base_airport === params.departure) reasons.push('Closer Base');
          else if (result.costs.positioning < currentResult.costs.positioning) reasons.push('Lower Positioning Cost');

          alternatives.push({
            listingId: listing.id,
            aircraftType: listing.type || 'Unknown',
            operatorName: listing.operatorName || listing.operator,
            totalCost: result.costs.total,
            savings: currentTotal - result.costs.total,
            finalRate: result.finalRate,
            reasons: reasons.length > 0 ? reasons : ['Better ACMI Rate']
          });
        }
      } catch (e) {
        // Skip if calculation fails for an alternative
      }
    }

    return alternatives.sort((a, b) => a.totalCost - b.totalCost).slice(0, 3);
  } catch (error) {
    console.error("Error suggesting alternatives:", error);
    return [];
  }
}

export async function predictACMILeaseRate(params: {
  aircraftType: string;
  operatorName: string;
  leaseTermMonths: number;
  mgh: number;
  region: string;
  baseMonthlyFee: number;
  baseHourlyRate: number;
}) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert aviation ACMI lease pricing analyst.
      Predict the current market ACMI lease rates for the following scenario:
      - Aircraft Type: ${params.aircraftType}
      - Operator: ${params.operatorName}
      - Lease Term: ${params.leaseTermMonths} months
      - Monthly Guaranteed Hours (MGH): ${params.mgh}
      - Region: ${params.region || 'Global'}
      - Baseline Monthly Fee: $${params.baseMonthlyFee}
      - Baseline Hourly Rate: $${params.baseHourlyRate}

      Consider factors like operator reputation, lease term discounts (longer term = lower rate), market demand, and availability.
      
      Provide your prediction as a JSON object.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedMonthlyFixedFee: { type: Type.NUMBER, description: "Predicted monthly fixed fee in USD" },
            predictedHourlyRate: { type: Type.NUMBER, description: "Predicted hourly rate in USD" },
            confidenceScore: { type: Type.NUMBER, description: "Confidence score from 0 to 100" },
            marketDemand: { type: Type.STRING, description: "Market demand: Low, Normal, or High" },
            availabilityScore: { type: Type.NUMBER, description: "Availability score from 0 to 100" },
            reasoning: { type: Type.STRING, description: "Brief reasoning for the prediction" }
          },
          required: ["predictedMonthlyFixedFee", "predictedHourlyRate", "confidenceScore", "marketDemand", "availabilityScore", "reasoning"]
        }
      }
    });

    const jsonStr = response.text?.trim() || "{}";
    return JSON.parse(jsonStr);
  } catch (error) {
    handleAiError(error, 'predictACMILeaseRate');
    throw error;
  }
}

export async function calculateACMILease(params: LeaseParams): Promise<LeaseResult> {
  try {
    // 1. Fetch Aircraft Data (try listings first, then main aircraft collection)
    let listingData: any = null;
    const listingRef = doc(db, 'aircraft_listings', params.aircraftListingId);
    const listingSnap = await getDoc(listingRef);
    
    if (listingSnap.exists()) {
      listingData = listingSnap.data();
    } else {
      const aircraftRef = doc(db, 'aircraft', params.aircraftListingId);
      const aircraftSnap = await getDoc(aircraftRef);
      if (aircraftSnap.exists()) {
        listingData = aircraftSnap.data();
      }
    }

    if (!listingData) {
      throw new Error('Aircraft data not found');
    }

    // 2. Fetch Master Data
    let masterData: any = null;
    if (listingData.aircraft_id) {
      const masterRef = doc(db, 'aircraft_master', listingData.aircraft_id);
      const masterSnap = await getDoc(masterRef);
      masterData = masterSnap.exists() ? masterSnap.data() : listingData;
    } else {
      masterData = listingData;
    }

    // Map fields (handle both snake_case and camelCase)
    const monthlyFixedFee = listingData.monthly_fixed_fee || listingData.monthlyFixedFee || 0;
    const mgh = params.monthlyGuaranteedHours || listingData.monthly_guaranteed_hours || listingData.monthlyGuaranteedHours || 0;
    let hourlyRate = listingData.acmi_rate_per_hr || listingData.acmiRate || 0;
    const depositMonths = listingData.lease_deposit_months || listingData.leaseDepositMonths || 1;

    // Apply Long-term ACMI Lease Discount (Monthly): -15% to -30%
    // If lease term is >= 3 months, apply a discount
    if (params.leaseTermMonths >= 3) {
      const leaseDiscount = 0.15 + (Math.min(params.leaseTermMonths, 12) / 12) * 0.15; // 15% to 30% based on term
      hourlyRate = hourlyRate * (1 - leaseDiscount);
    }
    
    const mghCost = mgh * hourlyRate;
    const totalMonthlyCost = monthlyFixedFee + mghCost;
    const totalLeaseCost = totalMonthlyCost * params.leaseTermMonths;
    const depositAmount = totalMonthlyCost * depositMonths;

    // Check Availability
    let availabilityConflict = false;
    try {
      const availSnapshot = await getDocs(collection(db, 'availability'));
      const leaseStart = new Date(params.startDate);
      const leaseEnd = new Date(params.startDate);
      leaseEnd.setMonth(leaseEnd.getMonth() + params.leaseTermMonths);

      availabilityConflict = availSnapshot.docs.some(doc => {
        const data = doc.data();
        // Check both naming conventions
        const aircraftId = data.aircraft_listing_id || data.aircraftId;
        const status = data.availability_status || data.status;
        const bookedStart = new Date(data.start_date || data.startTime);
        const bookedEnd = new Date(data.end_date || data.endTime);

        if (aircraftId !== params.aircraftListingId || (status !== 'Booked' && status !== 'booked')) {
          return false;
        }

        // Overlap check: (StartA <= EndB) and (EndA >= StartB)
        return (leaseStart <= bookedEnd) && (leaseEnd >= bookedStart);
      });
    } catch (e) {
      console.warn('Availability check failed', e);
    }

    // Call AI Prediction
    const aiPrediction = await predictACMILeaseRate({
      aircraftType: masterData.aircraft_type || 'Unknown',
      operatorName: listingData.operator_name || listingData.operator || 'Unknown',
      leaseTermMonths: params.leaseTermMonths,
      mgh: mgh,
      region: params.region || 'Global',
      baseMonthlyFee: monthlyFixedFee,
      baseHourlyRate: hourlyRate
    });

    return {
      monthlyFixedFee,
      mghCost,
      totalMonthlyCost,
      totalLeaseCost,
      depositAmount,
      hourlyRateAboveMGH: hourlyRate,
      currency: listingData.currency || 'USD',
      listingData,
      masterData,
      availabilityConflict,
      aiPrediction
    };
  } catch (error) {
    console.error("ACMI Lease calculation failed:", error);
    throw error;
  }
}
