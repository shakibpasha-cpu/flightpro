import { Plane, Clock, MapPin, Fuel, DollarSign, Globe, Zap, FileText, Printer, Send } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useMemo } from 'react';

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
  airportDetails?: Record<string, any>;
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
  cargoWeight,
  airportDetails
}: MissionSummaryProps) {
  const bestAlt = optimizedRoute?.alternatives?.[0];
  const calculatedTotalFuel = useMemo(() => totalFuel || legs?.reduce((acc, leg) => acc + (Math.round((leg.metrics?.distance || 0) * 4.5)), 0) || 0, [totalFuel, legs]);
  const missionId = useMemo(() => `MS-${Math.random().toString(36).substring(7).toUpperCase()}`, []);

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
              <p className="text-indigo-200 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-1">Flight Mission Briefing</p>
              <h2 className="text-2xl font-black">{departure} → {destination}</h2>
              <p className="text-indigo-100/60 text-[10px] font-medium tracking-wide mt-1">Generated Mission ID: {missionId}</p>
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
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Routing Distance</span>
            </div>
            <div className="space-y-1">
              <p className="text-xl font-black text-gray-800 dark:text-white">
                {(routingDistance || totalDistance)?.toLocaleString()}
                <span className="text-[8px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 ml-2">NM</span>
              </p>
              {gcDistance && gcDistance < (routingDistance || totalDistance) && (
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                  GC: {gcDistance?.toLocaleString()} nm (+{Math.round(((routingDistance || totalDistance) - gcDistance) / gcDistance * 100)}% buffer)
                </p>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Fuel size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total Fuel Burn</span>
            </div>
            <p className="text-xl font-black text-gray-800 dark:text-white">{calculatedTotalFuel?.toLocaleString()} <span className="text-xs font-normal text-gray-400 dark:text-gray-500">lbs</span></p>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-1">Avg 2,500 lbs/hr fuel flow</p>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Estimated Mission Cost</span>
            </div>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">${totalCost?.toLocaleString()}</p>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-1">Includes all fees & taxes</p>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Mission Status</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Ready for Dispatch</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cost Breakdown */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">
          <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Estimated Cost Breakdown</h4>
          <div className="space-y-3">
            {[
              { label: 'Base Aircraft Charters', value: totalCost * 0.75, icon: Plane },
              { label: 'Ground Handling & FBO', value: totalCost * 0.12, icon: MapPin },
              { label: 'En-Route FIR / Navigation', value: totalCost * 0.08, icon: Globe },
              { label: 'Fuel Surcharges', value: totalCost * 0.05, icon: Fuel }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <item.icon size={12} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-dashed border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Total Mission Value</span>
              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">${totalCost.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Route Details */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700">
          <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Route Leg Analysis</h4>
          <div className="space-y-4">
            {legs?.map((leg, i) => (
              <div key={i} className="relative pl-6 pb-4 last:pb-0 border-l border-gray-100 dark:border-gray-700">
                <div className="absolute left-[-5px] top-1 w-[10px] h-[10px] rounded-full bg-indigo-600 dark:bg-indigo-400" />
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-black text-gray-900 dark:text-white">
                      {leg.departure} {airportDetails?.[leg.departure]?.timezone ? `(${airportDetails[leg.departure].timezone})` : ''} → {leg.destination} {airportDetails?.[leg.destination]?.timezone ? `(${airportDetails[leg.destination].timezone})` : ''}
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">Distance: {Math.round(leg.metrics?.distance || 0)} NM | Time: {leg.metrics?.flightTime.toFixed(1)} hrs</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Est. ${Math.round(leg.metrics?.estimatedCost || 0).toLocaleString()}</p>
                    <p className="text-[10px] font-medium text-gray-400">Fuel: {Math.round((leg.metrics?.distance || 0) * 4.5).toLocaleString()} lbs</p>
                  </div>
                </div>
                {leg.handlingAgent && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <div className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-md inline-block font-medium">
                      Handling: {leg.handlingAgent.companyName || leg.handlingAgent}
                    </div>
                    {airportDetails?.[leg.to] && (
                      <>
                        <div className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md inline-block font-medium">
                          Fuel: {airportDetails[leg.to].fuelTypes?.slice(0, 2).join(', ') || 'Available'}
                        </div>
                        {airportDetails[leg.to].customsAvailable && (
                          <div className="text-[10px] bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-md inline-block font-medium">
                            AOE / Customs
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {missionSummary && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800/50">
          <h4 className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Zap size={14} />
            AI Mission Executive Briefing
          </h4>
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
