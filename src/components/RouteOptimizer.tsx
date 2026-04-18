import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Shield, Clock, DollarSign, Loader2, CheckCircle2, AlertTriangle, Wind, CloudRain, Plane, ChevronRight, Info } from 'lucide-react';
import { getOptimizedRoute } from '../services/aiService';

interface RouteOptimizerProps {
  departure: string;
  destination: string;
  currentFirs?: any[];
  aircraftPerformance?: any;
  onApplyRoute?: (route: any) => void;
  stops?: string;
  dateTime?: string;
  aircraftType?: string;
  passengers?: number;
  payload?: number;
}

export default function RouteOptimizer({ 
  departure, 
  destination, 
  currentFirs = [], 
  aircraftPerformance, 
  onApplyRoute,
  stops,
  dateTime,
  aircraftType,
  passengers,
  payload
}: RouteOptimizerProps) {
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<any>(null);
  const [selectedAltIndex, setSelectedAltIndex] = useState(0);
  const [optimizationCriteria, setOptimizationCriteria] = useState<string>('balanced');

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      // Use the more detailed optimizeRoute if we have extra params
      const result = await getOptimizedRoute(departure, destination, currentFirs, aircraftPerformance || { type: aircraftType }, optimizationCriteria);
      setOptimization(result);
      setSelectedAltIndex(0);
    } catch (error) {
      console.error('Optimization Error:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const selectedAlt = optimization?.alternatives?.[selectedAltIndex];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-indigo-50/30 dark:bg-indigo-900/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">AI Route Optimizer</h3>
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Weather • FIR • Performance</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={optimizationCriteria}
            onChange={(e) => setOptimizationCriteria(e.target.value)}
            disabled={optimizing}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="balanced">Balanced (Cost, Time, Fuel)</option>
            <option value="cheapest">Cheapest (Min Cost)</option>
            <option value="fastest">Fastest (Min Time)</option>
            <option value="most fuel-efficient">Most Fuel-Efficient</option>
          </select>
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-100 dark:shadow-none"
          >
            {optimizing ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
            {optimization ? 'Re-Optimize' : 'Optimize Now'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {!optimization && !optimizing && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wind className="text-gray-300 dark:text-gray-600" size={32} />
            </div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Ready to Optimize</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              Click optimize to analyze current weather, FIR charges, and aircraft performance for the best possible route.
            </p>
          </div>
        )}

        {optimizing && (
          <div className="text-center py-12">
            <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={32} />
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Analyzing Global Airspace...</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Checking NOTAMs, FIR charges, and jet streams.</p>
          </div>
        )}

        {optimization && !optimizing && (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {optimization.alternatives.map((alt: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedAltIndex(idx)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedAltIndex === idx
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {alt.name}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={selectedAltIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                      <DollarSign size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Total Savings</span>
                    </div>
                    <p className="text-xl font-black text-gray-900 dark:text-white">${selectedAlt.totalSavings?.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
                      <Clock size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Est. Time</span>
                    </div>
                    <p className="text-xl font-black text-gray-900 dark:text-white">{selectedAlt.totalTime}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CloudRain size={16} />
                    </div>
                    <div>
                      <h5 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Weather Avoidance</h5>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{selectedAlt.weatherAvoidance}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Globe size={16} />
                    </div>
                    <div>
                      <h5 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">FIR Optimization</h5>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{selectedAlt.firOptimization}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Plane size={16} />
                    </div>
                    <div>
                      <h5 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Performance Notes</h5>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{selectedAlt.performanceNotes}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={14} className="text-indigo-600" />
                    <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">AI Recommendation</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 italic leading-relaxed">
                    "{selectedAlt.recommendation}"
                  </p>
                </div>

                <button
                  onClick={() => onApplyRoute?.(selectedAlt)}
                  className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-3 rounded-xl font-bold text-xs hover:bg-gray-800 dark:hover:bg-gray-100 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Apply This Route
                </button>
              </motion.div>
            </AnimatePresence>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
              <h5 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">AI Summary</h5>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {optimization.summary}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Globe({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}
