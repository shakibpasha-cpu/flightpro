import { Plane, Calendar, MapPin, DollarSign, ArrowRight, Sparkles, ExternalLink, RefreshCw, Search, Globe, Users, Briefcase, Package, Filter } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { getEmptyLegs, EmptyLegSearchParams } from '../services/aiService';

const TOP_RESOURCES = [
  { name: 'Victor', url: 'https://www.flyvictor.com/en-us/empty-legs/', desc: 'Global empty leg marketplace' },
  { name: 'VistaJet', url: 'https://www.vistajet.com/en/empty-legs/', desc: 'Premium global fleet' },
  { name: 'Jettly', url: 'https://jettly.com/empty_legs', desc: 'Subscription-based charter' },
  { name: 'LunaJets', url: 'https://www.lunajets.com/en/empty-legs', desc: 'European & global deals' },
  { name: 'Air Partner', url: 'https://www.airpartner.com/en/private-jets/empty-legs', desc: 'Trusted global broker' },
  { name: 'XO', url: 'https://flyxo.com/empty-legs/', desc: 'Shared & private charter' },
];

export default function EmptyLegs() {
  const [emptyLegs, setEmptyLegs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [minSeatsFilter, setMinSeatsFilter] = useState(0);
  const [cargoFilter, setCargoFilter] = useState('All');
  
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchParams, setSearchParams] = useState<EmptyLegSearchParams>({
    searchType: 'anywhere',
    radiusLocation: '',
    radiusDistance: 500,
    betweenStart: '',
    betweenEnd: '',
    specificDeparture: '',
    specificDestination: ''
  });

  const fetchLiveLegs = async () => {
    setLoading(true);
    setIsFallback(false);
    try {
      const result = await getEmptyLegs(searchParams);
      setEmptyLegs(result.data);
      setIsFallback(result.isFallback);
    } catch (error) {
      console.error("Failed to fetch empty legs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveLegs();
  }, []);

  const filteredLegs = emptyLegs.filter(leg => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      leg.departure?.toLowerCase().includes(term) ||
      leg.destination?.toLowerCase().includes(term) ||
      leg.aircraft?.toLowerCase().includes(term) ||
      leg.operator?.toLowerCase().includes(term);
      
    const matchesCategory = categoryFilter === 'All' || leg.category === categoryFilter || (categoryFilter === 'Executive' && leg.category?.toLowerCase().includes('jet'));
    const matchesSeats = categoryFilter === 'Cargo' ? true : (leg.seats || 0) >= minSeatsFilter;
    const matchesCargo = categoryFilter !== 'Cargo' || cargoFilter === 'All' || (leg.cargoType && leg.cargoType.toLowerCase() === cargoFilter.toLowerCase());

    return matchesSearch && matchesCategory && matchesSeats && matchesCargo;
  });

  const getCategoryIcon = (category: string) => {
    if (!category) return <Plane size={14} />;
    const cat = category.toLowerCase();
    if (cat.includes('cargo')) return <Package size={14} />;
    if (cat.includes('executive') || cat.includes('jet')) return <Briefcase size={14} />;
    return <Users size={14} />;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Live Empty Legs</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Real-time discounted charter flights</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={fetchLiveLegs}
            disabled={loading}
            className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Refresh Live Data</span>
          </button>
          <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 flex items-center gap-2">
            <Sparkles size={16} />
            <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">AI Web Search Active</span>
          </div>
        </div>
      </div>

      {isFallback && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-start gap-3">
          <div className="mt-0.5 text-amber-600 dark:text-amber-500">
            <Sparkles size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">API Rate Limit Exceeded</h4>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
              We are currently showing sample empty legs data because the AI search quota has been reached. Please try again later for live results.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input 
            type="text"
            placeholder="Search routes, aircraft, operators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white w-full"
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className={`p-2 rounded-2xl border transition-colors flex items-center gap-2 ${showAdvancedSearch ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'}`}
            title="Advanced Search"
          >
            <Filter size={16} />
          </button>
          <select 
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              if (e.target.value === 'Cargo') setMinSeatsFilter(0);
              else setCargoFilter('All');
            }}
            className="py-2 px-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500 flex-1 md:flex-none"
          >
            <option value="All">All Types</option>
            <option value="Executive">Executive / Jets</option>
            <option value="Passenger">Passenger / Airliner</option>
            <option value="Cargo">Cargo</option>
          </select>
          
          {categoryFilter === 'Cargo' ? (
            <select 
              value={cargoFilter}
              onChange={(e) => setCargoFilter(e.target.value)}
              className="py-2 px-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500 flex-1 md:flex-none"
            >
              <option value="All">Any Cargo Space</option>
              <option value="Full">Full Charter</option>
              <option value="Pallets">By Pallets</option>
              <option value="Kgs">By Kgs</option>
            </select>
          ) : (
            <select 
              value={minSeatsFilter}
              onChange={(e) => setMinSeatsFilter(Number(e.target.value))}
              className="py-2 px-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500 flex-1 md:flex-none"
            >
              <option value={0}>Any Capacity</option>
              <option value={4}>4+ Seats</option>
              <option value={8}>8+ Seats</option>
              <option value={14}>14+ Seats</option>
              <option value={50}>50+ Seats</option>
            </select>
          )}
        </div>
      </div>

      {showAdvancedSearch && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
        >
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-500" />
              AI Advanced Search
            </h3>
            
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="radio" name="searchType" checked={searchParams.searchType === 'anywhere'} onChange={() => setSearchParams({...searchParams, searchType: 'anywhere'})} className="text-indigo-600 focus:ring-indigo-500" />
                Anywhere
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="radio" name="searchType" checked={searchParams.searchType === 'radius'} onChange={() => setSearchParams({...searchParams, searchType: 'radius'})} className="text-indigo-600 focus:ring-indigo-500" />
                Radius
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="radio" name="searchType" checked={searchParams.searchType === 'between'} onChange={() => setSearchParams({...searchParams, searchType: 'between'})} className="text-indigo-600 focus:ring-indigo-500" />
                Between Areas
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="radio" name="searchType" checked={searchParams.searchType === 'specific'} onChange={() => setSearchParams({...searchParams, searchType: 'specific'})} className="text-indigo-600 focus:ring-indigo-500" />
                Specific Legs
              </label>
            </div>

            {searchParams.searchType === 'radius' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Center Location</label>
                  <input type="text" placeholder="e.g. LHR, London, Europe" value={searchParams.radiusLocation} onChange={e => setSearchParams({...searchParams, radiusLocation: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Radius (NM)</label>
                  <input type="number" placeholder="500" value={searchParams.radiusDistance} onChange={e => setSearchParams({...searchParams, radiusDistance: Number(e.target.value)})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                </div>
              </div>
            )}

            {searchParams.searchType === 'between' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Area 1</label>
                  <input type="text" placeholder="e.g. Europe" value={searchParams.betweenStart} onChange={e => setSearchParams({...searchParams, betweenStart: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Area 2</label>
                  <input type="text" placeholder="e.g. North America" value={searchParams.betweenEnd} onChange={e => setSearchParams({...searchParams, betweenEnd: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                </div>
              </div>
            )}

            {searchParams.searchType === 'specific' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Departure</label>
                  <input type="text" placeholder="e.g. DXB" value={searchParams.specificDeparture} onChange={e => setSearchParams({...searchParams, specificDeparture: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Destination</label>
                  <input type="text" placeholder="e.g. JFK" value={searchParams.specificDestination} onChange={e => setSearchParams({...searchParams, specificDestination: e.target.value})} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                </div>
              </div>
            )}

            <div className="flex justify-end mt-2">
              <button 
                onClick={fetchLiveLegs}
                disabled={loading}
                className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                Search with AI
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 animate-pulse h-64" />
          ))
        ) : filteredLegs.length > 0 ? (
          filteredLegs.map((leg, idx) => (
            <motion.div 
              key={leg.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => leg.link && window.open(leg.link, '_blank')}
              className={`bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all group flex flex-col justify-between ${leg.link ? 'cursor-pointer hover:shadow-md' : ''}`}
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Plane size={18} />
                    <span className="font-black text-sm uppercase tracking-widest">{leg.aircraft}</span>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                    -60% OFF
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div className="text-center w-1/3">
                    <p className="text-2xl font-black text-gray-800 dark:text-white truncate" title={leg.departure}>{leg.departure}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Origin</p>
                  </div>
                  <ArrowRight className="text-gray-200 dark:text-gray-600 group-hover:text-indigo-400 dark:group-hover:text-indigo-400 transition-colors" />
                  <div className="text-center w-1/3">
                    <p className="text-2xl font-black text-gray-800 dark:text-white truncate" title={leg.destination}>{leg.destination}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Destination</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 pt-4 border-t border-gray-50 dark:border-gray-700/50">
                  {leg.category && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                      {getCategoryIcon(leg.category)}
                      <span>{leg.category}</span>
                    </div>
                  )}
                  {leg.category === 'Cargo' && leg.cargoType ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                      <Package size={14} />
                      <span>{leg.cargoType === 'Full' ? 'Full Charter' : `${leg.cargoCapacity || ''} ${leg.cargoType}`}</span>
                    </div>
                  ) : leg.seats !== undefined && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                      <Users size={14} />
                      <span>{leg.seats === 0 ? 'Cargo' : `${leg.seats} Seats`}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Calendar size={14} />
                    <span className="text-xs font-bold">{leg.date}</span>
                  </div>
                  <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                    <DollarSign size={14} />
                    <span className="text-lg font-black">{leg.price ? leg.price.toLocaleString() : 'Enquire'}</span>
                  </div>
                </div>
                
                {leg.operator && (
                  <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700/50">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Operator:</span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{leg.operator}</span>
                    </div>
                    {leg.link && (
                      <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                        <span className="text-[10px] font-bold uppercase tracking-widest">View Deal</span>
                        <ExternalLink size={12} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
            <Plane size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-bold">No empty legs found matching your filters</p>
            <button onClick={() => { setSearchTerm(''); setCategoryFilter('All'); setMinSeatsFilter(0); setCargoFilter('All'); }} className="text-indigo-600 dark:text-indigo-400 text-sm font-bold mt-2 hover:underline">Clear all filters</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-indigo-600 dark:bg-indigo-900 p-8 rounded-[40px] text-white relative overflow-hidden">
          <div className="relative z-10 max-w-lg">
            <h3 className="text-2xl font-black mb-2">Want to be notified?</h3>
            <p className="text-sm opacity-80 leading-relaxed mb-6">
              Our AI engine monitors global empty leg databases and alerts you the moment a matching flight becomes available for your preferred routes.
            </p>
            <button className="bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors">
              Set Up AI Alerts
            </button>
          </div>
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 opacity-10">
            <Sparkles size={240} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Globe className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Top Resources</h3>
          </div>
          <div className="space-y-4">
            {TOP_RESOURCES.map((resource, idx) => (
              <a 
                key={idx}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{resource.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{resource.desc}</p>
                  </div>
                  <ExternalLink size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
