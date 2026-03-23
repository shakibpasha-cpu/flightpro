import React from 'react';
import { ShieldAlert, FileText, Clock, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Permit {
  country: string;
  type: 'Overflight' | 'Landing';
  leadTime: string;
  estimatedFee: number;
}

interface RestrictedArea {
  name: string;
  reason: string;
  severity: 'Low' | 'Medium' | 'High';
}

interface PermitSystemProps {
  permits: Permit[];
  restrictedAreas: RestrictedArea[];
}

export default function PermitSystem({ permits, restrictedAreas }: PermitSystemProps) {
  const severityColors = {
    Low: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800/50',
    Medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800/50',
    High: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800/50',
  };

  const severityIcons = {
    Low: <AlertTriangle size={14} className="text-blue-500" />,
    Medium: <AlertTriangle size={14} className="text-amber-500" />,
    High: <ShieldAlert size={14} className="text-red-500" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-4">
        <FileText size={20} />
        <h3 className="font-black uppercase tracking-widest text-sm text-gray-800 dark:text-white">Overflight & Permit System</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Permits Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Required Permits</h4>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
              {permits.length} Required
            </span>
          </div>
          
          <div className="space-y-2">
            {permits.length > 0 ? (
              permits.map((permit, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={idx}
                  className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-gray-800 dark:text-white">{permit.country}</p>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest">{permit.type} Permit</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        <DollarSign size={14} />
                        <span>{permit.estimatedFee}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Lead Time: {permit.leadTime}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400">
                      <CheckCircle2 size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Standard Procedure</span>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <CheckCircle2 className="mx-auto text-emerald-400 dark:text-emerald-500 mb-2" size={24} />
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">No special permits detected for this route.</p>
              </div>
            )}
          </div>
        </div>

        {/* Restricted Airspaces Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Restricted Airspaces</h4>
            <span className="text-[10px] bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
              {restrictedAreas.length} Alerts
            </span>
          </div>

          <div className="space-y-2">
            {restrictedAreas.length > 0 ? (
              restrictedAreas.map((area, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={idx}
                  className={`border p-4 rounded-2xl shadow-sm ${severityColors[area.severity]}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {severityIcons[area.severity]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold">{area.name}</p>
                        <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border border-current opacity-70">
                          {area.severity} Risk
                        </span>
                      </div>
                      <p className="text-xs opacity-80 leading-relaxed">{area.reason}</p>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <ShieldAlert className="mx-auto text-blue-400 dark:text-blue-500 mb-2" size={24} />
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">No restricted airspaces detected on this routing.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
