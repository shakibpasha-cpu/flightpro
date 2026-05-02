import React from 'react';
import { Users, Mail, Phone, Globe, DollarSign, Building2, CheckCircle2, Zap } from 'lucide-react';
import { motion } from 'motion/react';

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
  handlingAgents?: HandlingAgent[];
  departureHandlingAgents?: HandlingAgent[];
  selectedHandlingAgent?: HandlingAgent;
  selectedDepartureHandlingAgent?: HandlingAgent;
}

interface HandlingAgentsPanelProps {
  legs: Leg[];
  initialDeparture?: string;
  initialDepartureAgents?: HandlingAgent[];
  selectedInitialAgent?: HandlingAgent;
  onSelectAgent?: (legIdx: number | 'initial', agent: HandlingAgent, type: 'departure' | 'destination') => void;
  onRefreshAgents?: (legIdx: number, type: 'departure' | 'destination') => void;
  loading?: boolean;
}

export default function HandlingAgentsPanel({ 
  legs, 
  initialDeparture, 
  initialDepartureAgents, 
  selectedInitialAgent,
  onSelectAgent,
  onRefreshAgents,
  loading
}: HandlingAgentsPanelProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-8">
        {legs.map((leg, legIdx) => {
          const selectedAgent = leg.selectedHandlingAgent;
          const selectedDepAgent = leg.selectedDepartureHandlingAgent;
          
          return (
            <div key={legIdx} className="space-y-8">
              {/* Departure Handling */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                    <span className="text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">
                      {leg.departure}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Departure Handling</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRefreshAgents?.(legIdx, 'departure'); }}
                      disabled={loading}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-indigo-500"
                      title="Force refresh local handlers"
                    >
                      <Zap size={14} className={loading ? 'animate-pulse' : ''} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {leg.departureHandlingAgents && leg.departureHandlingAgents.length > 0 ? (
                    leg.departureHandlingAgents.map((agent, agentIdx) => {
                      const isSelected = selectedDepAgent?.companyName === agent.companyName;
                      
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: (legIdx * 0.1) + (agentIdx * 0.05) }}
                          key={agentIdx}
                          onClick={() => onSelectAgent?.(legIdx, agent, 'departure')}
                          className={`bg-white dark:bg-gray-800 border p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group cursor-pointer relative ${
                            isSelected 
                              ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                              : 'border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-500/30'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 bg-indigo-500 text-white p-1 rounded-full shadow-lg z-10">
                              <CheckCircle2 size={16} />
                            </div>
                          )}
                          
                          <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-colors">
                              <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-lg">
                                <DollarSign size={16} />
                                <span>{agent.baseFee?.toLocaleString()}</span>
                              </div>
                              <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Base Fee</p>
                            </div>
                          </div>

                          <h4 className="font-black text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-tight">
                            {agent.companyName}
                          </h4>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                              <Mail size={12} className="shrink-0" />
                              <span className="text-[10px] font-medium truncate">{agent.email}</span>
                            </div>
                            {agent.phone && (
                              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                <Phone size={12} className="shrink-0" />
                                <span className="text-[10px] font-medium">{agent.phone}</span>
                              </div>
                            )}
                            {agent.website && (
                              <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
                                <Globe size={12} className="shrink-0" />
                                <a 
                                  href={agent.website.startsWith('http') ? agent.website : `https://${agent.website}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] font-bold hover:underline truncate"
                                >
                                  {agent.website.replace(/^https?:\/\//, '')}
                                </a>
                              </div>
                            )}
                          </div>

                          {agent.additionalServices && (
                            <div className="pt-3 border-t border-gray-50 dark:border-gray-700">
                              <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Additional Services</p>
                              <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed italic">
                                "{agent.additionalServices}"
                              </p>
                            </div>
                          )}

                          <div className="mt-4 flex items-center gap-1.5 text-emerald-500">
                            <CheckCircle2 size={12} />
                            <span className="text-[8px] font-black uppercase tracking-widest">AI Recommended</span>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="col-span-full p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                      <Users className="mx-auto text-gray-300 dark:text-gray-600 mb-2" size={32} />
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        No handling agents found for {leg.departure}.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Destination Handling */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                    <span className="text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">
                      {leg.destination}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Destination Handling</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRefreshAgents?.(legIdx, 'destination'); }}
                      disabled={loading}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-indigo-500"
                      title="Force refresh local handlers"
                    >
                      <Zap size={14} className={loading ? 'animate-pulse' : ''} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {leg.handlingAgents && leg.handlingAgents.length > 0 ? (
                    leg.handlingAgents.map((agent, agentIdx) => {
                      const isSelected = selectedAgent?.companyName === agent.companyName;
                      
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (legIdx * 0.1) + (agentIdx * 0.05) }}
                        key={agentIdx}
                        onClick={() => onSelectAgent?.(legIdx, agent, 'destination')}
                        className={`bg-white dark:bg-gray-800 border p-5 rounded-3xl shadow-sm hover:shadow-md transition-all group cursor-pointer relative ${
                          isSelected 
                            ? 'border-amber-500 ring-2 ring-amber-500/20' 
                            : 'border-gray-100 dark:border-gray-700 hover:border-amber-200 dark:hover:border-amber-500/30'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 bg-amber-500 text-white p-1 rounded-full shadow-lg z-10">
                            <CheckCircle2 size={16} />
                          </div>
                        )}
                        
                        <div className="flex justify-between items-start mb-4">
                          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 transition-colors">
                            <Building2 size={18} className="text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-lg">
                              <DollarSign size={16} />
                              <span>{agent.baseFee?.toLocaleString()}</span>
                            </div>
                            <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Base Fee</p>
                          </div>
                        </div>

                        <h4 className="font-black text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-tight">
                          {agent.companyName}
                        </h4>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <Mail size={12} className="shrink-0" />
                            <span className="text-[10px] font-medium truncate">{agent.email}</span>
                          </div>
                          {agent.phone && (
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                              <Phone size={12} className="shrink-0" />
                              <span className="text-[10px] font-medium">{agent.phone}</span>
                            </div>
                          )}
                          {agent.website && (
                            <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
                              <Globe size={12} className="shrink-0" />
                              <a 
                                href={agent.website.startsWith('http') ? agent.website : `https://${agent.website}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] font-bold hover:underline truncate"
                              >
                                {agent.website.replace(/^https?:\/\//, '')}
                              </a>
                            </div>
                          )}
                        </div>

                        {agent.additionalServices && (
                          <div className="pt-3 border-t border-gray-50 dark:border-gray-700">
                            <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">Additional Services</p>
                            <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed italic">
                              "{agent.additionalServices}"
                            </p>
                          </div>
                        )}

                        <div className="mt-4 flex items-center gap-1.5 text-emerald-500">
                          <CheckCircle2 size={12} />
                          <span className="text-[8px] font-black uppercase tracking-widest">AI Recommended</span>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="col-span-full p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                    <Users className="mx-auto text-gray-300 dark:text-gray-600 mb-2" size={32} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      No handling agents found for {leg.destination}. Try re-planning or searching manually.
                    </p>
                  </div>
                )}
              </div>
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
