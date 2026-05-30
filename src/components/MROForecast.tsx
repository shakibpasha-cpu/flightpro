import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, Plane, TrendingUp, Calendar, AlertTriangle, ShieldCheck, 
  Sparkles, Loader2, Info, ChevronRight, CheckCircle2, Sliders, DollarSign, Clock, LayoutGrid
} from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getMroForecast, MROForecastResult } from '../services/mroAnalysisService';
import MROForecastD3Chart from './MROForecastD3Chart';

interface AircraftData {
  id: string;
  registration: string;
  type: string;
  maintenanceReserve: number;
  maintenanceStatus: string;
  averageMonthlyHours: number;
}

export default function MROForecast() {
  const [aircraftList, setAircraftList] = useState<AircraftData[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [forecast, setForecast] = useState<MROForecastResult | null>(null);
  
  // Custom flight hours overrides for what-if scenarios
  const [usageOverrides, setUsageOverrides] = useState<Record<string, number>>({});
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Fetch initial fleet and logs
  const fetchFleet = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'aircraft'));
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Compute logical default hours based on aircraft type/category if not specified
        let defaultHours = 60;
        const category = (data.category || '').toLowerCase();
        if (category.includes('heavy') || category.includes('ultra')) defaultHours = 95;
        else if (category.includes('mid') || category.includes('super')) defaultHours = 75;
        else if (category.includes('light')) defaultHours = 50;

        return {
          id: doc.id,
          registration: data.registration || 'N/A',
          type: data.type || 'Generic Jet',
          maintenanceReserve: Number(data.maintenanceReserve) || 180,
          maintenanceStatus: data.maintenanceStatus || 'Standard Status',
          averageMonthlyHours: defaultHours
        };
      }) as AircraftData[];

      setAircraftList(list);

      // Trigger first forecast
      if (list.length > 0) {
        const result = await getMroForecast(list);
        setForecast(result);
      }
    } catch (error) {
      console.error('Failed to load aircraft fleet for forecast:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  const handleUpdateHours = (id: string, hours: number) => {
    setUsageOverrides(prev => ({ ...prev, [id]: hours }));
  };

  const handleRunForecast = useCallback(async () => {
    if (aircraftList.length === 0) return;
    setRecalculating(true);
    try {
      const adjustedList = aircraftList.map(a => ({
        ...a,
        averageMonthlyHours: usageOverrides[a.id] !== undefined ? usageOverrides[a.id] : a.averageMonthlyHours
      }));
      const result = await getMroForecast(adjustedList);
      setForecast(result);
    } catch (e) {
      console.error(e);
    } finally {
      setRecalculating(false);
    }
  }, [aircraftList, usageOverrides]);

  // Format currency
  const formatCur = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(num);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 bg-white dark:bg-gray-950 rounded-3xl border border-gray-100 dark:border-gray-900 shadow-sm">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Computing Predictive Fleet Usage Logs...</p>
        <p className="text-[10px] text-gray-400 uppercase mt-1">Simulating aircraft-specific overhaul matrices</p>
      </div>
    );
  }

  // Active flight lists reflecting any manual overrides
  const activeFleet = aircraftList.map(a => ({
    ...a,
    hours: usageOverrides[a.id] !== undefined ? usageOverrides[a.id] : a.averageMonthlyHours
  }));

  const activeMonthData = forecast?.monthlyBreakdown.find(m => m.month === selectedMonth);

  return (
    <div className="space-y-8 select-none">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
            <TrendingUp className="text-indigo-600" size={32} />
            AI MRO cost Forecast
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">
            Predictive 12-month maintenance scheduling & hourly reserve cost models matching operational thresholds.
          </p>
        </div>
        <button 
          onClick={handleRunForecast}
          disabled={recalculating}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          {recalculating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          Recalculate Cost Projections
        </button>
      </div>

      {forecast && (
        <>
          {/* Key Intelligence Summary Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Total 12-Month Projections', value: formatCur(forecast.totalProjectedCost), icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
              { label: 'Estimated Monthly Average', value: formatCur(forecast.averageMonthlyCost), icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'Peak Liquidity Outflow', value: formatCur(forecast.peakMonthCost), info: `Expected in ${forecast.peakMonth}`, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
              { label: 'Total Fleet Projected Hours', value: `${forecast.monthlyBreakdown.reduce((sum, item) => sum + item.projectedHours, 0).toLocaleString()} Hrs`, icon: Plane, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            ].map((stat, i) => (
              <div key={i} className={`${stat.bg} p-6 rounded-3xl border border-gray-100/50 dark:border-gray-800 flex flex-col justify-between`}>
                <div>
                  <div className={`p-3 rounded-xl bg-white dark:bg-gray-800 w-fit shadow-sm mb-4 ${stat.color}`}>
                    <stat.icon size={20} />
                  </div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{stat.label}</p>
                </div>
                {stat.info && (
                  <p className="text-[10px] text-gray-500 font-semibold uppercase mt-3 italic">{stat.info}</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Interactive Flight Usage Simulation Configuration */}
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Sliders size={18} className="text-indigo-500" />
                  Fleet Utilization Scenario Simulation
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Adjust expected flight hours per aircraft to see standard maintenance interval costs reflect in the 12-month timeline.
                </p>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {activeFleet.map(a => (
                  <div key={a.id} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-850 space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xs font-black text-gray-800 dark:text-white">{a.registration}</span>
                        <span className="text-[10px] text-gray-400 ml-2 font-mono">({a.type})</span>
                      </div>
                      <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-400 px-2 py-0.5 rounded">
                        {a.hours} Hrs/mo
                      </span>
                    </div>
                    
                    <input 
                      type="range"
                      min="10"
                      max="200"
                      step="5"
                      value={a.hours}
                      onChange={(e) => handleUpdateHours(a.id, Number(e.target.value))}
                      className="w-full accent-indigo-600 h-1.5 bg-gray-250 rounded-lg cursor-pointer dark:bg-gray-700"
                    />

                    <div className="flex justify-between items-center pt-1 text-[9px] text-gray-400 font-bold uppercase">
                      <span>Reserve Rate: ${a.maintenanceReserve}/hr</span>
                      <span>Total: {formatCur(a.hours * a.maintenanceReserve)}/mo</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleRunForecast}
                  disabled={recalculating}
                  className="w-full py-3 bg-gray-900 border border-gray-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-indigo-600 transition"
                >
                  {recalculating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                  Re-Calculate Projections
                </button>
              </div>
            </div>

            {/* Visual Charts Projections using pristine D3.js */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <LayoutGrid size={16} className="text-indigo-600" />
                    D3 Projected Cost Flow Distribution
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Hover bars for exact breakdown or click to isolate specific months. Hot alert indicators represent scheduling conflicts.
                  </p>
                </div>
                {/* Visual Legend */}
                <div className="flex gap-3 text-[10px] font-black uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-gray-500">Hourly Reserves</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-gray-500">Checks (A/B/C)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-gray-500">Overhauls</span>
                  </div>
                </div>
              </div>

              {/* D3 Integration Space */}
              <div className="h-[285px] w-full mt-4 bg-gray-50/20 dark:bg-gray-900/20 rounded-2xl p-2">
                <MROForecastD3Chart 
                  data={forecast.monthlyBreakdown} 
                  selectedMonth={selectedMonth} 
                  onSelectMonth={setSelectedMonth} 
                />
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-2xl flex items-center gap-3 border border-gray-100 dark:border-gray-800/60 mt-4">
                <Info size={18} className="text-indigo-600 shrink-0" />
                <p className="text-xs leading-normal font-sans text-gray-600 dark:text-gray-300">
                  <span className="font-extrabold text-gray-950 dark:text-white uppercase">AI Analysis:</span> "{forecast.aiForecastSummary}"
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recommendations & Staggering Advice */}
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                Strategic Compliance Actions
              </h3>
              <p className="text-xs text-gray-500 leading-snug">
                AI recommended steps to mitigate scheduling overlaps, balance crew safety, and minimize total hangar grounding costs:
              </p>

              <div className="space-y-3 pt-2">
                {forecast.recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-2.5 items-start">
                    <span className="w-5 h-5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] rounded-full flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-350 leading-relaxed font-sans">{rec}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Aircraft Wise Annual Summary */}
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-wider">
                Fleet Aircraft Status Breakdown
              </h3>
              
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {forecast.aircraftSummaries.map((ac, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-850 flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-850 dark:text-white">{ac.registration}</span>
                        <span className={`text-[8px] font-black uppercase px-2 rounded-md ${
                          ac.status === 'Critical' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400' :
                          ac.status === 'Warning' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-405' :
                          'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                        }`}>{ac.status}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium font-sans">12Mo Hrs: {Math.round(ac.totalProjectedHours)}h ({ac.type})</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight italic pt-0.5">Next check: {ac.nextMajorCheck}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-gray-800 dark:text-white">{formatCur(ac.estimated12MonthCost)}</span>
                      <p className="text-[8.5px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">Proj. Expense</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Month-by-month Schedule Block */}
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-wider">
                  Forecast Schedule Timeline
                </h3>
                {selectedMonth && (
                  <button 
                    onClick={() => setSelectedMonth(null)} 
                    className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition"
                  >
                    View All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {forecast.monthlyBreakdown.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedMonth(item.month === selectedMonth ? null : item.month)}
                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-between ${
                      item.month === selectedMonth 
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20' 
                        : 'border-gray-150 dark:border-gray-750 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{item.month.split(' ')[0]}</span>
                    <span className="text-xs font-extrabold text-gray-800 dark:text-white mt-1">{formatCur(item.totalCost).replace('.00','')}</span>
                    {item.scheduledEvents.length > 0 && (
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5" />
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                {selectedMonth ? (
                  <div className="p-3 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30 space-y-2">
                    <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">Selected Month Details: {selectedMonth}</p>
                    <div className="flex justify-between text-xs pt-1">
                      <span className="text-gray-500 font-medium">Projected Flight Hours:</span>
                      <span className="font-extrabold">{Math.round(activeMonthData?.projectedHours || 0)} Hrs</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 font-medium">Routine Reserves:</span>
                      <span className="font-semibold">{formatCur(activeMonthData?.reserveCost || 0)}</span>
                    </div>
                    {Number(activeMonthData?.scheduledCheckCost) > 0 && (
                      <div className="flex justify-between text-xs text-amber-600">
                        <span className="font-medium">Scheduled Check Costs:</span>
                        <span className="font-bold">+{formatCur(activeMonthData?.scheduledCheckCost || 0)}</span>
                      </div>
                    )}
                    {Number(activeMonthData?.componentOverhaulCost) > 0 && (
                      <div className="flex justify-between text-xs text-rose-600">
                        <span className="font-medium">Overhaul Estimates:</span>
                        <span className="font-bold">+{formatCur(activeMonthData?.componentOverhaulCost || 0)}</span>
                      </div>
                    )}

                    {activeMonthData && activeMonthData.scheduledEvents.length > 0 && (
                      <div className="pt-2 border-t border-indigo-100/40 dark:border-indigo-900/30">
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Scheduled Fleet Events</p>
                        <ul className="list-disc pl-4 space-y-1 text-[10px] text-gray-700 dark:text-gray-300 font-sans mt-1">
                          {activeMonthData.scheduledEvents.map((evt, eIdx) => (
                            <li key={eIdx}>{evt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-[10px] font-black uppercase text-gray-400 tracking-widest bg-gray-50/40 dark:bg-gray-900/10 rounded-2xl border border-dashed border-gray-150">
                    Click any month or D3 bar to view activity logs
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
