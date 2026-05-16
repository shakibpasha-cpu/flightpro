import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  Search,
  Filter,
  RefreshCw,
  Clock,
  MapPin,
  Shield,
  ArrowRight,
  Info,
  Activity,
  Loader2
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, getDocs, orderBy } from 'firebase/firestore';
import { analyzeCrewScheduleConflicts } from '../services/aiService';

interface CrewConflict {
  crewId: string;
  crewName: string;
  role: string;
  hasConflicts: boolean;
  conflicts: any[];
  recommendation?: string;
  lastChecked?: string;
}

export default function CrewConflictIntelligence() {
  const [crew, setCrew] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, CrewConflict>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'All' | 'Critical' | 'Warning' | 'None'>('All');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'crew_members'), (snapshot) => {
      const crewData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCrew(crewData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const runFleetScan = async () => {
    setScanning(true);
    const newConflicts: Record<string, CrewConflict> = { ...conflicts };

    try {
      // 1. Fetch all schedules for the near future
      const schedulesSnap = await getDocs(collection(db, 'schedules'));
      const allSchedules = schedulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      for (const member of crew) {
        // Fetch historical logs
        const logsQuery = query(
          collection(db, 'duty_logs'),
          where('crewMemberId', '==', member.id),
          orderBy('startTime', 'desc')
        );
        const logsSnap = await getDocs(logsQuery);
        const logs = logsSnap.docs.map(d => d.data());

        // Find relevant schedules for this crew member
        const relevantSchedules = allSchedules.filter(s => s.date === selectedDate && s.crewIds?.includes(member.id));
        
        if (relevantSchedules.length > 0) {
          // Flatten flights from all schedules on that day (in case they are assigned twice)
          const proposedFlights = relevantSchedules.flatMap(s => s.flights || []);
          const existingSchedules = allSchedules.filter(s => s.date !== selectedDate && s.crewIds?.includes(member.id));

          const result = await analyzeCrewScheduleConflicts(
            member, 
            { date: selectedDate, flights: proposedFlights }, 
            logs, 
            existingSchedules
          );

          newConflicts[member.id] = {
            crewId: member.id,
            crewName: member.name,
            role: member.role,
            hasConflicts: result.hasConflicts,
            conflicts: result.conflicts || [],
            recommendation: result.recommendation,
            lastChecked: new Date().toISOString()
          };
          
          setConflicts({ ...newConflicts });
          // Delay to prevent quota exhaustion
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    } catch (error) {
      console.error('Fleet Scan Error:', error);
    } finally {
      setScanning(false);
    }
  };

  const filteredConflicts = Object.values(conflicts).filter(c => {
    const matchesSearch = c.crewName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === 'All' || 
                            (filterSeverity === 'Critical' && c.conflicts.some(con => con.severity === 'Critical')) ||
                            (filterSeverity === 'Warning' && c.conflicts.some(con => con.severity === 'Warning')) ||
                            (filterSeverity === 'None' && !c.hasConflicts);
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
            <Shield className="text-indigo-600" />
            Crew Compliance Intelligence
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            AI-powered FTL (Flight Time Limitation) monitoring and conflict resolution for cockpit and cabin crew.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button 
            onClick={runFleetScan}
            disabled={scanning || loading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
          >
            {scanning ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
            Scan Fleet Conflicts
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 rounded-xl flex items-center justify-center text-rose-600">
              <AlertCircle size={20} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Critical Conflicts</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {Object.values(conflicts).filter(c => c.conflicts.some(con => con.severity === 'Critical')).length}
          </p>
          <p className="text-[10px] font-bold text-rose-600 uppercase mt-1">Requires Immediate Action</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600">
              <Clock size={20} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Rest Warnings</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {Object.values(conflicts).filter(c => c.conflicts.some(con => con.type === 'Rest Violation')).length}
          </p>
          <p className="text-[10px] font-bold text-amber-600 uppercase mt-1">Potential Fatigue Risk</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Schedules Analyzed</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {Object.keys(conflicts).length}
          </p>
          <p className="text-[10px] font-bold text-emerald-600 uppercase mt-1">Active Monitoring</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-black uppercase tracking-widest text-gray-900 dark:text-white">Conflict Analysis Grid</h3>
            <div className="flex p-1 bg-gray-50 dark:bg-gray-900 rounded-xl">
              {['All', 'Critical', 'Warning', 'None'].map(severity => (
                <button
                  key={severity}
                  onClick={() => setFilterSeverity(severity as any)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition ${
                    filterSeverity === severity 
                      ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {severity}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search crew name..."
              className="pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-sm w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-50 dark:border-gray-700">
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Crew Member</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status / Severity</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Conflicts Detected</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Recommendation</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={32} />
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Loading Crew Data...</p>
                  </td>
                </tr>
              ) : filteredConflicts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <Shield className="text-gray-200 dark:text-gray-700 mx-auto mb-4" size={64} />
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">
                      {scanning ? 'Analyzing Conflict Patterns...' : 'No relevant conflicts found for selected filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredConflicts.map((c) => (
                  <tr key={c.crewId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition group">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600">
                          <Users size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{c.crewName}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        {c.hasConflicts ? (
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            c.conflicts.some(con => con.severity === 'Critical') 
                              ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                              : 'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                            <AlertCircle size={14} />
                            {c.conflicts.some(con => con.severity === 'Critical') ? 'Critical' : 'Warning'}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-widest">
                            <CheckCircle2 size={14} />
                            Compliant
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="space-y-2 max-w-sm">
                        {c.conflicts.map((conflict, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${conflict.severity === 'Critical' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                            <div>
                               <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight">{conflict.message}</p>
                               <p className="text-[9px] text-gray-500 uppercase font-black">{conflict.regulationRef}</p>
                            </div>
                          </div>
                        ))}
                        {c.conflicts.length === 0 && <p className="text-xs text-gray-400 italic">No violations detected.</p>}
                      </div>
                    </td>
                    <td className="p-6">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-xs italic">
                        "{c.recommendation || 'Continuous monitoring active.'}"
                      </p>
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => {/* Navigate to schedule builder or crew management */}}
                        className="p-3 bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition"
                      >
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-8 rounded-[2.5rem] flex gap-6 items-start">
          <div className="p-4 bg-indigo-100 dark:bg-indigo-800/50 rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0">
            <Info size={32} />
          </div>
          <div>
            <h4 className="text-lg font-black text-indigo-900 dark:text-indigo-100 uppercase tracking-tight mb-2">Automated Compliance Guard</h4>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
              Our AI engine cross-references <strong>Duty Logs</strong>, <strong>Confirmed Schedules</strong>, and <strong>Rest Period requirements</strong> against ICAO Annex 6 standards. 
              The system scans for overlap, mandatory rest violations, and cumulative hour limits (28-day/90-day/Yearly) to ensure 100% legal operations.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
               <div className="bg-white/50 dark:bg-black/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800 pointer-events-none">
                  <p className="text-[10px] font-black text-indigo-900 dark:text-indigo-100 uppercase">10h Rest</p>
                  <p className="text-[8px] text-indigo-600/70">Mandatory Min</p>
               </div>
               <div className="bg-white/50 dark:bg-black/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800 pointer-events-none">
                  <p className="text-[10px] font-black text-indigo-900 dark:text-indigo-100 uppercase">100h / 28D</p>
                  <p className="text-[8px] text-indigo-600/70">Flight Limit</p>
               </div>
               <div className="bg-white/50 dark:bg-black/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800 pointer-events-none">
                  <p className="text-[10px] font-black text-indigo-900 dark:text-indigo-100 uppercase">13h Duty</p>
                  <p className="text-[8px] text-indigo-600/70">Max Daily</p>
               </div>
               <div className="bg-white/50 dark:bg-black/20 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800 pointer-events-none">
                  <p className="text-[10px] font-black text-indigo-900 dark:text-indigo-100 uppercase">60h / 7D</p>
                  <p className="text-[8px] text-indigo-600/70">Duty Limit</p>
               </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
            <Activity size={32} />
          </div>
          <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">Real-time Readiness</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            Conflicts are automatically triggered during schedule creation. Use the Fleet Scan to audit the entire network daily.
          </p>
          <button className="mt-6 w-full py-3 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-800 transition text-[10px]">
            Export Audit Report
          </button>
        </div>
      </div>
    </div>
  );
}
