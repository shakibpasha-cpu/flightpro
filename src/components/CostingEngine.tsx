import React from 'react';
import { DollarSign, Fuel, Globe, Landmark, ParkingCircle, UserCheck, Navigation, ChevronDown, ChevronUp, Coffee, Truck, Snowflake, PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CostBreakdown {
  fuel: number;
  overflight: number;
  navigation: number;
  landing: number;
  parking: number;
  handling: number;
  terminalNavigation: number;
  catering: number;
  groundTransport: number;
  deicing: number;
  positioning: number;
  repositioning: number;
  crew: number;
  total: number;
}

interface Leg {
  departure: string;
  destination: string;
  distance: number;
  flightTime: number;
  costs: CostBreakdown;
}

interface CostingEngineProps {
  legs: Leg[];
  totalCosts: CostBreakdown;
  currency?: string;
}

export default function CostingEngine({ legs, totalCosts, currency = '$' }: CostingEngineProps) {
  const [expandedLeg, setExpandedLeg] = React.useState<number | null>(null);

  const costItems = [
    { key: 'fuel', label: 'Fuel Cost', icon: Fuel, color: 'text-amber-600' },
    { key: 'overflight', label: 'Overflight Charges', icon: Globe, color: 'text-blue-600' },
    { key: 'navigation', label: 'Navigation Charges', icon: Navigation, color: 'text-indigo-600' },
    { key: 'landing', label: 'Landing Fees', icon: Landmark, color: 'text-emerald-600' },
    { key: 'parking', label: 'Parking Charges', icon: ParkingCircle, color: 'text-slate-600' },
    { key: 'handling', label: 'Handling Charges', icon: UserCheck, color: 'text-purple-600' },
    { key: 'terminalNavigation', label: 'Terminal Nav', icon: Navigation, color: 'text-cyan-600' },
    { key: 'catering', label: 'Catering', icon: Coffee, color: 'text-orange-600' },
    { key: 'groundTransport', label: 'Ground Transport', icon: Truck, color: 'text-blue-500' },
    { key: 'deicing', label: 'De-icing', icon: Snowflake, color: 'text-sky-400' },
    { key: 'positioning', label: 'Positioning', icon: PlaneTakeoff, color: 'text-orange-500' },
    { key: 'repositioning', label: 'Repositioning', icon: PlaneLanding, color: 'text-amber-500' },
    { key: 'crew', label: 'Crew Costs', icon: UserCheck, color: 'text-rose-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <DollarSign size={20} />
          <h3 className="font-black uppercase tracking-widest text-sm text-gray-800 dark:text-white">Flight Costing Engine</h3>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Total Trip Cost</p>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{currency}{totalCosts.total?.toLocaleString()}</p>
        </div>
      </div>

      {/* Total Breakdown Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {costItems.map((item) => (
          <div key={item.key} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <item.icon size={14} className={item.color} />
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{item.label}</p>
            </div>
            <p className="text-lg font-black text-gray-800 dark:text-white">
              {currency}{(totalCosts as any)[item.key]?.toLocaleString() || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Leg Breakdown */}
      <div className="space-y-3">
        <h4 className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest px-1">Cost Breakdown Per Leg</h4>
        {legs.map((leg, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
            <button
              onClick={() => setExpandedLeg(expandedLeg === idx ? null : idx)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                    <span>{leg.departure}</span>
                    <span className="text-gray-300 dark:text-gray-600">→</span>
                    <span>{leg.destination}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                    {leg.distance} nm | {leg.flightTime} hours
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{currency}{leg.costs.total?.toLocaleString()}</p>
                </div>
                {expandedLeg === idx ? <ChevronUp size={16} className="text-gray-500 dark:text-gray-400" /> : <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />}
              </div>
            </button>

            <AnimatePresence>
              {expandedLeg === idx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-gray-50 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30"
                >
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
                    {costItems.map((item) => (
                      <div key={item.key} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <item.icon size={12} className={item.color} />
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">{item.label}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {currency}{(leg.costs as any)[item.key]?.toLocaleString() || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
