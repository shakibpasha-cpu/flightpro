import { useState } from 'react';
import { Sparkles, Loader2, Plane, MapPin, DollarSign, Fuel, Info, AlertTriangle, Zap, Lightbulb } from 'lucide-react';
import { planComplexFlight, analyzeFlightPlan } from '../services/aiService';
import { motion } from 'motion/react';
import FIRAnalysis from './FIRAnalysis';
import FuelPlan from './FuelPlan';
import CostingEngine from './CostingEngine';
import PermitSystem from './PermitSystem';

interface AIPlannerProps {
  aircraftList: any[];
  onPlanGenerated: (plan: any) => void;
}

export default function AIPlanner({ aircraftList, onPlanGenerated }: AIPlannerProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [optimization, setOptimization] = useState<'cheapest' | 'fastest' | 'balanced'>('balanced');

  const quickActions = [
    "Plan flight from Lahore to Riyadh via Dubai",
    "Cargo flight from London to New York for 50 tons",
    "VIP trip from Paris to Tokyo with 12 passengers",
    "Cheapest route from Singapore to Sydney"
  ];

  const handlePlan = async (text?: string) => {
    const queryText = text || input;
    if (!queryText.trim()) return;
    
    setLoading(true);
    try {
      const result = await planComplexFlight(queryText, aircraftList, optimization);
      setPlan(result);
      onPlanGenerated(result);
      
      // Generate AI analysis
      setAnalyzing(true);
      const analysisResult = await analyzeFlightPlan(result);
      setAnalysis(analysisResult);
    } catch (error) {
      console.error('AI Planning Error:', error);
      alert('Failed to generate flight plan. Please try again.');
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 mb-4">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
          <Info size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">AI Assistant Tips</span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          Ask me to plan complex multi-leg journeys, specify passenger counts, cargo weights, or request the most cost-effective options.
        </p>
      </div>

      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your flight request here..."
          className="w-full p-4 pr-12 border-2 border-indigo-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-2xl focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-0 transition-all min-h-[120px] text-gray-700 dark:text-white shadow-sm"
        />
        <button
          onClick={() => handlePlan()}
          disabled={loading || !input.trim()}
          className="absolute right-3 bottom-3 bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['cheapest', 'fastest', 'balanced'].map((opt) => (
          <button
            key={opt}
            onClick={() => setOptimization(opt as any)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              optimization === opt 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 dark:shadow-none' 
                : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInput(action);
                handlePlan(action);
              }}
              disabled={loading}
              className="text-xs bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {plan && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-indigo-600 dark:bg-indigo-900 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 dark:shadow-none"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Suggested Aircraft</p>
              <h3 className="text-2xl font-black">{plan.suggestedAircraft}</h3>
            </div>
            <div className="bg-white/20 dark:bg-black/20 p-2 rounded-xl">
              <Plane size={24} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 dark:bg-black/20 p-3 rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Est. Cost</p>
              <p className="text-xl font-black">${plan.totalCost?.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 dark:bg-black/20 p-3 rounded-2xl">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Total Distance</p>
              <p className="text-xl font-black">{plan.legs.reduce((acc: number, l: any) => acc + l.distance, 0)?.toLocaleString()} nm</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 text-xs font-bold bg-white/10 dark:bg-black/20 p-3 rounded-2xl">
            <Info size={14} />
            <span>Full operational breakdown generated in the results panel.</span>
          </div>
        </motion.div>
      )}

      {analyzing && (
        <div className="flex items-center justify-center gap-2 p-8 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
          <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={20} />
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">AI is analyzing your plan...</p>
        </div>
      )}

      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles size={20} className="text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-lg font-black text-gray-900 dark:text-white">AI Strategic Analysis</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Risks */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle size={16} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Potential Risks</h4>
                </div>
                <div className="space-y-3">
                  {analysis.risks.map((r: any, i: number) => (
                    <div key={i} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-bold text-red-900 dark:text-red-200">{r.risk}</p>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                          r.severity === 'High' ? 'bg-red-600 text-white' :
                          r.severity === 'Medium' ? 'bg-amber-500 text-white' :
                          'bg-emerald-500 text-white'
                        }`}>
                          {r.severity}
                        </span>
                      </div>
                      <p className="text-[10px] text-red-700 dark:text-red-400 italic">Mitigation: {r.mitigation}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Efficiency */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Zap size={16} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Efficiency Gains</h4>
                </div>
                <div className="space-y-3">
                  {analysis.efficiencyGains.map((g: any, i: number) => (
                    <div key={i} className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1">{g.gain}</p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 italic">Impact: {g.impact}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alternatives */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Lightbulb size={16} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Alternative Strategies</h4>
                </div>
                <div className="space-y-3">
                  {analysis.alternatives.map((a: any, i: number) => (
                    <div key={i} className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                      <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 mb-1">{a.strategy}</p>
                      <p className="text-[10px] text-indigo-700 dark:text-indigo-400 italic">Est. Impact: {a.estimatedImpact}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                <span className="font-black text-gray-900 dark:text-white uppercase tracking-widest mr-2">Overall Assessment:</span>
                {analysis.overallAssessment}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
