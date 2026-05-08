import React, { useState } from 'react';
import { Search, MapPin, Globe, Loader2, Plane, X, Info, ExternalLink, Clock, Navigation, Cloud, ShieldAlert, Fuel, Map as MapIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAirportDetails } from '../services/aiService';

export default function IcaoSearchTool() {
  const [icao, setIcao] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleSearch = async (e?: React.FormEvent, forceRefetch: boolean = false) => {
    e?.preventDefault();
    if (!icao || icao.length < 3) return;
    
    setLoading(true);
    if (forceRefetch) {
      // Keep result visible but show loading if refreshing
    } else {
      setResult(null);
      setShowDetails(false);
    }

    try {
      // Use existing getAirportDetails which fetches via AI / Cache
      const details = await getAirportDetails(icao, forceRefetch);
      setResult(details);
    } catch (error) {
      setResult({ error: 'Airport not found or AI lookup failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Plane size={20} />
        </div>
        <h2 className="font-bold text-gray-800 dark:text-white">Quick ICAO Search</h2>
      </div>
      
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={icao}
          onChange={(e) => setIcao(e.target.value.toUpperCase())}
          placeholder="Enter ICAO (e.g. EGLL, KJFK)"
          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent dark:border-transparent rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all dark:text-white"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
        </button>
      </form>

      {result && !result.error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowDetails(true)}
          className="mt-4 p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 space-y-3 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-all group"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-black text-indigo-900 dark:text-indigo-400 text-lg tracking-tight flex items-center gap-2">
              {result.name || 'Unknown Airport'}
              <Info size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </h3>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-white dark:bg-indigo-950 px-2 py-1 rounded-lg">
              {result.icao}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Globe size={14} className="shrink-0 opacity-60" />
              <span className="text-xs font-bold leading-none">
                {result.city && result.city !== 'Unknown' ? result.city : 'Location'} 
                {result.country && result.country !== 'Unknown' ? `, ${result.country}` : ' Not Found'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <ExternalLink size={14} className="shrink-0 opacity-60" />
              <span className="text-xs font-bold leading-none">Runway: {result.runwayLength?.toLocaleString() || '---'} ft</span>
            </div>
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Navigation size={14} className="shrink-0 opacity-60" />
              <span className="text-xs font-bold leading-none">Elevation: {result.elevation || '---'} ft</span>
            </div>
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Fuel size={14} className="shrink-0 opacity-60" />
              <span className="text-xs font-bold leading-none">Fuel: {result.fuelTypes?.length > 0 ? result.fuelTypes.join(', ') : 'Check Intel'}</span>
            </div>
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Clock size={14} className="shrink-0 opacity-60" />
              <span className="text-xs font-bold leading-none">{result.timezone}</span>
            </div>
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <ShieldAlert size={14} className="shrink-0 opacity-60" />
              <span className="text-xs font-bold leading-none">AOE: {result.isAirportOfEntry ? 'Yes' : 'No'} | FBO: {result.handlingAvailable ? 'Yes' : 'No'}</span>
            </div>
          </div>
          <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest text-center pt-2 opacity-60 group-hover:opacity-100 transition-opacity italic">
            {(!result.city || !result.country) ? 'Data incomplete. Click to enrich with AI Intel' : 'Click to view technical specs & live weather'}
          </p>
        </motion.div>
      )}

      {result && result.error && (
        <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-800/50">
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{result.error}</p>
        </div>
      )}

      {/* Detailed Intel Modal */}
      <AnimatePresence>
        {showDetails && result && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetails(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-900 w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
            >
              <div className="h-48 bg-indigo-600 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent scale-150" />
                </div>
                <button 
                  onClick={() => setShowDetails(false)}
                  className="absolute top-6 right-6 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all z-10"
                >
                  <X size={20} />
                </button>
                <div className="absolute bottom-8 left-8">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-white/20">
                      {result.icao} / {result.iata || '---'}
                    </span>
                    <span className="px-3 py-1 bg-indigo-500 rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-lg">
                      Enriched Data
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{result.name}</h2>
                  <p className="text-white/70 text-sm font-bold flex items-center gap-2 mt-1">
                    <Globe size={14} /> 
                    {result.city && result.city !== 'Unknown' ? result.city : '---'}, 
                    {result.country && result.country !== 'Unknown' ? result.country : '---'}
                  </p>
                </div>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Column 1: Technical & Weather */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Technical Overview</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-3">
                            <MapIcon size={16} className="text-indigo-500" />
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Coordinates</span>
                          </div>
                          <span className="text-[10px] font-black text-gray-900 dark:text-white">{result.lat?.toFixed(4)}, {result.lng?.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-3">
                            <Navigation size={16} className="text-indigo-500" />
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Elevation</span>
                          </div>
                          <span className="text-sm font-black text-gray-900 dark:text-white">{result.elevation} ft</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-3">
                            <ExternalLink size={16} className="text-indigo-500" />
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Runway Length</span>
                          </div>
                          <span className="text-sm font-black text-gray-900 dark:text-white">{result.runwayLength?.toLocaleString() || '---'} ft</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-3">
                            <Clock size={16} className="text-indigo-500" />
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Timezone</span>
                          </div>
                          <span className="text-sm font-black text-gray-900 dark:text-white">{result.timezone}</span>
                        </div>
                      </div>
                    </div>

                    {(result.metar || result.taf) && (
                      <div>
                        <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Cloud size={14} className="text-indigo-400" /> Live Weather (METAR/TAF)
                        </h4>
                        <div className="space-y-2">
                          {result.metar && (
                            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/30">
                              <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" /> METAR
                              </p>
                              <pre className="text-[10px] font-mono text-indigo-900 dark:text-indigo-300 leading-relaxed break-words whitespace-pre-wrap">{result.metar}</pre>
                            </div>
                          )}
                          {result.taf && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" /> TAF
                              </p>
                              <pre className="text-[10px] font-mono text-gray-700 dark:text-gray-400 leading-relaxed break-words whitespace-pre-wrap">{result.taf}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {result.notams && result.notams.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <ShieldAlert size={14} className="text-rose-400" /> Active NOTAMs ({result.notams.length})
                        </h4>
                        <div className="space-y-2">
                          {result.notams.map((notam: string, nIdx: number) => (
                            <div key={nIdx} className="p-3 bg-rose-50/30 dark:bg-rose-900/10 rounded-2xl border border-rose-100/30 dark:border-rose-900/20">
                              <p className="text-[9px] font-medium text-rose-900 dark:text-rose-300 leading-relaxed">{notam}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Column 2: Operations & Fuel */}
                  <div className="space-y-6">
                    {result.fuelPrices && result.fuelPrices.length > 0 && (
                      <div className="p-5 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-100 dark:border-amber-800/50">
                        <h4 className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Fuel size={14} /> Fuel Market Rates
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {result.fuelPrices.map((fp: any, fIdx: number) => (
                            <div key={fIdx} className="bg-white dark:bg-amber-950 p-3 rounded-2xl border border-amber-100 dark:border-amber-800/50 shadow-sm">
                              <p className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{fp.grade}</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-black text-amber-600 dark:text-amber-400">{fp.price}</span>
                                <span className="text-[8px] font-bold text-gray-400 uppercase">/{fp.unit || 'USG'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[7px] text-amber-600/50 font-bold uppercase tracking-widest mt-3 text-center">Prices verified via AI Intel Scraper</p>
                      </div>
                    )}

                    <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border border-emerald-100 dark:border-emerald-800/50">
                      <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-3">Operations & AOE</h4>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] font-black text-emerald-700/50 dark:text-emerald-400/50 uppercase tracking-widest mb-1">Status</p>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${result.isAirportOfEntry ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                            <span className="text-xs font-black text-emerald-900 dark:text-emerald-300">
                              {result.isAirportOfEntry ? 'Airport of Entry (AOE)' : 'Non-AOE Airport'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-emerald-700/50 dark:text-emerald-400/50 uppercase tracking-widest mb-1">Customs Info</p>
                          <p className="text-xs font-bold text-emerald-800/70 dark:text-emerald-300/60 leading-relaxed italic">
                            {result.customsInfo || "Contact authorities for details."}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Frequencies</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {result.atisFrequency && (
                          <div className="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">ATIS</p>
                            <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{result.atisFrequency}</p>
                          </div>
                        )}
                        {result.towerFrequency && (
                          <div className="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Tower</p>
                            <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{result.towerFrequency}</p>
                          </div>
                        )}
                        {result.groundFrequency && (
                          <div className="p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Ground</p>
                            <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{result.groundFrequency}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800/50">
                      <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Ground Handling</h4>
                      <p className="text-xs font-bold text-blue-800/70 dark:text-blue-300/60 leading-relaxed">
                        {result.handlingDescription || "Standard FBO services usually available."}
                      </p>
                      {result.fuelTypes && result.fuelTypes.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {result.fuelTypes.map((fuel: string) => (
                            <span key={fuel} className="px-2 py-0.5 bg-white dark:bg-blue-900/40 rounded text-[9px] font-black text-blue-600 dark:text-blue-300 uppercase tracking-widest border border-blue-100 dark:border-blue-800">
                              {fuel}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end items-center gap-3">
                <div className="mr-auto">
                  <button 
                    onClick={() => handleSearch(undefined, true)}
                    disabled={loading}
                    className="flex items-center gap-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />}
                    Refresh Intel
                  </button>
                </div>
                <button 
                  onClick={() => setShowDetails(false)}
                  className="px-6 py-2 text-sm font-black text-gray-500 uppercase tracking-widest hover:text-gray-700 transition"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    // Logic to jump to flight planner with this airport could go here
                  }}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  Apply to Flight Plan <Navigation size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
