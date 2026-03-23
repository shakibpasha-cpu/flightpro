import { AlertTriangle, Cloud, Info, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface Notam {
  id: string;
  airport: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High';
}

interface Weather {
  location: string;
  condition: string;
  impact: string;
  severity: 'Low' | 'Medium' | 'High';
}

interface WeatherNotamPanelProps {
  notams: Notam[];
  weather: Weather[];
}

export default function WeatherNotamPanel({ notams, weather }: WeatherNotamPanelProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'High': return 'text-red-600 bg-red-50 border-red-100 dark:text-red-400 dark:bg-red-900/20 dark:border-red-900/50';
      case 'Medium': return 'text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-900/50';
      default: return 'text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-900/50';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* NOTAMs Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <Info size={18} className="text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-black uppercase tracking-widest text-sm">Active NOTAMs</h3>
        </div>
        
        <div className="space-y-2">
          {notams.length > 0 ? (
            notams.map((notam, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-3 rounded-2xl border ${getSeverityColor(notam.severity)}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-black text-[10px] uppercase tracking-widest">{notam.airport}</span>
                  <span className="text-[9px] font-bold opacity-70">{notam.id}</span>
                </div>
                <p className="text-xs leading-relaxed">{notam.description}</p>
              </motion.div>
            ))
          ) : (
            <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
              <ShieldAlert size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">No Critical NOTAMs</p>
            </div>
          )}
        </div>
      </div>

      {/* Weather Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <Cloud size={18} className="text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-black uppercase tracking-widest text-sm">Real-time Weather</h3>
        </div>

        <div className="space-y-2">
          {weather.length > 0 ? (
            weather.map((w, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-3 rounded-2xl border ${getSeverityColor(w.severity)}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-black text-[10px] uppercase tracking-widest">{w.location}</span>
                  <div className="flex items-center gap-1">
                    <AlertTriangle size={10} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">{w.severity} Impact</span>
                  </div>
                </div>
                <p className="text-xs font-bold mb-1">{w.condition}</p>
                <p className="text-[10px] opacity-80 italic leading-tight">{w.impact}</p>
              </motion.div>
            ))
          ) : (
            <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
              <Cloud size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Weather Clear</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
