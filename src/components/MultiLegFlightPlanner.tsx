import React, { useState, useEffect } from 'react';
import { Plane, MapPin, Calendar, Users, Weight, Plus, Trash2, Save, Edit2, ChevronRight, Clock, DollarSign, Activity, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { onAuthStateChanged } from 'firebase/auth';

// Mock Aircraft Data for calculations
const AIRCRAFT_DATA: Record<string, any> = {
  'A320': { rate: 5500, speed: 450, seats: 180, payload: 18000, range: 3300, fuelBurn: 2500 },
  'B737': { rate: 5000, speed: 450, seats: 160, payload: 17000, range: 3000, fuelBurn: 2400 },
  'B737-800F': { rate: 5000, speed: 450, seats: 0, payload: 23000, range: 2800, fuelBurn: 2400 },
  'B777F': { rate: 15000, speed: 490, seats: 0, payload: 100000, range: 4900, fuelBurn: 7000 },
  'B777': { rate: 15000, speed: 490, seats: 350, payload: 60000, range: 8500, fuelBurn: 7500 },
  'G650': { rate: 8000, speed: 510, seats: 14, payload: 2500, range: 7000, fuelBurn: 1800 },
};

// Mock Airport DB for distance
const AIRPORTS: Record<string, { lat: number; lng: number }> = {
  'OMDB': { lat: 25.2528, lng: 55.3644 },
  'EGLL': { lat: 51.4700, lng: -0.4543 },
  'KJFK': { lat: 40.6413, lng: -73.7781 },
  'WSSS': { lat: 1.3644, lng: 103.9915 },
  'OTHH': { lat: 25.2731, lng: 51.6081 },
  'EDDF': { lat: 50.0333, lng: 8.5706 },
  'VHHH': { lat: 22.3089, lng: 113.9145 },
  'LSZH': { lat: 47.4582, lng: 8.5555 },
  'EHAM': { lat: 52.3105, lng: 4.7683 },
  'LFPG': { lat: 49.0097, lng: 2.5479 },
  'OPLA': { lat: 31.5204, lng: 74.4036 },
  'OPKC': { lat: 24.9065, lng: 67.1608 },
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 0.539957; // Convert to Nautical Miles
}

interface Leg {
  id: string;
  from: string;
  to: string;
  date: string;
  etd?: string;
  eta?: string;
  aircraftType: string;
  passengers: number;
  cargoWeight: number;
  metrics?: {
    distance: number;
    flightTime: number;
    estimatedCost: number;
  };
}

interface Crew {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface FlightPlan {
  id?: string;
  name: string;
  createdAt: string;
  legs: Leg[];
  totalCost?: number;
  totalDistance?: number;
  totalFlightTime?: number;
  userId?: string;
  crewIds?: string[];
}

export default function MultiLegFlightPlanner() {
  const [plans, setPlans] = useState<FlightPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<FlightPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [crewList, setCrewList] = useState<Crew[]>([]);

  const DUTY_LIMIT_HOURS = 14;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setPlans([]);
        setLoading(false);
      }
    });

    fetchCrew();
    return () => unsubscribe();
  }, []);

  const fetchCrew = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'crew'));
      setCrewList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Crew)));
    } catch (error) {
      console.error('Error fetching crew:', error);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchPlans();
    }
  }, [userId]);

  const fetchPlans = async () => {
    if (!userId) return;
    try {
      const q = query(collection(db, 'flight_plans'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedPlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FlightPlan));
      setPlans(fetchedPlans);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'flight_plans');
    } finally {
      setLoading(false);
    }
  };

  const calculateDutyTime = (legs: Leg[]) => {
    const sorted = [...legs].filter(l => l.etd && l.eta).sort((a, b) => a.etd!.localeCompare(b.etd!));
    if (sorted.length === 0) return 0;

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const [sH, sM] = first.etd!.split(':').map(Number);
    const [eH, eM] = last.eta!.split(':').map(Number);

    let startMinutes = sH * 60 + sM - 60; // 1h before
    let endMinutes = eH * 60 + eM + 30; // 30m after

    if (endMinutes < startMinutes) endMinutes += 24 * 60;
    return (endMinutes - startMinutes) / 60;
  };

  const calculateMetrics = (legs: Leg[]) => {
    let totalCost = 0;
    let totalDistance = 0;
    let totalFlightTime = 0;

    const updatedLegs = legs.map(leg => {
      const dep = AIRPORTS[leg.from] || { lat: 0, lng: 0 };
      const dest = AIRPORTS[leg.to] || { lat: 0, lng: 0 };
      let distance = calculateDistance(dep.lat, dep.lng, dest.lat, dest.lng);
      if (distance === 0 && leg.from && leg.to) distance = 1500; // Fallback

      const ac = AIRCRAFT_DATA[leg.aircraftType] || AIRCRAFT_DATA['A320'];
      const flightTime = distance / ac.speed;
      const estimatedCost = (flightTime + 0.5) * ac.rate * 1.15; // Rough estimate including fuel/margin

      totalCost += estimatedCost;
      totalDistance += distance;
      totalFlightTime += flightTime;

      return {
        ...leg,
        metrics: { distance, flightTime, estimatedCost }
      };
    });

    return { updatedLegs, totalCost, totalDistance, totalFlightTime };
  };

  const suggestBestAircraft = (legs: Leg[]) => {
    if (legs.length === 0) return 'A320';

    const maxPax = Math.max(...legs.map(l => l.passengers || 0));
    const maxCargo = Math.max(...legs.map(l => l.cargoWeight || 0));
    
    const maxDistance = Math.max(...legs.map(leg => {
      const dep = AIRPORTS[leg.from] || { lat: 0, lng: 0 };
      const dest = AIRPORTS[leg.to] || { lat: 0, lng: 0 };
      let distance = calculateDistance(dep.lat, dep.lng, dest.lat, dest.lng);
      if (distance === 0 && leg.from && leg.to) distance = 1500;
      return distance;
    }));

    const suitable = Object.entries(AIRCRAFT_DATA).filter(([_, data]) => {
      return data.seats >= maxPax && data.payload >= maxCargo && data.range >= maxDistance;
    });

    if (suitable.length === 0) {
      // If none fit perfectly, find the one that fits pax and cargo at least
      const mostlySuitable = Object.entries(AIRCRAFT_DATA).filter(([_, data]) => {
        return data.seats >= maxPax && data.payload >= maxCargo;
      });
      if (mostlySuitable.length > 0) {
        mostlySuitable.sort((a, b) => a[1].fuelBurn - b[1].fuelBurn);
        return mostlySuitable[0][0];
      }
      return 'B777'; 
    }

    suitable.sort((a, b) => a[1].fuelBurn - b[1].fuelBurn);
    return suitable[0][0];
  };

  const applySuggestion = () => {
    if (!editingPlan) return;
    const suggestedType = suggestBestAircraft(editingPlan.legs);
    const newLegs = editingPlan.legs.map(leg => ({ ...leg, aircraftType: suggestedType }));
    const { updatedLegs, totalCost, totalDistance, totalFlightTime } = calculateMetrics(newLegs);
    
    setEditingPlan({
      ...editingPlan,
      legs: updatedLegs,
      totalCost,
      totalDistance,
      totalFlightTime
    });
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    
    try {
      const { updatedLegs, totalCost, totalDistance, totalFlightTime } = calculateMetrics(editingPlan.legs);
      const planToSave = {
        ...editingPlan,
        legs: updatedLegs,
        totalCost,
        totalDistance,
        totalFlightTime,
        updatedAt: new Date().toISOString()
      };

      if (planToSave.id) {
        const docRef = doc(db, 'flight_plans', planToSave.id);
        await updateDoc(docRef, planToSave);
      } else {
        planToSave.createdAt = new Date().toISOString();
        planToSave.userId = userId || '';
        await addDoc(collection(db, 'flight_plans'), planToSave);
      }
      
      setEditingPlan(null);
      setIsCreating(false);
      fetchPlans();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'flight_plans');
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this flight plan?')) return;
    try {
      await deleteDoc(doc(db, 'flight_plans', id));
      fetchPlans();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'flight_plans');
    }
  };

  const addLeg = () => {
    if (!editingPlan) return;
    const suggestedType = suggestBestAircraft(editingPlan.legs);
    setEditingPlan({
      ...editingPlan,
      legs: [...editingPlan.legs, { id: Date.now().toString(), from: '', to: '', date: '', aircraftType: suggestedType, passengers: 0, cargoWeight: 0 }]
    });
  };

  const updateLeg = (index: number, field: keyof Leg, value: any) => {
    if (!editingPlan) return;
    const newLegs = [...editingPlan.legs];
    newLegs[index] = { ...newLegs[index], [field]: value };
    
    // Recalculate metrics live
    const { updatedLegs, totalCost, totalDistance, totalFlightTime } = calculateMetrics(newLegs);
    
    setEditingPlan({
      ...editingPlan,
      legs: updatedLegs,
      totalCost,
      totalDistance,
      totalFlightTime
    });
  };

  const removeLeg = (id: string) => {
    if (!editingPlan) return;
    const newLegs = editingPlan.legs.filter(l => l.id !== id);
    const { updatedLegs, totalCost, totalDistance, totalFlightTime } = calculateMetrics(newLegs);
    setEditingPlan({
      ...editingPlan,
      legs: updatedLegs,
      totalCost,
      totalDistance,
      totalFlightTime
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Activity className="animate-spin text-indigo-600" /></div>;
  }

  const suggestedAircraft = editingPlan ? suggestBestAircraft(editingPlan.legs) : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Multi-Leg Flight Planner</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Build, manage, and calculate metrics for complex multi-leg itineraries.</p>
        </div>
        {!isCreating && !editingPlan && (
          <button 
            onClick={() => {
              setIsCreating(true);
              const initialLeg = { id: Date.now().toString(), from: '', to: '', date: '', aircraftType: 'A320', passengers: 0, cargoWeight: 0 };
              setEditingPlan({ 
                name: 'New Flight Plan', 
                createdAt: new Date().toISOString(), 
                legs: [initialLeg] 
              });
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none"
          >
            <Plus size={16} />
            Create Plan
          </button>
        )}
      </div>

      {(isCreating || editingPlan) ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
            <input 
              type="text" 
              value={editingPlan?.name || ''} 
              onChange={(e) => setEditingPlan(prev => prev ? {...prev, name: e.target.value} : null)}
              className="text-xl font-black bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white placeholder-gray-400"
              placeholder="Flight Plan Name"
            />
            <div className="flex gap-2">
              <button onClick={() => { setEditingPlan(null); setIsCreating(false); }} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleSavePlan} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition flex items-center gap-2">
                <Save size={14} /> Save Plan
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Itinerary Legs</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={applySuggestion}
                      className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center gap-1 uppercase tracking-wider"
                    >
                      <Sparkles size={12} /> Suggest Aircraft
                    </button>
                    <button onClick={addLeg} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center gap-1">
                      <Plus size={14} /> Add Leg
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {editingPlan?.legs.map((leg, index) => (
                    <div key={leg.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 relative group">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white dark:bg-gray-800 px-2 py-1 rounded-md shadow-sm">Leg {index + 1}</span>
                        {editingPlan.legs.length > 1 && (
                          <button onClick={() => removeLeg(leg.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                          <input type="text" value={leg.from} onChange={(e) => updateLeg(index, 'from', e.target.value.toUpperCase())} placeholder="DEP (e.g. KJFK)" className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 uppercase" />
                        </div>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                          <input type="text" value={leg.to} onChange={(e) => updateLeg(index, 'to', e.target.value.toUpperCase())} placeholder="DEST (e.g. EGLL)" className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 uppercase" />
                        </div>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                          <input type="date" value={leg.date} onChange={(e) => updateLeg(index, 'date', e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-gray-600" />
                        </div>
                        <div className="relative">
                          <Plane className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                          <select value={leg.aircraftType} onChange={(e) => updateLeg(index, 'aircraftType', e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 appearance-none">
                            {Object.keys(AIRCRAFT_DATA).map(ac => <option key={ac} value={ac}>{ac}</option>)}
                          </select>
                          {leg.aircraftType === suggestedAircraft && (
                            <div className="absolute -top-2 -right-1 bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black flex items-center gap-0.5 shadow-sm">
                              <Sparkles size={8} /> REC
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <Clock className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                              <input type="time" value={leg.etd || ''} onChange={(e) => updateLeg(index, 'etd', e.target.value)} className="w-full pl-7 pr-2 py-2 bg-white dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="relative">
                              <Clock className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                              <input type="time" value={leg.eta || ''} onChange={(e) => updateLeg(index, 'eta', e.target.value)} className="w-full pl-7 pr-2 py-2 bg-white dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <Users className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                              <input type="number" value={leg.passengers} onChange={(e) => updateLeg(index, 'passengers', Number(e.target.value))} placeholder="Pax" className="w-full pl-7 pr-2 py-2 bg-white dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="relative">
                              <Weight className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                              <input type="number" value={leg.cargoWeight} onChange={(e) => updateLeg(index, 'cargoWeight', Number(e.target.value))} placeholder="KG" className="w-full pl-7 pr-2 py-2 bg-white dark:bg-gray-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {leg.metrics && (
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-4">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300">
                            <Activity size={12} className="text-indigo-500" /> {Math.round(leg.metrics.distance)} NM
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300">
                            <Clock size={12} className="text-blue-500" /> {leg.metrics.flightTime.toFixed(1)} Hrs
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                            <DollarSign size={12} /> {Math.round(leg.metrics.estimatedCost).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
                  <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Users size={16} className="text-indigo-600" />
                    Crew Assignment
                  </h3>
                  <div className="space-y-2">
                    {crewList.map(crew => {
                      const isAssigned = editingPlan?.crewIds?.includes(crew.id);
                      return (
                        <button
                          key={crew.id}
                          onClick={() => {
                            const currentCrew = editingPlan?.crewIds || [];
                            const newCrew = isAssigned 
                              ? currentCrew.filter(id => id !== crew.id)
                              : [...currentCrew, crew.id];
                            setEditingPlan(prev => prev ? { ...prev, crewIds: newCrew } : null);
                          }}
                          className={`w-full p-3 rounded-xl border text-left transition-all ${
                            isAssigned 
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                              : 'border-white dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-indigo-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-xs font-bold">{crew.name}</p>
                              <p className="text-[9px] opacity-60 font-bold uppercase">{crew.role}</p>
                            </div>
                            {isAssigned && <Activity size={14} className="text-indigo-600" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {editingPlan && editingPlan.legs.some(l => l.etd && l.eta) && (
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Duty Time</p>
                        <p className={`text-lg font-black ${calculateDutyTime(editingPlan.legs) > DUTY_LIMIT_HOURS ? 'text-red-600' : 'text-indigo-600'}`}>
                          {calculateDutyTime(editingPlan.legs).toFixed(1)}h
                        </p>
                      </div>
                      {calculateDutyTime(editingPlan.legs) > DUTY_LIMIT_HOURS && (
                        <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                          <AlertCircle size={14} />
                          <p className="text-[9px] font-bold uppercase">Exceeds 14h Limit!</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {editingPlan?.totalCost && (
                  <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 dark:shadow-none">
                    <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-80">Plan Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase opacity-70">Total Distance</span>
                        <span className="text-sm font-black">{Math.round(editingPlan.totalDistance || 0)} NM</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase opacity-70">Flight Time</span>
                        <span className="text-sm font-black">{(editingPlan.totalFlightTime || 0).toFixed(1)}h</span>
                      </div>
                      <div className="pt-3 border-t border-white/20 flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase opacity-70">Est. Total Cost</span>
                        <span className="text-xl font-black">${Math.round(editingPlan.totalCost).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl p-6 hover:shadow-2xl transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">{plan.name}</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{new Date(plan.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingPlan(plan)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                  <button onClick={() => handleDeletePlan(plan.id!)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {plan.legs.slice(0, 3).map((leg, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                    <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[8px]">{i+1}</div>
                    {leg.from || '?'} <ChevronRight size={10} className="text-gray-400" /> {leg.to || '?'}
                    <span className="ml-auto text-[10px] text-gray-400">{leg.aircraftType}</span>
                  </div>
                ))}
                {plan.legs.length > 3 && <p className="text-[10px] font-bold text-gray-400 italic">+ {plan.legs.length - 3} more legs</p>}
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div className="text-xs font-bold text-gray-500">
                  {plan.legs.length} Legs
                </div>
                <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                  ${Math.round(plan.totalCost || 0).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {plans.length === 0 && (
            <div className="col-span-full py-12 text-center bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
              <Plane className="mx-auto h-8 w-8 text-gray-400 mb-3" />
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">No Flight Plans</h3>
              <p className="text-xs text-gray-500 mt-1">Create your first multi-leg itinerary to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
