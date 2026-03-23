import React from 'react';
import { Fuel, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { motion } from 'motion/react';

interface FuelPlanProps {
  tripFuel: number;
  contingencyFuel: number;
  alternateFuel: number;
  reserveFuel: number;
  totalFuelRequired: number;
  aircraftRange: number;
  totalDistance: number;
  fuelBurnPerHour: number;
  stopsNeeded: boolean;
  suggestedStops?: string[];
}

export default function FuelPlan({
  tripFuel,
  contingencyFuel,
  alternateFuel,
  reserveFuel,
  totalFuelRequired,
  aircraftRange,
  totalDistance,
  fuelBurnPerHour,
  stopsNeeded,
  suggestedStops
}: FuelPlanProps) {
  const fuelEfficiency = totalDistance > 0 ? (totalFuelRequired / totalDistance).toFixed(2) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Fuel size={20} />
          <h3 className="font-black uppercase tracking-widest text-sm text-gray-800 dark:text-white">Operational Fuel Plan</h3>
        </div>
        {stopsNeeded ? (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-800/50">
            <AlertTriangle size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Fuel Stop Required</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800/50">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Direct Flight Capable</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">Trip Fuel</p>
          <p className="text-lg font-black text-gray-800 dark:text-white">{tripFuel?.toLocaleString()} L</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">Contingency (5%)</p>
          <p className="text-lg font-black text-gray-800 dark:text-white">{contingencyFuel?.toLocaleString()} L</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">Alternate</p>
          <p className="text-lg font-black text-gray-800 dark:text-white">{alternateFuel?.toLocaleString()} L</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">Reserve (45m)</p>
          <p className="text-lg font-black text-gray-800 dark:text-white">{reserveFuel?.toLocaleString()} L</p>
        </div>
      </div>

      <div className="bg-indigo-600 dark:bg-indigo-900/50 p-6 rounded-3xl text-white shadow-lg shadow-indigo-100 dark:shadow-none relative overflow-hidden border border-indigo-500/20">
        <div className="relative z-10 flex justify-between items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Total Fuel Required</p>
            <h4 className="text-3xl font-black text-white">{totalFuelRequired?.toLocaleString()} L</h4>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Efficiency</p>
            <p className="text-xl font-black text-white">{fuelEfficiency} L/nm</p>
          </div>
        </div>
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 opacity-10">
          <Fuel size={160} />
        </div>
      </div>

      {stopsNeeded && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-3xl border border-amber-100 dark:border-amber-800/50"
        >
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 mb-4">
            <Info size={18} />
            <span className="text-xs font-black uppercase tracking-widest">Fuel Stop Strategy</span>
          </div>
          
          {suggestedStops && suggestedStops.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {suggestedStops.map((stop, idx) => (
                  <React.Fragment key={idx}>
                    <div className="flex flex-col items-center gap-2 min-w-[100px]">
                      <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-2xl border-2 border-amber-200 dark:border-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black text-xs shadow-sm">
                        {stop.length <= 4 ? stop : `S${idx + 1}`}
                      </div>
                      <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase truncate max-w-[120px]">
                        {stop}
                      </span>
                    </div>
                    {idx < suggestedStops.length - 1 && (
                      <div className="h-0.5 w-8 bg-amber-200 dark:bg-amber-800/50 mt-[-20px]" />
                    )}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-500/70 italic">
                * Intermediate fuel stops are required to maintain safety reserves for this {totalDistance?.toLocaleString()}nm mission.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 text-center">
              <AlertTriangle size={32} className="text-amber-400 mb-2 opacity-50" />
              <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Manual Stop Planning Required</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-500/70 mt-1">
                The aircraft range ({aircraftRange}nm) is insufficient for this distance. Please select intermediate airports manually.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
