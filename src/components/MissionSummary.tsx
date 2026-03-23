import { Plane, Clock, MapPin, Fuel, DollarSign, Globe } from 'lucide-react';
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
  legsCount
}: MissionSummaryProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
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
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Plane size={16} className="text-indigo-200 dark:text-indigo-300" />
            <span className="text-sm font-bold">{aircraft}</span>
          </div>
          <div className="w-1 h-1 bg-indigo-400 dark:bg-indigo-500 rounded-full" />
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-indigo-200 dark:text-indigo-300" />
            <span className="text-sm font-bold">{totalTime.toFixed(1)} hrs</span>
          </div>
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
    </motion.div>
  );
}
