import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Search, 
  MapPin, 
  ShieldCheck, 
  Droplets, 
  Phone, 
  Mail, 
  Globe, 
  Star, 
  Plus, 
  X, 
  Filter, 
  CheckCircle2, 
  Sparkles,
  ChevronRight,
  ExternalLink,
  Loader2,
  Trash2,
  Zap
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/errorService';
import { getFuelProvidersForAirport } from '../services/aiService';

interface FuelProvider {
  id: string;
  name: string;
  airports: string[];
  fuelTypes: string[];
  services: string[];
  contactEmail?: string;
  phone?: string;
  website?: string;
  headquarters?: string;
  rating?: number;
  ai_verified?: boolean;
  providerType: string;
  last_updated?: string;
}

export default function FuelDatabase() {
  const [providers, setProviders] = useState<FuelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAirport, setSelectedAirport] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentAirport, setEnrichmentAirport] = useState('');
  const [enrichmentResults, setEnrichmentResults] = useState<any[]>([]);

  const handleAIEnrich = async () => {
    if (!enrichmentAirport || enrichmentAirport.length < 3) return;
    setIsEnriching(true);
    setEnrichmentResults([]);
    
    try {
        const data = await getFuelProvidersForAirport(enrichmentAirport);
        if (data && data.length > 0) {
            setEnrichmentResults(data);
        } else {
            alert(`No fuel providers found for ${enrichmentAirport}`);
        }
    } catch (error) {
        console.error("Enrichment failed", error);
        alert(error instanceof Error ? error.message : "Enrichment failed. Please try again.");
    } finally {
      setIsEnriching(false);
    }
  };

  const saveEnrichedProvider = async (provider: any) => {
    try {
      await addDoc(collection(db, 'fuel_providers'), {
        ...provider,
        last_updated: new Date().toISOString()
      });
      setEnrichmentResults(prev => prev.filter(p => p.name !== provider.name));
      fetchProviders();
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'fuel_providers');
    }
  };

  const [newProvider, setNewProvider] = useState<Partial<FuelProvider>>({
    name: '',
    airports: [],
    fuelTypes: ['Jet A-1'],
    services: [],
    rating: 5,
    ai_verified: false,
    providerType: 'Fuel Company'
  });

  const fuelTypes = [
    'Jet A-1',
    'Jet A',
    'Jet B',
    'Avgas 100LL',
    'Avgas 100/130',
    'SAF (Sustainable Aviation Fuel)',
    'TS-1'
  ];

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'fuel_providers'), orderBy('last_updated', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelProvider));
      setProviders(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'fuel_providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this fuel provider?')) return;
    try {
      await deleteDoc(doc(db, 'fuel_providers', id));
      setProviders(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'fuel_providers');
    }
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'fuel_providers'), {
        ...newProvider,
        last_updated: new Date().toISOString()
      });
      setShowAddModal(false);
      fetchProviders();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'fuel_providers');
    }
  };

  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.airports.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesAirport = !selectedAirport || p.airports.includes(selectedAirport.toUpperCase());
    const matchesFuelType = !selectedFuelType || p.fuelTypes.includes(selectedFuelType);
    return matchesSearch && matchesAirport && matchesFuelType;
  });

  return (
    <div className="space-y-8 p-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
            <Droplets className="text-indigo-600" size={36} />
            Fuel Service Network
          </h1>
          <p className="text-gray-500 font-medium mt-1">Manage global aviation fuel supply and FBO fueling services.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            <Plus size={18} />
            Add Provider
          </button>
        </div>
      </div>

      {/* AI Research Section */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group">
        <Sparkles className="absolute right-[-20px] top-[-20px] w-64 h-64 text-white/5 group-hover:rotate-12 transition-transform duration-1000" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-md">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-2 flex items-center gap-2">
              <Sparkles size={24} />
              AI Fuel Intelligence
            </h2>
            <p className="text-indigo-100 text-sm font-medium leading-relaxed">
              Research real-world fuel providers and FBOs for any international airport instantly using Google Search integration.
            </p>
          </div>
          <div className="flex-1 max-w-lg">
            <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl flex gap-2">
              <input 
                type="text"
                placeholder="Enter Airport ICAO (e.g., OMDB, KJFK)..."
                className="flex-1 bg-transparent border-none text-white placeholder:text-white/50 px-4 focus:ring-0 text-sm font-bold uppercase"
                value={enrichmentAirport}
                onChange={(e) => setEnrichmentAirport(e.target.value)}
              />
              <button 
                onClick={handleAIEnrich}
                disabled={isEnriching || !enrichmentAirport}
                className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-50 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isEnriching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {isEnriching ? 'Researching...' : 'Research'}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {enrichmentResults.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-8 pt-8 border-t border-white/10 overflow-hidden"
            >
              <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <ChevronRight size={14} />
                Research Results for {enrichmentAirport.toUpperCase()}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {enrichmentResults.map((result, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col justify-between group/card hover:bg-white/10 transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-black text-sm uppercase tracking-tight">{result.name}</p>
                        <div className="bg-white/20 px-2 py-0.5 rounded text-[8px] font-black uppercase">{result.providerType}</div>
                      </div>
                      <p className="text-[10px] text-indigo-200 mb-3">{result.headquarters || 'Location research complete'}</p>
                      <div className="flex flex-wrap gap-1 mb-4">
                        {result.fuelTypes?.map((f: string) => (
                          <span key={f} className="text-[8px] font-bold bg-white/10 px-1.5 py-0.5 rounded uppercase">{f}</span>
                        ))}
                      </div>
                    </div>
                    <button 
                      onClick={() => saveEnrichedProvider(result)}
                      className="w-full mt-4 py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={12} />
                      Import to Database
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Database Section Header */}
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
          <Droplets size={20} className="text-indigo-600" />
          Fuel Database
        </h2>
        {(searchTerm || selectedAirport || selectedFuelType) && (
          <button 
            onClick={() => {
              setSearchTerm('');
              setSelectedAirport('');
              setSelectedFuelType('');
            }}
            className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
          >
            <X size={12} />
            Clear Filters
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by provider name or airport..."
            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap mr-2">Top Hubs:</span>
           {['OMDB', 'KJFK', 'EGLL', 'WSSS', 'LFPG', 'VHHH', 'EDDF', 'OTHH'].map(icao => (
             <button
               key={icao}
               onClick={() => setSelectedAirport(selectedAirport === icao ? '' : icao)}
               className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                 selectedAirport === icao 
                   ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                   : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-100 dark:border-gray-700 hover:border-indigo-300'
               }`}
             >
               {icao}
             </button>
           ))}
        </div>

        <select 
          className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
          value={selectedAirport}
          onChange={(e) => setSelectedAirport(e.target.value)}
        >
          <option value="">All Airports</option>
          {Array.from(new Set(providers.flatMap(p => p.airports))).sort().map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select 
          className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
          value={selectedFuelType}
          onChange={(e) => setSelectedFuelType(e.target.value)}
        >
          <option value="">All Fuel Types</option>
          {fuelTypes.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin text-indigo-600" size={48} />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Loading Fuel Database...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredProviders.map((provider) => (
              <motion.div 
                key={provider.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-none transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleDelete(provider.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{provider.name}</h3>
                        {provider.ai_verified && (
                          <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-1.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800 flex items-center gap-1">
                            <ShieldCheck size={10} />
                            <span className="text-[8px] font-black uppercase tracking-tighter italic">AI Verified</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-1">
                        <MapPin size={12} className="text-gray-400" />
                        HQ: {provider.headquarters || 'Global Provider'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                       <div className="flex items-center gap-0.5">
                         {[...Array(5)].map((_, i) => (
                           <Star key={i} size={10} className={i < (provider.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                         ))}
                       </div>
                       <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{provider.providerType}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <MapPin size={10} /> Airspace Coverage
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {provider.airports.map(airport => (
                          <span key={airport} className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-2 py-0.5 rounded-md uppercase border border-indigo-100/50 dark:border-indigo-800/50">
                            {airport}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Droplets size={10} /> Fuel & Energy
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {provider.fuelTypes?.map(type => (
                          <span key={type} className="text-[10px] font-bold bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-md uppercase">
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Special Services
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {provider.services?.slice(0, 4).map(service => (
                          <span key={service} className="text-[10px] font-bold text-gray-400 border border-gray-100 dark:border-gray-700 px-2 py-0.5 rounded-md">
                            {service}
                          </span>
                        ))}
                        {provider.services?.length > 4 && (
                          <span className="text-[10px] font-bold text-gray-400 py-1">+{provider.services.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: Phone, label: 'Call', value: provider.phone },
                      { icon: Mail, label: 'Email', value: provider.contactEmail },
                      { icon: Globe, label: 'Web', value: provider.website }
                    ].map((action, i) => (
                      <button 
                        key={i}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
                          action.value 
                            ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-indigo-200 hover:bg-indigo-50/10' 
                            : 'bg-gray-50 dark:bg-gray-900/50 border-transparent opacity-50 cursor-not-allowed'
                        }`}
                        onClick={() => action.value && window.open(action.icon === Globe ? (action.value.startsWith('http') ? action.value : `https://${action.value}`) : `mailto:${action.value}`)}
                      >
                        <action.icon size={16} className={action.value ? 'text-indigo-600' : 'text-gray-400'} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{action.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-white/10 overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">New Fuel Provider</h2>
                  <p className="text-gray-500 text-sm font-medium">Add a fuel service provider to the global network.</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleAddProvider} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Company Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Email</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, contactEmail: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone</label>
                    <input 
                      type="tel" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Website</label>
                    <input 
                      type="url" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, website: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Headquarters</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, headquarters: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Airports (ICAO, comma separated)</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, airports: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fuel Types (comma separated)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, fuelTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Services (comma separated)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, services: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Provider Type</label>
                    <select 
                       className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                       onChange={(e) => setNewProvider({...newProvider, providerType: e.target.value})}
                    >
                      <option value="Fuel Company">Fuel Company</option>
                      <option value="FBO">FBO</option>
                      <option value="Airport Authority">Airport Authority</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        onChange={(e) => setNewProvider({...newProvider, ai_verified: e.target.checked})}
                      />
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">AI Verified</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-8 py-4 bg-gray-50 dark:bg-gray-900 text-gray-500 font-bold uppercase tracking-widest text-[10px] rounded-2xl hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    Create Fuel Record
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
