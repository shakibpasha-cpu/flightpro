import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Info, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { getSafetyRiskAnalysis, SafetyRiskAnalysisResult } from '../services/safetyRiskAnalysis';

interface SafetyRiskAnalysisProps {
  departure: string;
  destination: string;
  aircraftType?: string;
  date: string;
  flightTimeHours: number;
}

export default function SafetyRiskAnalysis({ departure, destination, aircraftType, date, flightTimeHours }: SafetyRiskAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [data, setData] = useState<SafetyRiskAnalysisResult | null>(null);

  useEffect(() => {
    // We only fetch data explicitly via button, or maybe automatically if needed.
    // For this context, let's load it automatically when all props are present and flightTimeHours > 0
    if (departure && destination && aircraftType && flightTimeHours > 0) {
      loadAnalysis();
    }
  }, [departure, destination, aircraftType, date, flightTimeHours]);

  const loadAnalysis = async () => {
    setLoading(true);
    setHasError(false);
    try {
      const result = await getSafetyRiskAnalysis(departure, destination, aircraftType || 'Unknown', date, flightTimeHours);
      setData(result);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  if (!departure || !destination || !flightTimeHours) return null;

  if (loading) {
    return (
      <div className="mt-8 border border-dashed border-gray-200 dark:border-gray-700 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
        <ShieldAlert className="text-indigo-400 animate-pulse mb-3" size={32} />
        <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-widest text-sm">Conducting Safety Analysis...</h4>
        <p className="text-xs text-gray-500 font-bold uppercase mt-1">Evaluating airspace, NOTAMs, and crew FTL risks</p>
      </div>
    );
  }

  if (hasError || !data) {
     return null; 
  }

  const getRiskColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-rose-500 text-white';
      case 'High': return 'bg-orange-500 text-white';
      case 'Medium': return 'bg-amber-400 text-black';
      case 'Low': return 'bg-emerald-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };
  
  const getRiskBorder = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'border-rose-500 text-rose-700 bg-rose-50';
      case 'High': return 'border-orange-500 text-orange-700 bg-orange-50';
      case 'Medium': return 'border-amber-400 text-amber-700 bg-amber-50';
      case 'Low': return 'border-emerald-500 text-emerald-700 bg-emerald-50';
      default: return 'border-gray-200';
    }
  };

  return (
    <div className="mt-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
            <ShieldCheck className="text-indigo-600" size={24} />
            Safety Risk Analysis & Operational Hazards
          </h3>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">AI-driven evaluation of FIR, METAR/TAF, and FTL limitations</p>
        </div>
        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${getRiskColor(data.overallRiskLevel)}`}>
           <AlertTriangle size={14} />
           Overall Risk: {data.overallRiskLevel}
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-inner">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 italic mb-6">
          "{data.summary}"
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.risks.map((risk, idx) => (
            <motion.div
              key={risk.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-5 rounded-2xl border-l-4 shadow-sm bg-white dark:bg-gray-900 flex flex-col gap-3 ${getRiskBorder(risk.severity)}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-black tracking-widest opacity-60">[{risk.category}]</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${getRiskColor(risk.severity)}`}>
                    {risk.severity} MAX
                  </span>
                </div>
              </div>
              
              <p className="font-bold text-sm leading-snug">
                {risk.description}
              </p>

              <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800 flex items-start gap-2">
                <Zap className="text-indigo-500 shrink-0 mt-0.5" size={14} />
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  <span className="uppercase text-[10px] font-black tracking-widest opacity-50 block mb-1">Mitigation Plan:</span>
                  {risk.mitigation}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
