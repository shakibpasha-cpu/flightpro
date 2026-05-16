import React, { useState, useEffect, useMemo } from 'react';
import { Users, UserPlus, Clock, Calendar, Shield, Mail, Phone, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, History, DollarSign, Activity, Loader2, Plane, Calculator, BarChart3, Fingerprint, ChevronRight, Info, StopCircle, Play, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc, orderBy, Timestamp } from 'firebase/firestore';
import { checkCrewCompliance, analyzeCrewScheduleConflicts, suggestCrewForMission, getIataComplianceSuggestion } from '../services/aiService';

export interface CrewMember {
  id: string;
  name: string;
  role: 'Captain' | 'First Officer' | 'Flight Engineer' | 'Cabin Crew' | 'Loadmaster';
  status: 'Active' | 'On Leave' | 'Training' | 'Sick';
  totalHours: number;
  lastDutyEnd?: string;
  contactEmail: string;
  contactPhone: string;
  certifications?: string[]; // Added this!
  compliance?: {
    status: 'Green' | 'Yellow' | 'Red';
    isLegal: boolean;
    summary: string;
    violations: string[];
    metrics: {
      hours7Days: number;
      hours28Days: number;
      restTimeRemainingHours: number;
      nextLegalDutyStart: string;
    };
    estimatedPerDiem: number;
    complianceNotes: string;
  };
  conflicts?: {
    hasConflicts: boolean;
    conflicts: any[];
    recommendation: string;
  };
}

export interface DutyLog {
  id: string;
  crewMemberId: string;
  startTime: string;
  endTime: string;
  type: 'Flight' | 'Standby' | 'Training' | 'Positioning';
  notes: string;
  sectors?: number;
  origin?: string;
  destination?: string;
}

interface CrewManagementProps {
  proposedPlan?: any;
}

type TabType = 'roster' | 'calculator' | 'planning';

export default function CrewManagement({ proposedPlan }: CrewManagementProps) {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null);
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [dutyLogs, setDutyLogs] = useState<DutyLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [isCheckingCompliance, setIsCheckingCompliance] = useState<string | null>(null);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('roster');

  const [planningData, setPlanningData] = useState({
    aircraftType: proposedPlan?.suggestedAircraft || '',
    missionType: (proposedPlan?.missionType || 'Passenger') as 'Passenger' | 'Cargo' | 'VIP',
    totalFlightTime: proposedPlan?.totalFlightTime || 0,
    departureTime: proposedPlan?.date || '',
    sectors: proposedPlan?.legs?.length || 1
  });
  const [assignments, setAssignments] = useState<Record<number, string[]>>({}); // legIndex: crewIds[]
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleAiSuggestion = async () => {
    if (!proposedPlan) return;
    setIsSuggesting(true);
    try {
      // Need a way to fetch all duty logs for suggestion
      const logsSnapshot = await getDocs(collection(db, 'duty_logs'));
      const logs = logsSnapshot.docs.map(doc => doc.data());
      
      const suggestion = await suggestCrewForMission(proposedPlan, crew, logs);
      if (suggestion && suggestion.assignedCrew) {
        const newAssignments: Record<number, string[]> = {};
        suggestion.assignedCrew.forEach((a: any) => {
          newAssignments[a.legIndex] = a.crewIds;
        });
        setAssignments(newAssignments);
        alert(`AI Suggestion loaded: ${suggestion.overallSafetyBrief}`);
      }
    } catch (e) {
      console.error(e);
      alert('Error fetching AI suggestion');
    } finally {
      setIsSuggesting(false);
    }
  };

  const missionAnalysis = useMemo(() => {
    if (!planningData.totalFlightTime) return null;

    let pilotsRequired = 2;
    let cabinCrewRequired = 0;

    // Simplified Crew Requirements
    if (planningData.totalFlightTime > 9 && planningData.totalFlightTime <= 13) pilotsRequired = 3;
    if (planningData.totalFlightTime > 13) pilotsRequired = 4;

    if (planningData.missionType === 'Passenger' || planningData.missionType === 'VIP') {
      // 1 per 50 pax or 1-2 for VIP
      cabinCrewRequired = planningData.missionType === 'VIP' ? 2 : 4; 
    }

    const minRestRequired = Math.max(12, planningData.totalFlightTime);

    return {
      pilotsRequired,
      cabinCrewRequired,
      minRestRequired,
      recommendation: planningData.totalFlightTime > 12 ? 'Augmented Crew Required' : 'Standard Double Crew'
    };
  }, [planningData]);

  const availablePersonnel = useMemo(() => {
     if (!missionAnalysis || !planningData.departureTime) return [];
     
     const reqTime = new Date(planningData.departureTime).getTime();
     
     return crew.filter(member => {
        if (member.status !== 'Active') return false;
        
        // If we have compliance data, check nextLegalDutyStart
        if (member.compliance?.metrics.nextLegalDutyStart) {
           const nextStart = new Date(member.compliance.metrics.nextLegalDutyStart).getTime();
           return nextStart <= reqTime;
        }

        // Basic check if lastDutyEnd + 12h rest is before start
        if (member.lastDutyEnd) {
           const lastEnd = new Date(member.lastDutyEnd).getTime();
           return (lastEnd + 12 * 3600000) <= reqTime;
        }

        return true;
     });
  }, [crew, missionAnalysis, planningData.departureTime]);

  const [formData, setFormData] = useState({
    name: '',
    role: 'Captain' as CrewMember['role'],
    status: 'Active' as CrewMember['status'],
    contactEmail: '',
    contactPhone: '',
    totalHours: 0,
    certifications: [] as string[]
  });

  const [dutyData, setDutyData] = useState({
    startTime: '',
    endTime: '',
    type: 'Flight' as DutyLog['type'],
    notes: '',
    sectors: 1,
    origin: '',
    destination: ''
  });

  // IATA/EASA Calculator State
  const [calcData, setCalcData] = useState({
    departure: '',
    destination: '',
    reportTime: '',
    onBlockTime: '',
    flyingTime: 0,
    sectors: 1,
    isMultiCrew: false
  });

  const [aiCalcResult, setAiCalcResult] = useState<any>(null);
  const [isCalculatingAi, setIsCalculatingAi] = useState(false);

  const handleAiCalc = async () => {
    if (!calcData.reportTime || !calcData.onBlockTime) return;
    setIsCalculatingAi(true);
    try {
      const result = await getIataComplianceSuggestion({
        departure: calcData.departure,
        destination: calcData.destination,
        reportingTime: calcData.reportTime,
        chockOnTime: calcData.onBlockTime,
        flyingTime: calcData.flyingTime,
        sectors: calcData.sectors,
        isMultiCrew: calcData.isMultiCrew
      });
      setAiCalcResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCalculatingAi(false);
    }
  };

  const calcResults = useMemo(() => {
    if (!calcData.reportTime || !calcData.onBlockTime) return null;
    
    const start = new Date(calcData.reportTime);
    const end = new Date(calcData.onBlockTime);
    const dutyDurationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    // IATA/EASA Table 1 - Maximum Daily FDP (Standard simplified)
    // Start Time (Local) | 1-2 Sectors | 3 | 4 | 5 | 6 | 7...
    // 06:00-13:29      | 13:00       | 12.5 | 12.0 | 11.5 | 11.0 | 10.5
    // 13:30-13:59      | 12:45... etc
    
    const startHour = calcData.reportTime ? new Date(calcData.reportTime).getUTCHours() : 12;
    let maxFDP = 13; // Base for 1-2 sectors at 0600-1329

    if (startHour >= 6 && startHour <= 13) {
      maxFDP = 13;
    } else if (startHour > 13 && startHour <= 17) {
      maxFDP = 12.5;
    } else if (startHour > 17 && startHour <= 21) {
      maxFDP = 12;
    } else {
      maxFDP = 11; // WOCL - Window of Circadian Low
    }

    // Reduction for sectors (Simplified EASA: 30m reduction per sector after 2nd)
    if (calcData.sectors > 2) {
      maxFDP -= (calcData.sectors - 2) * 0.5;
    }

    const margin = maxFDP - dutyDurationHours;
    const minRest = Math.max(12, dutyDurationHours); // Minimum rest at base

    return {
      duration: dutyDurationHours.toFixed(2),
      maxFDP: maxFDP.toFixed(2),
      margin: margin.toFixed(2),
      isLegal: margin >= 0,
      minRest: minRest.toFixed(2)
    };
  }, [calcData]);

  useEffect(() => {
    fetchCrew();
  }, []);

  const handleComplianceCheck = async (member: CrewMember) => {
    setIsCheckingCompliance(member.id);
    try {
      const q = query(
        collection(db, 'duty_logs'),
        where('crewMemberId', '==', member.id),
        orderBy('startTime', 'desc')
      );
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => doc.data());
      
      const compliance = await checkCrewCompliance(member, logs);
      if (compliance) {
        await updateDoc(doc(db, 'crew_members', member.id), { compliance });
        setCrew(prev => prev.map(c => c.id === member.id ? { ...c, compliance } : c));
      }
    } catch (error) {
      console.error('Compliance check failed:', error);
    } finally {
      setIsCheckingCompliance(null);
    }
  };

  const handleProposedPlanCheck = async (member: CrewMember) => {
    if (!proposedPlan) return;
    setIsCheckingConflicts(member.id);
    try {
      const historicalQ = query(
        collection(db, 'duty_logs'),
        where('crewMemberId', '==', member.id),
        orderBy('startTime', 'desc')
      );
      const historicalSnapshot = await getDocs(historicalQ);
      const historicalLogs = historicalSnapshot.docs.map(doc => doc.data());

      const proposedSchedule = {
        date: proposedPlan.legs[0]?.date || new Date().toISOString(),
        flights: proposedPlan.legs.map((l: any) => ({
          departure: l.departure,
          destination: l.destination,
          etd: l.etd || proposedPlan.date,
          eta: l.eta || proposedPlan.date,
          duration: l.flightTime
        }))
      };

      const result = await analyzeCrewScheduleConflicts(
        member,
        proposedSchedule,
        historicalLogs,
        [] 
      );

      setCrew(prev => prev.map(c => c.id === member.id ? { ...c, conflicts: result } : c));
    } catch (error) {
      console.error('Conflict check failed:', error);
    } finally {
      setIsCheckingConflicts(null);
    }
  };

  const fetchCrew = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'crew_members'), orderBy('name'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CrewMember));
      setCrew(data);
    } catch (error) {
      console.error('Error fetching crew:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDutyLogs = async (crewId: string) => {
    setLoadingLogs(true);
    try {
      const q = query(
        collection(db, 'duty_logs'), 
        where('crewMemberId', '==', crewId),
        orderBy('startTime', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DutyLog));
      setDutyLogs(data);
    } catch (error) {
      console.error('Error fetching duty logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleAddCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedCrew) {
        await updateDoc(doc(db, 'crew_members', selectedCrew.id), formData);
      } else {
        await addDoc(collection(db, 'crew_members'), formData);
      }
      setShowAddModal(false);
      setSelectedCrew(null);
      setFormData({ name: '', role: 'Captain', status: 'Active', contactEmail: '', contactPhone: '', totalHours: 0, certifications: [] });
      fetchCrew();
    } catch (error) {
      console.error('Error saving crew member:', error);
    }
  };

  const handleAddDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCrew) return;

    try {
      await addDoc(collection(db, 'duty_logs'), {
        ...dutyData,
        crewMemberId: selectedCrew.id
      });
      
      await updateDoc(doc(db, 'crew_members', selectedCrew.id), {
        lastDutyEnd: dutyData.endTime
      });

      setShowDutyModal(false);
      setDutyData({ startTime: '', endTime: '', type: 'Flight', notes: '', sectors: 1, origin: '', destination: '' });
      fetchCrew();
      fetchDutyLogs(selectedCrew.id);
      
      // Auto-trigger compliance check
      const updatedMember = crew.find(c => c.id === selectedCrew.id);
      if (updatedMember) {
          handleComplianceCheck(updatedMember);
      }
    } catch (error) {
      console.error('Error saving duty log:', error);
    }
  };

  const cumulativeHours = useMemo(() => {
     return dutyLogs.reduce((acc, log) => {
        const start = new Date(log.startTime).getTime();
        const end = new Date(log.endTime).getTime();
        return acc + (end - start) / 3600000;
     }, 0);
  }, [dutyLogs]);

  // Update JSX in duty records to show cumulative hours
  // ... (inside the Duty Records map section)

  const handleDeleteCrew = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this crew member?')) return;
    try {
      await deleteDoc(doc(db, 'crew_members', id));
      fetchCrew();
    } catch (error) {
      console.error('Error deleting crew member:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
            <Users className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Crew Control</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">IATA/ICAO Compliance & FTL Planning</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
          <button 
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'roster' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
          >
            Roster
          </button>
          <button 
            onClick={() => setActiveTab('calculator')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'calculator' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
          >
            FDP Calc
          </button>
          <button 
            onClick={() => setActiveTab('planning')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'planning' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
          >
            Planning
          </button>
        </div>

        <button
          onClick={() => {
            setSelectedCrew(null);
            setFormData({ name: '', role: 'Captain', status: 'Active', contactEmail: '', contactPhone: '', totalHours: 0, certifications: [] });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <UserPlus size={18} />
          Add Crew
        </button>
      </div>

      {activeTab === 'roster' && (
        <>
          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {crew.map((member) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
                >
                  {/* Performance Indicator Background */}
                  <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-[0.03] transition-opacity group-hover:opacity-[0.07] ${member.compliance?.status === 'Green' ? 'bg-emerald-500' : member.compliance?.status === 'Yellow' ? 'bg-amber-500' : 'bg-red-500'}`} />

                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                        <Fingerprint size={28} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{member.name}</h3>
                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                       {member.status === 'Active' && (
                          <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800">
                             <CheckCircle2 size={8} className="text-emerald-500" />
                             <span className="text-[7px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Available</span>
                          </div>
                       )}
                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                        <button
                          onClick={() => {
                            setSelectedCrew(member);
                            setFormData({
                              name: member.name, role: member.role, status: member.status,
                              contactEmail: member.contactEmail, contactPhone: member.contactPhone,
                              totalHours: member.totalHours,
                              certifications: member.certifications || []
                            });
                            setShowAddModal(true);
                          }}
                          className="p-2 bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-indigo-600 rounded-xl transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCrew(member.id)}
                          className="p-2 bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-red-600 rounded-xl transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-3xl border border-gray-100 dark:border-gray-800">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Career Hours</p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">{member.totalHours}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-3xl border border-gray-100 dark:border-gray-800">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Duty Status</p>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${member.status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <p className="text-xs font-black text-gray-900 dark:text-white uppercase">{member.status}</p>
                      </div>
                    </div>
                  </div>

                  {member.compliance && (
                    <div className="mb-6 space-y-3 p-5 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/30 relative z-10">
                       <div className="flex justify-between items-center">
                          <h4 className="text-[9px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">ICAO FTL Compliance</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                            member.compliance.status === 'Green' ? 'bg-emerald-100 text-emerald-600' :
                            member.compliance.status === 'Yellow' ? 'bg-amber-100 text-amber-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            {member.compliance.status}
                          </span>
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                             <div 
                                className={`h-full transition-all duration-500 ${member.compliance.status === 'Green' ? 'bg-emerald-500' : member.compliance.status === 'Yellow' ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(100, (member.compliance.metrics.hours28Days / 100) * 100)}%` }}
                             />
                          </div>
                          <span className="text-[10px] font-black text-gray-600 dark:text-gray-400">{member.compliance.metrics.hours28Days}h / 28d</span>
                       </div>
                       <p className="text-[9px] text-gray-500 italic leading-tight">"{member.compliance.summary}"</p>
                    </div>
                  )}

                  {member.conflicts && proposedPlan && (
                    <div className={`mb-6 p-5 rounded-3xl border relative z-10 ${member.conflicts.hasConflicts ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'}`}>
                       <div className="flex items-center gap-2 mb-2">
                          <Shield size={14} className={member.conflicts.hasConflicts ? 'text-red-500' : 'text-emerald-500'} />
                          <p className="text-[9px] font-black uppercase tracking-widest">Plan Conflict Audit</p>
                       </div>
                       {member.conflicts.hasConflicts ? (
                         <div className="space-y-1">
                           {member.conflicts.conflicts.map((c, i) => (
                             <p key={i} className="text-[10px] text-red-600 dark:text-red-400 font-bold leading-tight">• {c.message}</p>
                           ))}
                         </div>
                       ) : (
                         <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">Crew clear for mission.</p>
                       )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 relative z-10">
                    <button
                      onClick={() => handleComplianceCheck(member)}
                      disabled={isCheckingCompliance === member.id}
                      className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-opacity-90 transition-all disabled:opacity-50"
                    >
                      {isCheckingCompliance === member.id ? <Loader2 size={12} className="animate-spin" /> : <BarChart3 size={12} />}
                      FTL Audit
                    </button>
                    {proposedPlan && (
                      <button
                        onClick={() => handleProposedPlanCheck(member)}
                        disabled={isCheckingConflicts === member.id}
                        className="flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-opacity-90 transition-all disabled:opacity-50"
                      >
                         {isCheckingConflicts === member.id ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
                         Verify Plan
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedCrew(member);
                        fetchDutyLogs(member.id);
                      }}
                      className="col-span-2 flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-gray-600 transition-all"
                    >
                      <History size={12} />
                      Duty Records
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white dark:bg-gray-800 p-10 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-8">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl transform -rotate-6">
                    <Calculator className="text-indigo-600" size={24} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">IATA AI Compliance Specialist</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Regulatory FTL Planning & Suggestion Engine</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Departure Airport</label>
                    <input 
                      type="text"
                      placeholder="e.g. EGLL"
                      value={calcData.departure}
                      onChange={(e) => setCalcData({ ...calcData, departure: e.target.value.toUpperCase() })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Arrival Airport</label>
                    <input 
                      type="text"
                      placeholder="e.g. KJFK"
                      value={calcData.destination}
                      onChange={(e) => setCalcData({ ...calcData, destination: e.target.value.toUpperCase() })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Reporting Time (UTC)</label>
                    <input 
                      type="datetime-local"
                      value={calcData.reportTime}
                      onChange={(e) => setCalcData({ ...calcData, reportTime: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Chock On Time (UTC)</label>
                    <input 
                      type="datetime-local"
                      value={calcData.onBlockTime}
                      onChange={(e) => setCalcData({ ...calcData, onBlockTime: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Flying Time (Block Hours)</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={calcData.flyingTime}
                      onChange={(e) => setCalcData({ ...calcData, flyingTime: parseFloat(e.target.value) })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Number of Sectors</label>
                    <input 
                      type="number"
                      min="1"
                      value={calcData.sectors}
                      onChange={(e) => setCalcData({ ...calcData, sectors: parseInt(e.target.value) })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                 </div>
                 <div className="md:col-span-2">
                    <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl cursor-pointer hover:bg-gray-100 transition-all">
                      <input 
                        type="checkbox"
                        checked={calcData.isMultiCrew}
                        onChange={(e) => setCalcData({ ...calcData, isMultiCrew: e.target.checked })}
                        className="w-5 h-5 rounded-lg text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <span className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest">Multi-Crew / Augmented (3+ Pilots)</span>
                    </label>
                 </div>
              </div>

              <button
                onClick={handleAiCalc}
                disabled={isCalculatingAi || !calcData.reportTime || !calcData.onBlockTime}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
              >
                {isCalculatingAi ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                Run AI IATA Diagnostic
              </button>

              <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 flex gap-4">
                 <Info size={20} className="text-indigo-600 shrink-0" />
                 <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold leading-relaxed uppercase tracking-tight">
                    AI Diagnostic uses current IATA/EASA FTL regulations. It considers WOCL, sector counts, and acclimatization levels for rest suggestions.
                 </p>
              </div>
           </div>

           <div className="space-y-6">
              {aiCalcResult ? (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white dark:bg-gray-800 p-10 rounded-[3.5rem] border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-full"
                >
                  <div className="space-y-8">
                    <div className="flex justify-between items-center">
                       <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">AI Compliance Report</h4>
                       <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${aiCalcResult.isCompliant ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                          {aiCalcResult.status}
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800">
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Calculated FDP</p>
                          <p className="text-2xl font-black text-gray-900 dark:text-white">{aiCalcResult.fdpCalculated}</p>
                       </div>
                       <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800">
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Standard Limit</p>
                          <p className="text-2xl font-black text-indigo-600">{aiCalcResult.limitUsed}</p>
                       </div>
                       <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-800/50 col-span-2">
                          <p className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">Crew Augmentation Suggestion</p>
                          <div className="flex items-center gap-3">
                             <Users size={18} className="text-emerald-600" />
                             <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">{aiCalcResult.recommendations.crewAugmentation}</p>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-[2.5rem] border border-amber-100 dark:border-amber-800/50">
                          <div className="flex items-center justify-between mb-4">
                             <h5 className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Rest & Recovery</h5>
                             <Clock size={16} className="text-amber-600" />
                          </div>
                          <div className="space-y-3">
                             <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-tight">Required Rest:</span>
                                <span className="text-sm font-black text-gray-900 dark:text-white">{aiCalcResult.recommendations.restRequired}</span>
                             </div>
                             <div className="flex justify-between items-center pt-2 border-t border-amber-100 dark:border-amber-800/50">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-tight">Next Fly After:</span>
                                <span className="text-sm font-black text-indigo-600">{aiCalcResult.recommendations.earliestNextDuty}</span>
                             </div>
                          </div>
                       </div>

                       <div className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] border border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-2 mb-2">
                             <Shield size={14} className="text-indigo-600" />
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Over/Under Time Analysis</p>
                          </div>
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-relaxed italic">
                             {aiCalcResult.recommendations.overTimeUnderTime}
                          </p>
                       </div>

                       <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white">
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-2">Auditor Reasoning</p>
                          <p className="text-xs font-bold leading-relaxed">{aiCalcResult.reasoning}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mt-4">Reference: {aiCalcResult.iataLawsReference}</p>
                       </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900/50 p-12 rounded-[3.5rem] border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center text-center h-full">
                   <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-200 dark:text-gray-700 mb-4 shadow-sm">
                      <Sparkles size={40} />
                   </div>
                   <p className="text-sm font-black text-gray-400 uppercase tracking-widest">AI Audit Pending</p>
                   <p className="text-xs text-gray-400 mt-2 max-w-xs">Enter mission profile and click Run AI Diagnostic to get IATA compliance suggestions.</p>
                </div>
              )}
           </div>
        </div>
      )}

      {activeTab === 'planning' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           <div className="lg:col-span-4 space-y-6">
              <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                 <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight mb-6">Mission Parameters</h3>
                 <div className="space-y-4">
                    <div>
                       <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Aircraft Type</label>
                       <input 
                         type="text" 
                         value={planningData.aircraftType}
                         onChange={(e) => setPlanningData({ ...planningData, aircraftType: e.target.value })}
                         className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-xs font-bold"
                         placeholder="e.g. G650ER, A320"
                       />
                    </div>
                    <div>
                       <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Mission Type</label>
                       <select 
                         value={planningData.missionType}
                         onChange={(e) => setPlanningData({ ...planningData, missionType: e.target.value as any })}
                         className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-xs font-bold"
                       >
                          <option value="Passenger">Commercial Passenger</option>
                          <option value="VIP">Private/VIP</option>
                          <option value="Cargo">Cargo/Logistics</option>
                       </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Est. Flight Duration</label>
                          <input 
                            type="number" 
                            value={planningData.totalFlightTime}
                            onChange={(e) => setPlanningData({ ...planningData, totalFlightTime: parseFloat(e.target.value) })}
                            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-xs font-bold"
                          />
                       </div>
                       <div>
                          <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Mission Date/Time</label>
                          <input 
                            type="datetime-local" 
                            value={planningData.departureTime}
                            onChange={(e) => setPlanningData({ ...planningData, departureTime: e.target.value })}
                            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-xs font-bold"
                          />
                       </div>
                    </div>
                 </div>
              </div>

              {missionAnalysis && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none"
                >
                   <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-60 mb-4">Required Crew Capacity</p>
                   <div className="space-y-6">
                      <div className="flex justify-between items-end border-b border-white/10 pb-4">
                         <div>
                            <p className="text-3xl font-black">{missionAnalysis.pilotsRequired}</p>
                            <p className="text-[10px] font-bold uppercase opacity-80">Pilots Required</p>
                         </div>
                         <div className="text-right">
                            <p className="text-3xl font-black">{missionAnalysis.cabinCrewRequired}</p>
                            <p className="text-[10px] font-bold uppercase opacity-80">Cabin Service</p>
                         </div>
                      </div>
                      <div className="flex justify-between items-center bg-white/10 p-4 rounded-3xl">
                         <div>
                            <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Req. Pre-Flight Rest</p>
                            <p className="text-lg font-black">{missionAnalysis.minRestRequired}h</p>
                         </div>
                         <div className="text-right">
                            <Shield size={24} className="opacity-40" />
                         </div>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-tight leading-relaxed italic opacity-80">
                         Note: {missionAnalysis.recommendation} protocol recommended for safety margins.
                      </p>
                   </div>
                </motion.div>
              )}
           </div>

           <div className="lg:col-span-8 space-y-6">
              <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                 <div className="flex justify-between items-center mb-8">
                    <div>
                       <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Availability Mapping</h3>
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Qualified & Legal Personnel for Specified Timeframe</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                          onClick={handleAiSuggestion} 
                          disabled={isSuggesting}
                          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                          {isSuggesting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          {isSuggesting ? 'Suggesting...' : 'Get AI Assignment'}
                        </button>
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{availablePersonnel.length} Available</span>
                        </div>
                     </div>
                 </div>

                 {proposedPlan?.crewSafetyBrief && (
                   <motion.div 
                     initial={{ opacity: 0, scale: 0.98 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="mb-8 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-[2rem] border border-purple-100 dark:border-purple-800/50"
                   >
                     <div className="flex items-center gap-2 mb-3">
                       <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                       <h4 className="text-[11px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-[0.1em]">AI Strategic Compliance Brief</h4>
                     </div>
                     <p className="text-xs text-purple-900/70 dark:text-purple-200/70 leading-relaxed font-medium italic">
                       "{proposedPlan.crewSafetyBrief}"
                     </p>
                   </motion.div>
                 )}

                 <div className="space-y-4">
                    {availablePersonnel.length > 0 ? (
                      availablePersonnel.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-5 bg-gray-50 dark:bg-gray-900/40 rounded-3xl border border-gray-100 dark:border-gray-800 group hover:border-indigo-200 transition-all">
                           <div className="flex items-center gap-6">
                              <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center shadow-sm">
                                 <Fingerprint size={24} className="text-indigo-600" />
                              </div>
                              <div>
                                 <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{member.name}</h4>
                                 <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{member.role}</p>
                              </div>
                           </div>
                           
                           <div className="flex gap-12 items-center">
                              <div className="flex gap-2">
                                {proposedPlan?.legs?.map((leg: any, idx: number) => (
                                  <button
                                    key={idx}
                                    onClick={() => setAssignments(prev => {
                                      const current = prev[idx] || [];
                                      if (current.includes(member.id)) {
                                         return { ...prev, [idx]: current.filter(id => id !== member.id) };
                                      } else {
                                         return { ...prev, [idx]: [...current, member.id] };
                                      }
                                   })}
                                   className={`text-[8px] font-black uppercase border border-indigo-100 px-3 py-1.5 rounded-lg transition-all ${assignments[idx]?.includes(member.id) ? 'bg-indigo-600 text-white' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                                  >
                                    L{idx + 1}
                                  </button>
                                ))}
                              </div>
                              <div className="hidden md:block">
                                 <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Rest Remaining</p>
                                 <p className="text-xs font-black text-gray-900 dark:text-white">
                                    {member.compliance?.metrics.restTimeRemainingHours ? `${member.compliance.metrics.restTimeRemainingHours}h` : 'N/A'}
                                 </p>
                              </div>
                              <div className="text-right">
                                 <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Earliest Availability</p>
                                 <p className="text-xs font-black text-gray-900 dark:text-white">
                                    {member.compliance?.metrics.nextLegalDutyStart 
                                      ? new Date(member.compliance.metrics.nextLegalDutyStart).toLocaleDateString() + ' ' + new Date(member.compliance.metrics.nextLegalDutyStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                      : member.lastDutyEnd 
                                        ? new Date(new Date(member.lastDutyEnd).getTime() + 12 * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : 'Ready'
                                    }
                                 </p>
                              </div>
                              <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
                           </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center flex flex-col items-center">
                         <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-700 mb-4">
                            <Activity size={40} />
                         </div>
                         <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No Legal Personnel Found</p>
                         <p className="text-[10px] text-gray-400 mt-2 max-w-xs">Adjust mission times or perform FTL audits on roster members to refresh availability states.</p>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODALS (Simplified for turn limit) */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-[3rem] p-10 w-full max-w-lg shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600" />
              <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-8">Personnel Onboarding</h3>
              <form onSubmit={handleAddCrew} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Full Legal Name</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Designated Role</label>
                    <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as any })} className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all font-bold">
                      <option value="Captain">Captain</option>
                      <option value="First Officer">First Officer</option>
                      <option value="Flight Engineer">Flight Engineer</option>
                      <option value="Cabin Crew">Cabin Crew</option>
                      <option value="Loadmaster">Loadmaster</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Certifications (comma-separated)</label>
                    <input type="text" value={(selectedCrew?.certifications || []).join(', ')} onChange={(e) => setFormData({ ...formData, certifications: e.target.value.split(',').map(c => c.trim()) })} className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all font-bold" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Initial Career Hours</label>
                    <input type="number" required value={formData.totalHours} onChange={(e) => setFormData({ ...formData, totalHours: parseInt(e.target.value) })} className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all font-bold" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                   <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email</label>
                      <input type="email" required value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all font-bold" />
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Phone</label>
                      <input type="tel" required value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all font-bold" />
                   </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-6 py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">Discard</button>
                  <button type="submit" className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none">Confirm Entry</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Duty History Panel (Dynamic) */}
      {selectedCrew && !showDutyModal && dutyLogs.length > 0 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-gray-100/50 dark:bg-gray-900/50 rounded-[3rem] p-10 border border-gray-200 dark:border-gray-800">
           <div className="flex justify-between items-center mb-8">
              <div>
                 <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Mission History: {selectedCrew.name}</h3>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Historical FTL Audit Trail</p>
              </div>
              <button 
                onClick={() => { setDutyLogs([]); setSelectedCrew(null); }}
                className="px-6 py-2 bg-white dark:bg-gray-800 text-[10px] font-black text-gray-400 hover:text-indigo-600 uppercase tracking-widest rounded-xl transition-all shadow-sm"
              >
                Close Records
              </button>
           </div>
           
           <div className="mb-6 bg-white/50 dark:bg-gray-800/50 p-6 rounded-3xl border border-white/50 dark:border-gray-700/50 flex justify-between items-center">
               <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cumulative Duty Hours</p>
                   <p className="text-3xl font-black text-gray-900 dark:text-white">{cumulativeHours.toFixed(1)} <span className="text-xs text-gray-400">HRS</span></p>
               </div>
               <button 
                 onClick={() => setShowDutyModal(true)}
                 className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl"
               >
                 <Plus size={16} /> Add Duty Log
               </button>
           </div>

           <div className="space-y-4">
              {dutyLogs.map(log => (
                <div key={log.id} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 flex justify-between items-center group/item hover:shadow-lg transition-all">
                   <div className="flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${log.type === 'Flight' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}>
                         {log.type === 'Flight' ? <Play className="fill-current" size={24} /> : <StopCircle size={24} />}
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{log.type}</p>
                         {log.origin && (
                           <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-1">{log.origin} → {log.destination}</h4>
                         )}
                         <p className="text-xs text-gray-500 font-bold uppercase tracking-tight">{new Date(log.startTime).toLocaleString()} - {new Date(log.endTime).toLocaleString()}</p>
                      </div>
                   </div>
                   <div className="flex flex-col items-end">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Duration</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white">{((new Date(log.endTime).getTime() - new Date(log.startTime).getTime())/3600000).toFixed(1)}h</p>
                   </div>
                </div>
              ))}
           </div>
        </motion.div>
      )}
    </div>
  );
}
