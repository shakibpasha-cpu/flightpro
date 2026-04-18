import { Plane, Clock, MapPin, Fuel, DollarSign, Globe, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface MissionSummaryProps {
  departure: string;
  destination: string;
  aircraft: string;
  totalDistance: number;
  gcDistance?: number;
  routingDistance?: number;
  totalTime: number;
  totalCost: number;
  totalFuel: number;
  legsCount: number;
  operator?: string;
  availability?: string;
  missionSummary?: string;
  suggestedAlternative?: string;
  highCostRouteAlert?: string;
  optimizedRoute?: any;
  legs?: any[];
  passengers?: number;
  cargoWeight?: number;
}

export default function MissionSummary({
  departure,
  destination,
  aircraft,
  totalDistance,
  gcDistance,
  routingDistance,
  totalTime,
  totalCost,
  totalFuel,
  legsCount,
  operator,
  availability,
  missionSummary,
  suggestedAlternative,
  highCostRouteAlert,
  optimizedRoute,
  legs,
  passengers,
  cargoWeight
}: MissionSummaryProps) {
  const bestAlt = optimizedRoute?.alternatives?.[0];
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-indigo-600 dark:bg-indigo-900 p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-indigo-200 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-1">Mission Overview</p>
              <h2 className="text-2xl font-black">{departure} → {destination}</h2>
            </div>
            <div className="bg-white/20 dark:bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {legsCount} {legsCount === 1 ? 'Leg' : 'Legs'}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Plane size={16} className="text-indigo-200 dark:text-indigo-300" />
              <span className="text-sm font-bold">{aircraft}</span>
            </div>
            {passengers !== undefined && (
              <>
                <div className="w-1 h-1 bg-indigo-400 dark:bg-indigo-500 rounded-full" />
                <div className="text-sm font-bold opacity-80">{passengers} PAX</div>
              </>
            )}
            {cargoWeight !== undefined && cargoWeight > 0 && (
              <>
                <div className="w-1 h-1 bg-indigo-400 dark:bg-indigo-500 rounded-full" />
                <div className="text-sm font-bold opacity-80">{cargoWeight.toLocaleString()} kg Cargo</div>
              </>
            )}
            {operator && (
              <>
                <div className="w-1 h-1 bg-indigo-400 dark:bg-indigo-500 rounded-full" />
                <div className="text-sm font-bold opacity-80">{operator}</div>
              </>
            )}
            <div className="w-1 h-1 bg-indigo-400 dark:bg-indigo-500 rounded-full" />
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-indigo-200 dark:text-indigo-300" />
              <span className="text-sm font-bold">{totalTime.toFixed(1)} hrs</span>
            </div>
            {availability && (
              <>
                <div className="w-1 h-1 bg-indigo-400 dark:bg-indigo-500 rounded-full" />
                <div className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  {availability}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-50 dark:divide-gray-700">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Distance (nm)</span>
            </div>
            <div className="space-y-1">
              <p className="text-xl font-black text-gray-800 dark:text-white">
                {(routingDistance || totalDistance)?.toLocaleString()}
                <span className="text-[8px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 ml-2">Routing</span>
              </p>
              {gcDistance && (
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                  GC: {gcDistance?.toLocaleString()} nm
                </p>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Fuel size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Fuel Req.</span>
            </div>
            <p className="text-xl font-black text-gray-800 dark:text-white">{totalFuel?.toLocaleString()} <span className="text-xs font-normal text-gray-400 dark:text-gray-500">lbs</span></p>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Est. Cost</span>
            </div>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">${totalCost?.toLocaleString()}</p>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Status</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Optimized</span>
            </div>
          </div>
        </div>
      </div>

      {missionSummary && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800/50">
          <h4 className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">AI Mission Summary</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">"{missionSummary}"</p>
        </div>
      )}

      {(suggestedAlternative || highCostRouteAlert || bestAlt) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bestAlt && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <Zap size={14} />
                <h4 className="text-[10px] font-black uppercase tracking-widest">AI Route Optimization Suggestion</h4>
              </div>
              <p className="text-xs font-bold text-gray-900 dark:text-white">
                Switch to <span className="text-emerald-600">{bestAlt.name}</span> to save <span className="text-emerald-600">${bestAlt.totalSavings?.toLocaleString()}</span>
              </p>
              <p className="text-[10px] text-gray-500 italic leading-tight mt-1">
                {bestAlt.recommendation}
              </p>
            </div>
          )}
          {suggestedAlternative && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/50">
              <h4 className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">AI Suggestion</h4>
              <p className="text-xs text-gray-700 dark:text-gray-300">{suggestedAlternative}</p>
            </div>
          )}
          {highCostRouteAlert && (
            <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-800/50">
              <h4 className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1">Cost Alert</h4>
              <p className="text-xs text-gray-700 dark:text-gray-300">{highCostRouteAlert}</p>
            </div>
          )}
        </div>
      )}

      {legs?.some(l => l.operationalNotes) && (
        <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
          <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Operational Notes by Leg</h4>
          <div className="space-y-3">
            {legs.map((leg, i) => leg.operationalNotes && (
              <div key={i} className="flex gap-3">
                <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-[10px] font-bold shrink-0">
                  {i + 1}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-0.5">{leg.departure} → {leg.destination}</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 italic">"{leg.operationalNotes}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
