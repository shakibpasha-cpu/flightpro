import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, Loader2, Plane, MapPin, DollarSign, Fuel, Info, AlertTriangle, Zap, Lightbulb, ShieldAlert, Cloud, FileText, Globe, ChevronDown, ChevronUp, ChevronRight, Users, Settings, Download, Calendar, ShieldCheck, Tag, Clock, Activity, Route, ListOrdered } from 'lucide-react';
import { planComplexFlight, analyzeFlightPlan, getFIRDetails, searchHandlingAgents, getPermitDetails, getOptimizationAlternatives, getAirportDetails, suggestFuelStop, analyzePermits, getAirportFIR, getLegFIRAnalysis } from '../services/aiService';

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
  onFormDataChange?: (formData: any) => void;
  currentQuoteLegs?: any[];
  setActiveMapInput?: (input: 'departure' | 'destination' | 'none') => void;
}

type TabType = 'itinerary' | 'fuel' | 'costing' | 'permits' | 'handling' | 'optimization' | 'fir' | 'crew' | 'ai-analysis';

const LegCard = ({ 
  leg, 
  idx, 
  onHover, 
  onNoteChange, 
  onAssignCrew, 
  crewList, 
  suggestedAircraftDetails, 
  setActiveTab, 
  handleSuggestStops,
  hoveredLegIndex 
}: any) => {
  const [expanded, setExpanded] = useState(false);
  const [showLogistics, setShowLogistics] = useState(false);
  
  const legNotams = leg.notams || [];
  const legWeather = leg.weather || [];
  const hasRestricted = leg.restrictedAreaDetected || (leg.restrictedAreas && leg.restrictedAreas.length > 0);
  const isHovered = hoveredLegIndex === idx;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="relative mb-6"
      onMouseEnter={() => onHover(idx)}
      onMouseLeave={() => onHover(null)}
    >
      <div className={`p-6 rounded-[2rem] border transition-all duration-500 overflow-hidden ${
        expanded 
          ? 'bg-white dark:bg-gray-800 border-indigo-200 dark:border-indigo-500 shadow-2xl shadow-indigo-100/50 dark:shadow-none' 
          : 'bg-white/90 dark:bg-gray-900/40 border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800 shadow-sm'
      }`}>
        {/* Modern Accent Decoration */}
        {expanded && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -mr-16 -mt-16 rounded-full" />
        )}

        <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
          {/* Leg Badge Indicator */}
          <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-500 ${
            expanded ? 'bg-indigo-600 border-indigo-500 text-white rotate-3 scale-110' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400'
          }`}>
            <span className="text-[8px] font-black uppercase tracking-tighter mb-0.5">Leg</span>
            <span className="text-xl font-black">{idx + 1}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-10 mb-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Departure Port</span>
                </div>
                <h4 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-baseline gap-3">
                  {leg.departure}
                  <span className="text-[10px] font-bold text-indigo-500 truncate">
                    {leg.departureDetails?.name?.slice(0, 30) || 'Loading Intel...'}
                  </span>
                </h4>
              </div>
              
              <div className="flex items-center gap-4 py-2 px-6 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="text-center">
                   <p className="text-[10px] font-black text-gray-900 dark:text-white leading-none">{leg.distance}</p>
                   <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">NM</p>
                </div>
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
                <motion.div
                  animate={hoveredLegIndex === idx ? { x: [0, 5, 0] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Plane size={16} className="text-indigo-600 dark:text-indigo-400" />
                </motion.div>
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
                <div className="text-center">
                   <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 leading-none">{leg.flightTime}</p>
                   <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">HRS</p>
                </div>
              </div>

              <div className="flex-1 min-w-0 md:text-right">
                <div className="flex items-center md:justify-end gap-2 mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Arrival Target</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                </div>
                <h4 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-baseline md:justify-end gap-3">
                  <span className="text-[10px] font-bold text-gray-400 truncate opacity-60">
                    {leg.destinationDetails?.name?.slice(0, 30) || 'Loading Intel...'}
                  </span>
                  {leg.destination}
                </h4>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800">
                <DollarSign size={12} className="text-emerald-500" />
                <span className="text-[10px] font-black text-gray-700 dark:text-gray-300">${(leg.costs?.total || 0).toLocaleString()} <span className="text-[8px] opacity-60">EST</span></span>
              </div>
              {hasRestricted && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/30 rounded-xl border border-rose-100 dark:border-rose-900/50 animate-pulse text-rose-600 dark:text-rose-400 shadow-sm">
                  <ShieldAlert size={12} />
                  <span className="text-[10px] font-black uppercase">Restricted Airspace Alert</span>
                </div>
              )}
              {suggestedAircraftDetails && leg.distance > suggestedAircraftDetails.range * 0.85 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-100 dark:border-amber-900/50 text-amber-600 dark:text-amber-400">
                  <Fuel size={12} />
                  <span className="text-[10px] font-black uppercase">Range Critical</span>
                </div>
              )}
              <button 
                onClick={() => setExpanded(!expanded)}
                className={`ml-auto px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  expanded ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100'
                }`}
              >
                {expanded ? 'Collapse Insights' : 'Expand Strategic Intel'}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700 space-y-8 relative z-10"
            >
              {/* Mission Specs Dashboard */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50/50 dark:bg-gray-900/60 rounded-3xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Fuel Burn Strategy</p>
                  <p className="text-lg font-black text-gray-900 dark:text-white">
                    {Math.round(leg.fuelBurn).toLocaleString()} <span className="text-[10px] text-gray-400">kg</span>
                  </p>
                </div>
                <div className="p-4 bg-gray-50/50 dark:bg-gray-900/60 rounded-3xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Operational Altitude</p>
                  <p className="text-lg font-black text-gray-900 dark:text-white">
                    FL{Math.round(leg.altitude / 100) || '---'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50/50 dark:bg-gray-900/60 rounded-3xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Runway Length (Dest)</p>
                  <p className="text-lg font-black text-gray-900 dark:text-white">
                    {leg.destinationDetails?.runwayLength?.toLocaleString() || '---'} <span className="text-[10px] text-gray-400">ft</span>
                  </p>
                </div>
                <div className="p-4 bg-gray-50/50 dark:bg-gray-900/60 rounded-3xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Customs Access</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${leg.destinationDetails?.customsAvailable ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500'}`} />
                    <p className="text-lg font-black text-gray-900 dark:text-white">
                      {leg.destinationDetails?.customsAvailable ? 'AOE Ready' : 'Restricted'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Tactical Operations Center */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                       <FileText size={12} /> STRATEGIC ORDERS & DISPATCH REMARKS
                    </label>
                  </div>
                  <textarea
                    value={leg.operationalNotes || ''}
                    onChange={(e) => onNoteChange(idx, e.target.value)}
                    placeholder="Input tactical notes, pax preferences, or en-route tactical changes..."
                    className="w-full p-5 bg-gray-50/50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-3xl text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all min-h-[160px] shadow-inner font-medium leading-relaxed"
                  />
                </div>

                {/* Advanced Logistics - Request #1 Breakdown Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h5 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                      <Zap size={12} /> ADVANCED LOGISTICS & SAFETY DATA
                    </h5>
                    <button 
                      onClick={() => setShowLogistics(!showLogistics)}
                      className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-transform"
                    >
                      {showLogistics ? 'Show Basic Overview' : 'View Detailed Breakdown'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Primary Support Node */}
                    <div className="p-4 bg-white dark:bg-gray-950 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-all">
                       <div className="flex items-center gap-4">
                         <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600">
                           <Users size={16} />
                         </div>
                         <div>
                           <p className="text-[8px] font-bold text-gray-400 uppercase">Strategic Handler ({leg.destination})</p>
                           <p className="text-xs font-black text-gray-900 dark:text-white truncate max-w-[180px]">
                             {leg.selectedHandlingAgent?.companyName || 'Dispatch Pending...'}
                           </p>
                         </div>
                       </div>
                       <button onClick={() => setActiveTab('handling')} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Select</button>
                    </div>

                    <AnimatePresence>
                      {showLogistics && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-3 overflow-hidden"
                        >
                          <div className="p-5 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-800/50 space-y-5">
                            <div>
                               <p className="text-[10px] font-black text-gray-400 uppercase mb-3 flex items-center gap-2">
                                 <Globe size={10} /> FIR TRANSITIONS & CLEARANCE PATH
                               </p>
                               <div className="flex flex-wrap gap-2">
                                 {leg.firs && leg.firs.length > 0 ? leg.firs.map((fir: any, fIdx: number) => (
                                   <div key={fIdx} className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-[10px] font-black text-indigo-600 flex items-center gap-2 shadow-sm">
                                      {fir.firCode} <span className="opacity-40 text-gray-400">|</span> <span className="text-gray-900 dark:text-white">${fir.overflightCharge || 0}</span>
                                   </div>
                                 )) : <p className="text-[10px] text-gray-500 italic">No FIR transition data resolved for this segment.</p>}
                               </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                 <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Clearances</p>
                                 <div className="flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-emerald-500" />
                                    <p className="text-xs font-black">{(leg.permits?.length || 0)} Secured</p>
                                 </div>
                               </div>
                               <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                 <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Risk Profile</p>
                                 <p className="text-xs font-black text-emerald-500 uppercase tracking-tighter">Low Intensity</p>
                               </div>
                            </div>
                            <div className="pt-2">
                               <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Segment Waypoints</p>
                               <div className="flex flex-wrap gap-2">
                                 {leg.routeWaypoints?.slice(0, 8).map((wp: string, i: number) => (
                                   <span key={i} className="text-[9px] font-mono text-indigo-600 bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-700">{wp}</span>
                                 ))}
                                 {leg.routeWaypoints?.length > 8 && <span className="text-[9px] text-gray-400">+{leg.routeWaypoints.length - 8} more</span>}
                               </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Crew Integration Section */}
                    <div className="pt-4">
                       <div className="flex items-center justify-between mb-3 px-1">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Users size={12} /> MISSION CREW ASSIGNMENT
                          </p>
                          <button onClick={() => setActiveTab('crew')} className="text-[9px] font-bold text-indigo-600 hover:underline">Manage All</button>
                       </div>
                       <div className="flex flex-wrap gap-2">
                         {crewList.map((member: any) => {
                           const isAssigned = (leg.crewAssignments || []).some((c: any) => c.id === member.id);
                           return (
                             <button
                               key={member.id}
                               onClick={() => onAssignCrew(idx, member)}
                               className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${
                                 isAssigned 
                                   ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' 
                                   : 'bg-white dark:bg-gray-950 text-gray-500 border-gray-100 dark:border-gray-800 hover:border-indigo-300'
                               }`}
                             >
                               {member.name}
                             </button>
                           );
                         })}
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default function AIPlanner({ aircraftList, plan, onPlanChange, onHoverLeg, formData, onFormDataChange, currentQuoteLegs, setActiveMapInput }: AIPlannerProps) {
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

  const handleRefreshHandlingAgents = async (legIdx: number, type: 'departure' | 'destination') => {
    if (!plan) return;
    setLoading(true);
    setQuotaError(false);
    try {
      const icao = type === 'departure' ? plan.legs[legIdx].departure : plan.legs[legIdx].destination;
      const details = type === 'departure' ? plan.legs[legIdx].departureDetails : plan.legs[legIdx].destinationDetails;
      
      const result = await searchHandlingAgents(
        icao, 
        details?.name, 
        details?.city, 
        plan.suggestedAircraft, 
        true
      );
      
      const newLegs = [...plan.legs];
      if (type === 'departure') {
        newLegs[legIdx].departureHandlingAgents = result.agents || [];
      } else {
        newLegs[legIdx].handlingAgents = result.agents || [];
      }
      
      onPlanChange({ ...plan, legs: newLegs });
    } catch (error) {
      console.error('Refresh Handling Agents Error:', error);
      if (error instanceof Error && (error.message.includes('Quota') || error.message.includes('429'))) {
        setQuotaError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAirportDetails = async (legIdx: number, type: 'departure' | 'destination') => {
    if (!plan) return;
    setLoading(true);
    setQuotaError(false);
    try {
      const icao = type === 'departure' ? plan.legs[legIdx].departure : plan.legs[legIdx].destination;
      const details = await getAirportDetails(icao, true);
      
      const newLegs = [...plan.legs];
      if (type === 'departure') {
        newLegs[legIdx].departureDetails = details;
      } else {
        newLegs[legIdx].destinationDetails = details;
      }
      
      onPlanChange({ ...plan, legs: newLegs });
    } catch (error) {
      console.error('Refresh Airport Details Error:', error);
      if (error instanceof Error && (error.message.includes('Quota') || error.message.includes('429'))) {
        setQuotaError(true);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // New input states
  const [departure, setDeparture] = useState(formData?.departure || '');
  const [destination, setDestination] = useState(formData?.destination || '');
  const [date, setDate] = useState(formData?.date || '');
  const [passengers, setPassengers] = useState(formData?.passengers?.toString() || '1');
  const [aircraftPreference, setAircraftPreference] = useState('');

  const [minAltitude, setMinAltitude] = useState('');

  useEffect(() => {
    if (formData) {
      if (formData.departure !== undefined) setDeparture(formData.departure);
      if (formData.destination !== undefined) setDestination(formData.destination);
      if (formData.date !== undefined) setDate(formData.date);
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
        const agents = await searchHandlingAgents(
          updatedLeg.destination, 
          updatedLeg.destinationDetails?.name, 
          updatedLeg.destinationDetails?.city, 
          plan.suggestedAircraft
        );
        updatedLeg.handlingAgents = agents?.agents || [];
        updatedLeg.handlingAgentsLastUpdated = agents?.lastUpdated;
        updatedLeg.isHandlingAgentsFromCache = !!agents?.isFromCache;
        // Auto-select destination agent if NOT already selected
        if (!updatedLeg.selectedHandlingAgent && updatedLeg.handlingAgents.length > 0) {
          const firstAgent = updatedLeg.handlingAgents[0];
          updatedLeg.selectedHandlingAgent = firstAgent;
          updatedLeg.costs = {
            ...updatedLeg.costs,
            handling: firstAgent.baseFee || 0
          };
        }
        legChanged = true;
      }
      if (!updatedLeg.departureHandlingAgents) {
        const agents = await searchHandlingAgents(
          updatedLeg.departure, 
          updatedLeg.departureDetails?.name, 
          updatedLeg.departureDetails?.city, 
          plan.suggestedAircraft
        );
        updatedLeg.departureHandlingAgents = agents?.agents || [];
        updatedLeg.departureHandlingAgentsLastUpdated = agents?.lastUpdated;
        updatedLeg.isDepartureHandlingAgentsFromCache = !!agents?.isFromCache;
        // Auto-select departure agent if NOT already selected
        if (!updatedLeg.selectedDepartureHandlingAgent && updatedLeg.departureHandlingAgents.length > 0) {
          const firstAgent = updatedLeg.departureHandlingAgents[0];
          updatedLeg.selectedDepartureHandlingAgent = firstAgent;
          updatedLeg.costs = {
            ...updatedLeg.costs,
            departureHandling: firstAgent.baseFee || 0
          };
        }
        legChanged = true;
      }
      if (!updatedLeg.firs || updatedLeg.firs.length === 0 || updatedLeg.firs.every((f: any) => !f.overflightCharge)) {
        const firAnalysis = await getLegFIRAnalysis(updatedLeg.departure, updatedLeg.destination, plan.suggestedAircraft);
        const analyzedFirs = firAnalysis.firs || [];
        
        // Deep enrich FIRs with details (Sequential to save quota)
        const enrichedFirs = [];
        for (const fir of analyzedFirs) {
          const details = await getFIRDetails(fir.firCode || fir.name, fir.firName || fir.name, plan.suggestedAircraft);
          enrichedFirs.push({ ...fir, ...details });
          // Small delay between calls if multiple
          if (analyzedFirs.length > 1) await new Promise(r => setTimeout(r, 800));
        }

        updatedLeg.firs = enrichedFirs;
        
        // Update costs based on FIRs
        const totalOverflight = enrichedFirs.reduce((sum: number, f: any) => sum + (f.overflightCharge || 0), 0);
        const totalNavigation = enrichedFirs.reduce((sum: number, f: any) => sum + (f.navigationCharge || 0), 0);
        
        if (updatedLeg.costs) {
          updatedLeg.costs.overflight = totalOverflight;
          updatedLeg.costs.navigation = totalNavigation;
          updatedLeg.costs.total = Object.entries(updatedLeg.costs)
            .filter(([k]) => k !== 'total')
            .reduce((sum, [_, v]) => sum + (typeof v === 'number' ? v : 0), 0);
        }
        legChanged = true;
      } else {
        // Even if FIRs exist, check if they need enrichment
        const needsEnrichment = updatedLeg.firs.some((f: any) => !f.address);
        if (needsEnrichment) {
          const enrichedFirs = [];
          for (const f of updatedLeg.firs) {
            if (f.address) {
              enrichedFirs.push(f);
            } else {
              const details = await getFIRDetails(f.code || f.name, f.name, plan.suggestedAircraft);
              enrichedFirs.push({ ...f, ...details });
              await new Promise(r => setTimeout(r, 800));
            }
          }
          updatedLeg.firs = enrichedFirs;
          legChanged = true;
        }
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

  // Automatically fetch details when legs are added or updated
  useEffect(() => {
    let ignore = false;
    async function doFetch() {
      if (plan && plan.legs && plan.legs.length > 0) {
        // Check if any leg is missing details or has changed airport
        const needsFetch = plan.legs.some((leg: any) => 
          !leg.departureDetails || 
          !leg.destinationDetails || 
          !leg.handlingAgents || 
          !leg.departureHandlingAgents ||
          !leg.firs ||
          leg.firs.length === 0 ||
          leg.firs.some((f: any) => f.overflightCharge === undefined || f.navigationCharge === undefined) ||
          (leg.departureDetails && leg.departureDetails.icao !== leg.departure) ||
          (leg.destinationDetails && leg.destinationDetails.icao !== leg.destination)
        );

        if (needsFetch) {
          await fetchMissingLegDetails();
        }
      }
    }
    if (!ignore) {
      doFetch();
    }
    return () => { ignore = true; };
  }, [plan?.legs?.map((l: any) => `${l.departure}-${l.destination}`).join(','), plan?.suggestedAircraft]);

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
            departureHandling: agent.baseFee || 0
          }
        };
      } else {
        newLegs[legIdx] = { 
          ...newLegs[legIdx], 
          selectedHandlingAgent: agent,
          costs: {
            ...newLegs[legIdx].costs,
            handling: agent.baseFee || 0
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

    onPlanChange({ ...plan, legs: newLegs, totalCost: legsCost + (plan.initialHandlingCost || 0) });
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
              leg.handlingAgents = agentsResult.agents.slice(0, 3);
            }
          }

          // Fetch detailed handling agents for departure
          if (leg.departure) {
            const depAgentsResult = await searchHandlingAgents(leg.departure);
            if (depAgentsResult && depAgentsResult.agents) {
              leg.departureHandlingAgents = depAgentsResult.agents.slice(0, 3);
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
                onFocus={() => setActiveMapInput?.('departure')}
                onChange={(e) => {
                  setDeparture(e.target.value);
                  if (onFormDataChange && formData) {
                    onFormDataChange({ ...formData, departure: e.target.value.toUpperCase() });
                  }
                }}
                placeholder="ICAO / City"
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white outline-none focus:border-indigo-500 hover:border-indigo-300 transition-colors cursor-pointer"
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
                onFocus={() => setActiveMapInput?.('destination')}
                onChange={(e) => {
                  setDestination(e.target.value);
                  if (onFormDataChange && formData) {
                    onFormDataChange({ ...formData, destination: e.target.value.toUpperCase() });
                  }
                }}
                placeholder="ICAO / City"
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white outline-none focus:border-indigo-500 hover:border-indigo-300 transition-colors cursor-pointer"
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
          className="bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-900 dark:to-indigo-950 p-6 rounded-3xl text-white shadow-xl shadow-indigo-200 dark:shadow-none"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Active Mission Aircraft</p>
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <select 
                    value={plan.suggestedAircraft}
                    onChange={(e) => onPlanChange({ ...plan, suggestedAircraft: e.target.value })}
                    className="text-2xl font-black bg-white/10 dark:bg-black/20 px-3 py-1 rounded-xl border-none outline-none cursor-pointer hover:bg-white/20 transition-all appearance-none pr-8"
                  >
                    {uniqueAircraftTypes.map(type => (
                      <option key={type} value={type} className="bg-indigo-600 dark:bg-indigo-900 text-white">
                        {type}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none" size={16} />
                </div>
                {suggestedAircraftDetails && (
                  <div className="flex items-center gap-2 bg-white/10 dark:bg-black/20 px-3 py-1 rounded-full border border-white/10">
                    <Zap size={12} className="text-amber-300" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{suggestedAircraftDetails.range?.toLocaleString()} NM Range</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white/20 dark:bg-black/20 p-3 rounded-2xl backdrop-blur-md border border-white/10">
              <Plane size={32} className="text-indigo-100" />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/10 dark:bg-black/20 p-3 rounded-2xl border border-white/5">
              <div className="flex items-center gap-1.5 opacity-70 mb-1">
                <DollarSign size={12} />
                <p className="text-[10px] font-bold uppercase tracking-widest">Mission Cost</p>
              </div>
              <p className="text-xl font-black">${plan.totalCost?.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 dark:bg-black/20 p-3 rounded-2xl border border-white/5">
              <div className="flex items-center gap-1.5 opacity-70 mb-1">
                <Globe size={12} />
                <p className="text-[10px] font-bold uppercase tracking-widest">Total Distance</p>
              </div>
              <p className="text-xl font-black">{totalDistance?.toLocaleString()} nm</p>
            </div>
            <div className="bg-white/10 dark:bg-black/20 p-3 rounded-2xl border border-white/5">
              <div className="flex items-center gap-1.5 opacity-70 mb-1">
                <Clock size={12} />
                <p className="text-[10px] font-bold uppercase tracking-widest">Flight Time</p>
              </div>
              <p className="text-xl font-black">{plan.legs.reduce((acc: number, l: any) => acc + (l.flightTime || 0), 0).toFixed(1)} hrs</p>
            </div>
            <div className="bg-white/10 dark:bg-black/20 p-3 rounded-2xl border border-white/5">
              <div className="flex items-center gap-1.5 opacity-70 mb-1">
                <Fuel size={12} />
                <p className="text-[10px] font-bold uppercase tracking-widest">Fuel Burn</p>
              </div>
              <p className="text-xl font-black">{plan.legs.reduce((acc: number, l: any) => acc + (l.fuelBurn || 0), 0).toLocaleString()} lbs</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between bg-white/10 dark:bg-black/20 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${quotaError ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                {quotaError ? 'Service Running in Fallback Mode' : 'AI Mission Strategy Optimized'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={generatePDF} className="flex items-center gap-1.5 hover:text-indigo-200 transition-colors">
                <Download size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Export PDF</span>
              </button>
            </div>
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

      {quotaError && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="text-amber-600 shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-widest">AI Service Busy (Quota Exceeded)</p>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">We're experiencing high demand. Some live lookups (like handling agents or FIR details) might use cached data or be unavailable for a minute. Please try again soon.</p>
          </div>
          <button 
            onClick={() => setQuotaError(false)}
            className="text-[10px] font-black uppercase text-amber-600 hover:text-amber-700 underline"
          >
            Dismiss
          </button>
        </div>
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
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
                      <Route size={160} />
                    </div>
                    
                    <div className="flex items-center justify-between mb-8 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                          <ListOrdered size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none mb-1">Strategic Mission Flow</h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Operational Sequence & Logistics</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={fetchMissingLegDetails}
                          disabled={loading}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 dark:border-indigo-800"
                        >
                          {loading ? <Loader2 className="animate-spin" size={12} /> : <Activity size={12} />}
                          <span>Sync Leg Analytics</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-4 relative">
                      {/* Vertical line connector */}
                      <div className="absolute left-[27px] top-8 bottom-8 w-0.5 bg-gray-100 dark:bg-gray-800/50 hidden md:block" />
                      
                      {plan.legs.map((leg: any, idx: number) => (
                        <LegCard 
                          key={idx}
                          leg={leg}
                          idx={idx}
                          onHover={onHoverLeg}
                          onNoteChange={handleLegNoteChange}
                          onAssignCrew={handleAssignCrew}
                          crewList={crewList}
                          suggestedAircraftDetails={suggestedAircraftDetails}
                          setActiveTab={setActiveTab}
                          handleSuggestStops={handleSuggestStops}
                          hoveredLegIndex={hoveredLegIndex}
                        />
                      ))}
                    </div>
                  </div>
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
                    onLegsChange={(newLegs) => {
                      const totalCost = newLegs.reduce((sum, l) => sum + (l.costs?.total || 0), 0) + (plan.initialHandlingCost || 0);
                      onPlanChange({ ...plan, legs: newLegs, totalCost });
                    }}
                  />
                </div>
              )}

              {activeTab === 'handling' && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
                        <Users size={24} className="text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Ground Handling Network</h3>
                        <p className="text-xs text-gray-500 font-medium">Select and manage FBO services for each leg of the mission.</p>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        for(let i=0; i<plan.legs.length; i++) {
                           await handleRefreshHandlingAgents(i, 'departure');
                           await handleRefreshHandlingAgents(i, 'destination');
                        }
                      }}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 transition-all group disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Zap size={18} className="group-hover:scale-110 transition-transform" />
                      )}
                      <span className="uppercase tracking-widest text-[11px]">Audit All Agents</span>
                    </button>
                  </div>
                  <HandlingAgentsPanel 
                    legs={plan.legs}
                    onSelectAgent={handleSelectAgent}
                    onRefreshAgents={handleRefreshHandlingAgents}
                    loading={loading}
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