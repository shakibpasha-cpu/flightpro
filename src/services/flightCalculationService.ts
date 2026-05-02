/**
 * Industry standards for ACMI pricing.
 */
export const ACMI_STANDARDS = {
  OPERATIONAL_BUFFER: 1.15,
  TAXI_TIME_DEFAULT: 0.45, // Midpoint of 0.3 - 0.6
  TAXI_TIME_RANGE: { min: 0.3, max: 0.6 },
  CONTINGENCY_RATE: 0.05,
};

/**
 * Calculates Block Hours with operational buffer and taxi time.
 * Formula: Block Hours = (Distance / Cruise Speed) * 1.15 + Taxi Time
 */
export function calculateBlockHours(distanceNm: number, cruiseSpeedKts: number, taxiTimeHrs: number = ACMI_STANDARDS.TAXI_TIME_DEFAULT) {
  const flightHours = distanceNm / (cruiseSpeedKts || 450);
  return (flightHours * ACMI_STANDARDS.OPERATIONAL_BUFFER) + taxiTimeHrs;
}

/**
 * High-fidelity ACMI Pricing Model
 * Based on real-world broker/operator pricing system logic.
 */

export interface ACMIRateComponents {
  leaseMonthlyCost: number;
  utilizationMonthlyHours: number;
  crewCostPerHour: number;
  maintenanceCostPerHour: number;
  insuranceCostPerHour: number;
  operatorProfitMargin: number; // e.g., 0.3 for 30%
}

export const A320_ACMI_DEFAULTS: ACMIRateComponents = {
  leaseMonthlyCost: 180000,
  utilizationMonthlyHours: 300,
  crewCostPerHour: 500,
  maintenanceCostPerHour: 700,
  insuranceCostPerHour: 200,
  operatorProfitMargin: 0.45, // Midpoint of 30-60%
};

/**
 * Calculates the ACMI Hourly Rate based on core components.
 * ACMI Rate = (Lease Cost / Monthly Hours) + Crew + Maintenance + Insurance + Profit Margin
 */
export function calculateBaseACMIRate(components: ACMIRateComponents) {
  const leaseComponent = components.leaseMonthlyCost / (components.utilizationMonthlyHours || 300);
  const baseRate = leaseComponent + 
                   components.crewCostPerHour + 
                   components.maintenanceCostPerHour + 
                   components.insuranceCostPerHour;
  
  return baseRate * (1 + (components.operatorProfitMargin || 0));
}

/**
 * Calculates Fuel Cost based on advanced aviation model.
 * Advanced: Fuel Cost = (Takeoff + Cruise + Reserve) * Fuel Price
 * Baseline: Fuel Cost = Block Hours * Fuel Burn * Fuel Price
 */
export function calculateFuelCost(params: {
  blockHours: number;
  fuelBurnKgPerHour: number;
  fuelPricePerKg: number;
  mtowKg?: number; // Used for takeoff estimation
  isAdvanced?: boolean;
}) {
  if (!params.isAdvanced) {
    return params.blockHours * params.fuelBurnKgPerHour * params.fuelPricePerKg;
  }

  // Advanced Logic
  // 1. Takeoff Fuel: Higher burn for first ~15 mins. Approx 1.5x - 2.0x normal burn.
  const takeoffFuel = (15 / 60) * params.fuelBurnKgPerHour * 1.8;
  
  // 2. Cruise Fuel: Block hours minus takeoff time
  const cruiseHours = Math.max(0, params.blockHours - (15 / 60));
  const cruiseFuel = cruiseHours * params.fuelBurnKgPerHour;
  
  // 3. Reserve Fuel: Industry standard is often 30-45 mins of cruise fuel
  const reserveFuel = (45 / 60) * params.fuelBurnKgPerHour;

  const totalFuelKg = takeoffFuel + cruiseFuel + reserveFuel;
  return totalFuelKg * params.fuelPricePerKg;
}

/**
 * Calculates FIR (Overflight) Charges using Eurocontrol-style logic.
 * Formula: FIR Charge = Distance * FIR Rate * sqrt(MTOW / 50)
 */
export function calculateFIRCharges(distanceNm: number, mtowKg: number, firRatePerNm: number = 0.12) {
  const mtowTonnes = mtowKg / 1000;
  const weightFactor = Math.sqrt(mtowTonnes / 50);
  return distanceNm * firRatePerNm * weightFactor;
}

/**
 * Calculates Airport Charges including Landing and Handling.
 * Landing Fee = Airport Base Rate * (MTOW / Standard Weight)
 * Handling = Fixed Fee + (Passengers * Per Pax Fee)
 */
export function calculateAirportCharges(
  mtowKg: number, 
  airportBaseRate: number = 1200, 
  standardWeightKg: number = 50000,
  handlingFixedFee: number = 1500,
  passengerCount: number = 0,
  perPaxFee: number = 25
) {
  const landingFee = airportBaseRate * (mtowKg / standardWeightKg);
  const handlingFee = handlingFixedFee + (passengerCount * perPaxFee);
  return { landingFee, handlingFee, total: landingFee + handlingFee };
}

/**
 * CREW COST MODEL (REALISTIC)
 * Short Mission (< Max Duty): Daily Crew Cost * Days Required
 * Long Mission (> Max Duty): (Block Hours / Max Duty Hours) * Crew Daily Cost
 * Note: Long missions usually require multiple crew sets or heavy rotation.
 */
export function calculateCrewCosts(blockHours: number, dailyCost: number = 1000, maxDutyHours: number = 10, days: number = 1) {
  if (blockHours <= maxDutyHours) {
    return dailyCost * days;
  }
  // For long missions, we calculate based on crew sets/shifts required
  const shiftsRequired = Math.ceil(blockHours / maxDutyHours);
  return shiftsRequired * dailyCost;
}

/**
 * POSITIONING COST MODEL (CRITICAL 🔥)
 * Formula: Positioning Cost = (Positioning Flight Hours * ACMI Rate) + Fuel + Crew
 * Rule: Mandatory if Aircraft Distance > 1000 km (~540 NM)
 */
export function calculatePositioningCost(
  posDistanceNm: number, 
  cruiseSpeedKts: number, 
  acmiRate: number, 
  fuelBurnKgPerHour: number, 
  fuelPricePerKg: number,
  crewDailyCost: number = 1000
) {
  // RULE: If distance is significant, positioning is mandatory. 
  // If too short, we assume operational integration or ignore.
  if (posDistanceNm < 540) return 0; 

  const posHours = posDistanceNm / (cruiseSpeedKts || 450);
  
  // 1. ACMI Time Component
  const timeComponent = posHours * acmiRate;
  
  // 2. Fuel Component
  const fuelComponent = posHours * fuelBurnKgPerHour * fuelPricePerKg;
  
  // 3. Crew Component (Using the Crew Model logic)
  const crewComponent = calculateCrewCosts(posHours, crewDailyCost, 10, 1);

  return timeComponent + fuelComponent + crewComponent;
}

/**
 * Calculates Market Adjustment Multiplier (AI Layer).
 */
export function calculateMarketMultiplier(params: {
  demand: number; // 0.8 - 1.5
  season: number; // 0.8 - 1.4
  urgency: number; // 1.0 - 1.6
  region: number; // 1.0 - 1.6
}) {
  return params.demand * params.season * params.urgency * params.region;
}

/**
 * INSURANCE & RISK MODEL
 * Formula: Insurance Adjustment = Base Cost * Risk Factor
 */
export function calculateRiskFactor(condition: string): number {
  const c = condition.toLowerCase();
  if (c.includes('conflict') || c.includes('war')) return 1.35; // Ranges 1.25 - 1.60
  if (c.includes('africa') || c.includes('remote')) return 1.10;
  return 1.00; // Normal
}

/**
 * BROKER PRICING MODEL (REAL WORLD)
 * Typical margins based on deal complexity and urgency.
 */
export function calculateBrokerMarginRate(params: {
  missionType: string;
  urgencyMultiplier: number;
  isLease?: boolean;
}): number {
  // 1. Urgent Deals (Priority)
  if (params.urgencyMultiplier >= 1.25) return 0.20; // 20%+

  // 2. Mission Type Based
  const type = params.missionType.toLowerCase();
  
  if (type.includes('lease') || params.isLease) {
    return 0.08; // Mid-point of 5%-10%
  }
  
  if (type.includes('charter') || type.includes('cargo') || type.includes('pax')) {
    return 0.15; // Mid-point of 10%-20%
  }

  return 0.10; // Default
}

/**
 * Final Master Formula (Production Engine).
 * 
 * TOTAL COST = [
 *   (Block Hours * Adjusted ACMI Rate)
 *   + Fuel Cost
 *   + FIR Charges
 *   + Airport Charges
 *   + Crew Cost
 *   + Positioning Cost
 * ] * Risk Multiplier + Contingency + Broker Margin
 */
export function calculateTotalProjectedCost(params: {
  blockHours: number;
  baseAcmiRate: number; 
  fuelCost: number;
  firCharges: number;
  airportCharges: number;
  crewCost: number;
  positioningCost: number;
  cateringCost: number;
  marketMultiplier: number; 
  riskMultiplier: number; 
  contingencyRate: number; 
  brokerMarginRate: number; 
}) {
  // 1. Calculate Adjusted ACMI Cost (Market Layer)
  const adjustedAcmiRate = params.baseAcmiRate * params.marketMultiplier;
  const flightTimeCost = params.blockHours * adjustedAcmiRate;

  // 2. Sum Operational Add-ons
  const operationalAddons = params.fuelCost +
                             params.firCharges +
                             params.airportCharges +
                             params.crewCost +
                             params.positioningCost +
                             params.cateringCost;

  // 3. Base Mission Cost (Bracketed Part)
  const baseMissionCost = flightTimeCost + operationalAddons;

  // 4. Apply Risk Multiplier
  const costAfterRisk = baseMissionCost * params.riskMultiplier;

  // 5. Calculate Adjustments (for breakdown transparency)
  const marketAdjustment = flightTimeCost - (params.blockHours * params.baseAcmiRate);
  const riskAdjustment = costAfterRisk - baseMissionCost;
  
  // 6. Final Add-ons
  const contingency = costAfterRisk * params.contingencyRate;
  const subtotalBeforeMargin = costAfterRisk + contingency;
  const brokerMargin = subtotalBeforeMargin * params.brokerMarginRate;
  
  const finalClientPrice = subtotalBeforeMargin + brokerMargin;

  return {
    coreFlightCost: params.blockHours * params.baseAcmiRate,
    flightTimeCost, // Adjusted rate * hours
    operationalAddons,
    marketAdjustment,
    riskAdjustment,
    contingency,
    brokerMargin,
    baseMissionCost,
    costAfterRisk,
    totalCost: subtotalBeforeMargin,
    finalClientPrice
  };
}

// Legacy support for existing components
export function calculateFlightMetrics(leg: any, aircraft: any, windComponent: number) {
  const groundSpeed = (aircraft.cruiseSpeed || 450) + windComponent;
  const blockHours = calculateBlockHours(leg.routingDistance || leg.distance || 0, groundSpeed);
  const fuelBurn = (aircraft.fuelBurnPerHour || 0) * blockHours;
  return {
    flightTime: blockHours,
    fuelBurn: fuelBurn
  };
}

export function calculateOverflightCharges(distanceInFIR: number, mtowKg: number, firRatePerKm: number = 0.07) {
  return calculateFIRCharges(distanceInFIR, mtowKg, firRatePerKm);
}

export function calculateAirportCosts(airportType: 'small' | 'major', seed: string = 'default') {
  const isSmall = airportType === 'small';
  const airportResult = calculateAirportCharges(isSmall ? 20000 : 80000, isSmall ? 800 : 2500);
  return {
    landingFees: airportResult.landingFee,
    groundHandling: airportResult.handlingFee,
    parkingFees: 300
  };
}

export function calculateInsuranceSurcharge(baseInsurance: number, restrictedAreas: any[]) {
  let surcharge = 0;
  restrictedAreas.forEach(area => {
    if (area.severity === 'High') surcharge += baseInsurance * 0.10;
    if (area.reason?.toLowerCase().includes('war') || area.reason?.toLowerCase().includes('conflict')) surcharge += baseInsurance * 0.25;
  });
  return surcharge;
}

export function calculateTotalACMICost(breakdown: any) {
  const result = calculateTotalProjectedCost({
    blockHours: breakdown.blockHours,
    baseAcmiRate: breakdown.acmiRatePerHour,
    fuelCost: breakdown.fuelCost,
    firCharges: breakdown.overflightCharges,
    airportCharges: (breakdown.landingFees || 0) + (breakdown.groundHandling || 0) + (breakdown.parkingFees || 0),
    crewCost: breakdown.crewCost,
    positioningCost: 0,
    cateringCost: breakdown.cateringCost || 0,
    marketMultiplier: 1.0, 
    riskMultiplier: 1.0 + (breakdown.insuranceSurcharge / (breakdown.insurance || 1) || 0),
    contingencyRate: (breakdown.contingencyPercentage || 5) / 100,
    brokerMarginRate: (breakdown.brokerMarginPercentage || 10) / 100
  });

  return {
    baseAcmiCost: breakdown.blockHours * breakdown.acmiRatePerHour,
    componentsSum: (result as any).operationalSubtotal || result.totalCost,
    marginAmount: result.brokerMargin,
    finalRate: result.totalCost,
    contingency: result.contingency,
    totalEstimatedCost: result.finalClientPrice
  };
}
