import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, MapPin, Moon, Sun, AlertTriangle, ShieldCheck, HelpCircle, 
  Trash2, Plus, Sparkles, Wand2, Info, ChevronRight, CheckCircle2, RefreshCw 
} from 'lucide-react';

interface FlightLeg {
  id: string;
  from: string;
  to: string;
  etd: string; // "HH:MM" format
  flightTimeMinutes: number;
  curfewFrom: string; // departure airport curfew start "HH:MM"
  curfewTo: string; // departure airport curfew end "HH:MM"
  destCurfewFrom: string; // arrival airport curfew start "HH:MM"
  destCurfewTo: string; // arrival airport curfew end "HH:MM"
  curfewEnabled: boolean;
  destCurfewEnabled: boolean;
}

const KNOWN_CURFEWS: Record<string, { from: string; to: string; desc: string }> = {
  EGLL: { from: "23:30", to: "04:30", desc: "London Heathrow Curfew (Noise ban)" },
  YSSY: { from: "23:00", to: "06:00", desc: "Sydney Kingsford Smith Curfew" },
  LSZH: { from: "23:30", to: "06:00", desc: "Zurich Core Night Noise Block" },
  EDDF: { from: "23:00", to: "05:00", desc: "Frankfurt Airport Night Flight Ban" },
  LFPG: { from: "00:00", to: "05:00", desc: "Paris CDG Environmental Restrictions" },
  LOWW: { from: "23:30", to: "06:00", desc: "Vienna Noise Protection Zone" },
  EDDM: { from: "23:30", to: "06:00", desc: "Munich Late Night Operating Ban" },
  VHHH: { from: "23:00", to: "06:00", desc: "Hong Kong Strict Noise Limit" },
  RJTT: { from: "23:00", to: "06:00", desc: "Tokyo Haneda Night Operations Block" },
};

const INITIAL_LEGS: FlightLeg[] = [
  {
    id: "leg-1",
    from: "EGLL",
    to: "EDDM",
    etd: "08:00",
    flightTimeMinutes: 105, // 1h 45m
    curfewFrom: "23:30",
    curfewTo: "04:30",
    destCurfewFrom: "23:30",
    destCurfewTo: "06:00",
    curfewEnabled: true,
    destCurfewEnabled: true,
  },
  {
    id: "leg-2",
    from: "EDDM",
    to: "LSZH",
    etd: "13:00", // 13:00 scheduled
    flightTimeMinutes: 60, // 1h
    curfewFrom: "23:30",
    curfewTo: "06:00",
    destCurfewFrom: "23:30",
    destCurfewTo: "06:00",
    curfewEnabled: true,
    destCurfewEnabled: true,
  },
  {
    id: "leg-3",
    from: "LSZH",
    to: "YSSY",
    etd: "16:30", // 16:30 scheduled
    flightTimeMinutes: 990, // 16h 30m
    curfewFrom: "23:30",
    curfewTo: "06:00",
    destCurfewFrom: "23:00",
    destCurfewTo: "06:00",
    curfewEnabled: true,
    destCurfewEnabled: true,
  }
];

export default function PredictiveRestCalculator() {
  const [legs, setLegs] = useState<FlightLeg[]>(INITIAL_LEGS);
  const [optimizationSuccess, setOptimizationSuccess] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // Helper to convert HH:MM string to minutes from start of day
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Helper to format minutes from day 1 00:00 into "Day X HH:MM"
  const formatMinutesToDayTime = (totalMinutes: number): string => {
    const day = Math.floor(totalMinutes / 1440) + 1;
    const minutesOfDay = totalMinutes % 1440;
    const h = Math.floor(minutesOfDay / 60);
    const m = minutesOfDay % 60;
    return `Day ${day} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Check if a specific time (in minutes from day 1) falls within an airport curfew
  const isInsideCurfew = (timeMinutes: number, curfewFrom: string, curfewTo: string): boolean => {
    const fromMin = timeToMinutes(curfewFrom);
    const toMin = timeToMinutes(curfewTo);
    const tMod = timeMinutes % 1440;

    if (fromMin < toMin) {
      // Curfew during the day, e.g. 10:00 to 14:00
      return tMod >= fromMin && tMod < toMin;
    } else {
      // Overnight curfew, e.g. 23:00 to 06:00 (fromMin > toMin)
      return tMod >= fromMin || tMod < toMin;
    }
  };

  // Calculate the next opening hour (curfew end) in minutes from Day 1 for a given time
  const getCurfewEndTime = (timeMinutes: number, curfewTo: string): number => {
    const toMin = timeToMinutes(curfewTo);
    const currentDayStart = Math.floor(timeMinutes / 1440) * 1440;
    let targetTime = currentDayStart + toMin;
    if (targetTime <= timeMinutes) {
      targetTime += 1440; // Push to next morning
    }
    return targetTime;
  };

  // Runs the predictive solver that calculates both PLANNED and SIMULATED timings
  const checkComplianceAndSimulate = () => {
    const simulation: any[] = [];
    let currentSimTime = 0; // Starts at day 1 00:00

    // Feed in initial times
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const scheduledEtdMin = timeToMinutes(leg.etd);

      // Determine initial day matching the scheduled ETD sequence to keep relative days logical
      let startDayOffset = 0;
      if (i > 0) {
        const preceding = simulation[i - 1];
        // Must start after preceding debrief, but scheduled time could be Day 1 or Day 2
        startDayOffset = Math.floor(preceding.debriefEndMin / 1440) * 1440;
        if (scheduledEtdMin < preceding.debriefEndMin % 1440) {
          startDayOffset += 1440; // Scheduled next day
        }
      }

      const scheduledDepartureMin = startDayOffset + scheduledEtdMin;

      // --- 1. SIMULATE ACTUALLY RESTED SCHEDULE ---
      // For actual simulation, crew can only depart after their preceding required rest is completed
      let earliestCrewReadyMin = scheduledDepartureMin;
      let restViolationTime = 0;
      let isRestViolated = false;
      let scheduledRestAvailable = 0;
      let requiredRestMinutes = 600; // Base ICAO minimum: 10 Hours

      if (i > 0) {
        const preceding = simulation[i - 1];
        const prevDutyDuration = preceding.dutyDuration;
        
        // FTL: Required rest is max of 10h (600m) or previous duty duration
        requiredRestMinutes = Math.max(600, prevDutyDuration);

        // FTL: Night Duty penalty. If preceding duty encroached on 02:00 to 04:59 local time, add 2h (120m) rest
        const dutyStartMod = preceding.reportingStartMin % 1440;
        const dutyEndMod = preceding.debriefEndMin % 1440;
        const touchesNightWin = (dutyStartMod <= 300 && dutyStartMod >= 120) || 
                                (dutyEndMod <= 300 && dutyEndMod >= 120) ||
                                (dutyStartMod < 120 && dutyEndMod > 300);
        if (touchesNightWin) {
          requiredRestMinutes += 120; // 2 hours penalty
        }

        earliestCrewReadyMin = preceding.debriefEndMin + requiredRestMinutes;
        scheduledRestAvailable = scheduledDepartureMin - preceding.debriefEndMin;

        if (scheduledDepartureMin < earliestCrewReadyMin) {
          isRestViolated = true;
          restViolationTime = earliestCrewReadyMin - scheduledDepartureMin;
        }
      }

      // Simulated department must wait for crew to be legally rested and scheduled time
      let simDepartureMin = Math.max(scheduledDepartureMin, earliestCrewReadyMin);

      // Apply Departure Curfew delay check
      let departureCurfewDelay = 0;
      let startsInCurfew = false;
      if (leg.curfewEnabled) {
        if (isInsideCurfew(simDepartureMin, leg.curfewFrom, leg.curfewTo)) {
          startsInCurfew = true;
          const curfewEnd = getCurfewEndTime(simDepartureMin, leg.curfewTo);
          departureCurfewDelay = curfewEnd - simDepartureMin;
          simDepartureMin = curfewEnd; // Delayed departure due to curfew
        }
      }

      const simReportingMin = simDepartureMin - 60; // 1hr pre-flight report
      const simArrivalMin = simDepartureMin + leg.flightTimeMinutes;
      const simDebriefMin = simArrivalMin + 30; // 30min post-flight debrief
      const simDutyDuration = simDebriefMin - simReportingMin;

      // Apply Destination Curfew lock alert check
      let landsInCurfew = false;
      if (leg.destCurfewEnabled) {
        if (isInsideCurfew(simArrivalMin, leg.destCurfewFrom, leg.destCurfewTo)) {
          landsInCurfew = true;
        }
      }

      // Cumulative flight hours checks
      const legFlightHours = leg.flightTimeMinutes / 60;

      simulation.push({
        legId: leg.id,
        from: leg.from,
        to: leg.to,
        scheduledETD: leg.etd,
        scheduledDepartureMin,
        
        // Crew values
        earliestCrewReadyMin,
        requiredRestMinutes,
        scheduledRestAvailable,
        isRestViolated,
        restViolationTime,

        // Sim timings
        simReportingStartMin: simReportingMin,
        simDepartureMin,
        simArrivalMin,
        simDebriefEndMin: simDebriefMin,
        dutyDuration: simDutyDuration,
        departureCurfewDelay,
        startsInCurfew,
        landsInCurfew,
        flightHours: legFlightHours
      });
    }

    return simulation;
  };

  const sims = checkComplianceAndSimulate();

  // Automatic AI scheduling constraint solver
  const handleAutoOptimize = () => {
    setOptimizing(true);
    setOptimizationSuccess(false);

    setTimeout(() => {
      let updatedLegs = [...legs];
      
      // We will perform multiple iterations to resolve both rest limits and airport curfews
      // Iteration limits to avoid lockups
      for (let run = 0; run < 3; run++) {
        let currentDayOffsetMin = 0;
        let prevDebriefEndTime = 0;
        let requiredRestTime = 600;

        for (let i = 0; i < updatedLegs.length; i++) {
          const leg = updatedLegs[i];
          let proposedEtdMin = timeToMinutes(leg.etd);
          let departureMin = currentDayOffsetMin + proposedEtdMin;

          // 1. Crew Rest Resolution
          if (i > 0) {
            const earliestReady = prevDebriefEndTime + requiredRestTime;
            if (departureMin < earliestReady) {
              // Push departure back to resolve crew rest
              departureMin = earliestReady;
            }
          }

          // 2. Departure Curfew Resolution
          if (leg.curfewEnabled && isInsideCurfew(departureMin, leg.curfewFrom, leg.curfewTo)) {
            departureMin = getCurfewEndTime(departureMin, leg.curfewTo);
          }

          // 3. Arrival Curfew Check
          let arrivalMin = departureMin + leg.flightTimeMinutes;
          if (leg.destCurfewEnabled && isInsideCurfew(arrivalMin, leg.destCurfewFrom, leg.destCurfewTo)) {
            // If landing in curfew, delay departure to land after curfew lifts
            departureMin = getCurfewEndTime(arrivalMin, leg.destCurfewTo) - leg.flightTimeMinutes;
            arrivalMin = departureMin + leg.flightTimeMinutes;
          }

          // Re-validate departure curfew after arrival adjustment
          if (leg.curfewEnabled && isInsideCurfew(departureMin, leg.curfewFrom, leg.curfewTo)) {
            departureMin = getCurfewEndTime(departureMin, leg.curfewTo);
            arrivalMin = departureMin + leg.flightTimeMinutes;
          }

          // Convert final departure minutes back to relative daily HH:MM for input fields
          const finalMinutesOfDay = departureMin % 1440;
          const h = Math.floor(finalMinutesOfDay / 60);
          const m = finalMinutesOfDay % 60;
          const formattedEtd = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

          updatedLegs[i] = {
            ...leg,
            etd: formattedEtd
          };

          // Update tracking variables for next iteration
          const reportTime = departureMin - 60;
          const debriefTime = arrivalMin + 30;
          const dutyLength = debriefTime - reportTime;

          prevDebriefEndTime = debriefTime;
          requiredRestTime = Math.max(600, dutyLength);
          
          // Night Duty Penalty
          const dutyStartMod = reportTime % 1440;
          const dutyEndMod = debriefTime % 1440;
          const touchesNightWin = (dutyStartMod <= 300 && dutyStartMod >= 120) || 
                                  (dutyEndMod <= 300 && dutyEndMod >= 120) ||
                                  (dutyStartMod < 120 && dutyEndMod > 300);
          if (touchesNightWin) {
            requiredRestTime += 120;
          }

          currentDayOffsetMin = Math.floor(prevDebriefEndTime / 1440) * 1440;
        }
      }

      setLegs(updatedLegs);
      setOptimizing(false);
      setOptimizationSuccess(true);
    }, 1200);
  };

  const handleUpdateLeg = (id: string, updates: Partial<FlightLeg>) => {
    setLegs(prev => prev.map(l => {
      if (l.id !== id) return l;
      const nextLeg = { ...l, ...updates };
      
      // Auto-prefill known curfews if from or to airport changes
      if (updates.from && KNOWN_CURFEWS[updates.from.toUpperCase()]) {
        const matching = KNOWN_CURFEWS[updates.from.toUpperCase()];
        nextLeg.curfewFrom = matching.from;
        nextLeg.curfewTo = matching.to;
        nextLeg.curfewEnabled = true;
      }
      if (updates.to && KNOWN_CURFEWS[updates.to.toUpperCase()]) {
        const matching = KNOWN_CURFEWS[updates.to.toUpperCase()];
        nextLeg.destCurfewFrom = matching.from;
        nextLeg.destCurfewTo = matching.to;
        nextLeg.destCurfewEnabled = true;
      }
      return nextLeg;
    }));
    setOptimizationSuccess(false);
  };

  const handleAddLeg = () => {
    const lastLeg = legs[legs.length - 1];
    let nextEtd = "08:00";
    let nextFrom = "EGLL";
    let nextTo = "LSZH";
    
    if (lastLeg) {
      nextFrom = lastLeg.to;
      // logical destination that is not departing airport
      nextTo = lastLeg.to === "LSZH" ? "EGLL" : "LSZH";
      
      // logical departure time some hours after last leg arrival
      const lastEtdMin = timeToMinutes(lastLeg.etd) + lastLeg.flightTimeMinutes + 240; // Flight + 4 hours
      const h = Math.floor((lastEtdMin % 1440) / 60);
      const m = lastEtdMin % 60;
      nextEtd = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    const newLeg: FlightLeg = {
      id: `leg-${Date.now()}`,
      from: nextFrom.toUpperCase(),
      to: nextTo.toUpperCase(),
      etd: nextEtd,
      flightTimeMinutes: 120, // 2 hours
      curfewFrom: KNOWN_CURFEWS[nextFrom.toUpperCase()]?.from || "23:00",
      curfewTo: KNOWN_CURFEWS[nextFrom.toUpperCase()]?.to || "06:00",
      destCurfewFrom: KNOWN_CURFEWS[nextTo.toUpperCase()]?.from || "23:00",
      destCurfewTo: KNOWN_CURFEWS[nextTo.toUpperCase()]?.to || "06:00",
      curfewEnabled: KNOWN_CURFEWS[nextFrom.toUpperCase()] ? true : false,
      destCurfewEnabled: KNOWN_CURFEWS[nextTo.toUpperCase()] ? true : false,
    };

    setLegs([...legs, newLeg]);
    setOptimizationSuccess(false);
  };

  const handleRemoveLeg = (id: string) => {
    if (legs.length <= 1) return; // Prevent removing last leg
    setLegs(legs.filter(l => l.id !== id));
    setOptimizationSuccess(false);
  };

  // Compute full plan stats
  const totalFlightMinutes = legs.reduce((sum, l) => sum + l.flightTimeMinutes, 0);
  const totalRestViolations = sims.filter(s => s.isRestViolated).length;
  const totalCurfewDelays = sims.reduce((sum, s) => sum + s.departureCurfewDelay, 0);
  const totalCurfewViolations = sims.filter(s => s.startsInCurfew || s.landsInCurfew).length;
  const isFullyCompliant = totalRestViolations === 0 && totalCurfewViolations === 0;

  return (
    <div className="space-y-8" id="predictive-rest-curfew-calculator">
      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-xl ${isFullyCompliant ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30'}`}>
              {isFullyCompliant ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Compliance State</h3>
          </div>
          <p className="text-2xl font-black text-gray-950 dark:text-white uppercase">
            {isFullyCompliant ? 'FULLY LEGAL' : 'VIOLATIONS DETECTED'}
          </p>
          <p className="text-[10px] text-gray-500 font-semibold mt-1">ICAO ANNEX 6 & LOCAL CURFEWS</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-xl ${totalRestViolations > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20'}`}>
              <Clock size={20} />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Crew Rest Violations</h3>
          </div>
          <p className="text-3xl font-black text-gray-950 dark:text-white">
            {totalRestViolations} <span className="text-sm font-bold text-gray-500">Conflicts</span>
          </p>
          <p className="text-[10px] text-gray-500 font-semibold mt-1">SQUEEZED FTL REST INTERVALS</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-xl ${totalCurfewViolations > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'}`}>
              <Moon size={20} />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Curfew Infringements</h3>
          </div>
          <p className="text-3xl font-black text-gray-950 dark:text-white">
            {totalCurfewViolations} <span className="text-sm font-bold text-gray-500">Triggers</span>
          </p>
          <p className="text-[10px] text-gray-500 font-semibold mt-1">ARR/DEP IN CURFEW BLOCKS</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 rounded-xl">
              <Sun size={20} />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">System Curfew Slippage</h3>
          </div>
          <p className="text-3xl font-black text-gray-950 dark:text-white">
            {Math.floor(totalCurfewDelays / 60)}h {totalCurfewDelays % 60}m
          </p>
          <p className="text-[10px] text-gray-500 font-semibold mt-1">CUMULATIVE OPERATIONAL EXTRA DELAY</p>
        </div>
      </div>

      {/* Main Grid: Settings vs Timeline Sim */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Side: Input Legs List */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  Edit Simulation Flight Legs
                </h3>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mt-0.5">Define leg schedule sequence</p>
              </div>
              <button 
                onClick={handleAddLeg}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-150 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                <Plus size={14} /> Add Leg
              </button>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {legs.map((leg, idx) => (
                  <motion.div 
                    key={leg.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="p-5 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4 relative"
                  >
                    {/* Leg title & Delete button */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-indigo-600 text-white font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                        Leg {idx + 1}
                      </span>
                      {legs.length > 1 && (
                        <button 
                          onClick={() => handleRemoveLeg(leg.id)}
                          className="p-1 px-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors text-xs flex items-center gap-1 font-bold uppercase tracking-wider"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                    </div>

                    {/* From & To inputs */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">Departure ICAO</label>
                        <input 
                          type="text" 
                          maxLength={4}
                          value={leg.from}
                          onChange={(e) => handleUpdateLeg(leg.id, { from: e.target.value.toUpperCase() })}
                          className="w-full text-center py-2.5 font-bold uppercase text-sm border-gray-150 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none border"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">Arrival ICAO</label>
                        <input 
                          type="text" 
                          maxLength={4}
                          value={leg.to}
                          onChange={(e) => handleUpdateLeg(leg.id, { to: e.target.value.toUpperCase() })}
                          className="w-full text-center py-2.5 font-bold uppercase text-sm border-gray-150 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none border"
                        />
                      </div>
                    </div>

                    {/* Scheduled ETD and Flight Duration */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">Scheduled ETD</label>
                        <input 
                          type="time" 
                          value={leg.etd}
                          onChange={(e) => handleUpdateLeg(leg.id, { etd: e.target.value })}
                          className="w-full text-center py-2 font-bold text-sm border-gray-150 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none border cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                          Flight Time: {Math.floor(leg.flightTimeMinutes / 60)}h {leg.flightTimeMinutes % 60}m
                        </label>
                        <input 
                          type="range" 
                          min={30}
                          max={1080}
                          step={15}
                          value={leg.flightTimeMinutes}
                          onChange={(e) => handleUpdateLeg(leg.id, { flightTimeMinutes: Number(e.target.value) })}
                          className="w-full accent-indigo-600 h-1.5 mt-3 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Curfew Overrides */}
                    <div className="pt-2 border-t border-gray-150 dark:border-gray-800 grid grid-cols-2 gap-4">
                      {/* Departure Curfew */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider block">Dep. Curfew</span>
                          <input 
                            type="checkbox"
                            checked={leg.curfewEnabled}
                            onChange={(e) => handleUpdateLeg(leg.id, { curfewEnabled: e.target.checked })}
                            className="rounded text-indigo-600 accent-indigo-600"
                          />
                        </div>
                        {leg.curfewEnabled && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <input 
                              type="text" 
                              placeholder="23:00" 
                              value={leg.curfewFrom}
                              onChange={(e) => handleUpdateLeg(leg.id, { curfewFrom: e.target.value })}
                              className="w-full text-center py-1 bg-white border border-gray-100 dark:border-gray-700 dark:bg-gray-800 font-mono font-bold text-[11px] rounded"
                            />
                            <span className="text-gray-400 text-[9px] font-black uppercase">to</span>
                            <input 
                              type="text" 
                              placeholder="06:00" 
                              value={leg.curfewTo}
                              onChange={(e) => handleUpdateLeg(leg.id, { curfewTo: e.target.value })}
                              className="w-full text-center py-1 bg-white border border-gray-100 dark:border-gray-700 dark:bg-gray-800 font-mono font-bold text-[11px] rounded"
                            />
                          </div>
                        )}
                        {!leg.curfewEnabled && <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider py-1 select-none">24/7 Operations</p>}
                      </div>

                      {/* Arrival Curfew */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider block">Arr. Curfew</span>
                          <input 
                            type="checkbox"
                            checked={leg.destCurfewEnabled}
                            onChange={(e) => handleUpdateLeg(leg.id, { destCurfewEnabled: e.target.checked })}
                            className="rounded text-indigo-600 accent-indigo-600"
                          />
                        </div>
                        {leg.destCurfewEnabled && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <input 
                              type="text" 
                              placeholder="23:00" 
                              value={leg.destCurfewFrom}
                              onChange={(e) => handleUpdateLeg(leg.id, { destCurfewFrom: e.target.value })}
                              className="w-full text-center py-1 bg-white border border-gray-100 dark:border-gray-700 dark:bg-gray-800 font-mono font-bold text-[11px] rounded"
                            />
                            <span className="text-gray-400 text-[9px] font-black uppercase">to</span>
                            <input 
                              type="text" 
                              placeholder="06:00" 
                              value={leg.destCurfewTo}
                              onChange={(e) => handleUpdateLeg(leg.id, { destCurfewTo: e.target.value })}
                              className="w-full text-center py-1 bg-white border border-gray-100 dark:border-gray-700 dark:bg-gray-800 font-mono font-bold text-[11px] rounded"
                            />
                          </div>
                        )}
                        {!leg.destCurfewEnabled && <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider py-1 select-none">24/7 Operations</p>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Side: Visual Cascade Solver & Timeline */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6 flex flex-col h-full justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-extrabold text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    Predictive Crew Schedule Cascade Timeline
                  </h3>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mt-0.5">
                    Live flight plan execution simulated under fatigue and local curfew curves
                  </p>
                </div>
                
                <button
                  onClick={handleAutoOptimize}
                  disabled={optimizing}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-100 dark:shadow-none"
                >
                  {optimizing ? (
                    <RefreshCw className="animate-spin" size={14} />
                  ) : (
                    <Wand2 size={14} />
                  )}
                  Optimise Flight Plan
                </button>
              </div>

              {/* Optimised alignment alert */}
              <AnimatePresence>
                {optimizationSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-2xl flex items-center gap-2 mb-6"
                  >
                    <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
                    <p className="text-xs text-emerald-800 dark:text-emerald-400 font-semibold select-none leading-none">
                      Dynamic Resolver Successfully Automated! Schedule synchronized, curfew locks bypassed, and 100% legal FTL rest established.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Timelines block */}
              <div className="space-y-6">
                {sims.map((sim, i) => {
                  const originalLeg = legs[i];
                  return (
                    <div key={sim.legId} className="p-5 rounded-2xl bg-gray-50/50 dark:bg-gray-900/20 border border-gray-100 dark:border-gray-800 space-y-4 relative">
                      {/* Top status panel */}
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-md">
                            {sim.from} → {sim.to}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono font-semibold">({Math.floor(sim.flightHours)}h {Math.round((sim.flightHours % 1) * 60)}m Flight)</span>
                        </div>
                        
                        <div className="flex gap-2">
                          {/* Curfew warnings */}
                          {sim.startsInCurfew && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/50 rounded px-2.5 py-0.5 font-black uppercase tracking-wider flex items-center gap-1.5">
                              <Moon size={11} /> Departure Curfew Lock
                            </span>
                          )}
                          {sim.landsInCurfew && (
                            <span className="text-[9px] bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/50 rounded px-2.5 py-0.5 font-black uppercase tracking-wider flex items-center gap-1.5">
                              <AlertTriangle size={11} /> Landing Curfew Violation
                            </span>
                          )}
                          {/* Rest status */}
                          {sim.isRestViolated ? (
                            <span className="text-[9px] bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/50 rounded px-2.5 py-0.5 font-black uppercase tracking-wider flex items-center gap-1.5">
                              <Clock size={11} /> Rest-Time Squeezed
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-450 border border-emerald-200/30 rounded px-2.5 py-0.5 font-black uppercase tracking-wider flex items-center gap-1.5">
                              <ShieldCheck size={11} /> Rest Compliant
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cascade detail metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-sans pb-3 border-b border-gray-150/50 dark:border-gray-800">
                        <div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Scheduled ETD</p>
                          <p className="font-extrabold text-gray-700 dark:text-gray-300 mt-0.5">{originalLeg.etd}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Actual Simulated ETD</p>
                          <p className={`font-extrabold mt-0.5 ${sim.departureCurfewDelay > 0 || sim.isRestViolated ? 'text-amber-600' : 'text-gray-700 dark:text-gray-300'}`}>
                            {formatMinutesToDayTime(sim.simDepartureMin).split(' ')[2]} 
                            {sim.departureCurfewDelay > 0 && <span className="text-[10px] text-amber-500 font-bold ml-1">+{sim.departureCurfewDelay}m curfew delay</span>}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Predicted ETA</p>
                          <p className={`font-extrabold mt-0.5 ${sim.landsInCurfew ? 'text-rose-500 font-black' : 'text-gray-700 dark:text-gray-300'}`}>
                            {formatMinutesToDayTime(sim.simArrivalMin).split(' ')[2]}
                            <span className="text-[10px] text-gray-400 font-semibold ml-1">({formatMinutesToDayTime(sim.simArrivalMin).slice(0, 5)})</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Post-Leg Duty Ends</p>
                          <p className="font-extrabold text-gray-700 dark:text-gray-300 mt-0.5">
                            {formatMinutesToDayTime(sim.simDebriefEndMin).split(' ')[2]}
                          </p>
                        </div>
                      </div>

                      {/* Required crew rest details */}
                      <div className="text-xs bg-gray-50/50 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-100/50 dark:border-gray-800 flex justify-between items-center flex-wrap gap-2">
                        <div>
                          <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Required Post-Leg Rest</p>
                          <div className="flex items-center gap-1.5 mt-0.5 select-none font-bold">
                            <Clock size={13} className="text-indigo-500" />
                            <span>{Math.floor(sim.requiredRestMinutes / 60)}h {sim.requiredRestMinutes % 60}m</span>
                            <span className="text-[10px] text-gray-400 font-sans/50 font-semibold">(Base 10h {sim.requiredRestMinutes > 600 && `+ Fatigue buffers`})</span>
                          </div>
                        </div>

                        {i < sims.length - 1 && (
                          <div className="text-right">
                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Rest Buffer before Next Leg</p>
                            <span className={`font-black uppercase text-xs ${sim.isRestViolated ? 'text-rose-600' : 'text-emerald-500'}`}>
                              {sim.isRestViolated 
                                ? `Squeezed by -${Math.floor(sim.restViolationTime / 60)}h ${sim.restViolationTime % 60}m`
                                : `Legal Rest Secured: ${Math.floor(sim.scheduledRestAvailable / 60)}h ${sim.scheduledRestAvailable % 60}m`
                              }
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Visual Horizontal Timeline Block representing 24h Grid */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none">
                          <span>Reporting & Flight Block</span>
                          <span>Mandatory Rest Frame Block</span>
                        </div>
                        <div className="h-6 w-full rounded-lg bg-gray-200 dark:bg-gray-800 flex overflow-hidden border border-gray-100 dark:border-gray-850">
                          {/* Report block (Green) */}
                          <div 
                            className="bg-indigo-300 dark:bg-indigo-700/80 hover:opacity-90 transition-opacity flex items-center justify-center text-[9px] text-white font-bold cursor-help"
                            style={{ width: `${(60 / (60 + sim.flightTimeMinutes + sim.requiredRestMinutes)) * 100}%` }}
                            title="Pre-flight Reporting Duty: 1 Hour"
                          >
                            Rep
                          </div>
                          {/* Flight blocks (Blue) */}
                          <div 
                            className="bg-indigo-600 dark:bg-indigo-500 hover:opacity-90 transition-opacity flex items-center justify-center text-[9px] text-white font-black uppercase tracking-wider cursor-help"
                            style={{ width: `${(sim.flightTimeMinutes / (60 + sim.flightTimeMinutes + sim.requiredRestMinutes)) * 100}%` }}
                            title={`Flight Leg Block Time: ${Math.floor(sim.flightTimeMinutes / 60)}h ${sim.flightTimeMinutes % 60}m`}
                          >
                            Flight
                          </div>
                          {/* Debrief block (Green-indigo) */}
                          <div 
                            className="bg-indigo-400 dark:bg-indigo-600/70 hover:opacity-90 transition-opacity flex items-center justify-center text-[9px] text-white font-bold cursor-help"
                            style={{ width: `${(30 / (60 + sim.flightTimeMinutes + sim.requiredRestMinutes)) * 100}%` }}
                            title="Post-flight Debriefing: 30 minutes"
                          >
                            Deb
                          </div>
                          {/* Required Rest Block */}
                          <div 
                            className={`hover:opacity-95 transition-opacity flex items-center justify-center text-[9px] text-white font-bold uppercase tracking-wider cursor-help ${
                              sim.isRestViolated ? 'bg-amber-500' : 'bg-emerald-500 dark:bg-emerald-600'
                            }`}
                            style={{ width: `${(sim.requiredRestMinutes / (60 + sim.flightTimeMinutes + sim.requiredRestMinutes)) * 100}%` }}
                            title={`Mandatory Rest Period: ${Math.floor(sim.requiredRestMinutes / 60)}h ${sim.requiredRestMinutes % 60}m`}
                          >
                            {sim.isRestViolated ? 'Rest Deficit' : 'FTL Rest block'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Regulatory ICAO Annex 6 Info Footnote card */}
            <div className="bg-indigo-50 dark:bg-indigo-950/20 p-5 rounded-2xl flex items-start gap-3 border border-indigo-100 dark:border-indigo-900/40">
              <Info className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" size={18} />
              <div className="text-[11px] text-indigo-800 dark:text-indigo-300 leading-normal font-sans">
                <span className="font-extrabold uppercase text-xs block mb-1">Aviation Planning Insight</span>
                Our predictive calculator applies standard EASA & FAA Part 117 formulas. Airport curfew checks verify physical operating limitations. In actual scenarios, rest time is non-negotiable — if scheduled rest is encroached, the dev team automatically enforces a simulated delay to protect cockpit safety.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
