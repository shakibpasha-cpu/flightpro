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
  Trash2,
  Wine,
  ChefHat,
  Clock3,
  Users2,
  PlaneTakeoff,
  DollarSign,
  Coffee,
  Info
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/errorService';
import { getCateringProvidersForAirport, generateCateringIntelligence } from '../services/aiService';

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
  const [intelLoading, setIntelLoading] = useState(false);
  const [cateringIntel, setCateringIntel] = useState<any>(null);
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const [intelForm, setIntelForm] = useState({
    departure: '',
    arrival: '',
    pax: 4,
    duration: 3.5,
    aircraft: 'G650'
  });

  const handleGenerateIntel = async () => {
    if (!intelForm.departure || !intelForm.arrival) return;
    setIntelLoading(true);
    try {
      const result = await generateCateringIntelligence(
        intelForm.departure,
        intelForm.arrival,
        intelForm.pax,
        intelForm.duration,
        intelForm.aircraft
      );
      setCateringIntel(result);
      setSelectedTierIndex(0); 
    } catch (error) {
      console.error("Intel generation failed", error);
    } finally {
      setIntelLoading(false);
    }
  };

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

      <div className="bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group border border-white/5">
        <Sparkles className="absolute right-[-40px] top-[-40px] w-80 h-80 text-white/5 group-hover:rotate-12 transition-transform duration-1000" />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                  <ChefHat size={32} className="text-indigo-300" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight leading-tight">Culinary Strategy &<br/>Catering Intelligence</h2>
                <p className="text-indigo-200/70 text-xs font-bold uppercase tracking-widest mt-1">AI-Powered Gastronomy Design</p>
              </div>
            </div>
            <p className="text-indigo-100/80 mb-8 font-medium leading-relaxed">
              Design a bespoke in-flight culinary experience based on your specific route, aircraft equipment, and local provision availability.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-indigo-300 ml-1 mb-1.5 block">Dep Airport</label>
                  <input 
                    type="text" 
                    placeholder="OMDB" 
                    value={intelForm.departure}
                    onChange={(e) => setIntelForm({ ...intelForm, departure: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-indigo-300 ml-1 mb-1.5 block">Arr Airport</label>
                  <input 
                    type="text" 
                    placeholder="EGLL" 
                    value={intelForm.arrival}
                    onChange={(e) => setIntelForm({ ...intelForm, arrival: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-indigo-300 ml-1 mb-1.5 block">Aircraft</label>
                  <input 
                    type="text" 
                    placeholder="G650" 
                    value={intelForm.aircraft}
                    onChange={(e) => setIntelForm({ ...intelForm, aircraft: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-indigo-300 ml-1 mb-1.5 block">Pax</label>
                  <input 
                    type="number" 
                    value={intelForm.pax}
                    onChange={(e) => setIntelForm({ ...intelForm, pax: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-indigo-300 ml-1 mb-1.5 block">Duration (H)</label>
                  <input 
                    type="number" 
                    step="0.5"
                    value={intelForm.duration}
                    onChange={(e) => setIntelForm({ ...intelForm, duration: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm placeholder:text-white/30 focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                  />
               </div>
            </div>

            <button 
              onClick={handleGenerateIntel}
              disabled={intelLoading || !intelForm.departure || !intelForm.arrival}
              className="mt-8 w-full bg-white text-indigo-900 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-black/20"
            >
              {intelLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              {intelLoading ? 'Generating Culinary Strategy...' : 'Design Catering Strategy'}
            </button>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 h-full min-h-[500px] flex flex-col">
            {cateringIntel ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 flex-1 flex flex-col"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-black uppercase tracking-tight text-white">{cateringIntel.strategyName}</h3>
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-1">Strategic Culinary Architecture</p>
                  </div>
                  <div className="bg-white/10 px-3 py-1 rounded-full border border-white/10">
                     <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">{cateringIntel.destinationCuisineNote}</span>
                  </div>
                </div>

                <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                  {cateringIntel.tiers?.map((tier: any, idx: number) => (
                    <button
                      key={tier.name}
                      onClick={() => setSelectedTierIndex(idx)}
                      className={`flex-1 py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                        selectedTierIndex === idx 
                          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                          : 'text-indigo-200/50 hover:bg-white/5 hover:text-indigo-200'
                      }`}
                    >
                      {tier.name}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-emerald-400" />
                    <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">${cateringIntel.tiers[selectedTierIndex].totalEstimatedCost} Project Total</span>
                  </div>
                  <span className="text-[9px] font-bold text-white/40 uppercase">Est. ${cateringIntel.tiers[selectedTierIndex].estimatedCostPerPax} / PAX</span>
                </div>

                {cateringIntel.dietaryAudit && cateringIntel.dietaryAudit.length > 0 && (
                   <div className="flex flex-wrap gap-2">
                     {cateringIntel.dietaryAudit.map((item: string, i: number) => (
                       <span key={i} className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/10 text-indigo-200 rounded-full border border-white/5">
                         {item}
                       </span>
                     ))}
                   </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 relative overflow-hidden group/card shadow-sm">
                    <div className="flex items-center gap-2 mb-2 relative z-10">
                       <Wine size={14} className="text-indigo-400" />
                       <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Sommelier Protocol</span>
                    </div>
                    <p className="text-[10px] text-white/80 italic relative z-10 line-clamp-3">"{cateringIntel.tiers[selectedTierIndex].sommelierNotes}"</p>
                    <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover/card:rotate-12 transition-transform">
                      <Wine size={48} />
                    </div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 relative overflow-hidden group/card shadow-sm">
                    <div className="flex items-center gap-2 mb-2 relative z-10">
                       <Coffee size={14} className="text-indigo-400" />
                       <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Terroir Intelligence</span>
                    </div>
                    <p className="text-[10px] text-white/80 leading-relaxed relative z-10 line-clamp-3">{cateringIntel.localFoodIntelligence}</p>
                    <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover/card:-rotate-12 transition-transform">
                      <Coffee size={48} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {/* Service Timeline Table */}
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 mb-6">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3 flex items-center gap-2">
                       <Clock3 size={14} /> In-Flight Service Timeline
                     </h4>
                     <table className="w-full text-left">
                       <thead>
                         <tr>
                           <th className="text-[8px] font-black uppercase text-indigo-200/50 p-1">Timing</th>
                           <th className="text-[8px] font-black uppercase text-indigo-200/50 p-1">Service</th>
                           <th className="text-[8px] font-black uppercase text-indigo-200/50 p-1">Items</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                         {(cateringIntel.tiers[selectedTierIndex].serviceTimeline || []).map((step: any, i: number) => (
                           <tr key={i}>
                             <td className="text-[9px] font-bold text-white p-1 align-top">{step.timing}</td>
                             <td className="text-[9px] font-bold text-indigo-300 p-1 align-top">{step.serviceType}</td>
                             <td className="p-1 align-top">
                               <div className="text-[9px] text-white/70">{step.items.join(', ')}</div>
                               <div className="text-[8px] text-white/40 italic">{step.notes}</div>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                  </div>

                  {/* TableData Table */}
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 mb-6">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3 flex items-center gap-2">
                       <ChefHat size={14} /> Catering Breakdown
                     </h4>
                     <table className="w-full text-left text-[10px]">
                       <thead>
                         <tr className="border-b border-indigo-500/30">
                           <th className="p-2">Meal Service</th>
                           <th className="p-2">Item / Content</th>
                           <th className="p-2 text-right">Cost</th>
                           <th className="p-2 text-right">Pax</th>
                           <th className="p-2 text-right">Total</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-white/5">
                         {(cateringIntel.tiers[selectedTierIndex].tableData || []).map((row: any, i: number) => (
                           <tr key={i} className="hover:bg-white/5">
                             <td className="p-2 font-bold text-white">{row.mealService}</td>
                             <td className="p-2 text-white/70">{row.itemContent}</td>
                             <td className="p-2 text-right text-indigo-300 font-mono">${row.perPaxCost.toFixed(2)}</td>
                             <td className="p-2 text-right text-white/50 font-mono">{row.pax}</td>
                             <td className="p-2 text-right text-white font-mono font-bold">${row.totalCost.toFixed(2)}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center gap-3 bg-black/10 -mx-8 px-8 py-4 mt-auto rounded-b-[2.5rem]">
                   <Info size={16} className="text-indigo-400 shrink-0" />
                   <div className="flex-1">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 leading-none">Operational Galley Logistics ({cateringIntel.tiers[selectedTierIndex].platingStyle})</p>
                    <p className="text-[10px] text-indigo-100/60 leading-tight italic">
                      {cateringIntel.galleyLogistics}
                    </p>
                   </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <ChefHat size={48} className="text-white/10 mb-6" />
                <h4 className="text-lg font-black uppercase tracking-tight text-white/40">Ready for Culinary Design</h4>
                <p className="text-sm text-white/20 font-medium max-w-[240px] mt-2">
                  Input voyage details to generate an AI-powered luxury catering plan.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Global Providers', value: providers.length, icon: Building2, color: 'text-indigo-600', bg: 'bg-white dark:bg-gray-800' },
          { label: 'Maintained Airports', value: [...new Set(providers.flatMap(p => p.airports))].length, icon: MapPin, color: 'text-emerald-600', bg: 'bg-white dark:bg-gray-800' },
          { label: 'AVG Catering Fee', value: `$${Math.round(providers.reduce((acc, p) => acc + (p.cateringFee || 0), 0) / (providers.length || 1))}`, icon: DollarSign, color: 'text-amber-600', bg: 'bg-white dark:bg-gray-800' },
          { label: 'Active Regions', value: 'Global', icon: Globe, color: 'text-sky-600', bg: 'bg-white dark:bg-gray-800' },
         ].map((stat, i) => (
          <div key={i} className={`${stat.bg} p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:scale-[1.02]`}>
            <div className={`p-3 rounded-xl bg-gray-50 dark:bg-gray-900 w-fit mb-4 ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <p className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{stat.value}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 leading-none">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Provider Sourcing Section */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
           <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                 <Search size={22} className="text-indigo-600" />
                 Global Provider Sourcing
              </h3>
              <p className="text-xs text-gray-500 font-medium">Verify and import real-world catering companies at your destination.</p>
           </div>
           <div className="flex gap-2 min-w-[300px]">
              <input 
                type="text" 
                placeholder="ICAO Airport (e.g. OMDB)" 
                value={enrichmentAirport}
                onChange={(e) => setEnrichmentAirport(e.target.value.toUpperCase())}
                className="flex-1 px-5 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
              />
              <button 
                onClick={handleAIEnrich}
                disabled={isEnriching || !enrichmentAirport}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
              >
                {isEnriching ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                {isEnriching ? 'Sourcing...' : 'AI Sourcing'}
              </button>
           </div>
        </div>

        {enrichmentResults.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8"
          >
            {enrichmentResults.map((result, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-indigo-50/50 transition-colors">
                <div>
                  <span className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-tight block">{result.name}</span>
                  <span className="text-[9px] font-bold text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded uppercase mt-1 inline-block">Score: {result.rating}/5</span>
                </div>
                <button 
                  onClick={() => saveEnrichedProvider(result)}
                  className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition shadow-sm"
                >
                  <Plus size={16} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
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
