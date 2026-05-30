import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wrench, AlertTriangle, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { getMroComplianceReport, MROComplianceReportResult } from '../services/mroAnalysisService';

interface MROComplianceReportProps {
  aircraftType: string;
  registration: string;
  currentMaintenanceStatus: string;
}

export default function MROComplianceReport({ aircraftType, registration, currentMaintenanceStatus }: MROComplianceReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MROComplianceReportResult | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const report = await getMroComplianceReport(aircraftType, registration || 'N/A', currentMaintenanceStatus);
        setData(report);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [aircraftType, registration, currentMaintenanceStatus]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center gap-4">
        <Loader2 size={32} className="text-indigo-600 animate-spin" />
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Generating AI MRO Compliance Report...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Wrench className="text-indigo-600" size={24} />
          <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">MRO Compliance Report</h3>
        </div>
        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
          data.overallComplianceStatus === 'Compliant' ? 'bg-emerald-500 text-white' :
          data.overallComplianceStatus === 'Warning' ? 'bg-amber-400 text-black' :
          'bg-rose-500 text-white'
        }`}>
          {data.overallComplianceStatus}
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 italic leading-snug">"{data.summary}"</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Upcoming Checks</h4>
          {data.upcomingChecks.map((check, i) => (
            <div key={i} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
              <span className="text-sm font-bold">{check.type}</span>
              <div className="flex items-center gap-4">
                 <span className="text-xs font-medium text-gray-500">{check.dueDate}</span>
                 <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${
                   check.status === 'Compliant' ? 'text-emerald-700 bg-emerald-50' : 
                   check.status === 'Due Soon' ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50'
                 }`}>{check.status}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Required Component Overhauls</h4>
          {data.requiredOverhauls.map((comp, i) => (
             <div key={i} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
              <span className="text-sm font-bold">{comp.component}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-gray-500">{comp.nextOverhaulHours} Hrs</span>
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${
                   comp.status === 'Good' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                }`}>{comp.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
