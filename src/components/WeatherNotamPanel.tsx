import React, { useState } from 'react';
import { AlertTriangle, Cloud, Info, RefreshCw, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { getLiveWeather, getLiveNotams, MetarData, NotamData } from '../services/weatherService';

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

export default function WeatherNotamPanel({ notams: initialNotams, weather: initialWeather }: WeatherNotamPanelProps) {
  const [liveWeather, setLiveWeather] = useState<MetarData | null>(null);
  const [liveNotams, setLiveNotams] = useState<NotamData | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Filter states
  const [icaoFilter, setIcaoFilter] = useState(initialNotams[0]?.airport || initialWeather[0]?.location || '');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const fetchLiveData = async () => {
    if (!icaoFilter) return;

    setLoading(true);
    try {
      const [w, n] = await Promise.all([
        getLiveWeather(icaoFilter),
        getLiveNotams(icaoFilter, { 
          keyword: keywordFilter, 
          severity: severityFilter || undefined 
        })
      ]);
      setLiveWeather(w);
      setLiveNotams(n);
    } catch (error) {
      console.error('Failed to fetch live data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'High': return 'text-red-600 bg-red-50 border-red-100 dark:text-red-400 dark:bg-red-900/20 dark:border-red-900/50';
      case 'Medium': return 'text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-900/50';
      default: return 'text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-900/50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-widest">Safety & Weather Analysis</h2>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <input 
            type="text"
            placeholder="ICAO"
            value={icaoFilter}
            onChange={(e) => setIcaoFilter(e.target.value.toUpperCase())}
            className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold w-20 uppercase"
          />
          <input 
            type="text"
            placeholder="Keyword (e.g. closed)"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold w-32"
          />
          <select 
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-bold"
          >
            <option value="">All Severities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <button 
            onClick={fetchLiveData}
            disabled={loading || !icaoFilter}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Fetching...' : 'Fetch Live Data'}
          </button>
        </div>
      </div>

      {liveWeather && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30"
        >
          <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400">
            <Cloud size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Live Weather: {liveWeather.airport}</span>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest block mb-1">METAR</span>
              <code className="text-xs font-mono text-indigo-900 dark:text-indigo-200 block bg-white dark:bg-gray-900 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                {liveWeather.metar}
              </code>
            </div>
            {liveWeather.taf && liveWeather.taf !== "N/A" && (
              <div>
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest block mb-1">TAF</span>
                <code className="text-xs font-mono text-indigo-900 dark:text-indigo-200 block bg-white dark:bg-gray-900 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                  {liveWeather.taf}
                </code>
              </div>
            )}
          </div>
          <p className="text-[9px] text-indigo-400 mt-3 font-bold uppercase tracking-widest">Last Updated: {new Date(liveWeather.last_updated).toLocaleTimeString()}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* NOTAMs Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
            <Info size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-black uppercase tracking-widest text-sm">Active NOTAMs</h3>
          </div>
          
          <div className="space-y-2">
            {(liveNotams?.notams || initialNotams).length > 0 ? (
              (liveNotams?.notams || initialNotams).map((notam: any, idx: number) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`p-3 rounded-2xl border ${getSeverityColor(notam.severity)}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-black text-[10px] uppercase tracking-widest">{notam.airport || liveNotams?.airport}</span>
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
            {initialWeather.length > 0 ? (
              initialWeather.map((w, idx) => (
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
    </div>
  );
}
