import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, Loader2, Plane, MapPin, DollarSign, Fuel, Info, AlertTriangle, Zap, Lightbulb, ShieldAlert, Cloud, FileText, Globe, ChevronDown, ChevronUp, Users, Settings, Download, Calendar } from 'lucide-react';
import { planComplexFlight, analyzeFlightPlan, getFIRDetails, searchHandlingAgents, getPermitDetails, getOptimizationAlternatives, getAirportDetails, suggestFuelStop, analyzePermits, getAirportFIR } from '../services/aiService';

import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend as RechartsLegend } from 'recharts';
import CrewManagement, { CrewMember } from './CrewManagement';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import FuelPlan from './FuelPlan';
import CostingEngine from './CostingEngine';
import PermitSystem from './PermitSystem';
import HandlingAgentsPanel from './HandlingAgentsPanel';
import WeatherNotamPanel from './WeatherNotamPanel';
import FIRAnalysis from './FIRAnalysis';
import { calculateFlightMetrics } from '../services/flightCalculationService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AIPlannerProps {
  aircraftList: any[];
  plan: any;
  onPlanChange: (plan: any) => void;
  onHoverLeg?: (index: number | null) => void;
  formData?: any;
  currentQuoteLegs?: any[];
}

type TabType = 'itinerary' | 'fuel' | 'costing' | 'permits' | 'handling' | 'optimization' | 'fir' | 'crew' | 'ai-analysis';

export default function AIPlanner({ aircraftList, plan, onPlanChange, onHoverLeg, formData, currentQuoteLegs }: AIPlannerProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [missionType, setMissionType] = useState<'Passenger' | 'Cargo' | 'VIP' | 'ACMI Lease'>('Passenger');
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [optimization, setOptimization] = useState<'cheapest' | 'fastest' | 'balanced' | 'fuel-efficient'>('balanced');
  const [activeTab, setActiveTab] = useState<TabType>('itinerary');
  const [hoveredLegIndex, setHoveredLegIndex] = useState<number | null>(null);
  const [quotaError, setQuotaError] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // New input states
  const [departure, setDeparture] = useState(formData?.departure || '');
  const [destination, setDestination] = useState(formData?.destination || '');
  const [date, setDate] = useState(formData?.date || '');
  const [passengers, setPassengers] = useState(formData?.passengers?.toString() || '1');
  const [aircraftPreference, setAircraftPreference] = useState('');

  const [minAltitude, setMinAltitude] = useState('');

  useEffect(() => {
    if (formData) {
      setDeparture(prev => prev || formData.departure || '');
      setDestination(prev => prev || formData.destination || '');
      setDate(prev => prev || formData.date || '');
      setPassengers(prev => prev !== formData.passengers?.toString() ? formData.passengers?.toString() || '1' : prev);
    }
  }, [formData]);
  const [preferredFlightLevel, setPreferredFlightLevel] = useState('');
  const [airspaceRestrictions, setAirspaceRestrictions] = useState('');
  const [routeDetails, setRouteDetails] = useState('');
  const [alternatives, setAlternatives] = useState<any>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [isSuggestingStops, setIsSuggestingStops] = useState(false);
  const [fuelStopSuggestions, setFuelStopSuggestions] = useState<any[]>([]);
  const [isAnalyzingPermits, setIsAnalyzingPermits] = useState(false);
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [crewList, setCrewList] = useState<CrewMember[]>([]);
  const [loadingCrew, setLoadingCrew] = useState(false);

  const [hasAnalyzedPermits, setHasAnalyzedPermits] = useState(false);

  const uniqueAircraftTypes = useMemo(() => {
    if (!aircraftList) return [];
    return Array.from(new Set(aircraftList.map(a => a.type))).sort();
  }, [aircraftList]);

  const suggestedAircraftDetails = useMemo(() => {
    if (!plan || !aircraftList) return null;
    return aircraftList.find(a => a.type === plan.suggestedAircraft) || 
           aircraftList.find(a => plan.suggestedAircraft.includes(a.type)) ||
           aircraftList[0];
  }, [plan?.suggestedAircraft, aircraftList]);

  // Automatically calculate flight times when aircraft or legs change
  useEffect(() => {
    if (!plan || !suggestedAircraftDetails) return;
    
    let needsUpdate = false;
    const updatedLegs = plan.legs.map((leg: any) => {
      const dist = leg.routingDistance || leg.distance || 0;
      const metrics = calculateFlightMetrics({ routingDistance: dist }, suggestedAircraftDetails, 0);
      const calculatedTime = Number(metrics.flightTime.toFixed(2));
      const fuelBurn = Math.round(metrics.fuelBurn);
      
      const timeDiff = Math.abs((leg.flightTime || 0) - calculatedTime);
      const fuelDiff = Math.abs((leg.fuelBurn || 0) - fuelBurn);

      if (timeDiff > 0.01 || fuelDiff > 5) {
        needsUpdate = true;
        return { ...leg, flightTime: calculatedTime, fuelBurn };
      }
      return leg;
    });

    if (needsUpdate) {
      const totalFuel = updatedLegs.reduce((acc, l) => acc + (l.fuelBurn || 0), 0);
      onPlanChange({ 
        ...plan, 
        legs: updatedLegs,
        fuelPlan: {
          ...(plan.fuelPlan || {}),
          trip: totalFuel,
          total: Math.round(totalFuel * 1.15)
        }
      });
    }
  }, [plan?.suggestedAircraft, plan?.legs, suggestedAircraftDetails, onPlanChange]);

  // Trigger permit analysis when entering the permits tab
  React.useEffect(() => {
    if (activeTab === 'permits' && !hasAnalyzedPermits && plan && plan.legs.length > 0) {
      handleAnalyzePermits();
      setHasAnalyzedPermits(true);
    }
  }, [activeTab, plan]);

  // Reset permit analysis flag when plan changes significantly
  React.useEffect(() => {
    setHasAnalyzedPermits(false);
  }, [plan?.suggestedAircraft, plan?.legs?.length]);

  useEffect(() => {
    const fetchCrew = async () => {
      setLoadingCrew(true);
      try {
        const q = query(collection(db, 'crew_members'), orderBy('name'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CrewMember));
        setCrewList(data);
      } catch (error) {
        console.error('Error fetching crew:', error);
      } finally {
        setLoadingCrew(false);
      }
    };
    fetchCrew();
  }, []);

  const handleAssignCrew = (legIdx: number, crewMember: CrewMember) => {
    if (!plan) return;
    const newLegs = [...plan.legs];
    const currentAssignments = newLegs[legIdx].crewAssignments || [];
    
    // Check if already assigned
    if (currentAssignments.some((c: any) => c.id === crewMember.id)) {
      newLegs[legIdx].crewAssignments = currentAssignments.filter((c: any) => c.id !== crewMember.id);
    } else {
      newLegs[legIdx].crewAssignments = [...currentAssignments, crewMember];
    }
    
    onPlanChange({ ...plan, legs: newLegs });
  };

  const fetchMissingLegDetails = async () => {
    setLoading(true);
    let changed = false;
    const updatedLegs = await Promise.all(plan.legs.map(async (leg: any) => {
      const updatedLeg = { ...leg };
      let legChanged = false;

      if (!updatedLeg.departureDetails) {
        updatedLeg.departureDetails = await getAirportDetails(updatedLeg.departure);
        legChanged = true;
      }
      if (!updatedLeg.destinationDetails) {
        updatedLeg.destinationDetails = await getAirportDetails(updatedLeg.destination);
        legChanged = true;
      }
      if (!updatedLeg.handlingAgents) {
        const agents = await searchHandlingAgents(updatedLeg.destination);
        updatedLeg.handlingAgents = agents?.agents || [];
        legChanged = true;
      }
      if (!updatedLeg.departureHandlingAgents) {
        const agents = await searchHandlingAgents(updatedLeg.departure);
        updatedLeg.departureHandlingAgents = agents?.agents || [];
        legChanged = true;
      }
      if (!updatedLeg.firs || updatedLeg.firs.length === 0 || updatedLeg.firs.every((f: any) => !f.overflightCharge)) {
        const firs = [];
        const [depFIR, destFIR] = await Promise.all([
          getAirportFIR(updatedLeg.departure),
          getAirportFIR(updatedLeg.destination)
        ]);
        if (depFIR) {
          const depDetails = await getFIRDetails(depFIR.firCode, depFIR.firName, plan.suggestedAircraft);
          firs.push({ ...depFIR, ...depDetails });
        }
        if (destFIR && destFIR.firCode !== depFIR?.firCode) {
          const destDetails = await getFIRDetails(destFIR.firCode, destFIR.firName, plan.suggestedAircraft);
          firs.push({ ...destFIR, ...destDetails });
        }
        updatedLeg.firs = firs;

        // Update costs based on FIRs
        const totalOverflight = firs.reduce((sum, f) => sum + (f.overflightCharge || 0), 0);
        const totalNavigation = firs.reduce((sum, f) => sum + (f.navigationCharge || 0), 0);
        
        if (updatedLeg.costs) {
          updatedLeg.costs.overflight = totalOverflight || updatedLeg.costs.overflight;
          updatedLeg.costs.navigation = totalNavigation || updatedLeg.costs.navigation;
          updatedLeg.costs.total = Object.entries(updatedLeg.costs)
            .filter(([k]) => k !== 'total')
            .reduce((sum, [_, v]) => sum + (typeof v === 'number' ? v : 0), 0);
        }
        
        legChanged = true;
      }
      if (legChanged) changed = true;
      return updatedLeg;
    }));
    
    if (changed) {
      const totalCost = updatedLegs.reduce((sum, l) => sum + (l.costs?.total || 0), 0) + (plan.initialHandlingCost || 0);
      onPlanChange({ ...plan, legs: updatedLegs, totalCost });
    }
    setLoading(false);
  };

  // Automatically fetch details when legs are added
  useEffect(() => {
    let ignore = false;
    async function doFetch() {
      if (plan && plan.legs && plan.legs.length > 0) {
        await fetchMissingLegDetails();
      }
    }
    if (!ignore) {
      doFetch();
    }
    return () => { ignore = true; };
  }, [plan?.legs.length]);

  const handleFetchFIRDetails = async (legIdx: number, firIdx: number) => {
    const leg = plan.legs[legIdx];
    const fir = leg.firs[firIdx];
    
    // Check if details are already present
    if (fir.address) return;

    // Fetch details
    setLoading(true);
    const details = await getFIRDetails(fir.code || fir.name, fir.name, plan.suggestedAircraft);
    
    // Update plan with new FIR details
    const newLegs = [...plan.legs];
    newLegs[legIdx].firs[firIdx] = { ...fir, ...details };
    
    // Recalculate leg cost
    const totalOverflight = newLegs[legIdx].firs.reduce((sum: number, f: any) => sum + (f.overflightCharge || 0), 0);
    const totalNavigation = newLegs[legIdx].firs.reduce((sum: number, f: any) => sum + (f.navigationCharge || 0), 0);
    
    if (newLegs[legIdx].costs) {
      newLegs[legIdx].costs.overflight = totalOverflight || newLegs[legIdx].costs.overflight;
      newLegs[legIdx].costs.navigation = totalNavigation || newLegs[legIdx].costs.navigation;
      newLegs[legIdx].costs.total = Object.entries(newLegs[legIdx].costs)
        .filter(([k]) => k !== 'total')
        .reduce((sum, [_, v]) => sum + (typeof v === 'number' ? v : 0), 0);
    }
    
    const totalCost = newLegs.reduce((sum, l) => sum + (l.costs?.total || 0), 0) + (plan.initialHandlingCost || 0);
    onPlanChange({ ...plan, legs: newLegs, totalCost });
    setLoading(false);
  };

  const totalDistance = useMemo(() => {
    if (!plan) return 0;
    return plan.legs.reduce((acc: number, l: any) => acc + (l.distance || 0), 0);
  }, [plan]);

  const totalCosts = useMemo(() => {
    if (!plan) return null;
    const initialCosts = {
      fuel: 0, 
      overflight: 0, 
      navigation: 0, 
      landing: 0, 
      parking: 0,
      handling: 0, 
      departureHandling: 0, 
      terminalNavigation: 0, 
      catering: 0, 
      groundTransport: 0,
      deicing: 0, 
      repositioning: 0, 
      crew: 0, 
      maintenance: 0,
      insurance: 0,
      contingency: 0,
      acmiRate: 0,
      brokerMargin: 0,
      positioning: 0,
      total: plan.totalCost || 0
    };

    return plan.legs.reduce((acc: any, leg: any) => {
      const legCosts = leg.costs || {};
      Object.keys(acc).forEach(key => {
        if (key !== 'total' && typeof legCosts[key] === 'number') {
          acc[key] += legCosts[key];
        }
      });
      return acc;
    }, initialCosts);
  }, [plan]);

  const costBreakdownData = useMemo(() => {
    if (!totalCosts) return [];
    const labels: Record<string, string> = {
      fuel: 'Fuel',
      overflight: 'Overflight',
      navigation: 'Navigation',
      landing: 'Landing',
      parking: 'Parking',
      handling: 'Handling',
      departureHandling: 'Dep. Handling',
      terminalNavigation: 'Terminal Nav',
      catering: 'Catering',
      groundTransport: 'Transport',
      deicing: 'De-icing',
      repositioning: 'Repositioning',
      crew: 'Crew',
      maintenance: 'Maintenance',
      insurance: 'Insurance',
      contingency: 'Contingency',
      acmiRate: 'ACMI Rate',
      brokerMargin: 'Broker Margin',
      positioning: 'Positioning'
    };

    const colors: Record<string, string> = {
      fuel: '#6366f1', // indigo-500
      overflight: '#f59e0b', // amber-500
      navigation: '#10b981', // emerald-500
      landing: '#ef4444', // red-500
      parking: '#8b5cf6', // violet-500
      handling: '#06b6d4', // cyan-500
      departureHandling: '#0ea5e9', // sky-500
      terminalNavigation: '#14b8a6', // teal-500
      catering: '#f43f5e', // rose-500
      groundTransport: '#ec4899', // pink-500
      deicing: '#64748b', // slate-500
      repositioning: '#d946ef', // fuchsia-500
      crew: '#475569', // slate-600
      maintenance: '#4ade80', // green-400
      insurance: '#fb923c', // orange-400
      contingency: '#a8a29e', // stone-400
      acmiRate: '#2dd4bf',  // teal-400
      brokerMargin: '#f43f5e', // rose-500
      positioning: '#8b5cf6'  // violet-500
    };

    return Object.entries(totalCosts)
      .filter(([key, value]) => key !== 'total' && typeof value === 'number' && value > 0)
      .map(([key, value]) => ({
        name: labels[key] || key,
        value,
        color: colors[key] || '#94a3b8'
      }));
  }, [totalCosts]);

  const allPermits = useMemo(() => {
    if (!plan) return [];
    return plan.legs.flatMap((l: any) => l.permits || []);
  }, [plan]);

  const allRestrictedAreas = useMemo(() => {
    if (!plan) return [];
    return plan.legs.flatMap((l: any) => l.restrictedAreas || []);
  }, [plan]);

  const quickActions = [
    "Plan flight from Lahore to Riyadh via Dubai",
    "Cargo flight from London to New York for 50 tons",
    "VIP trip from Paris to Tokyo with 12 passengers",
    "Cheapest route from Singapore to Sydney"
  ];

  const handleLegNoteChange = (idx: number, value: string) => {
    if (!plan) return;
    const newLegs = [...plan.legs];
    newLegs[idx] = { ...newLegs[idx], operationalNotes: value };
    onPlanChange({ ...plan, legs: newLegs });
  };

  const handleOptimize = async () => {
    if (!plan) return;
    setOptimizing(true);
    try {
      const result = await getOptimizationAlternatives(plan, optimization);
      setAlternatives(result);
      setActiveTab('optimization');
    } catch (error) {
      console.error('Optimization Error:', error);
      alert('Failed to generate optimization alternatives.');
    } finally {
      setOptimizing(false);
    }
  };

  const handleSelectAgent = (legIdx: number, agent: any, type: 'departure' | 'destination' = 'destination') => {
    if (!plan) return;

    const newLegs = [...plan.legs];
    if (type === 'departure') {
      newLegs[legIdx] = { 
        ...newLegs[legIdx], 
        selectedDepartureHandlingAgent: agent,
        costs: {
          ...newLegs[legIdx].costs,
          departureHandling: agent.baseFee
        }
      };
    } else {
      newLegs[legIdx] = { 
        ...newLegs[legIdx], 
        selectedHandlingAgent: agent,
        costs: {
          ...newLegs[legIdx].costs,
          handling: agent.baseFee
        }
      };
    }
    
    // Recalculate total cost
    const legsCost = newLegs.reduce((acc: number, l: any) => {
      const legCosts = l.costs || {};
      const legTotal = Object.entries(legCosts)
        .filter(([k]) => k !== 'total')
        .reduce((sum: number, [_, val]: [string, any]) => sum + (typeof val === 'number' ? val : 0), 0);
      l.costs = { ...l.costs, total: legTotal };
      return acc + (legTotal as number);
    }, 0);

    onPlanChange({ ...plan, legs: newLegs, totalCost: legsCost });
  };

  const handleSuggestStops = async () => {
    if (!plan) return;
    
    // Find all legs that exceed 85% range
    const longLegs = plan.legs.filter((l: any) => l.distance > (suggestedAircraftDetails?.range || 3000) * 0.85);
    if (longLegs.length === 0) {
      alert("No legs currently exceed the 85% range threshold.");
      return;
    }

    setIsSuggestingStops(true);
    try {
      let allSuggestions: any[] = [];
      for (const leg of longLegs) {
        const result = await suggestFuelStop(leg.departure, leg.destination, plan.suggestedAircraft);
        if (result.suggestions) {
          const legSuggestions = result.suggestions.map((s: any) => ({
            ...s,
            reason: `[${leg.departure} ✈️ ${leg.destination}] ${s.reason}`
          }));
          allSuggestions = [...allSuggestions, ...legSuggestions];
        }
      }
      setFuelStopSuggestions(allSuggestions);
      setActiveTab('fuel');
    } catch (error) {
      console.error('Fuel Stop Suggestion Error:', error);
      alert('Failed to suggest fuel stops.');
    } finally {
      setIsSuggestingStops(false);
    }
  };

  const handleAnalyzePermits = async () => {
    if (!plan) return;
    setIsAnalyzingPermits(true);
    try {
      const result = await analyzePermits(plan);
      
      // Update the plan with the new permits and restricted areas
      // We'll distribute them across legs or just store them globally in the plan
      // For simplicity, let's update the first leg's permits or add a global permits field
      const newLegs = [...plan.legs];
      if (newLegs.length > 0) {
        newLegs[0] = { 
          ...newLegs[0], 
          permits: result.permits,
          restrictedAreas: result.restrictedAreas 
        };
      }
      
      onPlanChange({ ...plan, legs: newLegs });
    } catch (error) {
      console.error('Permit Analysis Error:', error);
      alert('Failed to analyze permits.');
    } finally {
      setIsAnalyzingPermits(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!plan) return;
    setIsRunningAnalysis(true);
    try {
      const result = await analyzeFlightPlan(plan);
      setAnalysis(result);
      setActiveTab('ai-analysis');
    } catch (error) {
      console.error('AI Analysis Error:', error);
      alert('Failed to run AI analysis.');
    } finally {
      setIsRunningAnalysis(false);
    }
  };

  const handleAddStop = (icao: string) => {
    if (!plan) return;
    
    // Update the input with the new stop and re-plan
    const currentRoute = plan.legs.map((l: any) => l.departure);
    currentRoute.push(plan.legs[plan.legs.length - 1].destination);
    
    // Find where to insert the stop (usually in the middle of the longest leg)
    const longLegIdx = plan.legs.findIndex((l: any) => l.distance > (suggestedAircraftDetails?.range || 3000) * 0.85);
    
    let newRoute = [...currentRoute];
    if (longLegIdx !== -1) {
      newRoute.splice(longLegIdx + 1, 0, icao);
    } else {
      newRoute.splice(newRoute.length - 1, 0, icao);
    }

    const newQuery = `Re-plan the flight with an additional fuel stop at ${icao}. Route: ${newRoute.join(' -> ')}`;
    setInput(newQuery);
    handlePlan(newQuery);
    setFuelStopSuggestions([]);
  };

  const handleLegCostChange = (legIndex: number, updatedCosts: any) => {
    if (!plan) return;
    const newLegs = [...plan.legs];
    newLegs[legIndex] = { ...newLegs[legIndex], costs: updatedCosts };
    
    // Recalculate total cost for the entire plan
    const legsTotal = newLegs.reduce((acc: number, l: any) => acc + (l.costs?.total || 0), 0);
    const initialHandling = plan.initialHandlingCost || 0;
    
    onPlanChange({ 
      ...plan, 
      legs: newLegs, 
      totalCost: legsTotal + initialHandling 
    });
  };

  const generatePDF = () => {
    if (!plan) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text('Flight Quote Breakdown', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Aircraft: ${plan.suggestedAircraft}`, 14, 35);
    doc.text(`Total Distance: ${totalDistance.toLocaleString()} nm`, 14, 40);
    doc.text(`Total Estimated Cost: $${plan.totalCost?.toLocaleString()} USD`, 14, 45);

    // Leg Details Table
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Leg Details', 14, 60);

    const legData = plan.legs.map((leg: any, index: number) => [
      index + 1,
      `${leg.departure} -> ${leg.destination}`,
      `${leg.distance} nm`,
      `${leg.flightTime} hrs`,
      `$${leg.costs?.fuel?.toLocaleString() || 0}`,
      `$${leg.costs?.total?.toLocaleString() || 0}`
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['#', 'Route', 'Distance', 'Time', 'Fuel Cost', 'Total Cost']],
      body: legData,
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    // Cost Distribution Table
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(14);
    doc.text('Cost Distribution', 14, finalY + 15);

    const costData: any[] = Object.entries(totalCosts || {})
      .filter(([key, value]) => key !== 'total' && typeof value === 'number' && value > 0)
      .map(([key, value]) => [
        key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        `$${(value as number).toLocaleString()}`
      ]);
    
    costData.push([
      { content: 'TOTAL ESTIMATED COST', styles: { fontStyle: 'bold' } }, 
      { content: `$${plan.totalCost?.toLocaleString()}`, styles: { fontStyle: 'bold' } }
    ]);

    autoTable(doc, {
      startY: finalY + 20,
      head: [['Category', 'Amount']],
      body: costData,
      headStyles: { fillColor: [79, 70, 229] },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 25, doc.internal.pageSize.getHeight() - 10);
      doc.text('AI Flight Planner - Strategic Operations', 14, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`Flight_Quote_${plan.suggestedAircraft.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleImportSegments = () => {
    let segmentsText = '';
    
    // Check if we have a current plan
    if (plan && plan.legs && plan.legs.length > 0) {
      segmentsText = `Current Plan Route: ${plan.legs.map((l: any) => `${l.departure} to ${l.destination}`).join(', ')}`;
    } 
    // Otherwise check current quote legs
    else if (currentQuoteLegs && currentQuoteLegs.length > 0) {
      segmentsText = `Current Quote Route: ${currentQuoteLegs.map((l: any) => `${l.departure} to ${l.destination}`).join(', ')}`;
    }
    // Otherwise check form data
    else if (formData && (formData.departure || formData.destination)) {
      const stops = formData.stopovers?.length > 0 ? ` via ${formData.stopovers.join(', ')}` : '';
      segmentsText = `Route: ${formData.departure || 'TBD'} to ${formData.destination || 'TBD'}${stops}`;
    }

    if (segmentsText) {
      setInput(prev => prev ? `${prev}\n\n${segmentsText}` : segmentsText);
    }
  };

  const handlePlan = async (text?: string) => {
    let queryText = text || input;
    
    // Combine explicit inputs if they exist and aren't already in the input
    const explicitParams = [];
    if (departure) explicitParams.push(`Departure: ${departure}`);
    if (destination) explicitParams.push(`Destination: ${destination}`);
    if (date) explicitParams.push(`Date: ${date}`);
    if (passengers) explicitParams.push(`Passengers: ${passengers}`);
    if (aircraftPreference) explicitParams.push(`Aircraft Preference: ${aircraftPreference}`);
    
    if (explicitParams.length > 0) {
      queryText = `FLIGHT PARAMETERS:\n${explicitParams.join('\n')}\n\nUSER REQUEST:\n${queryText}`;
    }

    if (!queryText.trim()) return;
    
    if (minAltitude) queryText += `\nMinimum Altitude: ${minAltitude}`;
    if (preferredFlightLevel) queryText += `\nPreferred Flight Level: ${preferredFlightLevel}`;
    if (airspaceRestrictions) queryText += `\nAirspace Restrictions: ${airspaceRestrictions}`;
    if (routeDetails) queryText += `\nSpecific Route Details: ${routeDetails}`;

    if (plan && plan.legs) {
      const notes = plan.legs
        .map((l: any, i: number) => l.operationalNotes ? `Leg ${i+1} (${l.departure}-${l.destination}) Notes: ${l.operationalNotes}` : null)
        .filter(Boolean);
      if (notes.length > 0) {
        queryText += `\n\nOperational Notes for current legs:\n${notes.join('\n')}`;
      }
    }

    setLoading(true);
    setQuotaError(false);
    try {
      const result = await planComplexFlight(queryText, aircraftList, optimization, missionType);
      
      // Fetch detailed data for each leg
      if (result.legs && Array.isArray(result.legs)) {
        for (const leg of result.legs) {
          // Fetch airport details
          if (leg.departure) {
            leg.departureDetails = await getAirportDetails(leg.departure);
          }
          if (leg.destination) {
            leg.destinationDetails = await getAirportDetails(leg.destination);
          }

          // Fetch detailed FIRs
          if (leg.firs && Array.isArray(leg.firs)) {
            const detailedFirs = await Promise.all(leg.firs.map(async (fir: any) => {
              const details = await getFIRDetails(fir.name || fir.code || 'Unknown', fir.name || 'Unknown', result.suggestedAircraft);
              return { ...fir, ...details };
            }));
            leg.firs = detailedFirs;

            // Link charges to costs
            const totalOverflight = detailedFirs.reduce((sum, f) => sum + (f.overflightCharge || 0), 0);
            const totalNavigation = detailedFirs.reduce((sum, f) => sum + (f.navigationCharge || 0), 0);
            
            if (leg.costs) {
              leg.costs.overflight = totalOverflight || leg.costs.overflight;
              leg.costs.navigation = totalNavigation || leg.costs.navigation;
              leg.costs.total = Object.entries(leg.costs)
                .filter(([k]) => k !== 'total')
                .reduce((sum, [_, v]) => sum + (typeof v === 'number' ? v : 0), 0);
            }
          }

          // Fetch detailed handling agents for destination
          if (leg.destination) {
            const agentsResult = await searchHandlingAgents(leg.destination);
            if (agentsResult && agentsResult.agents) {
              leg.handlingAgents = agentsResult.agents;
            }
          }

          // Fetch detailed handling agents for departure
          if (leg.departure) {
            const depAgentsResult = await searchHandlingAgents(leg.departure);
            if (depAgentsResult && depAgentsResult.agents) {
              leg.departureHandlingAgents = depAgentsResult.agents;
            }
          }

          // Fetch detailed permits
          if (leg.permits && Array.isArray(leg.permits)) {
            const detailedPermits = await Promise.all(leg.permits.map(async (permit: any) => {
              const details = await getPermitDetails(permit.country || 'Unknown', permit.type || 'Overflight');
              return { ...permit, ...details };
            }));
            leg.permits = detailedPermits;
          }
        }
      }

      // Recalculate total cost based on enriched leg costs
      if (result.legs) {
        result.totalCost = result.legs.reduce((sum: number, l: any) => sum + (l.costs?.total || 0), 0);
      }

      onPlanChange(result);
      
      if (result.isFallback) {
        setQuotaError(true);
      }

      // Generate AI analysis
      setAnalyzing(true);
      const analysisResult = await analyzeFlightPlan(result);
      setAnalysis(analysisResult);
    } catch (error: any) {
      console.error('AI Planning Error:', error);
      const isQuotaError = error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota') || error?.status === 429;
      if (isQuotaError) {
        setQuotaError(true);
        alert('AI Quota Exceeded. The system is currently using a sample flight plan. Please try again later or contact support.');
      } else {
        alert('Failed to generate flight plan. Please try again.');
      }
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {quotaError && (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/50 mb-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">AI Quota Exceeded</h4>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              The AI service is currently at its limit. We've provided a sample flight plan for demonstration purposes. Real-time AI planning will resume shortly.
            </p>
          </div>
        </div>
      )}
      <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Info size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">AI Assistant Tips</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-full">
            <MapPin size={10} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-[8px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Map Interaction Active</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          Ask me to plan complex journeys, or <span className="font-bold text-indigo-600 dark:text-indigo-400">click on the map</span> to add custom waypoints. You can also drag route midpoints to insert new stops.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Departure</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
                placeholder="ICAO / City"
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Destination</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="ICAO / City"
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Passengers</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="number"
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
                min="1"
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Aircraft Pref.</label>
            <div className="relative">
              <Plane className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <select
                value={aircraftPreference}
                onChange={(e) => setAircraftPreference(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white outline-none focus:border-indigo-500 appearance-none"
              >
                <option value="">No Preference</option>
                {uniqueAircraftTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Mission Type</label>
            <div className="relative">
              <select
                value={missionType}
                onChange={(e) => setMissionType(e.target.value as any)}
                className="w-full p-3 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white outline-none focus:border-indigo-500 appearance-none cursor-pointer"
              >
                <option value="Passenger">Passenger</option>
                <option value="Cargo">Cargo</option>
                <option value="VIP">VIP</option>
                <option value="ACMI Lease">ACMI Lease</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
          </div>
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Optimization</label>
            <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
              {['cheapest', 'fastest', 'balanced', 'fuel-efficient'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setOptimization(opt as any)}
                  className={`flex-1 min-w-[80px] px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    optimization === opt 
                      ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200 dark:border-gray-700' 
                      : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {opt.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your flight request here..."
            className="w-full p-4 pr-12 border-2 border-indigo-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-2xl focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-0 transition-all min-h-[120px] text-gray-700 dark:text-white shadow-sm"
          />
          <div className="absolute left-4 bottom-3 flex gap-2">
            <button
              onClick={handleImportSegments}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-gray-200 dark:border-gray-800"
              title="Bring from all segments"
            >
              <Globe size={12} />
              <span>Bring from segments</span>
            </button>
          </div>
          <div className="absolute right-3 bottom-3 flex gap-2">
              {plan && (
                <button
                  onClick={handleOptimize}
                  disabled={loading || optimizing}
                  className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2"
                  title="Optimize Route"
                >
                  {optimizing ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Optimize</span>
                </button>
              )}
              {plan && (
                <button
                  onClick={handleRunAnalysis}
                  disabled={loading || isRunningAnalysis}
                  className="bg-purple-600 text-white p-3 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-200 dark:shadow-none flex items-center gap-2"
                  title="Run Strategic AI Analysis"
                >
                  {isRunningAnalysis ? <Loader2 className="animate-spin" size={20} /> : <ShieldAlert size={20} />}
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Run Analysis</span>
                </button>
              )}
              {plan && (
                <button
                  onClick={() => handlePlan('Recalculate and analyze the current flight plan with manual changes.')}
                  disabled={loading}
                  className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200 dark:shadow-none flex items-center gap-2"
                  title="Recalculate & Analyze Manual Changes"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Analyze Changes</span>
                </button>
              )}
            <button
              onClick={() => handlePlan()}
              disabled={loading || !input.trim()}
              className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
            </button>
          </div>
        </div>

        <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-gray-800/50">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Settings size={16} className="text-indigo-500" />
              <span className="text-sm font-bold">Operational Constraints</span>
            </div>
            {showAdvanced ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
          </button>
          
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-gray-100 dark:border-gray-800"
              >
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Min Altitude</label>
                    <input
                      type="text"
                      value={minAltitude}
                      onChange={(e) => setMinAltitude(e.target.value)}
                      placeholder="e.g., FL250"
                      className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Preferred FL</label>
                    <input
                      type="text"
                      value={preferredFlightLevel}
                      onChange={(e) => setPreferredFlightLevel(e.target.value)}
                      placeholder="e.g., FL350, FL410"
                      className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Airspace Restrictions</label>
                    <input
                      type="text"
                      value={airspaceRestrictions}
                      onChange={(e) => setAirspaceRestrictions(e.target.value)}
                      placeholder="e.g., Avoid Russian Airspace"
                      className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Route Details / Waypoints</label>
                    <textarea
                      value={routeDetails}
                      onChange={(e) => setRouteDetails(e.target.value)}
                      placeholder="e.g., Via L602, M747, or specific waypoints: 51N020W, 52N030W..."
                      className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-white outline-none focus:border-indigo-500 transition-colors min-h-[80px]"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInput(action);
                handlePlan(action);
              }}
              disabled={loading}
              className="text-xs bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {plan && analysis && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 mb-4"
        >
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
            <Sparkles size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Strategic Summary</span>
          </div>
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
            {analysis.overallAssessment}
          </p>
          <div className="mt-3 flex gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">
              <AlertTriangle size={12} />
              <span>{analysis.risks?.length || 0} Risks Identified</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
              <Zap size={12} />
              <span>{analysis.efficiencyGains?.length || 0} Efficiency Tips</span>
            </div>
          </div>
        </motion.div>
      )}

      {plan && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-indigo-600 dark:bg-indigo-900 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 dark:shadow-none"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Selected Aircraft</p>
              <div className="relative group">
                <select 
                  value={plan.suggestedAircraft}
                  onChange={(e) => onPlanChange({ ...plan, suggestedAircraft: e.target.value })}
                  className="text-2xl font-black bg-transparent border-none outline-none cursor-pointer hover:opacity-80 appearance-none pr-6"
                >
                  {uniqueAircraftTypes.map(type => (
                    <option key={type} value={type} className="bg-indigo-600 dark:bg-indigo-900 text-white">
                      {type}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" size={16} />
              </div>
            </div>
            <div className="bg-white/20 dark:bg-black/20 p-2 rounded-xl">
              <Plane size={24} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 dark:bg-black/20 p-3 rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Est. Cost</p>
              <p className="text-xl font-black">${plan.totalCost?.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 dark:bg-black/20 p-3 rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Total Distance</p>
              <p className="text-xl font-black">{totalDistance?.toLocaleString()} nm</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs font-bold bg-white/10 dark:bg-black/20 p-3 rounded-2xl">
            <Info size={14} />
            <span>Full operational breakdown generated in the results panel.</span>
          </div>
        </motion.div>
      )}

      {plan && costBreakdownData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Cost Distribution</h4>
          </div>

          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {costBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '10px',
                    fontWeight: '900',
                    textTransform: 'uppercase'
                  }}
                  itemStyle={{ color: '#4f46e5' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cost']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
              <p className="text-lg font-black text-gray-900 dark:text-white">${plan.totalCost?.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4">
            {costBreakdownData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between group">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate">{item.name}</span>
                </div>
                <span className="text-[10px] font-black text-gray-900 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  ${item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {analyzing && (
        <div className="flex items-center justify-center gap-2 p-8 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
          <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={20} />
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">AI is analyzing your plan...</p>
        </div>
      )}

      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Results Tabs */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
            {[
              { id: 'itinerary', label: 'Itinerary', icon: MapPin },
              { id: 'fuel', label: 'Fuel Plan', icon: Fuel },
              { id: 'costing', label: 'Costing', icon: DollarSign },
              { id: 'permits', label: 'Permits', icon: FileText },
              { id: 'fir', label: 'FIR Analysis', icon: Globe },
              { id: 'handling', label: 'Handling', icon: Users },
              { id: 'crew', label: 'Crew', icon: Users },
              { id: 'optimization', label: 'Optimization', icon: Zap },
              { id: 'ai-analysis', label: 'AI Analysis', icon: Sparkles },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200 dark:border-gray-700'
                    : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'itinerary' && (
                <div className="space-y-6">
                  {/* Flight Itinerary with Integrated Safety Data */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <MapPin size={20} className="text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-lg font-black text-gray-900 dark:text-white">Flight Itinerary & Safety</h3>
                      </div>
                      <button
                        onClick={fetchMissingLegDetails}
                        disabled={loading}
                        className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                      >
                        {loading ? 'Refreshing...' : 'Refresh All Airport Data'}
                      </button>
                    </div>
                    <div className="space-y-4">
                      {plan.legs.map((leg: any, idx: number) => {
                        const legNotams = plan.safety?.notams?.filter((n: any) => 
                          n.airport === leg.departure || n.airport === leg.destination
                        ) || [];
                        const legWeather = plan.safety?.weather?.filter((w: any) => 
                          w.location === leg.departure || w.location === leg.destination
                        ) || [];

                        return (
                          <div 
                            key={idx} 
                            className="space-y-3 relative group"
                            onMouseEnter={() => {
                              setHoveredLegIndex(idx);
                              onHoverLeg?.(idx);
                            }}
                            onMouseLeave={() => {
                              setHoveredLegIndex(null);
                              onHoverLeg?.(null);
                            }}
                          >
                            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 group-hover:border-indigo-300 dark:group-hover:border-indigo-500 transition-all">
                              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                                {idx + 1}
                              </div>
                              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">From</p>
                                  <p className="text-sm font-black text-gray-900 dark:text-white">{leg.departure}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">To</p>
                                  <p className="text-sm font-black text-gray-900 dark:text-white">{leg.destination}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Distance</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-black text-gray-900 dark:text-white">{leg.distance} nm</p>
                                    {suggestedAircraftDetails && leg.distance > suggestedAircraftDetails.range * 0.85 && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveTab('fuel');
                                          handleSuggestStops();
                                        }}
                                        className="flex items-center gap-1 text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border border-amber-100 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all" 
                                        title="Leg exceeds 85% of aircraft range. Click to find optimal fuel stops."
                                      >
                                        <Fuel size={8} />
                                        <span>Range Alert: Find Stops</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Time</p>
                                  <p className="text-sm font-black text-gray-900 dark:text-white">{leg.flightTime} hrs</p>
                                </div>
                              </div>
                            </div>

                            <div className="ml-14 space-y-1.5">
                              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Operational Notes</label>
                              <textarea
                                value={leg.operationalNotes || ''}
                                onChange={(e) => handleLegNoteChange(idx, e.target.value)}
                                placeholder="Add specific instructions or remarks for this leg..."
                                className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-500 transition-colors min-h-[60px] resize-none"
                              />
                            </div>

                            {/* Crew Assignment Section */}
                            <div className="ml-14 space-y-3">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Crew Assignments</label>
                                <div className="flex -space-x-2 overflow-hidden">
                                  {(leg.crewAssignments || []).map((c: any) => (
                                    <div key={c.id} className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase" title={`${c.name} (${c.role})`}>
                                      {c.name.charAt(0)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {crewList.filter(c => c.status === 'Active').map(member => {
                                  const isAssigned = (leg.crewAssignments || []).some((c: any) => c.id === member.id);
                                  return (
                                    <button
                                      key={member.id}
                                      onClick={() => handleAssignCrew(idx, member)}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all border ${
                                        isAssigned 
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                          : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-500/50'
                                      }`}
                                    >
                                      {member.name} ({member.role.charAt(0)})
                                    </button>
                                  );
                                })}
                                {crewList.length === 0 && (
                                  <p className="text-[10px] text-gray-400 italic">No active crew members found. Add them in the Crew tab.</p>
                                )}
                              </div>
                            </div>

                            <AnimatePresence>
                              {hoveredLegIndex === idx && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                  className="absolute z-50 bottom-full left-0 mb-2 w-72 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-indigo-100 dark:border-gray-700 pointer-events-none"
                                >
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2 border-b border-gray-50 dark:border-gray-700 pb-2">
                                      <Globe size={14} className="text-indigo-600" />
                                      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">Leg Details</h4>
                                    </div>

                                    <div className="space-y-3">
                                      {/* Airport Details */}
                                      <div className="grid grid-cols-2 gap-3">
                                        {leg.departureDetails && (
                                          <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                                            <p className="text-[8px] text-indigo-500 uppercase font-bold mb-1">Departure: {leg.departure}</p>
                                            <div className="space-y-1">
                                              <p className="text-[9px] text-gray-400">Elev: <span className="text-gray-700 dark:text-gray-200">{leg.departureDetails.elevation} ft</span></p>
                                              <p className="text-[9px] text-gray-400">Rwy: <span className="text-gray-700 dark:text-gray-200">{leg.departureDetails.runwayLength} ft</span></p>
                                            </div>
                                          </div>
                                        )}
                                        {leg.destinationDetails && (
                                          <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                                            <p className="text-[8px] text-indigo-500 uppercase font-bold mb-1">Arrival: {leg.destination}</p>
                                            <div className="space-y-1">
                                              <p className="text-[9px] text-gray-400">Elev: <span className="text-gray-700 dark:text-gray-200">{leg.destinationDetails.elevation} ft</span></p>
                                              <p className="text-[9px] text-gray-400">Rwy: <span className="text-gray-700 dark:text-gray-200">{leg.destinationDetails.runwayLength} ft</span></p>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* FIR Charges */}
                                      <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <Globe size={12} className="text-indigo-500" />
                                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">FIR Details & Charges</p>
                                        </div>
                                        <div className="space-y-1.5">
                                          {leg.firs && leg.firs.length > 0 ? (
                                            leg.firs.map((fir: any, i: number) => (
                                              <div key={i} className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                                                <div className="flex justify-between items-center mb-1">
                                                  <p className="text-[9px] font-black text-gray-700 dark:text-gray-200 uppercase">{fir.name}</p>
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-[8px] text-gray-400 font-bold">{fir.country}</span>
                                                    {!fir.address && (
                                                      <button
                                                        onClick={() => handleFetchFIRDetails(idx, i)}
                                                        className="text-[8px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                                                      >
                                                        Fetch Details
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>
                                                {fir.address && (
                                                  <div className="mt-2 text-[9px] text-gray-600 dark:text-gray-400 space-y-1">
                                                    <p>{fir.address}</p>
                                                    <p>{fir.phone} | {fir.email}</p>
                                                    <p className="italic">{fir.rules}</p>
                                                  </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                  <div>
                                                    <p className="text-[7px] text-gray-400 uppercase font-bold">Overflight</p>
                                                    <p className="text-[10px] font-mono text-emerald-500">${fir.overflightCharge?.toLocaleString() || 0}</p>
                                                  </div>
                                                  <div>
                                                    <p className="text-[7px] text-gray-400 uppercase font-bold">Nav</p>
                                                    <p className="text-[10px] font-mono text-emerald-500">${fir.navigationCharge?.toLocaleString() || 0}</p>
                                                  </div>
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="grid grid-cols-2 gap-2">
                                              <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                                                <p className="text-[8px] text-gray-400 uppercase font-bold">Overflight</p>
                                                <p className="text-xs font-black text-gray-700 dark:text-gray-200">${leg.costs?.overflight?.toLocaleString() || 0}</p>
                                              </div>
                                              <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                                                <p className="text-[8px] text-gray-400 uppercase font-bold">Navigation</p>
                                                <p className="text-xs font-black text-gray-700 dark:text-gray-200">${leg.costs?.navigation?.toLocaleString() || 0}</p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Handling Agents */}
                                      <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <Users size={12} className="text-cyan-500" />
                                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Handling Agent Info</p>
                                        </div>
                                        {leg.handlingAgents && leg.handlingAgents.length > 0 ? (
                                          <div className="space-y-1.5">
                                            {leg.handlingAgents.slice(0, 1).map((agent: any, i: number) => (
                                              <div key={i} className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-800 text-[9px] text-gray-600 dark:text-gray-400 space-y-0.5">
                                                <p className="font-bold text-gray-800 dark:text-gray-200">{agent.companyName}</p>
                                                <p>{agent.phone} | {agent.email}</p>
                                                <p className="italic text-[8px] truncate">{agent.additionalServices}</p>
                                                <p className="font-mono text-cyan-600 dark:text-cyan-400">Base Fee: ${agent.baseFee?.toLocaleString() || 0}</p>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-[8px] text-gray-400 italic">No agent info available</p>
                                        )}
                                      </div>

                                      {/* Permits */}
                                      <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <FileText size={12} className="text-blue-500" />
                                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Required Permits</p>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {leg.permits && leg.permits.length > 0 ? (
                                            leg.permits.map((p: any, i: number) => (
                                              <span key={i} className="text-[8px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase">
                                                {p.type || p}
                                              </span>
                                            ))
                                          ) : (
                                            <span className="text-[8px] text-gray-400 italic">None required</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Departure Handling Agents */}
                                      <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <Users size={12} className="text-amber-500" />
                                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Departure Handling Agents ({leg.departure})</p>
                                        </div>
                                        <div className="space-y-1.5">
                                          {leg.departureHandlingAgents && leg.departureHandlingAgents.length > 0 ? (
                                            leg.departureHandlingAgents.map((agent: any, i: number) => {
                                              const isSelected = leg.selectedDepartureHandlingAgent?.companyName === agent.companyName;
                                              return (
                                                <div 
                                                  key={i} 
                                                  onClick={() => handleSelectAgent(idx, agent, 'departure')}
                                                  className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                                                    isSelected 
                                                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-400' 
                                                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-600'
                                                  }`}
                                                >
                                                  <div className="flex justify-between items-center mb-1">
                                                    <p className={`text-[9px] font-black uppercase ${isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-amber-900 dark:text-amber-200'}`}>
                                                      {agent.companyName}
                                                    </p>
                                                    <span className="text-[10px] font-mono text-emerald-500">${agent.baseFee?.toLocaleString() || 0}</span>
                                                  </div>
                                                  <div className="flex flex-col gap-0.5">
                                                    <p className={`text-[8px] truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-500'}`}>{agent.email}</p>
                                                    {agent.phone && <p className={`text-[8px] ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-500'}`}>{agent.phone}</p>}
                                                    {agent.additionalServices && (
                                                      <p className={`text-[8px] italic truncate ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
                                                        Services: {agent.additionalServices}
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })
                                          ) : (
                                            <span className="text-[8px] text-gray-400 italic">No agents found</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Destination Handling Agents */}
                                      <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <Users size={12} className="text-amber-500" />
                                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Destination Handling Agents ({leg.destination})</p>
                                        </div>
                                        <div className="space-y-1.5">
                                          {leg.handlingAgents && leg.handlingAgents.length > 0 ? (
                                            leg.handlingAgents.map((agent: any, i: number) => {
                                              const isSelected = leg.selectedHandlingAgent?.companyName === agent.companyName;
                                              return (
                                                <div 
                                                  key={i} 
                                                  onClick={() => handleSelectAgent(idx, agent)}
                                                  className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                                                    isSelected 
                                                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-400' 
                                                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-600'
                                                  }`}
                                                >
                                                  <div className="flex justify-between items-center mb-1">
                                                    <p className={`text-[9px] font-black uppercase ${isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-amber-900 dark:text-amber-200'}`}>
                                                      {agent.companyName}
                                                    </p>
                                                    <span className="text-[10px] font-mono text-emerald-500">${agent.baseFee?.toLocaleString() || 0}</span>
                                                  </div>
                                                  <div className="flex flex-col gap-0.5">
                                                    <p className={`text-[8px] truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-500'}`}>{agent.email}</p>
                                                    {agent.phone && <p className={`text-[8px] ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-500'}`}>{agent.phone}</p>}
                                                    {agent.additionalServices && (
                                                      <p className={`text-[8px] italic truncate ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
                                                        Services: {agent.additionalServices}
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })
                                          ) : (
                                            <span className="text-[8px] text-gray-400 italic">No agents found</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Restricted Airspaces */}
                                      <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <ShieldAlert size={12} className="text-red-500" />
                                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Restricted Airspaces</p>
                                        </div>
                                        <div className="space-y-1">
                                          {leg.restrictedAreas && leg.restrictedAreas.length > 0 ? (
                                            leg.restrictedAreas.map((area: any, i: number) => (
                                              <div key={i} className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 p-1.5 rounded-lg">
                                                <div className="w-1 h-1 bg-red-500 rounded-full" />
                                                <p className="text-[8px] font-bold text-red-700 dark:text-red-400 uppercase">{area.name || area}</p>
                                              </div>
                                            ))
                                          ) : (
                                            <span className="text-[8px] text-gray-400 italic">No restrictions detected</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {(legNotams.length > 0 || legWeather.length > 0) && (
                              <div className="ml-14 grid grid-cols-1 md:grid-cols-2 gap-3">
                                {legNotams.map((n: any, i: number) => (
                                  <div key={i} className={`flex items-start gap-2 p-2 rounded-xl border ${
                                    n.severity === 'High' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' :
                                    n.severity === 'Medium' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' :
                                    'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'
                                  }`}>
                                    <ShieldAlert size={14} className={`shrink-0 mt-0.5 ${
                                      n.severity === 'High' ? 'text-red-600 dark:text-red-400' :
                                      n.severity === 'Medium' ? 'text-amber-600 dark:text-amber-400' :
                                      'text-blue-600 dark:text-blue-400'
                                    }`} />
                                    <div>
                                      <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                        n.severity === 'High' ? 'text-red-900 dark:text-red-200' :
                                        n.severity === 'Medium' ? 'text-amber-900 dark:text-amber-200' :
                                        'text-blue-900 dark:text-blue-200'
                                      }`}>NOTAM: {n.airport}</p>
                                      <p className={`text-[10px] leading-tight ${
                                        n.severity === 'High' ? 'text-red-800 dark:text-red-400' :
                                        n.severity === 'Medium' ? 'text-amber-800 dark:text-amber-400' :
                                        'text-blue-800 dark:text-blue-400'
                                      }`}>{n.description}</p>
                                    </div>
                                  </div>
                                ))}
                                {legWeather.map((w: any, i: number) => (
                                  <div key={i} className={`flex items-start gap-2 p-2 rounded-xl border ${
                                    w.severity === 'High' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' :
                                    w.severity === 'Medium' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' :
                                    'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'
                                  }`}>
                                    <Cloud size={14} className={`shrink-0 mt-0.5 ${
                                      w.severity === 'High' ? 'text-red-600 dark:text-red-400' :
                                      w.severity === 'Medium' ? 'text-amber-600 dark:text-amber-400' :
                                      'text-blue-600 dark:text-blue-400'
                                    }`} />
                                    <div>
                                      <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                        w.severity === 'High' ? 'text-red-900 dark:text-red-200' :
                                        w.severity === 'Medium' ? 'text-amber-900 dark:text-amber-200' :
                                        'text-blue-900 dark:text-blue-200'
                                      }`}>Weather: {w.location}</p>
                                      <p className={`text-[10px] leading-tight ${
                                        w.severity === 'High' ? 'text-red-800 dark:text-red-400' :
                                        w.severity === 'Medium' ? 'text-amber-800 dark:text-amber-400' :
                                        'text-blue-800 dark:text-blue-400'
                                      }`}>{w.condition} - {w.impact}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* General Safety Alerts (for items not tied to specific legs) */}
                  {plan.safety && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                      <div className="flex items-center gap-2 mb-6">
                        <ShieldAlert size={20} className="text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-lg font-black text-gray-900 dark:text-white">General Safety & Operational Alerts</h3>
                      </div>
                      <WeatherNotamPanel 
                        notams={plan.safety.notams?.filter((n: any) => 
                          !plan.legs.some((l: any) => l.departure === n.airport || l.destination === n.airport)
                        ) || []} 
                        weather={plan.safety.weather?.filter((w: any) => 
                          !plan.legs.some((l: any) => l.departure === w.location || l.destination === w.location)
                        ) || []} 
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'fuel' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <Fuel size={20} className="text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-lg font-black text-gray-900 dark:text-white">Fuel Planning</h3>
                    </div>
                    <button 
                      onClick={generatePDF}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                      <Download size={16} />
                      Generate PDF Quote
                    </button>
                  </div>
                  <FuelPlan 
                    tripFuel={plan.fuelPlan.trip}
                    contingencyFuel={plan.fuelPlan.contingency}
                    alternateFuel={plan.fuelPlan.alternate}
                    reserveFuel={plan.fuelPlan.reserve}
                    totalFuelRequired={plan.fuelPlan.total}
                    aircraftRange={suggestedAircraftDetails?.range || 3000}
                    totalDistance={totalDistance}
                    fuelBurnPerHour={suggestedAircraftDetails?.fuelBurnPerHour || 800}
                    stopsNeeded={plan.fuelPlan.stopsNeeded}
                    suggestedStops={plan.fuelPlan.suggestedStops}
                    hasLongLeg={plan.legs.some((l: any) => l.distance > (suggestedAircraftDetails?.range || 3000) * 0.85)}
                    onAddStop={handleAddStop}
                    onSuggestStops={handleSuggestStops}
                    isSuggesting={isSuggestingStops}
                    detailedSuggestions={fuelStopSuggestions}
                  />
                </div>
              )}

              {activeTab === 'costing' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <DollarSign size={20} className="text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-lg font-black text-gray-900 dark:text-white">Cost Breakdown</h3>
                    </div>
                    <button 
                      onClick={generatePDF}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                      <Download size={16} />
                      Generate PDF Quote
                    </button>
                  </div>
                  <CostingEngine 
                    legs={plan.legs}
                    totalCosts={totalCosts}
                    onLegCostChange={handleLegCostChange}
                    onSelectAgent={handleSelectAgent}
                  />
                </div>
              )}

              {activeTab === 'permits' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-lg font-black text-gray-900 dark:text-white">Permit Analysis</h3>
                    </div>
                    <button 
                      onClick={handleAnalyzePermits}
                      disabled={isAnalyzingPermits}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                    >
                      {isAnalyzingPermits ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                      Deep Permit Analysis
                    </button>
                  </div>
                  <PermitSystem 
                    permits={allPermits}
                    restrictedAreas={allRestrictedAreas}
                  />
                </div>
              )}

              {activeTab === 'fir' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <FIRAnalysis 
                    legs={plan.legs}
                    departure={plan.legs[0].departure}
                    destination={plan.legs[plan.legs.length - 1].destination}
                  />
                </div>
              )}

              {activeTab === 'handling' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <HandlingAgentsPanel 
                    legs={plan.legs}
                    onSelectAgent={handleSelectAgent}
                  />
                </div>
              )}

              {activeTab === 'optimization' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Zap size={20} className="text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Optimization Alternatives</h3>
                  </div>
                  
                  {optimizing ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="animate-spin text-indigo-600" size={32} />
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Finding better routes...</p>
                    </div>
                  ) : alternatives ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {alternatives.alternatives.map((alt: any, i: number) => (
                          <div key={i} className="flex flex-col p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all group">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Lightbulb size={16} />
                              </div>
                              <h4 className="text-sm font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{alt.title}</h4>
                            </div>
                            
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{alt.explanation}</p>
                            
                            <div className="space-y-3 mb-4">
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-gray-400">Cost Impact</span>
                                <span className={alt.impacts.cost < 0 ? 'text-emerald-500' : 'text-red-500'}>
                                  {alt.impacts.cost < 0 ? '-' : '+'}${Math.abs(alt.impacts.cost).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-gray-400">Time Impact</span>
                                <span className={alt.impacts.time < 0 ? 'text-emerald-500' : 'text-red-500'}>
                                  {alt.impacts.time < 0 ? '-' : '+'}{Math.abs(alt.impacts.time)} hrs
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-gray-400">Fuel Impact</span>
                                <span className={alt.impacts.fuel < 0 ? 'text-emerald-500' : 'text-red-500'}>
                                  {alt.impacts.fuel < 0 ? '-' : '+'}{Math.abs(alt.impacts.fuel).toLocaleString()} L
                                </span>
                              </div>
                            </div>

                            {alt.weatherAndFirNotes && (
                              <div className="mb-4 p-2 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30">
                                <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Weather & FIR Notes</p>
                                <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-tight italic">"{alt.weatherAndFirNotes}"</p>
                              </div>
                            )}

                            <button 
                              className="mt-auto w-full py-2.5 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all"
                              onClick={() => {
                                onPlanChange({ ...plan, legs: alt.updatedLegs });
                                setActiveTab('itinerary');
                              }}
                            >
                              Apply Alternative
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                        <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400">
                          <Zap size={16} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Optimization Strategy: {optimization}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                          These alternatives were generated specifically to address your <span className="font-bold text-indigo-600">{optimization}</span> goal. 
                          We analyzed global fuel prices, overflight charges, and aircraft performance data to find these potential savings.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                      <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-700">
                        <Zap size={32} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">No optimization data yet</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">Click the "Optimize" button above to generate alternative routes based on your criteria.</p>
                      </div>
                      <button 
                        onClick={handleOptimize}
                        className="mt-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                      >
                        Optimize Now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'crew' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <CrewManagement />
                </div>
              )}

              {activeTab === 'ai-analysis' && analysis && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                      <Sparkles size={20} className="text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-lg font-black text-gray-900 dark:text-white">AI Decision Breakdown</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Identified Risks */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                          <ShieldAlert size={16} />
                          <h4 className="text-[10px] font-black uppercase tracking-widest">Identified Risks</h4>
                        </div>
                        <div className="space-y-3">
                          {analysis.risks?.map((r: any, i: number) => (
                            <div key={i} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                              <div className="flex justify-between items-start mb-1">
                                <p className="text-xs font-bold text-red-900 dark:text-red-200">{r.risk}</p>
                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                  r.severity === 'High' ? 'bg-red-200 text-red-800' :
                                  r.severity === 'Medium' ? 'bg-amber-200 text-amber-800' :
                                  'bg-emerald-200 text-emerald-800'
                                }`}>
                                  {r.severity}
                                </span>
                              </div>
                              <p className="text-[10px] text-red-700 dark:text-red-400 italic">Mitigation: {r.mitigation}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Suggested Route Changes */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                          <MapPin size={16} />
                          <h4 className="text-[10px] font-black uppercase tracking-widest">Suggested Route Changes</h4>
                        </div>
                        <div className="space-y-3">
                          {analysis.alternatives?.map((a: any, i: number) => (
                            <div key={i} className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-1">{a.strategy}</p>
                              <p className="text-[10px] text-indigo-700 dark:text-indigo-400 italic">Est. Impact: {a.estimatedImpact}</p>
                              {a.reasoning && <p className="text-[9px] text-gray-500 mt-1 leading-tight">{a.reasoning}</p>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Operational Considerations */}
                      <div className="space-y-4 md:col-span-2">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <Settings size={16} />
                          <h4 className="text-[10px] font-black uppercase tracking-widest">Operational Considerations</h4>
                        </div>
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                           <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                             {analysis.overallAssessment}
                           </p>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles size={20} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-lg font-black text-gray-900 dark:text-white">AI Strategic Analysis</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Risks */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle size={16} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Potential Risks</h4>
                </div>
                <div className="space-y-3">
                  {analysis?.risks?.map((r: any, i: number) => (
                    <div key={i} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-bold text-red-900 dark:text-red-200">{r.risk}</p>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                          r.severity === 'High' ? 'bg-red-600 text-white' :
                          r.severity === 'Medium' ? 'bg-amber-500 text-white' :
                          'bg-emerald-500 text-white'
                        }`}>
                          {r.severity}
                        </span>
                      </div>
                      <p className="text-[10px] text-red-700 dark:text-red-400 italic">Mitigation: {r.mitigation}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weather Impact */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Cloud size={16} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Weather Impact</h4>
                </div>
                {analysis?.weatherImpact && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <p className="text-xs text-blue-900 dark:text-blue-200 font-bold mb-2">{analysis.weatherImpact.assessment}</p>
                    <div className="space-y-2">
                      {analysis.weatherImpact.threats?.length > 0 && (
                        <div>
                          <p className="text-[8px] font-black text-red-500 uppercase mb-1">Threats</p>
                          <div className="flex flex-wrap gap-1">
                            {analysis.weatherImpact.threats.map((t: string, i: number) => (
                              <span key={i} className="text-[8px] bg-red-100 dark:bg-red-900/30 text-red-600 px-1.5 py-0.5 rounded">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysis.weatherImpact.favorableConditions?.length > 0 && (
                        <div>
                          <p className="text-[8px] font-black text-emerald-500 uppercase mb-1">Favorable</p>
                          <div className="flex flex-wrap gap-1">
                            {analysis.weatherImpact.favorableConditions.map((f: string, i: number) => (
                              <span key={i} className="text-[8px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 px-1.5 py-0.5 rounded">{f}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* FIR Analysis */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Globe size={16} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">FIR & Charges</h4>
                </div>
                {analysis?.firAnalysis && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[8px] font-black text-amber-500 uppercase">Est. Charges</p>
                      <p className="text-sm font-black text-amber-900 dark:text-amber-200">${analysis.firAnalysis.totalEstimatedCharges?.toLocaleString()}</p>
                    </div>
                    {analysis.firAnalysis.highCostFirs?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[8px] font-black text-red-500 uppercase mb-1">High Cost Airspaces</p>
                        <div className="flex flex-wrap gap-1">
                          {analysis.firAnalysis.highCostFirs.map((f: string, i: number) => (
                            <span key={i} className="text-[8px] bg-red-100 dark:bg-red-900/30 text-red-600 px-1.5 py-0.5 rounded">{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 italic">Potential: {analysis.firAnalysis.optimizationPotential}</p>
                  </div>
                )}
              </div>

              {/* Efficiency */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Zap size={16} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Efficiency Gains</h4>
                </div>
                <div className="space-y-3">
                  {analysis?.efficiencyGains?.map((g: any, i: number) => (
                    <div key={i} className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1">{g.gain}</p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 italic">Impact: {g.impact}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alternatives */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Lightbulb size={16} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Alternative Strategies</h4>
                </div>
                <div className="space-y-3">
                  {analysis?.alternatives?.map((a: any, i: number) => (
                    <div key={i} className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                      <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-1">{a.strategy}</p>
                      <p className="text-[10px] text-indigo-700 dark:text-indigo-400 italic">Est. Impact: {a.estimatedImpact}</p>
                      {a.reasoning && <p className="text-[9px] text-gray-500 mt-1 leading-tight">{a.reasoning}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                <span className="font-black text-gray-900 dark:text-white uppercase tracking-widest mr-2">Overall Assessment:</span>
                {analysis?.overallAssessment || 'No assessment available.'}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}