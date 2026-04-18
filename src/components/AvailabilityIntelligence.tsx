import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Plane, 
  Clock, 
  MapPin, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Filter,
  Sparkles,
  Zap,
  Calendar,
  ArrowRight,
  Info,
  RefreshCw
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { calculateAvailability, AvailabilityStatus } from '../services/availabilityService';

interface AircraftIntelligence {
  id: string;
  registration: string;
  type: string;
  operator: string;
  base: string;
  icao24?: string;
  status: AvailabilityStatus;
  reason: string;
  intelligence?: {
    isIdle: boolean;
    isHighUtilization: boolean;
    isAtBase: boolean;
    hasConsistentPattern: boolean;
  };
  lastUpdated: string;
}

export default function AvailabilityIntelligence() {
  const [aircraft, setAircraft] = useState<AircraftIntelligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [refreshing, setRefreshing] = useState(false);

  const fetchIntelligence = async (aircraftDocs: any[]) => {
    // Process aircraft in small batches to avoid overwhelming the browser's fetch queue
    const batchSize = 3;
    const results: AircraftIntelligence[] = [];
    
    for (let i = 0; i < aircraftDocs.length; i += batchSize) {
      const batch = aircraftDocs.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (doc) => {
        const data = doc.data();
        const reg = (data.registration || data.tail_number || '').trim();
        const availability = await calculateAvailability(doc.id, data.icao24, reg);
        return {
          id: doc.id,
          registration: reg || 'Unknown',
          type: data.type || 'Unknown',
          operator: data.operator || 'Unknown',
          base: data.base || 'Unknown',
          icao24: data.icao24,
          status: availability.status,
          reason: availability.reason,
          intelligence: availability.intelligence,
          lastUpdated: new Date().toISOString()
        };
      }));
      results.push(...batchResults);
      
      // Update intermediate state for smoother UI
      if (i + batchSize < aircraftDocs.length) {
        setAircraft([...results]);
      }
    }
    
    setAircraft(results);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'aircraft'), (snapshot) => {
      fetchIntelligence(snapshot.docs);
    });
    return () => unsubscribe();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    // The snapshot listener will trigger fetchIntelligence
  };

  const filteredAircraft = aircraft.filter(a => {
    const matchesSearch = a.registration.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.operator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'All' || a.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
            <Sparkles className="text-indigo-600 dark:text-indigo-400" />
            Availability Intelligence
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            Inferred aircraft availability using flight tracking, utilization patterns, and base matching.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-gray-500 hover:text-indigo-600 transition shadow-sm"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search tail, type, operator..."
              className="pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-sm w-64 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Intelligence Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Confirmed</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {aircraft.filter(a => a.status === 'Confirmed Available').length}
          </p>
          <p className="text-[10px] font-bold text-emerald-600 uppercase mt-1">High Probability</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600">
              <TrendingUp size={20} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Likely</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {aircraft.filter(a => a.status === 'Likely Available').length}
          </p>
          <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1">Moderate Probability</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600">
              <Clock size={20} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">On Request</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {aircraft.filter(a => a.status === 'On Request').length}
          </p>
          <p className="text-[10px] font-bold text-amber-600 uppercase mt-1">Low Probability</p>
        </div>
        <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-100 dark:shadow-none">
          <div className="flex items-center gap-3 mb-4">
            <Zap size={20} />
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-200">AI Engine</h3>
          </div>
          <p className="text-sm font-bold leading-tight">
            Predicting availability based on 4 core intelligence rules.
          </p>
          <div className="mt-4 flex gap-1">
            {[1,2,3,4].map(i => <div key={i} className="h-1 w-full bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white w-3/4"></div></div>)}
          </div>
        </div>
      </div>

      {/* Intelligence Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-black uppercase tracking-widest text-gray-900 dark:text-white">Fleet Intelligence Grid</h3>
            <div className="flex p-1 bg-gray-50 dark:bg-gray-900 rounded-xl">
              {['All', 'Confirmed Available', 'Likely Available', 'On Request'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition ${
                    filterStatus === status 
                      ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {status === 'All' ? 'All' : status.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Idle</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">At Base</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pattern</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-50 dark:border-gray-700">
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Aircraft / Operator</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Intelligence Rules</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Inferred Status</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reasoning</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <RefreshCw className="animate-spin text-indigo-600 mx-auto mb-4" size={32} />
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Analyzing Fleet Intelligence...</p>
                  </td>
                </tr>
              ) : filteredAircraft.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <Plane className="text-gray-200 dark:text-gray-700 mx-auto mb-4" size={64} />
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">No aircraft found in database</p>
                  </td>
                </tr>
              ) : (
                filteredAircraft.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                          <Plane size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{a.registration}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{a.type} • {a.operator}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex gap-2">
                        <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                          a.intelligence?.isIdle 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                            : 'bg-gray-50 text-gray-300 border-gray-100 dark:bg-gray-800 dark:border-gray-700'
                        }`}>
                          Idle
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                          a.intelligence?.isAtBase 
                            ? 'bg-indigo-50 text-indigo-600 border-indigo-100' 
                            : 'bg-gray-50 text-gray-300 border-gray-100 dark:bg-gray-800 dark:border-gray-700'
                        }`}>
                          At Base
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                          a.intelligence?.hasConsistentPattern 
                            ? 'bg-amber-50 text-amber-600 border-amber-100' 
                            : 'bg-gray-50 text-gray-300 border-gray-100 dark:bg-gray-800 dark:border-gray-700'
                        }`}>
                          Pattern
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                          a.intelligence?.isHighUtilization 
                            ? 'bg-rose-50 text-rose-600 border-rose-100' 
                            : 'bg-gray-50 text-gray-300 border-gray-100 dark:bg-gray-800 dark:border-gray-700'
                        }`}>
                          Busy
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        a.status === 'Confirmed Available' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        a.status === 'Likely Available' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                        'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="p-6">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-xs">
                        {a.reason}
                      </p>
                    </td>
                    <td className="p-6 text-right">
                      <button className="p-3 bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition">
                        <ArrowRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Intelligence Methodology */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-8 rounded-[2.5rem] flex gap-6 items-start">
          <div className="p-4 bg-amber-100 dark:bg-amber-800/50 rounded-2xl text-amber-600 dark:text-amber-400 shrink-0">
            <Info size={32} />
          </div>
          <div>
            <h4 className="text-lg font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight mb-2">Availability Intelligence Methodology</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-1">
                <p className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">Rule 1: Idle Aircraft</p>
                <p className="text-xs text-amber-700 dark:text-amber-300/80 leading-relaxed">If Last Flight &gt; 24–48 hrs ago, aircraft is likely available for immediate charter.</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">Rule 2: High Utilization</p>
                <p className="text-xs text-amber-700 dark:text-amber-300/80 leading-relaxed">If 5–6 flights/day, aircraft is heavily utilized and availability is unlikely.</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">Rule 3: Base Matching</p>
                <p className="text-xs text-amber-700 dark:text-amber-300/80 leading-relaxed">If aircraft is already at the departure airport, availability probability is HIGH.</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">Rule 4: Parking Pattern</p>
                <p className="text-xs text-amber-700 dark:text-amber-300/80 leading-relaxed">Consistent night parking at the same base suggests a stable ACMI candidate.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
            <Activity size={32} />
          </div>
          <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">Real-time Tracking</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            Connected to OpenSky Network and Aviationstack for live telemetry and historical utilization metrics.
          </p>
          <button className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition text-[10px]">
            Configure API Keys
          </button>
        </div>
      </div>
    </div>
  );
}
