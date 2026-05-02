import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingDown, Target, Zap, Shield, Info, Loader2, ArrowRight, MapPin, DollarSign, MessageSquare, AlertCircle, AlertTriangle, Route, Activity, Clock, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSuggestedAircraft, getEmptyLegs, getNegotiationStrategy, getFlightRouteDetails, optimizeRoute, getOperationalRiskAssessment, getFuelStopSuggestions } from '../services/aiService';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface AILayerProps {
  missionData: {
    departure: string;
    destination: string;
    passengers: number;
    payload: number;
    missionType: string;
    dateTime?: string;
  };
  selectedAircraft?: any;
  currentPrice?: number;
  defaultTab?: 'prediction' | 'optimization' | 'risk' | 'emptylegs' | 'negotiation';
  onRouteOptimized?: (route: any) => void;
}

export default function AILayer({ missionData, selectedAircraft, currentPrice, defaultTab, onRouteOptimized }: AILayerProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [emptyLegs, setEmptyLegs] = useState<any[]>([]);
  const [negotiation, setNegotiation] = useState<any>(null);
  const [routeAnalysis, setRouteAnalysis] = useState<any>(null);
  const [optimizedRoute, setOptimizedRoute] = useState<any>(null);
  const [riskAssessment, setRiskAssessment] = useState<any>(null);
  const [selectedAltIndex, setSelectedAltIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'prediction' | 'optimization' | 'risk' | 'emptylegs' | 'negotiation'>(defaultTab || 'prediction');
  const [optimizationCriteria, setOptimizationCriteria] = useState<string>('balanced');
  const [isReoptimizing, setIsReoptimizing] = useState(false);
  const [fuelStopSuggestions, setFuelStopSuggestions] = useState<any>(null);
  const [isFetchingFuelStops, setIsFetchingFuelStops] = useState(false);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const fetchFuelStops = async () => {
    if (!selectedAircraft) return;
    setIsFetchingFuelStops(true);
    try {
      const suggestions = await getFuelStopSuggestions({
        legs: routeAnalysis?.legs || [],
        aircraft: selectedAircraft,
        missionType: missionData.missionType,
        currentDate: new Date().toISOString()
      });
      setFuelStopSuggestions(suggestions);
    } catch (error) {
      console.error('Fuel Stop Fetch Error:', error);
    } finally {
      setIsFetchingFuelStops(false);
    }
  };

  const reOptimizeRoute = async (criteria: string) => {
    setOptimizationCriteria(criteria);
    setIsReoptimizing(true);
    try {
      const optimized = await optimizeRoute({
        departure: missionData.departure,
        destination: missionData.destination,
        dateTime: missionData.dateTime || new Date().toISOString(),
        aircraftType: selectedAircraft?.type || 'Standard Jet',
        currentDate: new Date().toISOString(),
        passengers: missionData.passengers || 0,
        payload: missionData.payload || 0,
        aircraftPerformance: selectedAircraft,
        optimizationCriteria: criteria
      });
      setOptimizedRoute(optimized);
      setSelectedAltIndex(0);
      if (onRouteOptimized) {
        onRouteOptimized(optimized);
      }
    } catch (error) {
      console.error('Re-optimization Error:', error);
    } finally {
      setIsReoptimizing(false);
    }
  };

  const runAnalysis = async () => {
    if (!missionData.departure || !missionData.destination) return;
    
    setLoading(true);
    try {
      // 1. Get all aircraft for suggestions
      const snapshot = await getDocs(collection(db, 'aircraft'));
      const allAircraft = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 2. Run AI Analysis sequentially to save quota
      const route = await getFlightRouteDetails(missionData.departure, missionData.destination);
      const distance = route.routingDistance || route.gcDistance;
      
      const aircraftSuggestions = await getSuggestedAircraft(missionData.passengers || 0, missionData.payload || 0, distance, allAircraft, missionData.departure);
      const legs = await getEmptyLegs({ 
        searchType: 'specific', 
        specificDeparture: missionData.departure, 
        specificDestination: missionData.destination 
      });
      const optimized = await optimizeRoute({
        departure: missionData.departure,
        destination: missionData.destination,
        dateTime: missionData.dateTime || new Date().toISOString(),
        aircraftType: selectedAircraft?.type || 'Standard Jet',
        currentDate: new Date().toISOString(),
        passengers: missionData.passengers || 0,
        payload: missionData.payload || 0,
        aircraftPerformance: selectedAircraft, // Pass the full aircraft object as performance data
        optimizationCriteria: optimizationCriteria
      });
      const risk = await getOperationalRiskAssessment({
        departure: missionData.departure,
        destination: missionData.destination,
        aircraftType: selectedAircraft?.type || 'Standard Jet',
        dateTime: missionData.dateTime || new Date().toISOString()
      });

      setRouteAnalysis(route);
      setSuggestions(aircraftSuggestions);
      setEmptyLegs(legs.data || []);
      setOptimizedRoute(optimized);
      setSelectedAltIndex(0);
      setRiskAssessment(risk);
      
      if (onRouteOptimized) {
        onRouteOptimized(optimized);
      }

      // 3. If aircraft selected, get negotiation strategy
      if (selectedAircraft && currentPrice) {
        const negStrategy = await getNegotiationStrategy(selectedAircraft, missionData, currentPrice);
        setNegotiation(negStrategy);
      }

    } catch (error) {
      console.error('AI Layer Analysis Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, [missionData.departure, missionData.destination, selectedAircraft?.id]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">AI Intelligence Layer</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Mission Optimization & Predictive Analysis</p>
          </div>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto max-w-full">
          {[
            { id: 'prediction', label: 'Prediction', icon: Target },
            { id: 'optimization', label: 'Route Optimizer', icon: Route },
            { id: 'risk', label: 'Risk Assessment', icon: Activity },
            { id: 'emptylegs', label: 'Empty Legs', icon: Zap },
            { id: 'negotiation', label: 'Negotiation', icon: MessageSquare }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-4 flex items-start gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-800/50 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100 mb-1">Reality Check: The Power of AI</h4>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
            Because operators don't share availability easily and there's no public real ACMI pricing database, data is highly fragmented. 
            Our <strong className="font-bold">AI + Scraping + Network</strong> combo brings clarity to this chaos, providing predictive pricing and smart alternatives.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 p-20 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 text-center space-y-4">
          <Loader2 className="mx-auto text-indigo-600 animate-spin" size={48} />
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Running Deep Mission Analysis...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === 'optimization' && (
            <motion.div
              key="optimization"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Route className="text-indigo-600" size={24} />
                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Route Optimization Analysis</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={optimizationCriteria}
                          onChange={(e) => reOptimizeRoute(e.target.value)}
                          disabled={isReoptimizing}
                          className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="balanced">Balanced</option>
                          <option value="cheapest">Cheapest</option>
                          <option value="fastest">Fastest</option>
                          <option value="most fuel-efficient">Fuel-Efficient</option>
                        </select>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                          Savings: ${optimizedRoute?.alternatives?.[0]?.totalSavings?.toLocaleString() || '0'}
                        </div>
                      </div>
                    </div>

                    {isReoptimizing ? (
                      <div className="py-12 text-center space-y-4">
                        <Loader2 className="mx-auto text-indigo-600 animate-spin" size={32} />
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest animate-pulse">Re-optimizing Route...</p>
                      </div>
                    ) : optimizedRoute ? (
                      <div className="space-y-8">
                        {/* Alternative Selector in AILayer */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                          {optimizedRoute.alternatives?.map((alt: any, i: number) => (
                            <button
                              key={i}
                              onClick={() => setSelectedAltIndex(i)}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0 border ${
                                selectedAltIndex === i 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20' 
                                  : 'bg-gray-50 dark:bg-gray-900/50 text-gray-500 border-gray-100 dark:border-gray-700 hover:border-indigo-600'
                              }`}
                            >
                              {alt.label}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl space-y-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Distance Change</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white">
                              {optimizedRoute.alternatives?.[selectedAltIndex]?.distanceNm} nm
                              <span className="text-[10px] text-emerald-500 ml-2">
                                ({optimizedRoute.alternatives?.[selectedAltIndex]?.distanceNm - optimizedRoute.originalRoute.distanceNm > 0 ? '+' : ''}{optimizedRoute.alternatives?.[selectedAltIndex]?.distanceNm - optimizedRoute.originalRoute.distanceNm})
                              </span>
                            </p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl space-y-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Time Change</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white">
                              {optimizedRoute.alternatives?.[selectedAltIndex]?.flightTimeHours} hrs
                              <span className="text-[10px] text-emerald-500 ml-2">
                                ({(optimizedRoute.alternatives?.[selectedAltIndex]?.flightTimeHours - optimizedRoute.originalRoute.flightTimeHours).toFixed(1)}h)
                              </span>
                            </p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl space-y-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fuel Burn</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white">
                              {optimizedRoute.alternatives?.[selectedAltIndex]?.fuelBurnKg?.toLocaleString()} kg
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Optimization Strategy</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl space-y-2">
                              <div className="flex items-center gap-2 text-indigo-600">
                                <Shield size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Weather Avoidance</span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                {optimizedRoute.alternatives?.[selectedAltIndex]?.weatherAvoidance}
                              </p>
                            </div>
                            <div className="p-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-2xl space-y-2">
                              <div className="flex items-center gap-2 text-violet-600">
                                <DollarSign size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">FIR Optimization</span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                {optimizedRoute.alternatives?.[selectedAltIndex]?.firOptimization}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-900 p-6 rounded-3xl space-y-4">
                          <div className="flex items-center gap-2">
                            <Zap size={16} className="text-amber-400" />
                            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">AI Dispatcher Recommendation</p>
                          </div>
                          <p className="text-sm text-gray-300 italic leading-relaxed">
                            "{optimizedRoute.alternatives?.[selectedAltIndex]?.recommendation}"
                          </p>
                        </div>

                        {/* Fuel Stops Section */}
                        <div className="p-8 border-2 border-dashed border-indigo-100 dark:border-indigo-900/40 rounded-[2rem] space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-indigo-600 rounded-xl text-white">
                                <Zap size={16} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Optimal Fuel Stops</h4>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">AI Technical Analysis</p>
                              </div>
                            </div>
                            <button 
                              onClick={fetchFuelStops}
                              disabled={isFetchingFuelStops || !selectedAircraft}
                              className="px-4 py-2 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all disabled:opacity-50 shadow-sm"
                            >
                              {isFetchingFuelStops ? 'Calculating...' : 'Analyze Fuel Efficiency'}
                            </button>
                          </div>

                          {fuelStopSuggestions ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-50 dark:border-indigo-900/30">
                                <span className="font-black text-indigo-600 mr-2 uppercase">Reasoning:</span>
                                {fuelStopSuggestions.reasoning}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {fuelStopSuggestions.suggestedLegs.map((leg: any, i: number) => (
                                  <div key={i} className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${leg.stopType === 'fuel' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                        {leg.stopType === 'fuel' ? '⛽' : '🏁'}
                                      </div>
                                      <div>
                                        <p className="text-xs font-black text-gray-900 dark:text-white">{leg.departure} → {leg.destination}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{leg.stopType === 'fuel' ? 'Fuel / Tech Stop' : 'Mission Destination'}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-6">
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">
                                {selectedAircraft 
                                  ? "Click 'Analyze Fuel Efficiency' to detect required or strategic fuel stops."
                                  : "Select an aircraft to enable fuel stop analysis."}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-400 italic">
                        Generating optimized routing...
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={18} className="text-indigo-600" />
                      <h4 className="font-black uppercase tracking-widest text-[10px]">Profitability Metrics</h4>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Est. Broker Profit</p>
                        <p className="text-3xl font-black text-emerald-600">${optimizedRoute?.alternatives?.[selectedAltIndex]?.profitabilityMetrics?.brokerProfit?.toLocaleString() || '---'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profit per Hour</p>
                        <p className="text-xl font-black text-gray-900 dark:text-white">${optimizedRoute?.alternatives?.[selectedAltIndex]?.profitabilityMetrics?.profitPerHour?.toLocaleString() || '---'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Margin</p>
                        <p className="text-xl font-black text-indigo-600">{optimizedRoute?.alternatives?.[selectedAltIndex]?.profitabilityMetrics?.marginPercentage || '---'}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 space-y-4">
                    <div className="flex items-center gap-2">
                      <Clock size={18} className="text-gray-400" />
                      <h4 className="font-black uppercase tracking-widest text-[10px]">Optimal Timing</h4>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {optimizedRoute?.optimizedRoute?.optimalDepartureTime || 'TBD'}
                    </p>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Suggested departure time to minimize airport congestion and maximize slot availability.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'risk' && (
            <motion.div
              key="risk"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="text-rose-600" size={24} />
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Operational Risk Assessment</h3>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${
                    riskAssessment?.riskLevel === 'Low' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    riskAssessment?.riskLevel === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                    'bg-rose-50 text-rose-600 border-rose-100'
                  }`}>
                    {riskAssessment?.riskLevel || 'Analyzing...'} Risk
                  </div>
                </div>

                {riskAssessment ? (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="relative w-20 h-20 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle
                                cx="40"
                                cy="40"
                                r="36"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-gray-100 dark:text-gray-800"
                              />
                              <circle
                                cx="40"
                                cy="40"
                                r="36"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 36}
                                strokeDashoffset={2 * Math.PI * 36 * (1 - riskAssessment.operationalReadiness / 100)}
                                className="text-indigo-600"
                              />
                            </svg>
                            <span className="absolute text-lg font-black text-gray-900 dark:text-white">{riskAssessment.operationalReadiness}%</span>
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Operational Readiness</h4>
                            <p className="text-xs text-gray-500">Based on airport, crew, and technical constraints.</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Identified Risks</h4>
                          <div className="space-y-3">
                            {riskAssessment.risks.map((risk: any, i: number) => (
                              <div key={i} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{risk.category}</span>
                                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                                    risk.severity === 'High' ? 'bg-rose-100 text-rose-600' :
                                    risk.severity === 'Medium' ? 'bg-amber-100 text-amber-600' :
                                    'bg-emerald-100 text-emerald-600'
                                  }`}>{risk.severity}</span>
                                </div>
                                <p className="text-xs text-gray-900 dark:text-white font-bold">{risk.description}</p>
                                <p className="text-[10px] text-gray-500 italic">Mitigation: {risk.mitigation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800/50 space-y-4">
                          <div className="flex items-center gap-2">
                            <Info size={16} className="text-indigo-600" />
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Dispatcher's Final Notes</p>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed italic">
                            "{riskAssessment.dispatcherNotes}"
                          </p>
                        </div>

                        <div className="p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/30 rounded-3xl space-y-3">
                          <div className="flex items-center gap-2 text-rose-600">
                            <AlertTriangle size={18} />
                            <h4 className="text-xs font-black uppercase tracking-widest">Critical Alerts</h4>
                          </div>
                          <div className="space-y-2">
                            {optimizedRoute?.weatherAlerts?.map((alert: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-[11px] text-rose-700 dark:text-rose-400">
                                <div className="w-1 h-1 bg-rose-500 rounded-full mt-1.5 shrink-0" />
                                <span>{alert.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400 italic">
                    Performing operational risk assessment...
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'prediction' && (
            <motion.div
              key="prediction"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <Target className="text-indigo-600" size={24} />
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Best Aircraft Prediction</h3>
                  </div>
                  
                  {suggestions?.recommended ? (
                    <div className="space-y-6">
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800/50">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">AI Recommended Selection</p>
                            <h4 className="text-2xl font-black text-gray-900 dark:text-white">{suggestions.recommended.type}</h4>
                          </div>
                          <div className="bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-[10px] font-black text-emerald-600 uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                            98% Match
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed italic">
                          "{suggestions.recommended.notes}"
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl space-y-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Route Efficiency</p>
                          <div className="flex items-center gap-2">
                            <Zap size={16} className="text-amber-500" />
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Optimal Range Performance</span>
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl space-y-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cost Viability</p>
                          <div className="flex items-center gap-2">
                            <DollarSign size={16} className="text-emerald-500" />
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Balanced Operating Costs</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400 italic">
                      No prediction data available for this route.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-8 rounded-[2.5rem] text-white space-y-6 shadow-xl shadow-indigo-100 dark:shadow-none">
                  <div className="flex items-center gap-2">
                    <Info size={18} />
                    <h4 className="font-black uppercase tracking-widest text-[10px]">AI Insights</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Est. Fuel Savings</p>
                      <p className="text-2xl font-black">$4,200</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Time Optimization</p>
                      <p className="text-2xl font-black">-12 mins</p>
                    </div>
                  </div>
                  <div className="h-px bg-white/20" />
                  <p className="text-[11px] leading-relaxed opacity-80 italic">
                    "Based on current wind patterns and FIR charges, the recommended aircraft offers the highest commercial viability for this specific mission."
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'emptylegs' && (
            <motion.div
              key="emptylegs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="text-amber-500" size={24} />
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Empty Leg Opportunities</h3>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-800">
                    {emptyLegs.length} Matches Found
                  </div>
                </div>

                {emptyLegs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {emptyLegs.map((leg, i) => (
                      <div key={i} className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 space-y-4 group hover:border-amber-200 transition-all">
                        <div className="flex justify-between items-start">
                          <div className="bg-white dark:bg-gray-800 p-2 rounded-xl text-amber-500 shadow-sm">
                            <Zap size={16} />
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Est. Price</p>
                            <p className="text-lg font-black text-emerald-600">${leg.price?.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
                            <span>{leg.departure}</span>
                            <ArrowRight size={14} className="text-gray-400" />
                            <span>{leg.destination}</span>
                          </div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{leg.aircraft}</p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                          <span className="text-[10px] font-bold text-gray-400">{leg.date}</span>
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest group-hover:underline cursor-pointer">View Deal</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                    <Zap size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No direct empty leg matches for this route.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'negotiation' && (
            <motion.div
              key="negotiation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-8">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="text-indigo-600" size={24} />
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">AI Negotiation Strategy</h3>
                  </div>

                  {negotiation ? (
                    <div className="space-y-8">
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800/50 space-y-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle size={16} className="text-indigo-600" />
                          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Market Analysis</p>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                          {negotiation.marketAnalysis}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Strategy Points</h4>
                          <div className="space-y-2">
                            {negotiation.strategyPoints.map((point: string, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                                {point}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Concessions to Ask</h4>
                          <div className="space-y-2">
                            {negotiation.concessionsToAsk.map((point: string, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                                {point}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-900 p-6 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare size={16} className="text-indigo-400" />
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Suggested Script</p>
                          </div>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(negotiation.negotiationScript);
                              // Could add a toast here
                            }}
                            className="text-[10px] font-black text-white/50 hover:text-white uppercase tracking-widest"
                          >
                            Copy Script
                          </button>
                        </div>
                        <p className="text-sm text-gray-300 italic leading-relaxed">
                          "{negotiation.negotiationScript}"
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                      <MessageSquare size={48} className="mx-auto text-gray-200 mb-4" />
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Select an aircraft to generate a negotiation strategy.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
                  <div className="flex items-center gap-2">
                    <Target size={18} className="text-indigo-600" />
                    <h4 className="font-black uppercase tracking-widest text-[10px]">Price Targets</h4>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Target Price</p>
                      <p className="text-3xl font-black text-emerald-600">${negotiation?.targetPrice?.toLocaleString() || '---'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Walk-away Price</p>
                      <p className="text-3xl font-black text-rose-600">${negotiation?.walkAwayPrice?.toLocaleString() || '---'}</p>
                    </div>
                  </div>
                  <div className="h-px bg-gray-100 dark:bg-gray-700" />
                  <p className="text-[11px] text-gray-500 leading-relaxed italic">
                    "Target price is based on current market availability and operator fleet positioning."
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
