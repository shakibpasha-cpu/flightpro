import React, { useState } from 'react';
import { Globe, Shield, DollarSign, Zap, Loader2, CheckCircle2, ChevronRight, AlertTriangle, CloudRain } from 'lucide-react';
import { getOptimizedRoute } from '../services/aiService';
import { motion, AnimatePresence } from 'motion/react';

interface FIR {
  name: string;
  country: string;
  rules: string;
  overflightCharge: number;
  navigationCharge: number;
}

interface FIRAnalysisProps {
  firs: FIR[];
  departure: string;
  destination: string;
}

export default function FIRAnalysis({ firs, departure, destination }: FIRAnalysisProps) {
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<any>(null);

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const result = await getOptimizedRoute(departure, destination, firs);
      setOptimization(result);
    } catch (error) {
      console.error('Optimization Error:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const totalFIRCharges = firs.reduce((acc, fir) => acc + (fir.overflightCharge || 0) + (fir.navigationCharge || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="text-indigo-600 dark:text-indigo-400" size={20} />
          <h3 className="font-bold text-gray-800 dark:text-white">Airspace & FIR Analysis</h3>
        </div>
        <button
          onClick={handleOptimize}
          disabled={optimizing}
          className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center gap-2 disabled:opacity-50"
        >
          {optimizing ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
          {optimization ? 'Re-Optimize' : 'Optimize Route'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {firs.map((fir, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:border-indigo-100 dark:hover:border-indigo-500/50 transition-all group">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-gray-800 dark:text-white">{fir.name}</span>
                  <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                    {fir.country}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  ${((fir.overflightCharge || 0) + (fir.navigationCharge || 0))?.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">
                  {fir.overflightCharge > 0 && fir.navigationCharge > 0 ? 'Overflight + Nav' : fir.overflightCharge > 0 ? 'Overflight Fee' : 'Nav Fee'}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              <Shield size={14} className="mt-0.5 flex-shrink-0 text-gray-300 dark:text-gray-600" />
              <p>{fir.rules}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Total Airspace Charges</span>
        <span className="text-lg font-black text-gray-800 dark:text-white">${totalFIRCharges?.toLocaleString()}</span>
      </div>

      <AnimatePresence>
        {optimization && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={18} />
                  <h4 className="font-bold">AI Route Optimization Suggestion</h4>
                </div>
                <div className="bg-emerald-600 dark:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">
                  Save ${optimization.savings?.toLocaleString()}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {optimization.suggestedRoute.firs.map((fir: any, idx: number) => (
                    <React.Fragment key={idx}>
                      <div className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50 shadow-sm flex-shrink-0">
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{fir.name}</div>
                        <div className="text-[8px] text-gray-400 dark:text-gray-500 font-bold uppercase">{fir.country}</div>
                      </div>
                      {idx < optimization.suggestedRoute.firs.length - 1 && (
                        <ChevronRight size={14} className="text-emerald-300 dark:text-emerald-700 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed italic">
                  "{optimization.reasoning}"
                </div>

                {optimization.impactedBy && optimization.impactedBy.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {optimization.impactedBy.map((impact: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                        {impact.type === 'NOTAM' ? (
                          <AlertTriangle size={12} className="text-amber-500" />
                        ) : impact.type === 'Weather' ? (
                          <CloudRain size={12} className="text-blue-500" />
                        ) : (
                          <DollarSign size={12} className="text-emerald-500" />
                        )}
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{impact.type}:</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{impact.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-emerald-100 dark:border-emerald-800/50">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Optimized Total</span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">${optimization.suggestedRoute.totalCost?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
