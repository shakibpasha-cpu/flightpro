import React from 'react';
import { DollarSign, ChevronDown, ChevronUp, Users, Mail, Phone, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CostBreakdown {
  fuel?: number;
  overflight?: number;
  navigation?: number;
  landing?: number;
  parking?: number;
  handling?: number;
  departureHandling?: number;
  terminalNavigation?: number;
  catering?: number;
  groundTransport?: number;
  deicing?: number;
  positioning?: number;
  repositioning?: number;
  crew?: number;
  acmiRate?: number;
  acmi?: number;
  acmiRatePerHour?: number;
  blockHours?: number;
  insuranceAdjustments?: number;
  insurance?: number;
  marketAdjustment?: number;
  riskAdjustment?: number;
  contingency?: number;
  brokerMargin?: number;
  airport?: number;
  total?: number;
}

interface HandlingAgent {
  companyName: string;
  email: string;
  phone: string;
  website: string;
  baseFee: number;
  additionalServices: string;
}

interface Leg {
  departure: string;
  destination: string;
  distance: number;
  flightTime: number;
  costs: CostBreakdown;
  handlingAgents?: HandlingAgent[];
  selectedHandlingAgent?: HandlingAgent;
  departureHandlingAgents?: HandlingAgent[];
  selectedDepartureHandlingAgent?: HandlingAgent;
}

interface CostingEngineProps {
  legs: Leg[];
  totalCosts: CostBreakdown;
  currency?: string;
  onLegCostChange?: (legIndex: number, updatedCosts: CostBreakdown) => void;
  onSelectAgent?: (legIdx: number | 'initial', agent: HandlingAgent, type: 'departure' | 'destination') => void;
}

export default function CostingEngine({ legs, totalCosts, currency = '$', onLegCostChange, onSelectAgent }: CostingEngineProps) {
  const [expandedLeg, setExpandedLeg] = React.useState<number | null>(null);

  const costItems = [
    { key: 'acmiRate', label: 'ACMI Cost' },
    { key: 'fuel', label: 'Fuel Cost' },
    { key: 'overflight', label: 'Overflight Charges' },
    { key: 'navigation', label: 'Navigation Fees' },
    { key: 'landing', label: 'Landing Fees' },
    { key: 'parking', label: 'Parking Fees' },
    { key: 'departureHandling', label: 'Departure Handling' },
    { key: 'handling', label: 'Destination Handling' },
    { key: 'crew', label: 'Crew Cost' },
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'marketAdjustment', label: 'Market Adjustment' },
    { key: 'riskAdjustment', label: 'Risk Adjustment' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'positioning', label: 'Positioning' },
    { key: 'repositioning', label: 'Repositioning' },
    { key: 'contingency', label: 'Contingency' },
    { key: 'brokerMargin', label: 'Broker Margin' },
  ];

  const handleCostChange = (legIndex: number, key: string, value: string) => {
    if (!onLegCostChange) return;
    
    const numValue = parseFloat(value) || 0;
    const leg = legs[legIndex];
    const updatedCosts = {
      ...leg.costs,
      [key]: numValue
    };
    
    // Recalculate total for this leg
    const newTotal = Object.keys(updatedCosts).reduce((acc, k) => {
      if (k === 'total') return acc;
      return acc + (Number((updatedCosts as any)[k]) || 0);
    }, 0);
    
    updatedCosts.total = newTotal;
    onLegCostChange(legIndex, updatedCosts);
  };

  const baseFlightCost = Number((totalCosts as any).acmi) || Number((totalCosts as any).acmiRate) || 0;
  const operationalAddons = (Number(totalCosts.fuel) || 0) + 
                             (Number(totalCosts.overflight) || 0) + 
                             (Number(totalCosts.navigation) || 0) + 
                             (Number(totalCosts.landing) || 0) + 
                             (Number(totalCosts.parking) || 0) + 
                             (Number(totalCosts.handling) || 0) + 
                             (Number(totalCosts.airport) || 0) +
                             (Number(totalCosts.departureHandling) || 0) + 
                             (Number(totalCosts.crew) || 0) +
                             (Number(totalCosts.positioning) || 0) +
                             (Number(totalCosts.repositioning) || 0);
  
  const riskAndMarket = (Number(totalCosts.marketAdjustment) || 0) +
                         (Number(totalCosts.riskAdjustment) || 0) +
                         (Number(totalCosts.insurance) || 0) + 
                         (Number(totalCosts.insuranceAdjustments) || 0) + 
                         (Number(totalCosts.contingency) || 0);
  
  const margin = Number(totalCosts.brokerMargin) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <DollarSign size={20} />
          <h3 className="font-black uppercase tracking-widest text-sm text-gray-800 dark:text-white">ACMI PRICING MODEL</h3>
        </div>
      </div>

      {/* Layered Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Flight Cost', value: baseFlightCost, color: 'indigo' },
          { label: 'Ops Add-ons', value: operationalAddons, color: 'blue' },
          { label: 'Risk & AI', value: riskAndMarket, color: 'orange' },
          { label: 'Broker Margin', value: margin, color: 'rose' }
        ].map((layer) => (
          <div key={layer.label} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">{layer.label}</p>
            <p className={`text-sm font-black text-${layer.color}-600 dark:text-${layer.color}-400`}>
              {currency}{layer.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-1">
        {costItems.map((item) => {
          const value = Number((totalCosts as any)[item.key]) || 0;
          if ((totalCosts as any)[item.key] === undefined) return null;
          
          return (
            <div key={item.key} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700/50 last:border-0">
              <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{item.label}:</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">
                {currency}{value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          );
        })}
        <div className="pt-6 mt-4 border-t-2 border-gray-200 dark:border-gray-700">
          <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4">TOTAL ESTIMATED COST:</p>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            👉 {currency}{(Number(totalCosts.total) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USD
          </p>
        </div>
      </div>

      {/* Leg Breakdown */}
      <div className="space-y-3">
        <h4 className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest px-1">Cost Breakdown Per Leg (Adjustable)</h4>
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
                  <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{currency}{(Number(leg.costs.total) || 0).toLocaleString()}</p>
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
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {costItems.map((item) => (
                      <div key={item.key} className="space-y-1">
                        <label className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest block">
                          {item.label}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{currency}</span>
                          <input
                            type="number"
                            value={(leg.costs as any)[item.key] || 0}
                            onChange={(e) => handleCostChange(idx, item.key, e.target.value)}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg py-1.5 pl-7 pr-3 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="md:col-span-2 lg:col-span-3 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-6">
                      {/* Departure Handling */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                            <Users size={12} />
                            Select Handling Agent at {leg.departure} (Departure)
                          </h5>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {leg.departureHandlingAgents && leg.departureHandlingAgents.length > 0 ? (
                            leg.departureHandlingAgents.map((agent, agentIdx) => {
                              const isSelected = leg.selectedDepartureHandlingAgent?.companyName === agent.companyName;
                              return (
                                <div 
                                  key={agentIdx}
                                  onClick={() => onSelectAgent?.(idx, agent, 'departure')}
                                  className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                                    isSelected 
                                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' 
                                      : 'border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-900/20 bg-white dark:bg-gray-900'
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="text-[10px] font-black text-gray-900 dark:text-white truncate pr-4">{agent.companyName}</p>
                                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">{currency}{agent.baseFee}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-[8px] text-gray-500 dark:text-gray-400">
                                      <Mail size={10} />
                                      <span className="truncate">{agent.email}</span>
                                    </div>
                                    {agent.phone && (
                                      <div className="flex items-center gap-1.5 text-[8px] text-gray-500 dark:text-gray-400">
                                        <Phone size={10} />
                                        <span>{agent.phone}</span>
                                      </div>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 text-indigo-500">
                                      <CheckCircle2 size={12} />
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="col-span-full py-4 text-center bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">No agents found for {leg.departure}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Destination Handling */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                            <Users size={12} />
                            Select Handling Agent at {leg.destination} (Destination)
                          </h5>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {leg.handlingAgents && leg.handlingAgents.length > 0 ? (
                            leg.handlingAgents.map((agent, agentIdx) => {
                              const isSelected = leg.selectedHandlingAgent?.companyName === agent.companyName;
                              return (
                                <div 
                                  key={agentIdx}
                                  onClick={() => onSelectAgent?.(idx, agent, 'destination')}
                                  className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                                    isSelected 
                                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/20' 
                                      : 'border-gray-100 dark:border-gray-700 hover:border-amber-200 dark:hover:border-amber-900/20 bg-white dark:bg-gray-900'
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="text-[10px] font-black text-gray-900 dark:text-white truncate pr-4">{agent.companyName}</p>
                                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">{currency}{agent.baseFee}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-[8px] text-gray-500 dark:text-gray-400">
                                      <Mail size={10} />
                                      <span className="truncate">{agent.email}</span>
                                    </div>
                                    {agent.phone && (
                                      <div className="flex items-center gap-1.5 text-[8px] text-gray-500 dark:text-gray-400">
                                        <Phone size={10} />
                                        <span>{agent.phone}</span>
                                      </div>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <div className="absolute top-1 right-1 text-amber-500">
                                      <CheckCircle2 size={12} />
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="col-span-full py-4 text-center bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">No agents found for {leg.destination}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 lg:col-span-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest">Leg Total</span>
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                        {currency}{(Number(leg.costs.total) || 0).toLocaleString()}
                      </span>
                    </div>
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
