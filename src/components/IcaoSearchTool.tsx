import React, { useState } from 'react';
import { Search, MapPin, Globe, Loader2, Plane } from 'lucide-react';
import { getAirportDetails } from '../services/aiService';

export default function IcaoSearchTool() {
  const [icao, setIcao] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!icao || icao.length < 3) return;
    
    setLoading(true);
    setResult(null);
    try {
      // Use existing getAirportDetails which fetches via AI / Cache
      const details = await getAirportDetails(icao);
      if (details) {
        setResult(details);
      } else {
        setResult({ error: 'Airport not found or could not be loaded.' });
      }
    } catch (e) {
      setResult({ error: 'An error occurred during search.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-6">
        <Plane className="text-indigo-600 dark:text-indigo-400" size={20} />
        <h2 className="font-bold text-gray-800 dark:text-white">Quick ICAO Search</h2>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text"
            value={icao}
            onChange={(e) => setIcao(e.target.value.toUpperCase())}
            placeholder="Enter ICAO (e.g. EGLL)"
            maxLength={4}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all uppercase"
          />
        </div>
        <button 
          type="submit"
          disabled={loading || icao.length < 3}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
        </button>
      </form>

      {result && !result.error && (
        <div className="mt-4 p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 space-y-3">
          <h3 className="font-black text-indigo-900 dark:text-indigo-400 text-lg tracking-tight">
            {result.name || 'Unknown Airport'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Globe size={16} className="shrink-0" />
              <span className="text-sm font-medium">{result.country || 'Unknown Country'}</span>
            </div>
            {(result.lat !== undefined && result.lng !== undefined) && (
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <MapPin size={16} className="shrink-0" />
                <span className="text-sm font-mono tracking-widest bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded">
                  {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {result && result.error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50">
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{result.error}</p>
        </div>
      )}
    </div>
  );
}
