import React, { useState, useEffect } from 'react';
import { 
  Calculator, Plane, MapPin, DollarSign, Fuel, Users, Zap, Search, Globe, 
  AlertCircle, Loader2, ChevronRight, TrendingUp, PieChart as PieChartIcon, 
  BarChart3, Box, ShieldCheck, Star, ArrowRight, Info, AlertTriangle, CheckCircle2,
  Scale, Clock, Sparkles, Cpu, FileText
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';

interface AdvancedQuoteEngineProps {
  onQuoteGenerated?: (quote: any) => void;
}

type MissionType = 'acmi' | 'cargo' | 'charter' | 'emptyleg' | 'multileg';

export default function AdvancedQuoteEngine({ onQuoteGenerated }: AdvancedQuoteEngineProps) {
  const [activeTab, setActiveTab] = useState<MissionType>('acmi');
  const [from, setFrom] = useState('OPLA');
  const [to, setTo] = useState('OMDB');
  const [aircraftType, setAircraftType] = useState('');
  const [loadKg, setLoadKg] = useState<number>(0);
  const [volumeCbm, setVolumeCbm] = useState<number>(0);
  const [cargoType, setCargoType] = useState<string>('General');
  const [passengers, setPassengers] = useState<number>(0);
  const [urgency, setUrgency] = useState<'normal' | 'high'>('normal');
  const [isVip, setIsVip] = useState(false);
  const [currentLocation, setCurrentLocation] = useState('');
  
  // Multi-leg state
  const [multiLegs, setMultiLegs] = useState([{ id: 1, from: 'OPLA', to: 'OMDB', date: '' }, { id: 2, from: 'OMDB', to: 'EGLL', date: '' }]);
  const [multiLegType, setMultiLegType] = useState<'charter' | 'cargo'>('charter');

  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [operators, setOperators] = useState<any[]>([]);
  const [searchingOperators, setSearchingOperators] = useState(false);
  const [emptyLegs, setEmptyLegs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/empty-legs')
      .then(res => res.json())
      .then(data => setEmptyLegs(data))
      .catch(err => console.error('Failed to fetch empty legs', err));
  }, []);

  const aircraftOptions = [
    { type: 'A320', label: 'Airbus A320 (180 Seats)', cat: 'Narrowbody' },
    { type: 'B737', label: 'Boeing 737 (160 Seats)', cat: 'Narrowbody' },
    { type: 'B737-800F', label: 'B737-800 Freighter (23t)', cat: 'Cargo' },
    { type: 'A321F', label: 'A321 Freighter (27t)', cat: 'Cargo' },
    { type: 'B767F', label: 'B767 Freighter (52t)', cat: 'Cargo' },
    { type: 'B777F', label: 'B777 Freighter (100t)', cat: 'Cargo' },
    { type: 'B777', label: 'Boeing 777 (350 Seats)', cat: 'Widebody' },
    { type: 'A330', label: 'Airbus A330 (300 Seats)', cat: 'Widebody' },
    { type: 'ATR72', label: 'ATR-72 (70 Seats)', cat: 'Regional' },
    { type: 'G650', label: 'Gulfstream G650 (VIP)', cat: 'Private Jet' },
  ];

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'multileg' ? '/api/quote-multileg' : '/api/quote-advanced';
      const body = activeTab === 'multileg' 
        ? {
            type: multiLegType,
            legs: multiLegs,
            aircraftType,
            load_kg: loadKg,
            volume_cbm: volumeCbm,
            cargo_type: cargoType,
            passengers,
            urgency,
            isVip
          }
        : {
            type: activeTab,
            from,
            to,
            aircraftType,
            load_kg: loadKg,
            volume_cbm: volumeCbm,
            cargo_type: cargoType,
            passengers,
            urgency,
            isVip,
            currentLocation
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('API Error');
      
      const result = await response.json();
      setQuote(result);
      if (onQuoteGenerated) onQuoteGenerated(result);
      
      searchOperators(result.aircraft);
    } catch (error) {
      console.error('Error calculating advanced quote:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchOperators = async (type: string) => {
    setSearchingOperators(true);
    try {
      const fleetRef = collection(db, 'aircraft_fleet');
      const q = query(fleetRef, where('aircraft_type', '==', type));
      const fleetSnap = await getDocs(q);
      const operatorIds = fleetSnap.docs.map(doc => doc.data().operator_id);
      
      if (operatorIds.length > 0) {
        const operatorsRef = collection(db, 'operators_master');
        const opsSnap = await getDocs(operatorsRef);
        let matchedOps = opsSnap.docs
          .filter(doc => operatorIds.includes(doc.id))
          .map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort by rating (descending)
        matchedOps.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
        
        setOperators(matchedOps);
      } else {
        setOperators([]);
      }
    } catch (error) {
      console.error('Error searching operators:', error);
    } finally {
      setSearchingOperators(false);
    }
  };

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 dark:shadow-none">
              <Calculator size={24} />
            </div>
            Advanced Quote Engine
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium mt-1 ml-15">ACMI, Cargo, and Charter Intelligence System</p>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
          {(['acmi', 'cargo', 'charter', 'emptyleg'] as MissionType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setQuote(null);
              }}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'emptyleg' ? '🔥 Empty Legs' : tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Panel */}
        <div className="lg:col-span-4 space-y-6">
          {emptyLegs.length > 0 && activeTab === 'emptyleg' && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-3xl border border-amber-200 dark:border-amber-800 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2">
              <h3 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                <Zap size={14} className="fill-current" />
                Live Empty Legs (Up to 65% Off)
              </h3>
              <div className="flex flex-col gap-2">
                {emptyLegs.map((leg, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setFrom(leg.lastDestination);
                      setTo(leg.nextDeparture);
                      setAircraftType(leg.type);
                      if (leg.type.includes('F')) setActiveTab('cargo');
                      else if (leg.type === 'G650') { setActiveTab('charter'); setIsVip(true); }
                      else setActiveTab('charter');
                    }}
                    className="p-3 bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-800/50 rounded-xl text-left hover:border-amber-400 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-black text-gray-900 dark:text-white">{leg.lastDestination} → {leg.nextDeparture}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Match</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <Plane size={10} />
                      {leg.type} • {leg.tailNumber}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl space-y-6">
            {activeTab === 'multileg' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Flight Itinerary</label>
                  <button 
                    onClick={() => setMultiLegs([...multiLegs, { id: Date.now(), from: '', to: '', date: '' }])}
                    className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100"
                  >
                    + Add Leg
                  </button>
                </div>
                
                <div className="space-y-3">
                  {multiLegs.map((leg, index) => (
                    <div key={leg.id} className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 relative group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Leg {index + 1}</span>
                        {multiLegs.length > 1 && (
                          <button 
                            onClick={() => setMultiLegs(multiLegs.filter(l => l.id !== leg.id))}
                            className="text-red-400 hover:text-red-600 text-xs font-bold"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                          <input
                            type="text"
                            value={leg.from}
                            onChange={(e) => {
                              const newLegs = [...multiLegs];
                              newLegs[index].from = e.target.value.toUpperCase();
                              setMultiLegs(newLegs);
                            }}
                            className="w-full pl-7 pr-2 py-2 bg-white dark:bg-gray-800 border-none rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                            placeholder="DEP"
                          />
                        </div>
                        <div className="relative">
                          <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                          <input
                            type="text"
                            value={leg.to}
                            onChange={(e) => {
                              const newLegs = [...multiLegs];
                              newLegs[index].to = e.target.value.toUpperCase();
                              setMultiLegs(newLegs);
                            }}
                            className="w-full pl-7 pr-2 py-2 bg-white dark:bg-gray-800 border-none rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500"
                            placeholder="DEST"
                          />
                        </div>
                      </div>
                      <div className="relative">
                        <Clock className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                        <input
                          type="date"
                          value={leg.date}
                          onChange={(e) => {
                            const newLegs = [...multiLegs];
                            newLegs[index].date = e.target.value;
                            setMultiLegs(newLegs);
                          }}
                          className="w-full pl-7 pr-2 py-2 bg-white dark:bg-gray-800 border-none rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-gray-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Mission Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMultiLegType('charter')}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        multiLegType === 'charter' 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                          : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-400'
                      }`}
                    >
                      Passenger
                    </button>
                    <button
                      onClick={() => setMultiLegType('cargo')}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        multiLegType === 'cargo' 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                          : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-400'
                      }`}
                    >
                      Cargo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Route Configuration</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      value={from}
                      onChange={(e) => setFrom(e.target.value.toUpperCase())}
                      className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="DEP"
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      value={to}
                      onChange={(e) => setTo(e.target.value.toUpperCase())}
                      className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="DEST"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Aircraft Selection</label>
              <div className="relative">
                <Plane className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <select
                  value={aircraftType}
                  onChange={(e) => setAircraftType(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 appearance-none transition-all"
                >
                  <option value="">Auto-Select (Smart Engine)</option>
                  {aircraftOptions.map(opt => (
                    <option key={opt.type} value={opt.type}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {(activeTab === 'cargo' || (activeTab === 'multileg' && multiLegType === 'cargo')) && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Payload (KG)</label>
                    <div className="relative">
                      <Scale className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input
                        type="number"
                        value={loadKg}
                        onChange={(e) => setLoadKg(Number(e.target.value))}
                        className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Volume (CBM)</label>
                    <div className="relative">
                      <Box className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input
                        type="number"
                        value={volumeCbm}
                        onChange={(e) => setVolumeCbm(Number(e.target.value))}
                        className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cargo Type</label>
                  <div className="relative">
                    <Box className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <select
                      value={cargoType}
                      onChange={(e) => setCargoType(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 appearance-none transition-all"
                    >
                      <option value="General">General Cargo</option>
                      <option value="Pharma">Pharma / Temperature Controlled</option>
                      <option value="Live animals">Live Animals</option>
                      <option value="Dangerous Goods">Dangerous Goods (DG)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {(activeTab === 'charter' || (activeTab === 'multileg' && multiLegType === 'charter')) && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Passengers</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="number"
                      value={passengers}
                      onChange={(e) => setPassengers(Number(e.target.value))}
                      className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={isVip}
                    onChange={(e) => setIsVip(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-2">
                    <Star size={14} className={isVip ? "text-amber-500 fill-amber-500" : "text-gray-400"} />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">VIP Configuration</span>
                  </div>
                </label>
              </div>
            )}

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Operational Factors</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setUrgency('normal')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    urgency === 'normal' 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                      : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-400'
                  }`}
                >
                  Planned
                </button>
                <button
                  onClick={() => setUrgency('high')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    urgency === 'high' 
                      ? 'bg-red-50 border-red-200 text-red-600' 
                      : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-400'
                  }`}
                >
                  Urgent
                </button>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current Aircraft Location (Optional)</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={currentLocation}
                    onChange={(e) => setCurrentLocation(e.target.value.toUpperCase())}
                    className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="e.g. OPLA"
                  />
                </div>
                <p className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter">Used to calculate positioning costs</p>
              </div>
            </div>

            <button
              onClick={handleCalculate}
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Analyzing Market...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Generate Smart Quote
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-8 space-y-8">
          <AnimatePresence mode="wait">
            {!quote ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center p-12 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 text-center"
              >
                <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600 shadow-sm mb-6">
                  <TrendingUp size={40} />
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Ready for Analysis</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm font-medium">
                  Enter your mission requirements and let the AI Pricing Engine calculate the most efficient solution.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* Main Quote Card */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden">
                  <div className="bg-indigo-600 p-8 text-white relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Plane size={120} />
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-white/20 rounded text-[8px] font-black uppercase tracking-widest">Recommended</span>
                          <span className="px-2 py-0.5 bg-emerald-500 rounded text-[8px] font-black uppercase tracking-widest">Feasible</span>
                        </div>
                        <h2 className="text-4xl font-black tracking-tight">{quote.aircraft}</h2>
                        <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs mt-1">
                          {activeTab === 'multileg' ? (
                            <span>Multi-Leg Itinerary • {Math.round(quote.totalDistance || 0)} NM</span>
                          ) : (
                            <span>{from} <ArrowRight size={12} className="inline mx-1" /> {to} • {Math.round(quote.metrics?.distance || 0)} NM</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Total Estimated Cost</p>
                        <div className="text-5xl font-black tracking-tighter">${Math.round(quote.totalCost || quote.pricing?.total || 0).toLocaleString()}</div>
                        <p className="text-[10px] font-bold text-indigo-200 mt-1 uppercase tracking-widest">Incl. Broker Margin & Fees</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Metrics */}
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 dark:border-gray-700 pb-2">Mission Metrics</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-gray-500">
                            <Clock size={14} />
                            <span className="text-xs font-bold uppercase tracking-widest">Flight Time</span>
                          </div>
                          <span className="text-sm font-black text-gray-900 dark:text-white">{(quote.totalFlightHours || quote.metrics?.flightHours || 0).toFixed(1)} hrs</span>
                        </div>
                        {(activeTab === 'cargo' || (activeTab === 'multileg' && multiLegType === 'cargo')) && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-600">
                              <DollarSign size={14} />
                              <span className="text-xs font-bold uppercase tracking-widest">Cost per KG</span>
                            </div>
                            <span className="text-sm font-black text-emerald-600">${((quote.totalCost || quote.pricing?.total || 0) / (loadKg || 1)).toFixed(2)}</span>
                          </div>
                        )}
                        {(activeTab === 'charter' || (activeTab === 'multileg' && multiLegType === 'charter')) && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-indigo-500">
                              <Users size={14} />
                              <span className="text-xs font-bold uppercase tracking-widest">Cost per Pax</span>
                            </div>
                            <span className="text-sm font-black text-indigo-600">${((quote.totalCost || quote.pricing?.total || 0) / (passengers || 1)).toFixed(0)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-gray-500">
                            <ShieldCheck size={14} />
                            <span className="text-xs font-bold uppercase tracking-widest">Feasibility</span>
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            quote.feasibility?.status === 'Feasible' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                          }`}>
                            {quote.feasibility?.status || 'Unknown'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-4 space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-gray-400 uppercase">Payload Check</span>
                          <span className={quote.feasibility?.payload ? "text-emerald-600" : "text-red-600"}>
                            {quote.feasibility?.payload ? "✓ Within Limits" : "✗ Overweight"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-gray-400 uppercase">Volume Check</span>
                          <span className={quote.feasibility?.volume ? "text-emerald-600" : "text-red-600"}>
                            {quote.feasibility?.volume ? "✓ Within Limits" : "✗ Volume Exceeded"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-gray-400 uppercase">Seating Check</span>
                          <span className={quote.feasibility?.seats ? "text-emerald-600" : "text-red-600"}>
                            {quote.feasibility?.seats ? "✓ Confirmed" : "✗ Insufficient Seats"}
                          </span>
                        </div>
                      </div>

                      {quote.pricing?.isEmptyLeg && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/50">
                          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                            <Zap size={14} className="fill-current" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Empty Leg Detected</span>
                          </div>
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                            {quote.pricing.emptyLegDetails || 'Repositioning flight found!'} <span className="text-emerald-600">-{quote.pricing.discount} discount</span> applied to ACMI rate.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Cost Breakdown Chart / Multi-Leg Breakdown */}
                    <div className="md:col-span-2">
                      {activeTab === 'multileg' ? (
                        <div>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 dark:border-gray-700 pb-2 mb-4">Itinerary Breakdown</h4>
                          <div className="space-y-3">
                            {quote.legs?.map((leg: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black">
                                    {leg.legNumber}
                                  </div>
                                  <div>
                                    <p className="text-xs font-black text-gray-900 dark:text-white">
                                      {leg.from} → {leg.to}
                                      {leg.date && <span className="ml-2 text-[10px] font-bold text-gray-400">{leg.date}</span>}
                                    </p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{Math.round(leg.distance)} NM • {leg.flightHours.toFixed(1)} hrs</p>
                                  </div>
                                </div>
                                <div className="text-sm font-black text-indigo-600">
                                  ${Math.round(leg.cost).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 dark:border-gray-700 pb-2 mb-4">Cost Breakdown</h4>
                          <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={[
                                { name: 'ACMI', value: quote.pricing?.acmi || 0 },
                                { name: 'Fuel', value: quote.pricing?.fuel || 0 },
                                { name: 'Overflight', value: quote.pricing?.overflight || 0 },
                                { name: 'Handling', value: quote.pricing?.handling || 0 },
                                { name: 'Crew', value: quote.pricing?.crew || 0 },
                                { name: 'Pos.', value: quote.pricing?.positioning || 0 },
                                { name: 'Margin', value: quote.pricing?.margin || 0 },
                              ]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                <YAxis hide />
                                <Tooltip 
                                  cursor={{ fill: '#f8fafc' }}
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cost']}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                  {[0, 1, 2, 3, 4, 5, 6].map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Insights & Operators */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* AI Insights */}
                  <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Sparkles size={20} />
                      </div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">AI Market Intelligence</h3>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Market Analysis</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium">{quote.aiInsights?.analysis || 'Analysis pending...'}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Cheapest Option</p>
                          <p className="text-xs font-black text-gray-900 dark:text-white">{quote.aiInsights?.cheapestOption || 'N/A'}</p>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Fastest Option</p>
                          <p className="text-xs font-black text-gray-900 dark:text-white">{quote.aiInsights?.fastestOption || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                          <Info size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Broker Strategy Tip</span>
                        </div>
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 italic leading-relaxed">
                          "{quote.aiInsights?.tip || 'Optimizing for current market conditions...'}"
                        </p>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 text-gray-400 mb-3">
                          <Cpu size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">AI Decision Logic</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Mission: {activeTab === 'multileg' ? `Multi-Leg ${multiLegType}` : activeTab}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Requirement: {(activeTab === 'cargo' || (activeTab === 'multileg' && multiLegType === 'cargo')) ? `${loadKg}kg` : (activeTab === 'charter' || (activeTab === 'multileg' && multiLegType === 'charter')) ? `${passengers} pax` : 'Standard ACMI'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Selected: {quote.aircraft} (Optimal Capacity)</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Regulatory & Permits */}
                  {quote.permits && quote.permits.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl md:col-span-2">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <FileText size={20} />
                          </div>
                          <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Regulatory & Permits</h3>
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{quote.permits.length} Required</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {quote.permits.map((permit: any, idx: number) => (
                          <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black text-gray-900 dark:text-white">{permit.country}</span>
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                                permit.type.includes('Landing') ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                              }`}>
                                {permit.type}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-3 text-[10px] font-bold">
                              <div className="flex items-center gap-1 text-gray-500">
                                <Clock size={10} />
                                <span className="uppercase tracking-widest">{permit.leadTime}</span>
                              </div>
                              <span className="text-gray-900 dark:text-white">${permit.fee}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Operators */}
                  <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl md:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck size={20} />
                        </div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Verified Operators</h3>
                      </div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{operators.length} Matches</span>
                    </div>

                    <div className="space-y-3">
                      {searchingOperators ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-4">
                          <Loader2 className="animate-spin text-indigo-600" size={24} />
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Syncing with AOC DB...</p>
                        </div>
                      ) : operators.length > 0 ? (
                        operators.map((op, index) => (
                          <div key={op.id} className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${
                            index === 0 
                              ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' 
                              : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-indigo-300'
                          }`}>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-gray-900 dark:text-white">{op.operator_name}</h4>
                                {index === 0 && (
                                  <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[8px] font-black uppercase tracking-widest">Best Match</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">{op.icao_code || op.iata_code || 'AOC'}</span>
                                <div className="w-1 h-1 bg-gray-300 rounded-full" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500">{op.country}</span>
                                <div className="w-1 h-1 bg-gray-300 rounded-full" />
                                <div className="flex items-center gap-0.5 text-amber-500">
                                  <Star size={8} className="fill-current" />
                                  <span className="text-[8px] font-black">{op.rating || 0}</span>
                                </div>
                              </div>
                            </div>
                            <button className="p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-indigo-600 hover:border-indigo-600 transition-all">
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center space-y-4">
                          <AlertTriangle className="mx-auto text-amber-400" size={32} />
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">No direct AOC matches found</p>
                          <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Request Manual Sourcing</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
