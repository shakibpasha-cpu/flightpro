import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Search, 
  MapPin, 
  ShieldCheck, 
  Wrench, 
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
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/errorService';
import { getMROProvidersForAirport, standardizeMROCapabilities, getMROCertifications } from '../services/aiService';

interface MROProvider {
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
  last_updated?: string;
  manual_review_needed?: boolean;
  unmapped_capabilities?: string[];
}

export default function MRODatabase() {
  const [providers, setProviders] = useState<MROProvider[]>([]);
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
        const data = await getMROProvidersForAirport(enrichmentAirport);
        if (data && data.length > 0) {
            setEnrichmentResults(data); 
        } else {
            alert(`No MRO providers found for ${enrichmentAirport}`);
        }
    } catch (error) {
      console.error('Enrichment failed:', error);
      alert(error instanceof Error ? error.message : "Enrichment failed. Please try again.");
    } finally {
      setIsEnriching(false);
    }
  };

  const saveEnrichedProvider = async (provider: any) => {
    try {
      await addDoc(collection(db, 'mro_providers'), {
        ...provider,
        last_updated: new Date().toISOString()
      });
      setEnrichmentResults(prev => prev.filter(p => p.name !== provider.name));
      fetchProviders();
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'mro_providers');
    }
  };

  const [newProvider, setNewProvider] = useState<Partial<MROProvider>>({
    name: '',
    airports: [],
    capabilities: [],
    certifications: [],
    aircraftTypes: [],
    rating: 5,
    ai_verified: false
  });

  const capabilities = [
    'Line Maintenance',
    'Base Maintenance',
    'A-Check',
    'B-Check',
    'C-Check',
    'D-Check',
    'Engine Overhaul',
    'Avionics',
    'Interior Refurbishment',
    'Component Repair',
    'Engineering Services',
    'Non-Destructive Testing (NDT)',
    'Composite Repair',
    'Painting/Liveries',
    'Structural Repair'
  ];

  const [isStandardizing, setIsStandardizing] = useState(false);
  const [isEnrichingCertifications, setIsEnrichingCertifications] = useState(false);

  const handleEnrichCertificationsFullDatabase = async () => {
    if (!window.confirm('This will use AI to research and update certifications for ALL providers in your database. Continue?')) return;
    
    setIsEnrichingCertifications(true);
    let successCount = 0;

    try {
      for (const provider of providers) {
        const result = await getMROCertifications(provider.name, provider.headquarters);
        
        // Combine mapped and others, ensuring uniqueness
        const allCertifications = [...new Set([...result.mapped, ...result.others])];
        
        if (allCertifications.length > 0) {
          await updateDoc(doc(db, 'mro_providers', provider.id), {
            certifications: allCertifications,
            last_updated: new Date().toISOString()
          });
          successCount++;
        }
      }
      
      alert(`Certification enrichment complete!\n- Updated: ${successCount} providers`);
      fetchProviders();
    } catch (error) {
      console.error('Certification enrichment failed:', error);
      alert('Certification enrichment failed. Some records may not have been updated.');
    } finally {
      setIsEnrichingCertifications(false);
    }
  };

  const handleStandardizeFullDatabase = async () => {
    if (!window.confirm('This will analyze and standardize the capabilities for all MRO providers in your database using AI. Continue?')) return;
    
    setIsStandardizing(true);
    let successCount = 0;
    let flagCount = 0;

    try {
      for (const provider of providers) {
        if (!provider.capabilities || provider.capabilities.length === 0) continue;
        
        const result = await standardizeMROCapabilities(provider.capabilities);
        
        await updateDoc(doc(db, 'mro_providers', provider.id), {
          capabilities: result.mapped,
          unmapped_capabilities: result.unmapped,
          manual_review_needed: result.review_needed,
          last_updated: new Date().toISOString()
        });

        if (result.review_needed) flagCount++;
        successCount++;
      }
      
      alert(`Standardization complete!\n- Processed: ${successCount} providers\n- Flagged for review: ${flagCount}`);
      fetchProviders();
    } catch (error) {
      console.error('Standardization failed:', error);
      alert('Standardization failed. Some records may not have been updated.');
    } finally {
      setIsStandardizing(false);
    }
  };

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'mro_providers'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MROProvider[];
      setProviders(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'mro_providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvider.name || !newProvider.airports?.length) return;

    try {
      await addDoc(collection(db, 'mro_providers'), {
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
      handleFirestoreError(error, OperationType.CREATE, 'mro_providers');
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!window.confirm('Delete this MRO provider?')) return;
    try {
      await deleteDoc(doc(db, 'mro_providers', id));
      fetchProviders();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'mro_providers');
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
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
            <Wrench className="text-indigo-600" size={32} />
            MRO Intelligence Database
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">
            Global Maintenance, Repair & Overhaul providers for international aviation operations.
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <Plus size={18} />
          Add Provider
        </button>
      </div>

      {/* Database Maintenance Section */}
      <div className="flex justify-end pr-2 gap-4">
        <button
          onClick={handleStandardizeFullDatabase}
          disabled={isStandardizing || isEnrichingCertifications || providers.length === 0}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
        >
          {isStandardizing ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <Sparkles size={14} />
          )}
          Standardize All Capabilities
        </button>
        <button
          onClick={handleEnrichCertificationsFullDatabase}
          disabled={isStandardizing || isEnrichingCertifications || providers.length === 0}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
        >
          {isEnrichingCertifications ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <ShieldCheck size={14} />
          )}
          Enrich Certifications
        </button>
      </div>

      {/* AI Enrichment Section */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group">
        <Sparkles className="absolute right-[-20px] top-[-20px] w-64 h-64 text-white/5 group-hover:rotate-12 transition-transform duration-1000" />
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-xl">
                <Sparkles size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight">AI MRO Intelligence</h2>
          </div>
          <p className="text-indigo-50/80 mb-6 font-medium">
            Search for local MRO providers at any international airport. Our AI will research the top-rated maintenance facilities globally and enrich your database.
          </p>
          <div className="flex gap-3">
            <input 
                type="text" 
                placeholder="Enter Airport ICAO (e.g., OMDB, EGLL, KLAX)..."
                value={enrichmentAirport}
                onChange={(e) => setEnrichmentAirport(e.target.value.toUpperCase())}
                className="bg-white/10 border border-white/20 rounded-2xl px-6 py-3 text-sm focus:bg-white/20 transition-all outline-none flex-1 placeholder:text-white/40"
            />
            <button 
                onClick={handleAIEnrich}
                disabled={isEnriching}
                className="bg-white text-indigo-600 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50 transition-all shadow-lg flex items-center gap-2 transform active:scale-95 disabled:opacity-50"
            >
                {isEnriching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                Enrich Database
            </button>
          </div>
        </div>

        {enrichmentResults.length > 0 && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {enrichmentResults.map((res, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-sm leading-tight pr-2">{res.name}</h3>
                                <div className="flex gap-0.5 shrink-0">
                                    {[...Array(5)].map((_, idx) => (
                                        <Star key={idx} size={8} className={idx < (res.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-white/20'} />
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-indigo-200/60 mb-2">
                                <MapPin size={8} />
                                {res.headquarters || 'Global Provider'}
                            </div>
                            <div className="space-y-1.5 mb-4">
                                <div className="flex flex-wrap gap-1">
                                    {res.capabilities.slice(0, 2).map(c => (
                                        <span key={c} className="bg-white/5 px-1.5 py-0.5 rounded text-[8px] border border-white/10">{c}</span>
                                    ))}
                                </div>
                                {res.aircraftTypes && (
                                    <div className="flex flex-wrap gap-1">
                                        {res.aircraftTypes.slice(0, 2).map(t => (
                                            <span key={t} className="bg-amber-400/10 text-amber-300 px-1.5 py-0.5 rounded text-[8px] border border-amber-400/20">{t}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button 
                            onClick={() => saveEnrichedProvider(res)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mt-auto"
                        >
                            <Plus size={12} />
                            Save Provider
                        </button>
                    </motion.div>
                ))}
            </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Global Providers', value: providers.length, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Maintained Airports', value: [...new Set(providers.flatMap(p => p.airports))].length, icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Deep Maintenance', value: providers.filter(p => p.capabilities.includes('D-Check')).length, icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'AI Verified', value: providers.filter(p => p.ai_verified).length, icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
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

      {/* Filters Bar */}
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

      {/* Providers Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Accessing MRO Intelligence...</p>
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
                        <Building2 size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{provider.name}</h3>
                          {provider.ai_verified && (
                            <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-1.5 py-0.5 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-1">
                              <ShieldCheck size={10} />
                              <span className="text-[8px] font-black uppercase tracking-tighter italic">AI Verified</span>
                            </div>
                          )}
                          {provider.manual_review_needed && (
                             <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 px-1.5 py-0.5 rounded-lg border border-amber-100 dark:border-amber-800 flex items-center gap-1">
                               <Filter size={10} />
                               <span className="text-[8px] font-black uppercase tracking-tighter italic">Review Needed</span>
                             </div>
                          )}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Serving Airports</p>
                      <div className="flex flex-wrap gap-2">
                        {provider.airports.map(icao => (
                          <span key={icao} className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-lg text-[10px] font-black border border-emerald-100 dark:border-emerald-800 group-hover:scale-105 transition-transform">
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
                      {provider.manual_review_needed && provider.unmapped_capabilities && provider.unmapped_capabilities.length > 0 && (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-dashed border-amber-200 dark:border-amber-800/50">
                           <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1 italic">Unmapped data found:</p>
                           <div className="flex flex-wrap gap-1">
                             {provider.unmapped_capabilities.map(u => (
                               <span key={u} className="text-[8px] font-bold text-gray-500 bg-white/50 dark:bg-gray-800/50 px-1.5 py-0.5 rounded italic">
                                 {u}
                               </span>
                             ))}
                           </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {provider.aircraftTypes && provider.aircraftTypes.length > 0 && (
                    <div className="mb-6 space-y-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Supported Aircraft Families</p>
                      <div className="flex flex-wrap gap-2">
                        {provider.aircraftTypes.map(type => (
                          <span key={type} className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-lg text-[10px] font-black border border-amber-100 dark:border-amber-800 flex items-center gap-1">
                            <CheckCircle2 size={8} />
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

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
                
                <div className="bg-gray-50/50 dark:bg-gray-900/30 px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center mt-auto">
                    <p className="text-[9px] font-bold text-gray-400 uppercase">Last updated: {provider.last_updated ? new Date(provider.last_updated).toLocaleDateString() : 'Unknown'}</p>
                    <div className="flex gap-2">
                        {provider.certifications.map(cert => (
                            <span key={cert} className="text-[8px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                                {cert}
                            </span>
                        ))}
                    </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Modal */}
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
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">New MRO Provider</h2>
                  <p className="text-gray-500 text-sm font-medium">Add a maintenance service provider to the global network.</p>
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
                      placeholder="e.g., Lufthansa Technik" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Airports (ICAO, comma separated)</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g., EDDF, OMDB, KJFK" 
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, airports: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Headquarters</label>
                      <input 
                        type="text" 
                        placeholder="City, Country" 
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        onChange={(e) => setNewProvider({...newProvider, headquarters: e.target.value})}
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rating (1-5)</label>
                      <input 
                        type="number" 
                        min="1" max="5" step="0.5"
                        placeholder="5" 
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        onChange={(e) => setNewProvider({...newProvider, rating: parseFloat(e.target.value)})}
                      />
                  </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Key Capabilities</label>
                    <div className="flex flex-wrap gap-2">
                        {capabilities.map(cap => (
                            <button
                                type="button"
                                key={cap}
                                onClick={() => {
                                    const caps = newProvider.capabilities || [];
                                    if (caps.includes(cap)) {
                                        setNewProvider({...newProvider, capabilities: caps.filter(c => c !== cap)});
                                    } else {
                                        setNewProvider({...newProvider, capabilities: [...caps, cap]});
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                                    newProvider.capabilities?.includes(cap)
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-none'
                                        : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-600 hover:border-indigo-200'
                                }`}
                            >
                                {cap}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Email</label>
                        <input 
                            type="email" 
                            placeholder="mro@example.com" 
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            onChange={(e) => setNewProvider({...newProvider, contactEmail: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                        <input 
                            type="tel" 
                            placeholder="+1 (555) 000-0000" 
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            onChange={(e) => setNewProvider({...newProvider, phone: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Website</label>
                        <input 
                            type="text" 
                            placeholder="www.mroservice.com" 
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            onChange={(e) => setNewProvider({...newProvider, website: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Aircraft Families Supported (comma sep)</label>
                        <input 
                            type="text" 
                            placeholder="A320, B737, E190" 
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            onChange={(e) => setNewProvider({...newProvider, aircraftTypes: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Certifications (comma sep)</label>
                        <input 
                            type="text" 
                            placeholder="EASA 145, FAA 145" 
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            onChange={(e) => setNewProvider({...newProvider, certifications: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)})}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      onChange={(e) => setNewProvider({...newProvider, ai_verified: e.target.checked})}
                    />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Mark as AI Verified</span>
                  </label>
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
                    Create Provider Record
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
