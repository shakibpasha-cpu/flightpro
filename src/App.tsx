/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, MapPin, Calendar, Users, Weight, Loader2, Sparkles, LayoutDashboard, History, Trash2, Plus, Moon, Sun, ChevronLeft, ChevronRight, ShieldCheck, FileText, MessageSquare, Fuel } from 'lucide-react';
import { generateQuotePDF } from './utils/pdfGenerator';
import { getSuggestedAircraft, getOptimizedRoute, getWindImpact, getMultiLegRouteDetails, searchAirports, generateACMIQuote, searchHandlingAgents, getFIRDetails, getFuelStopSuggestions } from './services/aiService';
import { calculateFlightMetrics, calculateTotalACMICost, calculateOverflightCharges, calculateAirportCosts, calculateCrewCosts, calculateInsuranceSurcharge } from './services/flightCalculationService';
import { CHART_LAYERS, DefaultIcon, getBearing, getMidpoint, calculateDistance } from './lib/mapConfig';
import { db, auth } from './firebase';
import { collection, addDoc, getDocs, getDocFromServer, doc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { handleFirestoreError, OperationType } from './utils/errorHandling';
import { seedOperators } from './utils/seedOperators';
import { ChatAssistant } from './components/ChatAssistant';
import FlightMap from './components/FlightMap';
import AIPlanner from './components/AIPlanner';
import AirportDatabase from './components/AirportDatabase';
import AircraftDatabase from './components/AircraftDatabase';
import FIRDatabase from './components/FIRDatabase';
import FIRAnalysis from './components/FIRAnalysis';
import FuelPlan from './components/FuelPlan';
import CostingEngine from './components/CostingEngine';
import PermitSystem from './components/PermitSystem';
import ScheduleBuilder from './components/ScheduleBuilder';
import HandlingAgentDatabase from './components/HandlingAgentDatabase';
import AvailabilityDatabase from './components/AvailabilityDatabase';
import PricingRuleDatabase from './components/PricingRuleDatabase';
import RouteDatabase from './components/RouteDatabase';
import MissionSummary from './components/MissionSummary';
import WeatherNotamPanel from './components/WeatherNotamPanel';
import EmptyLegs from './components/EmptyLegs';
import CharterQuoteEngine from './components/CharterQuoteEngine';
import DashboardOverview from './components/DashboardOverview';
import CostingSettings from './components/CostingSettings';
import LeadsManagement from './components/LeadsManagement';
import ReportsAnalytics from './components/ReportsAnalytics';
import ACMIMarketplace from './components/ACMIMarketplace';
import OperatorDatabase from './components/OperatorDatabase';
import MarketScraper from './components/MarketScraper';
import MarketIntelligence from './components/MarketIntelligence';
import LiveFleetTracking from './components/LiveFleetTracking';
import DataAutomation from './components/DataAutomation';
import PricingEngine from './components/PricingEngine';
import AILayer from './components/AILayer';
import RouteOptimizer from './components/RouteOptimizer';
import AOCDatabase from './components/AOCDatabase';
import AOCScraperEngine from './components/AOCScraperEngine';
import AOCSourceDirectory from './components/AOCSourceDirectory';
import { ACMIDatabase } from './components/ACMIDatabase';
import CharterBookingFlow from './components/CharterBookingFlow';
import BillingDashboard from './components/BillingDashboard';
import ACMIQuoteEngine from './components/ACMIQuoteEngine';
import AdvancedQuoteEngine from './components/AdvancedQuoteEngine';
import MultiLegFlightPlanner from './components/MultiLegFlightPlanner';
import AeronauticalCharts from './components/AeronauticalCharts';
import AuthorityIntelligence from './components/AuthorityIntelligence';
import AvailabilityIntelligence from './components/AvailabilityIntelligence';
import FeasibilityReport from './components/FeasibilityReport';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Breadcrumbs from './components/Breadcrumbs';
import PitchDeck from './components/PitchDeck';
import { QuotaMonitor } from './components/QuotaMonitor';

export default function App() {
  const [formData, setFormData] = useState({
    departure: '',
    destination: '',
    alternate: '',
    stopovers: [] as string[],
    dateTime: '',
    returnDate: '',
    passengers: 1 as number | '',
    cargoWeight: 0 as number | '',
    aircraftPreference: '',
    brokerMargin: 15 as number | '',
    operatorMargin: 0 as number | '',
    missionType: 'Passenger' as 'Passenger' | 'Cargo' | 'VIP' | 'ACMI Lease',
    specialRequirements: '',
    fuelPrice: 0 as number | '',
  });
  const [loading, setLoading] = useState(false);
  const [aircraftList, setAircraftList] = useState<any[]>([]);
  const [quoteOptions, setQuoteOptions] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<string>('recommended');
  const [routeData, setRouteData] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [hoveredLegIndex, setHoveredLegIndex] = useState<number | null>(null);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [activeMission, setActiveMission] = useState<any>(null);
  const [activeAircraftId, setActiveAircraftId] = useState<string | null>(null);
  const [aiPlan, setAiPlan] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [windData, setWindData] = useState<any>(null);
  const [optimizedRoute, setOptimizedRoute] = useState<any>(null);
  const [isLeftColumnCollapsed, setIsLeftColumnCollapsed] = useState(false);
  const [acmiQuote, setAcmiQuote] = useState<any>(null);
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [airportDetails, setAirportDetails] = useState<Record<string, any>>({});
  const [aiLayerDefaultTab, setAiLayerDefaultTab] = useState<'prediction' | 'optimization' | 'risk' | 'emptylegs' | 'negotiation'>('prediction');
  const [isOptimizingFuel, setIsOptimizingFuel] = useState(false);
  const [fuelStopSuggestions, setFuelStopSuggestions] = useState<any[]>([]);
  const [activeMapInput, setActiveMapInput] = useState<'departure' | 'destination' | 'none'>('departure');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const previewAirports = [formData.departure, ...formData.stopovers, formData.destination].filter(Boolean);

  const handleLegsUpdate = async (newLegs: any[], isFinal: boolean = true) => {
    if (isFinal) setLoading(true);
    const aircraft = aircraftList.find(a => a.type === (aiPlan?.suggestedAircraft || quoteOptions?.[selectedOption]?.type || acmiQuote?.type)) || aircraftList[0];
    
    const updatedLegs = newLegs.map(l => {
      const gcDistance = l.gcDistance || calculateDistance(l.departureCoords.lat, l.departureCoords.lng, l.destinationCoords.lat, l.destinationCoords.lng);
      const routingDistance = l.routingDistance || Math.round(gcDistance * 1.05);
      const metrics = calculateFlightMetrics({ routingDistance }, aircraft, 0);
      const airportCosts = calculateAirportCosts(gcDistance > 500 ? 'major' : 'small', l.destination);
      const overflightCharges = calculateOverflightCharges(routingDistance, aircraft.maxPayload || 50000);
      
      const depDetails = airportDetails[l.departure];
      const destDetails = airportDetails[l.destination];
      
      const handlingFee = l.selectedHandlingAgent?.baseFee || airportCosts.groundHandling;
      const departureHandlingFee = l.selectedDepartureHandlingAgent?.baseFee || 0;
      
      const legCost = (metrics.flightTime * (aircraft.hourlyRate || 3500)) + 
                      airportCosts.landingFees + 
                      handlingFee + 
                      departureHandlingFee +
                      airportCosts.parkingFees + 
                      overflightCharges;

      return {
        ...l,
        gcDistance,
        routingDistance,
        distance: routingDistance, // For compatibility
        flightTime: metrics.flightTime,
        fuelBurn: metrics.fuelBurn,
        departureHandlingAgents: depDetails?.handlingAgents || l.departureHandlingAgents || [],
        handlingAgents: destDetails?.handlingAgents || l.handlingAgents || [],
        costs: {
          ...l.costs,
          total: legCost,
          fuel: metrics.fuelBurn * 1.2,
          landing: airportCosts.landingFees,
          handling: handlingFee,
          departureHandling: departureHandlingFee,
          parking: airportCosts.parkingFees,
          overflight: overflightCharges
        }
      };
    });

    const totalTime = updatedLegs.reduce((acc, l) => acc + (l.flightTime || 0), 0);
    const totalFuel = updatedLegs.reduce((acc, l) => acc + (l.fuelBurn || 0), 0);
    const legsTotalCost = updatedLegs.reduce((acc, l) => acc + (l.costs?.total || 0), 0);
    const totalCost = legsTotalCost + (aiPlan?.initialHandlingCost || 0);
    
    const totalCostsObj = {
      fixed: 0,
      variable: totalCost,
      fees: 0,
      total: totalCost
    };

    const updateState = (legs: any[]) => {
      if (activeTab === 'planner' || (activeTab === 'dashboard' && aiPlan)) {
        setAiPlan(prev => prev ? { 
          ...prev, 
          legs: legs,
          totalCost: totalCost,
          fuelPlan: { 
            ...prev.fuelPlan, 
            trip: totalFuel,
            total: totalFuel * 1.15
          }
        } : null);
      } else if (activeTab === 'manual' && quoteOptions && selectedOption !== null) {
        setQuoteOptions(prev => {
          if (!prev) return null;
          const updatedOptions = { ...prev };
          updatedOptions[selectedOption] = { 
            ...updatedOptions[selectedOption], 
            legs: legs,
            flightTime: totalTime.toString(),
            totalCost: totalCost,
            totalCosts: totalCostsObj,
            fuelPlan: { ...updatedOptions[selectedOption].fuelPlan, total: totalFuel }
          };
          return updatedOptions;
        });
      } else if (activeTab === 'acmi' && acmiQuote) {
        setAcmiQuote(prev => prev ? { 
          ...prev, 
          legs: legs,
          flightTime: totalTime.toString(),
          totalCost: totalCost,
          totalCosts: totalCostsObj,
          fuelPlan: { ...prev.fuelPlan, total: totalFuel }
        } : null);
      }
    };

    updateState(updatedLegs);

    // Update formData to keep it in sync with map changes
    if (updatedLegs.length > 0) {
      const firstLeg = updatedLegs[0];
      const lastLeg = updatedLegs[updatedLegs.length - 1];
      const stopovers = updatedLegs.slice(0, -1).map(l => l.destination);
      
      setFormData(prev => ({
        ...prev,
        departure: firstLeg.departure,
        destination: lastLeg.destination,
        stopovers: stopovers
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        destination: '',
        stopovers: []
      }));
    }

    // If final update, fetch more details
    if (isFinal) {
      try {
        const finalLegs = [...updatedLegs];
        let changed = false;

        for (let i = 0; i < finalLegs.length; i++) {
          const leg = finalLegs[i];
          
          // Check departure for first leg if it's custom
          if (i === 0 && (leg.departure === 'Custom' || leg.departure.includes(','))) {
            const result = await searchAirports(`${leg.departureCoords.lat}, ${leg.departureCoords.lng}`);
            if (result.airports && result.airports.length > 0) {
              const airport = result.airports[0];
              const dist = calculateDistance(leg.departureCoords.lat, leg.departureCoords.lng, airport.lat, airport.lng);
              if (dist < 30) {
                finalLegs[i] = { 
                  ...finalLegs[i], 
                  departure: airport.icao || airport.iata,
                  departureCoords: { lat: airport.lat, lng: airport.lng }
                };
                changed = true;
              }
            }
          }

          // If destination is 'Custom' or coordinates, try to find nearest airport
          if (leg.destination === 'Custom' || leg.destination.includes(',')) {
            const result = await searchAirports(`${leg.destinationCoords.lat}, ${leg.destinationCoords.lng}`);
            if (result.airports && result.airports.length > 0) {
              const airport = result.airports[0];
              const dist = calculateDistance(leg.destinationCoords.lat, leg.destinationCoords.lng, airport.lat, airport.lng);
              if (dist < 30) {
                const airportCode = airport.icao || airport.iata;
                const airportCoords = { lat: airport.lat, lng: airport.lng };
                
                finalLegs[i] = { 
                  ...finalLegs[i], 
                  destination: airportCode,
                  destinationCoords: airportCoords
                };
                
                if (i + 1 < finalLegs.length) {
                  finalLegs[i+1] = { 
                    ...finalLegs[i+1], 
                    departure: airportCode,
                    departureCoords: airportCoords
                  };
                }
                changed = true;
              }
            }
          }

          // Fetch FIRs for the leg
          try {
            const firs = await getFIRDetails(leg.departure, leg.destination);
            if (firs && firs.length > 0) {
              finalLegs[i] = { ...finalLegs[i], firs };
              changed = true;
            }
          } catch (e) {
            console.error('FIR fetch error:', e);
          }
        }

        if (changed) {
          updateState(finalLegs);
        }
      } catch (error) {
        console.error('Final legs update error:', error);
      } finally {
        if (isFinal) setLoading(false);
      }
    }
  };

  const handleOptimizeFuelStops = async () => {
    const activeLegs = aiPlan?.legs || quoteOptions?.[selectedOption]?.legs || acmiQuote?.legs;
    const aircraft = aircraftList.find(a => a.type === (aiPlan?.suggestedAircraft || quoteOptions?.[selectedOption]?.type || acmiQuote?.type)) || aircraftList[0];
    
    if (!activeLegs || activeLegs.length === 0) return;

    setIsOptimizingFuel(true);
    try {
      const result = await getFuelStopSuggestions({
        legs: activeLegs,
        aircraft,
        missionType: formData.missionType,
        currentDate: new Date().toISOString()
      });

      if (result.suggestedLegs) {
        // We don't automatically apply them yet, we show them as suggestions first
        // Or if the user wants "Update the flight plan", we can apply them.
        // The request says "Update the flight plan with the suggested stops."
        // So I will apply them.
        
        // Map suggested legs to include coordinates and other details if missing
        const updatedLegs = [];
        for (const leg of result.suggestedLegs) {
          let depCoords = leg.departureCoords;
          let destCoords = leg.destinationCoords;

          if (!depCoords) {
            const res = await searchAirports(leg.departure);
            if (res.airports?.[0]) depCoords = { lat: res.airports[0].lat, lng: res.airports[0].lng };
          }
          if (!destCoords) {
            const res = await searchAirports(leg.destination);
            if (res.airports?.[0]) destCoords = { lat: res.airports[0].lat, lng: res.airports[0].lng };
          }

          updatedLegs.push({
            ...leg,
            departureCoords: depCoords || { lat: 0, lng: 0 },
            destinationCoords: destCoords || { lat: 0, lng: 0 }
          });
        }

        handleLegsUpdate(updatedLegs, true);
        
        // Also store suggestions for the UI to show reasoning
        if (result.reasoning) {
          // You could show a toast or update a state to show the reasoning
          console.log("Fuel Optimization Reasoning:", result.reasoning);
        }
      }
    } catch (error) {
      console.error("Fuel optimization error:", error);
    } finally {
      setIsOptimizingFuel(false);
    }
  };

  const handleAddFuelStop = async (icao: string) => {
    setLoading(true);
    try {
      const res = await searchAirports(icao);
      if (res.airports?.[0]) {
        const airport = res.airports[0];
        const activeLegs = aiPlan?.legs || quoteOptions?.[selectedOption]?.legs || acmiQuote?.legs;
        
        if (activeLegs && activeLegs.length > 0) {
          // Find the longest leg and split it with this stop
          let longestIdx = 0;
          let maxDist = 0;
          activeLegs.forEach((l: any, i: number) => {
            if (l.routingDistance > maxDist) {
              maxDist = l.routingDistance;
              longestIdx = i;
            }
          });

          const legToSplit = activeLegs[longestIdx];
          const newLeg1 = {
            departure: legToSplit.departure,
            destination: airport.icao || airport.iata,
            departureCoords: legToSplit.departureCoords,
            destinationCoords: { lat: airport.lat, lng: airport.lng }
          };
          const newLeg2 = {
            departure: airport.icao || airport.iata,
            destination: legToSplit.destination,
            departureCoords: { lat: airport.lat, lng: airport.lng },
            destinationCoords: legToSplit.destinationCoords
          };

          const newLegs = [...activeLegs];
          newLegs.splice(longestIdx, 1, newLeg1, newLeg2);
          handleLegsUpdate(newLegs, true);
        }
      }
    } catch (error) {
      console.error("Add fuel stop error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const result = await searchAirports(`${lat}, ${lng}`);
      let code = `${lat.toFixed(4)}, ${lng.toFixed(4)}`; // Default to coordinate
      let coords = { lat, lng };
      
      if (result.airports && result.airports.length > 0) {
        const airport = result.airports[0];
        const dist = calculateDistance(lat, lng, airport.lat, airport.lng);
        
        // Snap to airport if within 30nm
        if (dist < 30) {
          code = airport.icao || airport.iata || code;
          coords = { lat: airport.lat, lng: airport.lng };
        }
      }
      
      const activeLegs = aiPlan?.legs || quoteOptions?.[selectedOption]?.legs || acmiQuote?.legs;
      
      if (activeLegs && activeLegs.length > 0) {
        // Only append leg if map input is not set (i.e., user is generally interacting)
        if (activeMapInput === 'none') {
          const lastLeg = activeLegs[activeLegs.length - 1];
          const newLeg = {
            departure: lastLeg.destination,
            destination: code,
            departureCoords: lastLeg.destinationCoords,
            destinationCoords: coords,
          };
          handleLegsUpdate([...activeLegs, newLeg], true);
        } else if (activeMapInput === 'departure') {
          setFormData({ ...formData, departure: code });
          setActiveMapInput('destination'); // Auto-switch focus
        } else if (activeMapInput === 'destination') {
          setFormData({ ...formData, destination: code });
          setActiveMapInput('none');
        }
      } else {
        if (activeMapInput === 'departure') {
          setFormData({ ...formData, departure: code });
          setActiveMapInput('destination');
        } else if (activeMapInput === 'destination') {
          setFormData({ ...formData, destination: code });
          setActiveMapInput('none');
        } else {
          if (!formData.departure) {
            setFormData({ ...formData, departure: code });
            setActiveMapInput('destination');
          } else if (!formData.destination) {
            setFormData({ ...formData, destination: code });
            setActiveMapInput('none');
          } else {
            // If we have departure and destination but no active legs yet, create the first leg
            const departureResult = await searchAirports(formData.departure);
            const destResult = await searchAirports(formData.destination);
            
            if (departureResult.airports?.[0] && destResult.airports?.[0]) {
              const dep = departureResult.airports[0];
              const dest = destResult.airports[0];
              const initialLeg = {
                departure: formData.departure,
                destination: code,
                departureCoords: { lat: dep.lat, lng: dep.lng },
                destinationCoords: coords
              };
              const secondLeg = {
                departure: code,
                destination: formData.destination,
                departureCoords: coords,
                destinationCoords: { lat: dest.lat, lng: dest.lng }
              };
              handleLegsUpdate([initialLeg, secondLeg], true);
            } else {
              setFormData({ ...formData, stopovers: [...formData.stopovers, code] });
            }
          }
        }
      }
    } catch (error) {
      console.error('Map click search error:', error);
      const code = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      const coords = { lat, lng };

      const activeLegs = aiPlan?.legs || quoteOptions?.[selectedOption]?.legs || acmiQuote?.legs;
      if (activeLegs && activeLegs.length > 0) {
        const lastLeg = activeLegs[activeLegs.length - 1];
        const newLeg = {
          departure: lastLeg.destination,
          destination: code,
          departureCoords: lastLeg.destinationCoords,
          destinationCoords: coords,
        };
        handleLegsUpdate([...activeLegs, newLeg], true);
      } else {
        if (!formData.departure) {
          setFormData({ ...formData, departure: code });
        } else if (!formData.destination) {
          setFormData({ ...formData, destination: code });
        } else {
          setFormData({ ...formData, stopovers: [...formData.stopovers, code] });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Test connection to Firestore
        await getDocFromServer(doc(db, 'settings', 'connection-test'));
        // Seed operators if needed
        await seedOperators();
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firestore connection failed: The client is offline. Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchAircraft = async () => {
      try {
        // 1. Fetch Listings
        const listingSnapshot = await getDocs(collection(db, 'aircraft_listings'));
        const listings = listingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // 2. Fetch Master Data and Operators to enrich
        const masterSnapshot = await getDocs(collection(db, 'aircraft_master'));
        const masterMap = new Map(masterSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
        
        const operatorSnapshot = await getDocs(collection(db, 'operators'));
        const operatorMap = new Map(operatorSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));

        const enrichedData = listings.map((l: any) => {
          const master = (masterMap.get(l.aircraft_id) || {}) as any;
          const operator = (operatorMap.get(l.operator_id) || {}) as any;
          
          return {
            id: l.id,
            registration: l.tail_number,
            type: master.aircraft_type || 'Unknown',
            fuelBurnPerHour: master.fuel_burn_kg_per_hr || 2500,
            cruiseSpeed: master.cruise_speed_kts || 450,
            range: master.range_nm || 3000,
            maxPayload: master.payload_kg || master.maxPayload || 20000,
            maxPassengers: master.passenger_capacity || master.seats?.max || (typeof master.seats === 'number' ? master.seats : 0),
            hourlyRate: l.acmi_rate_per_hr || 0,
            acmiRate: l.acmi_rate_per_hr || 0,
            category: master.category || 'Commercial',
            operatorName: operator.name || 'Unknown Operator',
            baseAirport: l.location_airport || 'TBD',
            crewIncluded: l.crew_included,
            maintenanceStatus: l.maintenance_included ? 'Included' : 'Not Included',
            insuranceCoverage: l.insurance_included ? 'Included' : 'Not Included',
            image: master.image_url || `https://loremflickr.com/800/600/aircraft,jet,plane?lock=${master.aircraft_type?.length || 1}`,
            ...l
          };
        });

        setAircraftList(enrichedData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'aircraft_listings');
      }
    };
    fetchAircraft();
  }, []);

  const fetchAirportInfo = async (code: string) => {
    if (!code || code.length < 3 || airportDetails[code.toUpperCase()]) return;
    
    try {
      const result = await searchAirports(code);
      if (result.airports && result.airports.length > 0) {
        // Find the best match (exact ICAO or IATA)
        const match = result.airports.find((a: any) => 
          a.icao?.toUpperCase() === code.toUpperCase() || 
          a.iata?.toUpperCase() === code.toUpperCase()
        ) || result.airports[0];
        
        // Also fetch handling agents
        let handlingAgents = [];
        try {
          const agentsResult = await searchHandlingAgents(match.icao || match.iata || code, formData.aircraftPreference);
          handlingAgents = (agentsResult.agents || []).slice(0, 3);
        } catch (err) {
          console.error(`Error fetching handling agents for ${code}:`, err);
        }
        
        setAirportDetails(prev => ({ 
          ...prev, 
          [code.toUpperCase()]: { ...match, handlingAgents } 
        }));
      }
    } catch (error) {
      console.error(`Error fetching airport info for ${code}:`, error);
    }
  };

  useEffect(() => {
    if (activeTab === 'manual') {
      if (formData.departure.length >= 3) fetchAirportInfo(formData.departure);
      if (formData.destination.length >= 3) fetchAirportInfo(formData.destination);
      formData.stopovers.forEach(stop => {
        if (stop.length >= 3) fetchAirportInfo(stop);
      });
    }
  }, [formData.departure, formData.destination, formData.stopovers, activeTab]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in to submit a quote request.');
      return;
    }
    setLoading(true);
    try {
      const airports = [formData.departure, ...formData.stopovers.filter(s => s.trim()), formData.destination];
      const routeDetails = await getMultiLegRouteDetails(airports);
      setRouteData(routeDetails);
      
      const distance = routeDetails.totalDistance;
      const passengers = Number(formData.passengers) || 0;
      const cargoWeight = Number(formData.cargoWeight) || 0;

      // Pre-filter aircraft list to ensure capacity requirements are met
      const filteredAircraftList = aircraftList.filter(a => {
        // If mission is passenger, check seats. If cargo, check payload.
        if (formData.missionType === 'Cargo') {
          return a.maxPayload >= cargoWeight;
        } else {
          // For passenger missions, must have enough seats
          return a.maxPassengers >= passengers;
        }
      });

      const suggestions = await getSuggestedAircraft(passengers, cargoWeight, distance, filteredAircraftList, formData.departure, formData.missionType);
      
      const windImpact = await getWindImpact(formData.departure, formData.destination);
      setWindData(windImpact);

      const options: any = {};
      suggestions.options.forEach((suggestion: any, index: number) => {
        const key = ['cheapest', 'fastest', 'recommended'][index] || `option-${index}`;
        const type = suggestion.type;
        const aircraft = aircraftList.find(a => a.type === type);
        
        let totalFlightTime = 0;
        let totalFuelBurn = 0;
        let totalCost = routeDetails.totalCosts.total;

        if (aircraft) {
          const calculatedLegs = routeDetails.legs.map((leg: any) => {
            const metrics = calculateFlightMetrics(leg, aircraft, windImpact.windComponent);
            const destination = leg.destination;
            const agents = airportDetails[destination.toUpperCase()]?.handlingAgents || [];
            
            return {
              ...leg,
              flightTime: metrics.flightTime,
              fuelBurn: metrics.fuelBurn,
              handlingAgents: agents
            };
          });

          totalFlightTime = calculatedLegs.reduce((acc: number, l: any) => acc + l.flightTime, 0);
          totalFuelBurn = calculatedLegs.reduce((acc: number, l: any) => acc + l.fuelBurn, 0);

          const tripFuel = totalFuelBurn;
          const contingency = tripFuel * 0.05;
          const alternate = tripFuel * 0.1; // Assumed 10% for alternate
          const finalReserve = (aircraft.fuelBurnPerHour || 0) * 0.75; // 45 mins
          const totalFuelRequired = tripFuel + contingency + alternate + finalReserve;
          const stopsNeeded = distance > (aircraft.range || 0) * 0.85;

          if (aircraft.hourlyRate) {
            const aircraftCost = aircraft.hourlyRate * totalFlightTime;
            const maintenanceCost = (aircraft.maintenanceReserve || 0) * totalFlightTime;
            const crewCost = (aircraft.crewCostPerHour || 0) * totalFlightTime;
            
            const otherCosts = (routeDetails.totalCosts.landing || 0) + 
                              (routeDetails.totalCosts.handling || 0) + 
                              (routeDetails.totalCosts.parking || 0) + 
                              (routeDetails.totalCosts.overflight || 0) +
                              (routeDetails.totalCosts.navigation || 0) +
                              (routeDetails.totalCosts.positioning || 0) +
                              (routeDetails.totalCosts.repositioning || 0);
            totalCost = aircraftCost + maintenanceCost + crewCost + otherCosts;
          }

          options[key] = {
            type,
            legs: calculatedLegs,
            flightTime: totalFlightTime.toFixed(2),
            fuelBurn: totalFuelBurn.toFixed(2),
            fuelPlan: {
              trip: Math.round(totalFuelBurn),
              contingency: Math.round(contingency),
              alternate: Math.round(alternate),
              reserve: Math.round(finalReserve),
              total: Math.round(totalFuelRequired),
              stopsNeeded,
              suggestedStops: stopsNeeded ? ['Tech Stop Required (Calculated based on range)'] : []
            },
            aircraftRange: aircraft.range || 0,
            fuelBurnPerHour: aircraft.fuelBurnPerHour || 0,
            totalCost,
            totalCosts: {
              ...routeDetails.totalCosts,
              total: totalCost
            },
            permits: routeDetails.legs.flatMap((l: any) => l.permits || []),
            restrictedAreas: routeDetails.legs.flatMap((l: any) => l.restrictedAreas || []),
            notes: suggestion.reasoning,
            breakdown: {
              fuel: routeDetails.totalCosts.fuel,
              landing: routeDetails.totalCosts.landing,
              handling: routeDetails.totalCosts.handling,
              parking: routeDetails.totalCosts.parking,
              crew: (aircraft.crewCostPerHour || 0) * totalFlightTime,
              maintenance: (aircraft.maintenanceReserve || 0) * totalFlightTime,
              overflight: routeDetails.totalCosts.overflight,
              navigation: routeDetails.totalCosts.navigation,
              brokerMargin: (totalCost * (Number(formData.brokerMargin) || 0) / 100).toFixed(2),
              operatorMargin: (totalCost * (Number(formData.operatorMargin) || 0) / 100).toFixed(2),
              finalTotal: (totalCost * (1 + ((Number(formData.brokerMargin) || 0) + (Number(formData.operatorMargin) || 0)) / 100)).toFixed(2)
            }
          };
        } else {
          options[key] = {
            type,
            legs: routeDetails.legs.map((l: any) => ({ ...l, flightTime: 0, fuelBurn: 0 })),
            flightTime: '0.00',
            fuelBurn: '0.00',
            totalCost,
            notes: suggestion.reasoning,
            breakdown: {
              fuel: routeDetails.totalCosts.fuel,
              landingFees: routeDetails.totalCosts.landingFees,
              handling: routeDetails.totalCosts.handling,
              parking: routeDetails.totalCosts.parking,
              crew: routeDetails.totalCosts.crew,
              overflight: routeDetails.totalCosts.overflight,
              brokerMargin: (totalCost * (Number(formData.brokerMargin) || 0) / 100).toFixed(2),
              operatorMargin: (totalCost * (Number(formData.operatorMargin) || 0) / 100).toFixed(2),
              finalTotal: (totalCost * (1 + ((Number(formData.brokerMargin) || 0) + (Number(formData.operatorMargin) || 0)) / 100)).toFixed(2)
            }
          };
        }
      });

      setQuoteOptions(options);
      setSelectedOption('recommended');

      // Save to Firebase
      try {
        await addDoc(collection(db, 'quotes'), {
          ...formData,
          userId: user.uid,
          routeDetails,
          quoteOptions: options,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'quotes');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to submit quote request.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLastCoordinate = () => {
    const activeLegs = aiPlan?.legs || quoteOptions?.[selectedOption]?.legs || acmiQuote?.legs;
    
    if (activeLegs && activeLegs.length > 0) {
      const newLegs = activeLegs.slice(0, -1);
      handleLegsUpdate(newLegs);
    } else {
      if (formData.stopovers.length > 0) {
        setFormData({ ...formData, stopovers: formData.stopovers.slice(0, -1) });
      } else if (formData.destination) {
        setFormData({ ...formData, destination: '' });
      } else if (formData.departure) {
        setFormData({ ...formData, departure: '' });
      }
    }
  };

  const handleOptimizeRoute = async () => {
    if (!routeData || !routeData.firs) return;
    setLoading(true);
    try {
      const optimized = await getOptimizedRoute(formData.departure, formData.destination, routeData.firs);
      setOptimizedRoute(optimized);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to optimize route.');
    } finally {
      setLoading(false);
    }
  };

  const handleACMIQuote = async (aircraft: any, missionData?: any) => {
    const finalMissionData = missionData || {
      departure: formData.departure,
      destination: formData.destination,
      alternate: formData.alternate,
      missionType: formData.missionType,
      dateTime: formData.dateTime,
      returnDate: formData.returnDate,
      payload: formData.missionType === 'Cargo' ? (Number(formData.cargoWeight) || 0) : (Number(formData.passengers) || 0),
      specialRequirements: formData.specialRequirements
    };

    if (!finalMissionData.departure || !finalMissionData.destination) {
      alert('Please enter departure and destination.');
      return;
    }

    // Set active mission and aircraft for the Pricing Engine
    setActiveMission({
      departure: finalMissionData.departure,
      destination: finalMissionData.destination,
      date: finalMissionData.dateTime || finalMissionData.date,
      passengers: Number(finalMissionData.passengers) || 0,
      payload: Number(finalMissionData.payload) || Number(finalMissionData.cargoWeight) || 0,
      missionType: finalMissionData.missionType,
      leaseTermMonths: finalMissionData.leaseTermMonths || 1,
      monthlyGuaranteedHours: finalMissionData.monthlyGuaranteedHours || 0
    });
    setActiveAircraftId(aircraft.id);

    // Switch to Pricing tab to show the engine in action
    setActiveTab('pricing');
    
    // We can still run the AI quote in the background or just let the engine handle it
    // For now, let's just switch to the engine as it's more "interactive"
  };

  const handleSaveQuote = async () => {
    if (!acmiQuote || !user) return;
    
    setIsSavingQuote(true);
    try {
      await addDoc(collection(db, 'quote_history'), {
        user_id: user.uid,
        quote_data: acmiQuote,
        created_at: new Date().toISOString(),
        type: 'ACMI',
        status: 'Saved'
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'quote_history');
    } finally {
      setIsSavingQuote(false);
    }
  };

  const handleSelectAgent = (legIdx: number | 'initial', agent: any, type: 'departure' | 'destination' = 'destination') => {
    if (activeTab === 'planner' && aiPlan) {
      const updatedPlan = { ...aiPlan };
      if (legIdx === 'initial') {
        updatedPlan.selectedInitialAgent = agent;
        updatedPlan.initialHandlingCost = agent.baseFee;
      } else {
        const leg = updatedPlan.legs[legIdx as number];
        if (type === 'departure') {
          leg.selectedDepartureHandlingAgent = agent;
          if (leg.costs) leg.costs.departureHandling = agent.baseFee;
        } else {
          leg.selectedHandlingAgent = agent;
          if (leg.costs) leg.costs.handling = agent.baseFee;
        }
        
        if (leg.costs) {
          leg.costs.total = Object.entries(leg.costs)
            .filter(([k]) => k !== 'total')
            .reduce((acc, [_, v]) => acc + (Number(v) || 0), 0);
        }
      }
      const legsTotal = updatedPlan.legs.reduce((acc: number, l: any) => acc + (l.costs?.total || 0), 0);
      updatedPlan.totalCost = legsTotal + (updatedPlan.initialHandlingCost || 0);
      setAiPlan(updatedPlan);
    } else if (activeTab === 'manual' && quoteOptions && selectedOption) {
      const updatedOptions = { ...quoteOptions };
      const option = updatedOptions[selectedOption];
      if (legIdx === 'initial') {
        option.selectedInitialAgent = agent;
        option.initialHandlingCost = agent.baseFee;
      } else {
        const leg = option.legs[legIdx as number];
        if (type === 'departure') {
          leg.selectedDepartureHandlingAgent = agent;
          if (leg.costs) leg.costs.departureHandling = agent.baseFee;
        } else {
          leg.selectedHandlingAgent = agent;
          if (leg.costs) leg.costs.handling = agent.baseFee;
        }

        if (leg.costs) {
          leg.costs.total = Object.entries(leg.costs)
            .filter(([k]) => k !== 'total')
            .reduce((acc, [_, v]) => acc + (Number(v) || 0), 0);
        }
      }
      const legsTotal = option.legs.reduce((acc: number, l: any) => acc + (l.costs?.total || 0), 0);
      option.totalCost = legsTotal + (option.initialHandlingCost || 0);
      if (option.totalCosts) option.totalCosts.total = option.totalCost;
      setQuoteOptions(updatedOptions);
    } else if (activeTab === 'acmi' && acmiQuote) {
      const updatedQuote = { ...acmiQuote };
      if (legIdx === 'initial') {
        updatedQuote.selectedInitialAgent = agent;
        updatedQuote.initialHandlingCost = agent.baseFee;
      } else {
        const leg = updatedQuote.legs[legIdx as number];
        if (type === 'departure') {
          leg.selectedDepartureHandlingAgent = agent;
          if (leg.costs) leg.costs.departureHandling = agent.baseFee;
        } else {
          leg.selectedHandlingAgent = agent;
          if (leg.costs) leg.costs.handling = agent.baseFee;
        }

        if (leg.costs) {
          leg.costs.total = Object.entries(leg.costs)
            .filter(([k]) => k !== 'total')
            .reduce((acc, [_, v]) => acc + (Number(v) || 0), 0);
        }
      }
      const legsTotal = updatedQuote.legs.reduce((acc: number, l: any) => acc + (l.costs?.total || 0), 0);
      updatedQuote.totalCost = legsTotal + (updatedQuote.initialHandlingCost || 0);
      if (updatedQuote.totalCosts) updatedQuote.totalCosts.total = updatedQuote.totalCost;
      setAcmiQuote(updatedQuote);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <QuotaMonitor />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={user} 
          isDarkMode={isDarkMode} 
          setIsDarkMode={setIsDarkMode} 
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Breadcrumbs 
              activeTab={activeTab} 
              onNavigate={setActiveTab}
              subPath={
                activeTab === 'acmi' && acmiQuote ? 'Quote Details' :
                activeTab === 'planner' && aiPlan ? 'Active Plan' :
                activeTab === 'manual' && quoteOptions ? 'Quote Results' :
                activeTab === 'ai-intelligence' ? (
                  aiLayerDefaultTab === 'prediction' ? 'Price Prediction' :
                  aiLayerDefaultTab === 'optimization' ? 'Route Optimization' :
                  aiLayerDefaultTab === 'risk' ? 'Risk Assessment' :
                  aiLayerDefaultTab === 'emptylegs' ? 'Empty Legs' :
                  aiLayerDefaultTab === 'negotiation' ? 'Negotiation Assistant' :
                  undefined
                ) :
                undefined
              }
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' ? (
            <div className="max-w-7xl mx-auto">
              <DashboardOverview />
            </div>
          ) : activeTab === 'multileg-planner' ? (
            <div className="max-w-7xl mx-auto">
              <MultiLegFlightPlanner />
            </div>
          ) : activeTab === 'booking-flow' ? (
            <div className="w-full">
              <CharterBookingFlow aircraftList={aircraftList} />
            </div>
          ) : activeTab === 'ai-intelligence' ? (
            <div className="max-w-7xl mx-auto">
              <AILayer 
                missionData={{
                  departure: formData.departure,
                  destination: formData.destination,
                  passengers: Number(formData.passengers) || 0,
                  payload: Number(formData.cargoWeight) || 0,
                  missionType: formData.missionType,
                  dateTime: formData.dateTime
                }}
                selectedAircraft={acmiQuote}
                currentPrice={acmiQuote?.totalCost}
                defaultTab={aiLayerDefaultTab}
                onRouteOptimized={setOptimizedRoute}
              />
            </div>
          ) : activeTab === 'aeronautical-charts' ? (
            <div className="max-w-7xl mx-auto">
              <AeronauticalCharts />
            </div>
          ) : activeTab === 'reports' ? (
            <div className="max-w-7xl mx-auto">
              <ReportsAnalytics />
            </div>
          ) : activeTab === 'feasibility' ? (
            <div className="max-w-7xl mx-auto">
              <FeasibilityReport />
            </div>
          ) : activeTab === 'aoc-database' ? (
            <div className="max-w-7xl mx-auto">
              <AOCDatabase />
            </div>
          ) : activeTab === 'aoc-scraper' ? (
            <div className="max-w-7xl mx-auto">
              <AOCScraperEngine />
            </div>
          ) : activeTab === 'aoc-sources' ? (
            <div className="max-w-7xl mx-auto">
              <AOCSourceDirectory />
            </div>
          ) : activeTab === 'advanced-quote' ? (
            <div className="max-w-7xl mx-auto">
              <AdvancedQuoteEngine />
            </div>
          ) : activeTab === 'acmi-pricing' ? (
            <div className="max-w-7xl mx-auto">
              <ACMIQuoteEngine />
            </div>
          ) : activeTab === 'acmi' ? (
            <div className="max-w-7xl mx-auto">
              {acmiQuote ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
                  {/* Left Column: Quote Details & Actions */}
                  <div className="lg:col-span-5 space-y-6">
                    <button 
                      onClick={() => setAcmiQuote(null)}
                      className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-4 hover:underline"
                    >
                      <ChevronLeft size={16} /> Back to Marketplace
                    </button>
                    
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <Plane className="text-indigo-600 dark:text-indigo-400" size={20} />
                          <h2 className="font-bold text-gray-800 dark:text-white uppercase tracking-tight">✈️ ACMI QUOTATION</h2>
                        </div>
                        <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">
                          REF: {acmiQuote.id}
                        </span>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Route</p>
                          <p className="text-sm font-black text-gray-900 dark:text-white">{formData.departure} → {formData.destination}</p>
                        </div>

                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Operator</p>
                          <p className="text-lg font-black text-gray-900 dark:text-white">{acmiQuote.operator || 'Estimated / Placeholder'}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Availability</p>
                            <p className="text-sm font-bold text-gray-800 dark:text-white">{acmiQuote.availability}</p>
                          </div>
                          <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Aircraft</p>
                            <p className="text-sm font-bold text-gray-800 dark:text-white">{acmiQuote.type}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">AI Notes & Assumptions</p>
                          <ul className="space-y-1">
                            {acmiQuote.notes.map((note: string, i: number) => (
                              <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-2">
                                <span className="text-indigo-500">•</span> {note}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <button 
                          onClick={() => {
                            setAiLayerDefaultTab('negotiation');
                            setActiveTab('ai-intelligence');
                          }}
                          className="w-full bg-amber-500 text-white p-4 rounded-2xl font-bold hover:bg-amber-600 transition shadow-lg shadow-amber-200 dark:shadow-none flex items-center justify-center gap-2"
                        >
                          <MessageSquare size={20} />
                          Negotiate with AI Assistant
                        </button>

                        <button 
                          onClick={() => generateQuotePDF(acmiQuote, 'ACMI')}
                          className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
                        >
                          <FileText size={20} />
                          Download Full PDF Quote
                        </button>

                        <button 
                          onClick={handleSaveQuote}
                          disabled={isSavingQuote || saveSuccess}
                          className={`w-full p-4 rounded-2xl font-bold transition flex items-center justify-center gap-2 ${
                            saveSuccess 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {isSavingQuote ? (
                            <Loader2 className="animate-spin" size={20} />
                          ) : saveSuccess ? (
                            <ShieldCheck size={20} />
                          ) : (
                            <History size={20} />
                          )}
                          {saveSuccess ? 'Quote Saved Successfully' : 'Save Quote to History'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Mission Summary & Costing */}
                  <div className="lg:col-span-7 space-y-8">
                    <MissionSummary 
                      departure={formData.departure}
                      destination={formData.destination}
                      aircraft={acmiQuote.type}
                      totalDistance={acmiQuote.legs.reduce((acc: number, l: any) => acc + (l.routingDistance || l.distance), 0)}
                      gcDistance={acmiQuote.legs.reduce((acc: number, l: any) => acc + (l.gcDistance || l.distance), 0)}
                      routingDistance={acmiQuote.legs.reduce((acc: number, l: any) => acc + (l.routingDistance || l.distance), 0)}
                      totalTime={parseFloat(acmiQuote.flightTime)}
                      totalCost={acmiQuote.totalCost}
                      totalFuel={acmiQuote.fuelPlan.total}
                      legsCount={acmiQuote.legs.length}
                      operator={acmiQuote.operator}
                      availability={acmiQuote.availability}
                      missionSummary={acmiQuote.missionSummary}
                      suggestedAlternative={acmiQuote.suggestedAlternative}
                      highCostRouteAlert={acmiQuote.highCostRouteAlert}
                      legs={acmiQuote.legs}
                      passengers={Number(formData.passengers)}
                      cargoWeight={Number(formData.cargoWeight)}
                    />

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-[400px]">
                      <FlightMap 
                        legs={acmiQuote.legs}
                        aircraftType={acmiQuote.type}
                        previewAirports={previewAirports}
                        onMapClick={handleMapClick}
                        onRemoveLastCoordinate={handleRemoveLastCoordinate}
                        safetyData={acmiQuote.safety}
                        hoveredLegIndex={hoveredLegIndex}
                        onLegsChange={handleLegsUpdate}
                        isDarkMode={isDarkMode}
                        isLoading={loading || isOptimizingFuel}
                      />
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                      <CostingEngine 
                        legs={acmiQuote.legs}
                        totalCosts={acmiQuote.totalCosts}
                        onSelectAgent={handleSelectAgent}
                        onLegCostChange={(idx, updatedCosts) => {
                          const newLegs = [...acmiQuote.legs];
                          newLegs[idx] = { ...newLegs[idx], costs: updatedCosts };
                          
                          const totalCosts = newLegs.reduce((acc, leg) => {
                            Object.keys(leg.costs).forEach(key => {
                              if (key === 'total') return;
                              acc[key] = (acc[key] || 0) + (Number((leg.costs as any)[key]) || 0);
                            });
                            acc.total = (acc.total || 0) + (Number(leg.costs.total) || 0);
                            return acc;
                          }, { total: 0 } as any);

                          setAcmiQuote({
                            ...acmiQuote,
                            legs: newLegs,
                            totalCost: totalCosts.total,
                            totalCosts: totalCosts
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <ACMIMarketplace 
                  onGenerateQuote={handleACMIQuote} 
                  setActiveTab={setActiveTab}
                  initialData={{
                    departure: formData.departure,
                    destination: formData.destination,
                    date: formData.dateTime,
                    passengers: Number(formData.passengers) || 0,
                    payload: Number(formData.cargoWeight) || 0,
                    missionType: formData.missionType
                  }}
                />
              )}
            </div>
          ) : activeTab === 'leads' ? (
            <div className="max-w-7xl mx-auto">
              <LeadsManagement />
            </div>
          ) : activeTab === 'billing' ? (
            <div className="max-w-7xl mx-auto">
              <BillingDashboard />
            </div>
          ) : activeTab === 'airports' ? (
            <div className="max-w-6xl mx-auto">
              <AirportDatabase />
            </div>
          ) : activeTab === 'firs' ? (
            <div className="max-w-6xl mx-auto">
              <FIRDatabase />
            </div>
          ) : activeTab === 'aircraft' ? (
            <div className="max-w-6xl mx-auto">
              <AircraftDatabase 
                onViewAvailability={(id) => {
                  setSelectedAircraftId(id);
                  setActiveTab('availability');
                }}
              />
            </div>
          ) : activeTab === 'availability' ? (
            <div className="max-w-6xl mx-auto">
              <AvailabilityDatabase 
                initialAircraftId={selectedAircraftId || undefined}
                onClearFilter={() => setSelectedAircraftId(null)}
              />
            </div>
          ) : activeTab === 'pricing-rules' ? (
            <div className="max-w-6xl mx-auto">
              <PricingRuleDatabase />
            </div>
          ) : activeTab === 'routes' ? (
            <div className="max-w-6xl mx-auto">
              <RouteDatabase />
            </div>
          ) : activeTab === 'scraper' ? (
            <div className="max-w-7xl mx-auto">
              <MarketScraper />
            </div>
          ) : activeTab === 'intelligence' ? (
            <div className="max-w-7xl mx-auto">
              <MarketIntelligence />
            </div>
          ) : activeTab === 'authority-intelligence' ? (
            <div className="max-w-7xl mx-auto">
              <AuthorityIntelligence />
            </div>
          ) : activeTab === 'availability-intelligence' ? (
            <div className="max-w-7xl mx-auto">
              <AvailabilityIntelligence />
            </div>
          ) : activeTab === 'tracking' ? (
            <div className="max-w-7xl mx-auto">
              <LiveFleetTracking />
            </div>
          ) : activeTab === 'automation' ? (
            <div className="max-w-7xl mx-auto">
              <DataAutomation />
            </div>
          ) : activeTab === 'operators' ? (
            <div className="max-w-6xl mx-auto">
              <OperatorDatabase />
            </div>
          ) : activeTab === 'schedules' ? (
            <div className="max-w-6xl mx-auto">
              <ScheduleBuilder />
            </div>
          ) : activeTab === 'handling' ? (
            <div className="max-w-6xl mx-auto">
              <HandlingAgentDatabase />
            </div>
          ) : activeTab === 'emptylegs' ? (
            <div className="max-w-6xl mx-auto">
              <EmptyLegs />
            </div>
          ) : activeTab === 'pricing' ? (
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col gap-12">
                <PricingEngine 
                  aircraftList={aircraftList} 
                  initialParams={activeMission}
                  initialAircraftId={activeAircraftId || undefined}
                />
                <div className="border-t border-gray-100 dark:border-gray-800 pt-12">
                  <CostingSettings />
                </div>
              </div>
            </div>
          ) : activeTab === 'optimizer' ? (
            <div className="max-w-6xl mx-auto">
              <RouteOptimizer 
                departure={formData.departure}
                destination={formData.destination}
                stops={formData.stopovers.join(', ')}
                dateTime={formData.dateTime}
                aircraftType={formData.aircraftPreference}
                passengers={Number(formData.passengers) || 0}
                payload={Number(formData.cargoWeight) || 0}
              />
            </div>
          ) : activeTab === 'database' ? (
            <div className="max-w-7xl mx-auto">
              <ACMIDatabase />
            </div>
          ) : activeTab === 'quotes' ? (
            <div className="max-w-6xl mx-auto">
              <CharterQuoteEngine aircraftList={aircraftList} isDarkMode={isDarkMode} />
            </div>
          ) : activeTab === 'pitch-deck' ? (
            <div className="max-w-7xl mx-auto">
              <PitchDeck />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
              {/* Left Column: Input/Controls */}
              <div className={`${isLeftColumnCollapsed ? 'hidden' : 'lg:col-span-5'} space-y-8 transition-all duration-300`}>
              {activeTab === 'planner' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="text-indigo-600 dark:text-indigo-400" size={20} />
                    <h2 className="font-bold text-gray-800 dark:text-white">AI Flight Planner</h2>
                  </div>
                  <AIPlanner 
                    aircraftList={aircraftList} 
                    plan={aiPlan}
                    onPlanChange={(plan) => setAiPlan(plan)}
                    onHoverLeg={setHoveredLegIndex}
                    formData={formData}
                    onFormDataChange={setFormData}
                    setActiveMapInput={setActiveMapInput}
                    currentQuoteLegs={quoteOptions?.[selectedOption]?.legs}
                  />
                </div>
              )}

              {activeTab === 'manual' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-6">
                    <LayoutDashboard className="text-indigo-600 dark:text-indigo-400" size={20} />
                    <h2 className="font-bold text-gray-800 dark:text-white">Manual Quote Engine</h2>
                  </div>
                  {user ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Mission Type</label>
                          <select 
                            value={formData.missionType}
                            className="w-full p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                            onChange={(e) => setFormData({...formData, missionType: e.target.value as any})}
                          >
                            <option value="Passenger">Passenger</option>
                            <option value="Cargo">Cargo</option>
                            <option value="VIP">VIP</option>
                            <option value="ACMI Lease">ACMI Lease</option>
                          </select>
                        </div>
                        <div className="relative">
                          <Fuel className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
                          <input 
                            type="number" 
                            placeholder="Fuel Price ($/gal)" 
                            value={formData.fuelPrice}
                            className="w-full pl-10 p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                            onChange={(e) => setFormData({...formData, fuelPrice: Number(e.target.value)})}
                          />
                        </div>
                        <div className="relative">
                          <MapPin className={`absolute left-3 top-3 ${activeMapInput === 'departure' ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500'}`} size={20} />
                          <input 
                            type="text" 
                            placeholder="Departure (IATA/ICAO)" 
                            value={formData.departure}
                            onFocus={() => setActiveMapInput('departure')}
                            className={`w-full pl-10 p-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-all ${
                              activeMapInput === 'departure' 
                                ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                                : 'border-gray-200 dark:border-gray-600 focus:border-indigo-500'
                            }`}
                            onChange={(e) => setFormData({...formData, departure: e.target.value.toUpperCase()})}
                          />
                          {airportDetails[formData.departure] && (
                            <div className="mt-1 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                              <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                {airportDetails[formData.departure].name} • RWY: {airportDetails[formData.departure].runwayLength}ft • ELEV: {airportDetails[formData.departure].elevation}ft
                              </p>
                              <p className="text-[9px] text-gray-500 dark:text-gray-400">
                                Lat: {airportDetails[formData.departure].lat.toFixed(4)} Lng: {airportDetails[formData.departure].lng.toFixed(4)} • ATIS: {airportDetails[formData.departure].atisFrequency}
                              </p>
                            </div>
                          )}
                        </div>

                        {formData.stopovers.map((stop, idx) => (
                          <div key={idx} className="relative flex flex-col gap-1">
                            <div className="relative flex gap-2">
                              <div className="relative flex-1">
                                <MapPin className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
                                <input 
                                  type="text" 
                                  placeholder={`Stopover ${idx + 1}`} 
                                  value={stop}
                                  className="w-full pl-10 p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                                  onChange={(e) => {
                                    const newStopovers = [...formData.stopovers];
                                    newStopovers[idx] = e.target.value.toUpperCase();
                                    setFormData({...formData, stopovers: newStopovers});
                                  }}
                                />
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  const newStopovers = formData.stopovers.filter((_, i) => i !== idx);
                                  setFormData({...formData, stopovers: newStopovers});
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                            {airportDetails[stop] && (
                              <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                  {airportDetails[stop].name} • RWY: {airportDetails[stop].runwayLength}ft • ELEV: {airportDetails[stop].elevation}ft
                                </p>
                                <p className="text-[9px] text-gray-500 dark:text-gray-400">
                                  Lat: {airportDetails[stop].lat.toFixed(4)} Lng: {airportDetails[stop].lng.toFixed(4)} • ATIS: {airportDetails[stop].atisFrequency}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}

                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, stopovers: [...formData.stopovers, '']})}
                          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:text-indigo-700 dark:hover:text-indigo-300 ml-1"
                        >
                          <Plus size={14} /> Add Stopover
                        </button>

                        <div className="relative">
                          <MapPin className={`absolute left-3 top-3 ${activeMapInput === 'destination' ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500'}`} size={20} />
                          <input 
                            type="text" 
                            placeholder="Destination (IATA/ICAO)" 
                            value={formData.destination}
                            onFocus={() => setActiveMapInput('destination')}
                            className={`w-full pl-10 p-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-all ${
                              activeMapInput === 'destination' 
                                ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                                : 'border-gray-200 dark:border-gray-600 focus:border-indigo-500'
                            }`}
                            onChange={(e) => setFormData({...formData, destination: e.target.value.toUpperCase()})}
                          />
                          {airportDetails[formData.destination] && (
                            <div className="mt-1 space-y-2">
                              <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                  {airportDetails[formData.destination].name} • RWY: {airportDetails[formData.destination].runwayLength}ft • ELEV: {airportDetails[formData.destination].elevation}ft
                                </p>
                                <p className="text-[9px] text-gray-500 dark:text-gray-400">
                                  Lat: {airportDetails[formData.destination].lat.toFixed(4)} Lng: {airportDetails[formData.destination].lng.toFixed(4)} • ATIS: {airportDetails[formData.destination].atisFrequency}
                                </p>
                              </div>
                              
                              {/* Suggested Handling Agents */}
                              {airportDetails[formData.destination].handlingAgents && airportDetails[formData.destination].handlingAgents.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Suggested Handling Agents</p>
                                  <div className="grid grid-cols-1 gap-2">
                                    {airportDetails[formData.destination].handlingAgents.slice(0, 2).map((agent: any, i: number) => (
                                      <div key={i} className="bg-amber-50/50 dark:bg-amber-900/10 p-2.5 rounded-xl border border-amber-100/50 dark:border-amber-800/30 flex items-center justify-between">
                                        <div className="min-w-0">
                                          <p className="text-[10px] font-black text-amber-900 dark:text-amber-200 uppercase truncate">{agent.companyName}</p>
                                          <p className="text-[9px] text-gray-500 truncate">{agent.email}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <p className="text-[10px] font-black text-emerald-600">${agent.baseFee?.toLocaleString() || 0}</p>
                                          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Base Fee</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
                        <input 
                          type="datetime-local" 
                          value={formData.dateTime}
                          className="w-full pl-10 p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                          onChange={(e) => setFormData({...formData, dateTime: e.target.value})}
                        />
                      </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="relative">
                            <Users className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
                            <input 
                              type="number" 
                              placeholder="Passengers" 
                              value={formData.passengers}
                              className="w-full pl-10 p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                              onChange={(e) => setFormData({...formData, passengers: e.target.value === '' ? '' : Number(e.target.value)})}
                            />
                          </div>
                          <div className="relative">
                            <Weight className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
                            <input 
                              type="number" 
                              placeholder="Cargo (kg)" 
                              value={formData.cargoWeight}
                              className="w-full pl-10 p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                              onChange={(e) => setFormData({...formData, cargoWeight: e.target.value === '' ? '' : Number(e.target.value)})}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Broker Margin (%)</label>
                            <input 
                              type="number" 
                              min="10"
                              max="30"
                              value={formData.brokerMargin}
                              className="w-full p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                              onChange={(e) => setFormData({...formData, brokerMargin: e.target.value === '' ? '' : Number(e.target.value)})}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Operator Margin (%)</label>
                            <input 
                              type="number" 
                              value={formData.operatorMargin}
                              className="w-full p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                              onChange={(e) => setFormData({...formData, operatorMargin: e.target.value === '' ? '' : Number(e.target.value)})}
                            />
                          </div>
                        </div>
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white p-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : 'Get Quote'}
                      </button>
                    </form>
                  ) : (
                    <p className="text-center text-gray-600 dark:text-gray-400">Please sign in to request a quote.</p>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-6">
                    <History className="text-indigo-600 dark:text-indigo-400" size={20} />
                    <h2 className="font-bold text-gray-800 dark:text-white">Flight History</h2>
                  </div>
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                    <History size={48} className="mb-4 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-xs">No History Found</p>
                    <p className="text-xs mt-2 text-center max-w-[200px]">Your past flight plans and quotes will appear here.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Visualization/Results */}
            <div className={`${isLeftColumnCollapsed ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-8 transition-all duration-300 relative`}>
              {/* Toggle Button */}
              <button 
                onClick={() => setIsLeftColumnCollapsed(!isLeftColumnCollapsed)}
                className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-md z-10 transition-all"
                title={isLeftColumnCollapsed ? "Show Controls" : "Hide Controls"}
              >
                {isLeftColumnCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>

              {/* Mission Summary (AI Mode) */}
              {activeTab === 'planner' && aiPlan && (
                <MissionSummary 
                  departure={aiPlan.legs[0].departure}
                  destination={aiPlan.legs[aiPlan.legs.length - 1].destination}
                  aircraft={aiPlan.suggestedAircraft}
                  totalDistance={aiPlan.legs.reduce((acc: number, l: any) => acc + (l.routingDistance || l.distance), 0)}
                  gcDistance={aiPlan.legs.reduce((acc: number, l: any) => acc + (l.gcDistance || l.distance), 0)}
                  routingDistance={aiPlan.legs.reduce((acc: number, l: any) => acc + (l.routingDistance || l.distance), 0)}
                  totalTime={aiPlan.legs.reduce((acc: number, l: any) => acc + l.flightTime, 0)}
                  totalCost={aiPlan.legs.reduce((acc: number, l: any) => acc + l.costs.total, 0)}
                  totalFuel={aiPlan.fuelPlan.total}
                  legsCount={aiPlan.legs.length}
                  optimizedRoute={optimizedRoute}
                  passengers={Number(formData.passengers)}
                  cargoWeight={Number(formData.cargoWeight)}
                />
              )}

              {/* Mission Summary (Manual Mode) */}
              {activeTab === 'manual' && quoteOptions && (
                <MissionSummary 
                  departure={formData.departure}
                  destination={formData.destination}
                  aircraft={quoteOptions[selectedOption].type}
                  totalDistance={quoteOptions[selectedOption].legs.reduce((acc: number, l: any) => acc + (l.routingDistance || l.distance), 0)}
                  gcDistance={quoteOptions[selectedOption].legs.reduce((acc: number, l: any) => acc + (l.gcDistance || l.distance), 0)}
                  routingDistance={quoteOptions[selectedOption].legs.reduce((acc: number, l: any) => acc + (l.routingDistance || l.distance), 0)}
                  totalTime={parseFloat(quoteOptions[selectedOption].flightTime)}
                  totalCost={quoteOptions[selectedOption].totalCost}
                  totalFuel={quoteOptions[selectedOption].fuelPlan.total}
                  legsCount={quoteOptions[selectedOption].legs.length}
                  optimizedRoute={optimizedRoute}
                  passengers={Number(formData.passengers)}
                  cargoWeight={Number(formData.cargoWeight)}
                />
              )}

              {/* Map Section */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-[650px] transition-all duration-500">
                <FlightMap 
                  legs={aiPlan?.legs || quoteOptions?.[selectedOption]?.legs || acmiQuote?.legs}
                  aircraftType={aiPlan?.suggestedAircraft || quoteOptions?.[selectedOption]?.type || acmiQuote?.type}
                  passengerCount={Number(formData.passengers) || 0}
                  missionType={formData.missionType}
                  departure={formData.departure}
                  destination={formData.destination}
                  previewAirports={previewAirports}
                  onMapClick={handleMapClick}
                  onRemoveLastCoordinate={handleRemoveLastCoordinate}
                  optimizedRoute={optimizedRoute}
                  safetyData={aiPlan?.safety}
                  hoveredLegIndex={hoveredLegIndex}
                  onLegsChange={handleLegsUpdate}
                  isDarkMode={isDarkMode}
                  isLoading={loading || isOptimizingFuel}
                />
              </div>

              {/* Quote Options (Manual Mode) */}
              {activeTab === 'manual' && quoteOptions && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white">Quote Summary</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Review your options and download the official quote.</p>
                    </div>
                    <button 
                      onClick={() => generateQuotePDF(quoteOptions[selectedOption], 'Charter')}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2"
                    >
                      <FileText size={20} />
                      Download PDF Quote
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {['cheapest', 'fastest', 'recommended'].map((key) => (
                      <button
                        key={key}
                        onClick={() => setSelectedOption(key)}
                        className={`p-3 rounded-xl border-2 transition-all text-center ${
                          selectedOption === key 
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400' 
                            : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="text-xs uppercase font-bold tracking-wider mb-1">{key}</div>
                        <div className="text-sm font-semibold truncate">{quoteOptions[key].type}</div>
                      </button>
                    ))}
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <CostingEngine 
                      legs={quoteOptions[selectedOption].legs}
                      totalCosts={quoteOptions[selectedOption].totalCosts}
                      onSelectAgent={handleSelectAgent}
                      onLegCostChange={(idx, updatedCosts) => {
                        const newLegs = [...quoteOptions[selectedOption].legs];
                        newLegs[idx] = { ...newLegs[idx], costs: updatedCosts };
                        
                        const totalCosts = newLegs.reduce((acc, leg) => {
                          Object.keys(leg.costs).forEach(key => {
                            if (key === 'total') return;
                            acc[key] = (acc[key] || 0) + (Number((leg.costs as any)[key]) || 0);
                          });
                          acc.total = (acc.total || 0) + (Number(leg.costs.total) || 0);
                          return acc;
                        }, { total: 0 } as any);

                        setQuoteOptions({
                          ...quoteOptions,
                          [selectedOption]: {
                            ...quoteOptions[selectedOption],
                            legs: newLegs,
                            totalCost: totalCosts.total,
                            totalCosts: totalCosts
                          }
                        });
                      }}
                    />
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <FuelPlan 
                      tripFuel={quoteOptions[selectedOption].fuelPlan.trip}
                      contingencyFuel={quoteOptions[selectedOption].fuelPlan.contingency}
                      alternateFuel={quoteOptions[selectedOption].fuelPlan.alternate}
                      reserveFuel={quoteOptions[selectedOption].fuelPlan.reserve}
                      totalFuelRequired={quoteOptions[selectedOption].fuelPlan.total}
                      aircraftRange={quoteOptions[selectedOption].aircraftRange}
                      totalDistance={routeData.totalDistance}
                      fuelBurnPerHour={quoteOptions[selectedOption].fuelBurnPerHour}
                      stopsNeeded={quoteOptions[selectedOption].fuelPlan.stopsNeeded}
                      suggestedStops={quoteOptions[selectedOption].fuelPlan.suggestedStops}
                      onSuggestStops={handleOptimizeFuelStops}
                      onAddStop={handleAddFuelStop}
                      isSuggesting={isOptimizingFuel}
                      detailedSuggestions={fuelStopSuggestions}
                    />
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <FIRAnalysis 
                      legs={quoteOptions[selectedOption].legs}
                      departure={formData.departure}
                      destination={formData.destination}
                    />
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <PermitSystem 
                      permits={quoteOptions[selectedOption].permits}
                      restrictedAreas={quoteOptions[selectedOption].restrictedAreas}
                    />
                  </div>
                </div>
              )}

              {/* AI Plan Details (Planner Mode) */}
              {activeTab === 'planner' && aiPlan && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white">AI Flight Plan</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Review your optimized flight plan and download the quote.</p>
                    </div>
                    <button 
                      onClick={() => generateQuotePDF({ ...aiPlan, type: aiPlan.suggestedAircraft, totalCost: aiPlan.estimatedTotalCost }, 'Charter')}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2"
                    >
                      <FileText size={20} />
                      Download PDF Quote
                    </button>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <CostingEngine 
                      legs={aiPlan.legs}
                      totalCosts={aiPlan.legs.reduce((acc: any, leg: any) => {
                        Object.keys(leg.costs).forEach(key => {
                          if (key === 'total') return;
                          acc[key] = (acc[key] || 0) + (Number((leg.costs as any)[key]) || 0);
                        });
                        acc.total = (acc.total || 0) + (Number(leg.costs.total) || 0);
                        return acc;
                      }, { total: 0 })}
                      onSelectAgent={handleSelectAgent}
                      onLegCostChange={(idx, updatedCosts) => {
                        const newLegs = [...aiPlan.legs];
                        newLegs[idx] = { ...newLegs[idx], costs: updatedCosts };
                        const newTotal = newLegs.reduce((acc, leg) => acc + (leg.costs.total || 0), 0);
                        setAiPlan({
                          ...aiPlan,
                          legs: newLegs,
                          estimatedTotalCost: newTotal
                        });
                      }}
                    />
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <FuelPlan 
                      tripFuel={aiPlan.fuelPlan.trip}
                      contingencyFuel={aiPlan.fuelPlan.contingency}
                      alternateFuel={aiPlan.fuelPlan.alternate}
                      reserveFuel={aiPlan.fuelPlan.reserve}
                      totalFuelRequired={aiPlan.fuelPlan.total}
                      aircraftRange={aircraftList.find(a => a.type === aiPlan.suggestedAircraft)?.range || 0}
                      totalDistance={aiPlan.legs.reduce((acc: number, l: any) => acc + l.distance, 0)}
                      fuelBurnPerHour={aircraftList.find(a => a.type === aiPlan.suggestedAircraft)?.fuelBurnPerHour || 0}
                      stopsNeeded={aiPlan.fuelPlan.stopsNeeded}
                      suggestedStops={aiPlan.fuelPlan.suggestedStops}
                      onSuggestStops={handleOptimizeFuelStops}
                      onAddStop={handleAddFuelStop}
                      isSuggesting={isOptimizingFuel}
                      detailedSuggestions={fuelStopSuggestions}
                    />
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <FIRAnalysis 
                      legs={aiPlan.legs}
                      departure={aiPlan.legs[0].departure}
                      destination={aiPlan.legs[aiPlan.legs.length - 1].destination}
                    />
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <PermitSystem 
                      permits={aiPlan.legs.flatMap((l: any) => l.permits || [])}
                      restrictedAreas={aiPlan.legs.flatMap((l: any) => l.restrictedAreas || [])}
                    />
                  </div>

                  {aiPlan.safety && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                      <WeatherNotamPanel 
                        notams={aiPlan.safety.notams || []}
                        weather={aiPlan.safety.weather || []}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
</main>
      <ChatAssistant context={{ formData, aiPlan, quoteOptions, acmiQuote }} />
      </div>
    </div>
  );
}
