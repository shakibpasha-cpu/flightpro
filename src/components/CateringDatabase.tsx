import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Search, 
  MapPin, 
  ShieldCheck, 
  Utensils, 
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
  Trash2
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/errorService';
import { getCateringProvidersForAirport } from '../services/aiService';

interface CateringProvider {
  id: string;
  name: string;
  airports: string[];
  capabilities: string[];
  certifications: string[];
  aircraftTypes: string[];
  contactEmail?: string;
  phone?: string;
  website?: string;
  headquarters?: string;
  rating?: number;
  ai_verified?: boolean;
  cateringFee?: number;
  last_updated?: string;
}

export default function CateringDatabase() {
  const [providers, setProviders] = useState<CateringProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAirport, setSelectedAirport] = useState('');
  const [selectedCapability, setSelectedCapability] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentAirport, setEnrichmentAirport] = useState('');
  const [enrichmentResults, setEnrichmentResults] = useState<any[]>([]);

  const handleAIEnrich = async () => {
    if (!enrichmentAirport || enrichmentAirport.length < 3) return;
    setIsEnriching(true);
    setEnrichmentResults([]);
    
    try {
        const data = await getCateringProvidersForAirport(enrichmentAirport);
        if (data && data.length > 0) {
            setEnrichmentResults(data);
        } else {
            alert(`No catering providers found for ${enrichmentAirport}`);
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
      await addDoc(collection(db, 'catering_providers'), {
        ...provider,
        last_updated: new Date().toISOString()
      });
      setEnrichmentResults(prev => prev.filter(p => p.name !== provider.name));
      fetchProviders();
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'catering_providers');
    }
  };

  const [newProvider, setNewProvider] = useState<Partial<CateringProvider>>({
    name: '',
    airports: [],
    capabilities: [],
    certifications: [],
    aircraftTypes: [],
    rating: 5,
    ai_verified: false,
    cateringFee: 0
  });

  const capabilities = [
    'Economy Catering',
    'Business Class Catering',
    'First Class Catering',
    'VIP/Private Catering',
    'Halal Meals',
    'Kosher Meals',
    'Special Dietary Meals',
    'In-Flight Retail',
    'Hot Meal Prep',
    'Cold Meal Prep'
  ];

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'catering_providers'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CateringProvider[];
      setProviders(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'catering_providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setShowAddModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvider.name || !newProvider.airports?.length) return;

    try {
      await addDoc(collection(db, 'catering_providers'), {
        ...newProvider,
        last_updated: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewProvider({
        name: '',
        airports: [],
        capabilities: [],
        certifications: [],
        aircraftTypes: [],
        rating: 5,
        ai_verified: false
      });
      fetchProviders();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'catering_providers');
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!window.confirm('Delete this Catering provider?')) return;
    try {
      await deleteDoc(doc(db, 'catering_providers', id));
      fetchProviders();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'catering_providers');
    }
  };

  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.airports.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesAirport = !selectedAirport || p.airports.includes(selectedAirport.toUpperCase());
    const matchesCapability = !selectedCapability || p.capabilities.includes(selectedCapability);
    return matchesSearch && matchesAirport && matchesCapability;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
            <Utensils className="text-indigo-600" size={32} />
            Catering Intelligence
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">
            Global in-flight catering providers for international aviation operations.
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-none relative group"
        >
          <Plus size={18} />
          Add Provider
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[8px] py-1 px-2 rounded-lg whitespace-nowrap pointer-events-none">
            Shortcut: Alt + A
          </span>
        </button>
      </div>

      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group">
        <Sparkles className="absolute right-[-20px] top-[-20px] w-64 h-64 text-white/5 group-hover:rotate-12 transition-transform duration-1000" />
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-xl">
                <Sparkles size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight">AI Catering Intelligence</h2>
          </div>
          <p className="text-indigo-50/80 mb-6 font-medium">
            Search for local Catering providers at any international airport. 
          </p>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Enter ICAO Airport Code (e.g. OMDB)..." 
              value={enrichmentAirport}
              onChange={(e) => setEnrichmentAirport(e.target.value.toUpperCase())}
              className="px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-sm placeholder:text-white/50 focus:ring-2 focus:ring-white/20 outline-none w-full max-w-xs"
            />
            <button 
              onClick={handleAIEnrich}
              className="bg-white text-indigo-800 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all hover:bg-indigo-50"
            >
              {isEnriching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
              {isEnriching ? 'Searching...' : 'Enrich & Search'}
            </button>
          </div>
          
          {enrichmentResults.length > 0 && (
            <div className="mt-6 bg-white/10 border border-white/10 rounded-2xl p-4">
              <h4 className="text-sm font-bold uppercase tracking-widest mb-3">AI Suggestions:</h4>
              {enrichmentResults.map((result, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10">
                  <span className="font-bold text-sm">{result.name}</span>
                  <button 
                    onClick={() => saveEnrichedProvider(result)}
                    className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1 hover:bg-emerald-600"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Global Providers', value: providers.length, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Maintained Airports', value: [...new Set(providers.flatMap(p => p.airports))].length, icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
         ].map((stat, i) => (
          <div key={i} className={`${stat.bg} p-6 rounded-3xl border border-gray-100 dark:border-gray-800`}>
            <div className={`p-3 rounded-xl bg-white dark:bg-gray-800 w-fit shadow-sm mb-4 ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Database Section Header */}
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
          <Utensils size={20} className="text-indigo-600" />
          Catering Database
        </h2>
        {(searchTerm || selectedAirport || selectedCapability) && (
          <button 
            onClick={() => {
              setSearchTerm('');
              setSelectedAirport('');
              setSelectedCapability('');
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
            placeholder="Search providers or airports..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={selectedAirport}
            onChange={(e) => setSelectedAirport(e.target.value)}
            className="bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl text-xs font-bold px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Airports</option>
            {[...new Set(providers.flatMap(p => p.airports))].sort().map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select 
            value={selectedCapability}
            onChange={(e) => setSelectedCapability(e.target.value)}
            className="bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl text-xs font-bold px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Capabilities</option>
            {capabilities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Accessing Catering Intelligence...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
          <AnimatePresence>
            {filteredProviders.map((provider) => (
              <motion.div 
                key={provider.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-800/50">
                        <Utensils size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{provider.name}</h3>
                        </div>
                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-1">
                          <MapPin size={12} className="text-gray-400" />
                          {provider.headquarters || 'Location not specified'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            size={12} 
                            className={i < (provider.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 dark:text-gray-700'} 
                          />
                        ))}
                      </div>
                      <button 
                        onClick={() => handleDeleteProvider(provider.id)}
                        className="p-2 text-gray-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Catering Fee</p>
                      <p className="font-bold text-sm text-gray-900 dark:text-white">$ {provider.cateringFee || 0}</p>
                    </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Serving Airports</p>
                      <div className="flex flex-wrap gap-2">
                        {provider.airports.map(icao => (
                          <span key={icao} className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-lg text-[10px] font-black border border-emerald-100 dark:border-emerald-800">
                            {icao}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Key Capabilities</p>
                      <div className="flex flex-wrap gap-2">
                        {provider.capabilities.slice(0, 4).map(cap => (
                          <span key={cap} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-lg text-[10px] font-black border border-indigo-100 dark:border-indigo-800">
                            {cap}
                          </span>
                        ))}
                        {provider.capabilities.length > 4 && (
                          <span className="text-[10px] font-bold text-gray-400 py-1">+{provider.capabilities.length - 4} more</span>
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
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">New Catering Provider</h2>
                  <p className="text-gray-500 text-sm font-medium">Add a catering service provider to the global network.</p>
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
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Capabilities (comma separated)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, capabilities: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Certifications (comma separated)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, certifications: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Aircraft Types (comma separated)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, aircraftTypes: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Catering Fee</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, cateringFee: parseFloat(e.target.value)})}
                    />
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
                    Create Catering Record
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
