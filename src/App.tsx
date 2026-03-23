/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plane, MapPin, Calendar, Users, Weight, Loader2, Sparkles, LayoutDashboard, History, Trash2, Plus, Moon, Sun, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSuggestedAircraft, getOptimizedRoute, getWindImpact, getMultiLegRouteDetails, searchAirports } from './services/aiService';
import { db, auth } from './firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { handleFirestoreError, OperationType } from './utils/errorHandling';
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
import MissionSummary from './components/MissionSummary';
import WeatherNotamPanel from './components/WeatherNotamPanel';
import EmptyLegs from './components/EmptyLegs';
import CharterQuoteEngine from './components/CharterQuoteEngine';
import DashboardOverview from './components/DashboardOverview';
import CostingSettings from './components/CostingSettings';
import LeadsManagement from './components/LeadsManagement';
import ReportsAnalytics from './components/ReportsAnalytics';

import Sidebar from './components/Sidebar';
import Header from './components/Header';

export default function App() {
  const [formData, setFormData] = useState({
    departure: '',
    destination: '',
    stopovers: [] as string[],
    dateTime: '',
    passengers: 1,
    cargoWeight: 0,
    aircraftPreference: '',
    brokerMargin: 15,
    operatorMargin: 0
  });
  const [loading, setLoading] = useState(false);
  const [aircraftList, setAircraftList] = useState<any[]>([]);
  const [quoteOptions, setQuoteOptions] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<string>('recommended');
  const [routeData, setRouteData] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [aiPlan, setAiPlan] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [windData, setWindData] = useState<any>(null);
  const [optimizedRoute, setOptimizedRoute] = useState<any>(null);
  const [isLeftColumnCollapsed, setIsLeftColumnCollapsed] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const previewAirports = [formData.departure, ...formData.stopovers, formData.destination].filter(Boolean);

  const handleMapClick = async (lat: number, lng: number) => {
    if (activeTab !== 'manual') return;
    
    setLoading(true);
    try {
      const result = await searchAirports(`${lat}, ${lng}`);
      if (result.airports && result.airports.length > 0) {
        const airport = result.airports[0];
        const code = airport.icao || airport.iata;
        
        if (!formData.departure) {
          setFormData({ ...formData, departure: code });
        } else if (!formData.destination) {
          setFormData({ ...formData, destination: code });
        } else {
          setFormData({ ...formData, stopovers: [...formData.stopovers, code] });
        }
      }
    } catch (error) {
      console.error('Map click search error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchAircraft = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'aircraft'));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAircraftList(Array.from(new Map(data.map(item => [item.id, item])).values()));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'aircraft');
      }
    };
    fetchAircraft();
  }, []);

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
      const suggestions = await getSuggestedAircraft(formData.passengers, distance, aircraftList, formData.departure);
      
      const windImpact = await getWindImpact(formData.departure, formData.destination);
      setWindData(windImpact);

      const options: any = {};
      for (const key of ['cheapest', 'fastest', 'recommended']) {
        const suggestion = suggestions[key];
        const type = suggestion.type;
        const aircraft = aircraftList.find(a => a.type === type);
        
        let totalFlightTime = 0;
        let totalFuelBurn = 0;
        let totalCost = routeDetails.totalCosts.total;

        if (aircraft) {
          const calculatedLegs = routeDetails.legs.map((leg: any) => {
            const groundSpeed = (aircraft.cruiseSpeed || 450) + windImpact.windComponent;
            // Flight time = Distance / Speed + Taxi (20 min) + Climb/Descent Buffer (15 min)
            const taxiTime = 20 / 60; // 20 mins
            const climbDescentBuffer = 15 / 60; // 15 mins
            const legTime = (leg.routingDistance / groundSpeed) + taxiTime + climbDescentBuffer;
            return {
              ...leg,
              flightTime: legTime,
              fuelBurn: (aircraft.fuelBurnPerHour || 0) * legTime
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
            notes: suggestion.notes,
            breakdown: {
              fuel: routeDetails.totalCosts.fuel,
              landing: routeDetails.totalCosts.landing,
              handling: routeDetails.totalCosts.handling,
              parking: routeDetails.totalCosts.parking,
              crew: (aircraft.crewCostPerHour || 0) * totalFlightTime,
              maintenance: (aircraft.maintenanceReserve || 0) * totalFlightTime,
              overflight: routeDetails.totalCosts.overflight,
              navigation: routeDetails.totalCosts.navigation,
              brokerMargin: (totalCost * formData.brokerMargin / 100).toFixed(2),
              operatorMargin: (totalCost * formData.operatorMargin / 100).toFixed(2),
              finalTotal: (totalCost * (1 + (formData.brokerMargin + formData.operatorMargin) / 100)).toFixed(2)
            }
          };
        } else {
          options[key] = {
            type,
            legs: routeDetails.legs.map((l: any) => ({ ...l, flightTime: 0, fuelBurn: 0 })),
            flightTime: '0.00',
            fuelBurn: '0.00',
            totalCost,
            notes: suggestion.notes,
            breakdown: {
              fuel: routeDetails.totalCosts.fuel,
              landingFees: routeDetails.totalCosts.landingFees,
              handling: routeDetails.totalCosts.handling,
              parking: routeDetails.totalCosts.parking,
              crew: routeDetails.totalCosts.crew,
              overflight: routeDetails.totalCosts.overflight,
              brokerMargin: (totalCost * formData.brokerMargin / 100).toFixed(2),
              operatorMargin: (totalCost * formData.operatorMargin / 100).toFixed(2),
              finalTotal: (totalCost * (1 + (formData.brokerMargin + formData.operatorMargin) / 100)).toFixed(2)
            }
          };
        }
      }

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
    if (formData.stopovers.length > 0) {
      setFormData({ ...formData, stopovers: formData.stopovers.slice(0, -1) });
    } else if (formData.destination) {
      setFormData({ ...formData, destination: '' });
    } else if (formData.departure) {
      setFormData({ ...formData, departure: '' });
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

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={user} 
          isDarkMode={isDarkMode} 
          setIsDarkMode={setIsDarkMode} 
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'dashboard' ? (
            <div className="max-w-7xl mx-auto">
              <DashboardOverview />
            </div>
          ) : activeTab === 'reports' ? (
            <div className="max-w-7xl mx-auto">
              <ReportsAnalytics />
            </div>
          ) : activeTab === 'leads' ? (
            <div className="max-w-7xl mx-auto">
              <LeadsManagement />
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
              <AircraftDatabase />
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
            <div className="max-w-6xl mx-auto">
              <CostingSettings />
            </div>
          ) : activeTab === 'quotes' ? (
            <div className="max-w-6xl mx-auto">
              <CharterQuoteEngine aircraftList={aircraftList} />
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
                    onPlanGenerated={(plan) => setAiPlan(plan)} 
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
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
                          <input 
                            type="text" 
                            placeholder="Departure (IATA/ICAO)" 
                            value={formData.departure}
                            className="w-full pl-10 p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                            onChange={(e) => setFormData({...formData, departure: e.target.value.toUpperCase()})}
                          />
                        </div>

                        {formData.stopovers.map((stop, idx) => (
                          <div key={idx} className="relative flex gap-2">
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
                        ))}

                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, stopovers: [...formData.stopovers, '']})}
                          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:text-indigo-700 dark:hover:text-indigo-300 ml-1"
                        >
                          <Plus size={14} /> Add Stopover
                        </button>

                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
                          <input 
                            type="text" 
                            placeholder="Destination (IATA/ICAO)" 
                            value={formData.destination}
                            className="w-full pl-10 p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                            onChange={(e) => setFormData({...formData, destination: e.target.value.toUpperCase()})}
                          />
                        </div>
                      </div>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
                        <input 
                          type="datetime-local" 
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
                              className="w-full pl-10 p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                              onChange={(e) => setFormData({...formData, passengers: parseInt(e.target.value)})}
                            />
                          </div>
                          <div className="relative">
                            <Weight className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
                            <input 
                              type="number" 
                              placeholder="Cargo (kg)" 
                              className="w-full pl-10 p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                              onChange={(e) => setFormData({...formData, cargoWeight: parseInt(e.target.value)})}
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
                              onChange={(e) => setFormData({...formData, brokerMargin: parseInt(e.target.value)})}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Operator Margin (%)</label>
                            <input 
                              type="number" 
                              value={formData.operatorMargin}
                              className="w-full p-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                              onChange={(e) => setFormData({...formData, operatorMargin: parseInt(e.target.value)})}
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
                />
              )}

              {/* Map Section */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-[650px] transition-all duration-500">
                <FlightMap 
                  legs={aiPlan?.legs || quoteOptions?.[selectedOption]?.legs}
                  aircraftType={aiPlan?.suggestedAircraft || quoteOptions?.[selectedOption]?.type}
                  previewAirports={previewAirports}
                  onMapClick={handleMapClick}
                  onRemoveLastCoordinate={handleRemoveLastCoordinate}
                  isDarkMode={isDarkMode}
                />
              </div>

              {/* Quote Options (Manual Mode) */}
              {activeTab === 'manual' && quoteOptions && (
                <div className="space-y-6">
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
                    />
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <FIRAnalysis 
                      firs={quoteOptions[selectedOption].legs.flatMap((l: any) => l.firs)}
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
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <CostingEngine 
                      legs={aiPlan.legs}
                      totalCosts={aiPlan.legs.reduce((acc: any, leg: any) => ({
                        fuel: (acc.fuel || 0) + (leg.costs.fuel || 0),
                        overflight: (acc.overflight || 0) + (leg.costs.overflight || 0),
                        navigation: (acc.navigation || 0) + (leg.costs.navigation || 0),
                        landing: (acc.landing || 0) + (leg.costs.landing || 0),
                        parking: (acc.parking || 0) + (leg.costs.parking || 0),
                        handling: (acc.handling || 0) + (leg.costs.handling || 0),
                        terminalNavigation: (acc.terminalNavigation || 0) + (leg.costs.terminalNavigation || 0),
                        catering: (acc.catering || 0) + (leg.costs.catering || 0),
                        groundTransport: (acc.groundTransport || 0) + (leg.costs.groundTransport || 0),
                        deicing: (acc.deicing || 0) + (leg.costs.deicing || 0),
                        positioning: (acc.positioning || 0) + (leg.costs.positioning || 0),
                        repositioning: (acc.repositioning || 0) + (leg.costs.repositioning || 0),
                        crew: (acc.crew || 0) + (leg.costs.crew || 0),
                        total: (acc.total || 0) + (leg.costs.total || 0)
                      }), {})}
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
                    />
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <FIRAnalysis 
                      firs={aiPlan.legs.flatMap((l: any) => l.firs)}
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
      </main>
      </div>
    </div>
  );
}
