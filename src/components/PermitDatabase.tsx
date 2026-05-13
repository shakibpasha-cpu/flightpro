import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Search, 
  MapPin, 
  ShieldCheck, 
  FileText, 
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
  Globe2,
  Info,
  RefreshCw
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/errorService';
import { getPermitServiceProviders, getPermitDetailsByCountry, scrapePermitProviders } from '../services/aiService';

interface PermitProvider {
  id: string;
  name: string;
  headquarters: string;
  regions: string[];
  serviceType: string;
  services: string[];
  contactEmail?: string;
  phone?: string;
  website?: string;
  rating?: number;
  ai_verified?: boolean;
  last_updated?: string;
  scraping_source?: string;
}

interface CountryPermitInfo {
  country: string;
  caaName: string;
  overflyLeadTime: string;
  landingLeadTime: string;
  requiredDocuments: string[];
  caaWebsite: string;
  notes: string;
}

export default function PermitDatabase() {
  const [providers, setProviders] = useState<PermitProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentRegion, setEnrichmentRegion] = useState('');
  const [enrichmentResults, setEnrichmentResults] = useState<any[]>([]);

  // Scraping State
  const [scrapingQuery, setScrapingQuery] = useState('');
  const [scrapingUrl, setScrapingUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [activeAITool, setActiveAITool] = useState<'finder' | 'scraper' | 'research'>('finder');

  // Country Research State
  const [countryResearchTerm, setCountryResearchTerm] = useState('');
  const [isResearchingCountry, setIsResearchingCountry] = useState(false);
  const [countryInfo, setCountryInfo] = useState<CountryPermitInfo | null>(null);

  const handleAIEnrich = async () => {
    setIsEnriching(true);
    setEnrichmentResults([]);
    try {
        const data = await getPermitServiceProviders(enrichmentRegion);
        if (data && data.length > 0) {
            setEnrichmentResults(data); 
        } else {
            alert(`No permit service providers found ${enrichmentRegion ? `for ${enrichmentRegion}` : ''}`);
        }
    } catch (error) {
      console.error('Enrichment failed:', error);
      alert(error instanceof Error ? error.message : "Enrichment failed. Please try again.");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleScrape = async () => {
    if (!scrapingQuery && !scrapingUrl) return;
    setIsScraping(true);
    setEnrichmentResults([]);
    try {
      const data = await scrapePermitProviders(scrapingQuery, scrapingUrl);
      if (data && data.length > 0) {
        setEnrichmentResults(data);
      } else {
        alert("No providers found from the scraping query/source.");
      }
    } catch (error) {
      console.error('Scraping failed:', error);
    } finally {
      setIsScraping(false);
    }
  };

  const handleCountryResearch = async () => {
    if (!countryResearchTerm) return;
    setIsResearchingCountry(true);
    setCountryInfo(null);
    try {
      const data = await getPermitDetailsByCountry(countryResearchTerm);
      if (data) {
        setCountryInfo(data);
      } else {
        alert(`Could not find permit details for ${countryResearchTerm}`);
      }
    } catch (error) {
      console.error('Country research failed:', error);
    } finally {
      setIsResearchingCountry(false);
    }
  };

  const saveEnrichedProvider = async (provider: any) => {
    try {
      await addDoc(collection(db, 'permit_providers'), {
        ...provider,
        last_updated: new Date().toISOString()
      });
      setEnrichmentResults(prev => prev.filter(p => p.name !== provider.name));
      fetchProviders();
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'permit_providers');
    }
  };

  const [newProvider, setNewProvider] = useState<Partial<PermitProvider>>({
    name: '',
    headquarters: '',
    regions: [],
    serviceType: 'Permit Specialist',
    services: [],
    rating: 5,
    ai_verified: false
  });

  const regions = [
    'Africa',
    'Middle East',
    'Europe',
    'Asia-Pacific',
    'North America',
    'South America',
    'Oceania',
    'Global'
  ];

  const serviceTypes = [
    'Permit Specialist',
    'Full-Service Handling (Trip Support)',
    'Technology/Software Provider',
    'Aviation Authority Agent'
  ];

  const serviceCategories = [
    'Overfly Permits',
    'Landing Permits',
    'Slots Management',
    'Flight Planning',
    'Ground Handling Coordination',
    'Fuel Coordination',
    'Charter Brokerage Support'
  ];

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'permit_providers'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PermitProvider[];
      setProviders(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'permit_providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvider.name) return;

    try {
      await addDoc(collection(db, 'permit_providers'), {
        ...newProvider,
        last_updated: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewProvider({
        name: '',
        headquarters: '',
        regions: [],
        serviceType: 'Permit Specialist',
        services: [],
        rating: 5,
        ai_verified: false
      });
      fetchProviders();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'permit_providers');
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!window.confirm('Delete this permit provider?')) return;
    try {
      await deleteDoc(doc(db, 'permit_providers', id));
      fetchProviders();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'permit_providers');
    }
  };

  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.headquarters.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = !selectedRegion || p.regions.includes(selectedRegion);
    return matchesSearch && matchesRegion;
  });

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
            <Globe2 className="text-emerald-600" size={32} />
            Permit & Trip Support Network
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">
            Global network of agencies assisting with landing permits, overfly permits, and CAA authorizations.
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
        >
          <Plus size={18} />
          Register Agency
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: AI Intelligence & Scraper */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden min-h-[500px]">
            {/* AI Tools Tabs */}
            <div className="flex border-b border-gray-50 dark:border-gray-700/50 p-2 gap-1">
              <button 
                onClick={() => setActiveAITool('finder')}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeAITool === 'finder' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none' 
                    : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                }`}
              >
                Finder
              </button>
              <button 
                onClick={() => setActiveAITool('scraper')}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeAITool === 'scraper' 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                    : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                }`}
              >
                Scraper
              </button>
              <button 
                onClick={() => setActiveAITool('research')}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeAITool === 'research' 
                    ? 'bg-gray-900 text-white shadow-lg' 
                    : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                }`}
              >
                Audit
              </button>
            </div>

            <div className="p-8">
              <AnimatePresence mode="wait">
                {activeAITool === 'finder' && (
                  <motion.div 
                    key="finder"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600">
                        <Sparkles size={24} />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">AI Agency Finder</h2>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-medium leading-relaxed">
                      Discover specialized permit agencies in specific global regions. AI researches market reputation and service breadth.
                    </p>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Geographic Region</label>
                        <input 
                          type="text" 
                          placeholder="e.g. West Africa, Caribbean..."
                          value={enrichmentRegion}
                          onChange={(e) => setEnrichmentRegion(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                        />
                      </div>
                      <button 
                        onClick={handleAIEnrich}
                        disabled={isEnriching}
                        className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 dark:shadow-none flex items-center justify-center gap-2"
                      >
                        {isEnriching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                        Scan Region
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeAITool === 'scraper' && (
                  <motion.div 
                    key="scraper"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600">
                        <RefreshCw size={24} />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Intelligence Scraper</h2>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-medium leading-relaxed">
                      Fetch and scrape permit agencies from specific URLs or complex market intelligence queries.
                    </p>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Search Keywords</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Flight support agencies in Singapore..."
                          value={scrapingQuery}
                          onChange={(e) => setScrapingQuery(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Source URL (Optional)</label>
                        <input 
                          type="text" 
                          placeholder="https://example.com/directory..."
                          value={scrapingUrl}
                          onChange={(e) => setScrapingUrl(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        />
                      </div>
                      <button 
                        onClick={handleScrape}
                        disabled={isScraping}
                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2"
                      >
                        {isScraping ? <Loader2 className="animate-spin" size={16} /> : <Globe size={16} />}
                        Fetch & Scrape
                      </button>
                    </div>
                  </motion.div>
                )}

                {activeAITool === 'research' && (
                  <motion.div 
                    key="research"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-2xl text-gray-900 dark:text-white">
                        <FileText size={24} />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">CAA Requirement Audit</h2>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-medium leading-relaxed">
                      Analyze Civil Aviation Authority lead times, required documents, and official portals globally.
                    </p>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Enter Country..."
                          value={countryResearchTerm}
                          onChange={(e) => setCountryResearchTerm(e.target.value)}
                          className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl px-5 py-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button 
                          onClick={handleCountryResearch}
                          disabled={isResearchingCountry}
                          className="bg-gray-900 dark:bg-white dark:text-gray-900 text-white p-4 rounded-2xl hover:opacity-80 transition-opacity"
                        >
                          {isResearchingCountry ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                        </button>
                      </div>

                      {countryInfo && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-800/30 space-y-4"
                        >
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-1">CAA Entity</p>
                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase">{countryInfo.caaName}</h3>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Overfly Lead</p>
                              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{countryInfo.overflyLeadTime}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Landing Lead</p>
                              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{countryInfo.landingLeadTime}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Mandatory Documents</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {countryInfo.requiredDocuments.map((doc, idx) => (
                                <span key={idx} className="bg-white/50 dark:bg-gray-800 px-2 py-0.5 rounded text-[9px] font-medium border border-emerald-100 dark:border-emerald-800/50">
                                  {doc}
                                </span>
                              ))}
                            </div>
                          </div>

                          {countryInfo.caaWebsite && (
                            <a 
                              href={countryInfo.caaWebsite} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-emerald-100 dark:border-emerald-800/50 hover:bg-emerald-50 transition-colors group"
                            >
                              <span className="text-[10px] font-black uppercase text-emerald-600">Official Portal</span>
                              <ExternalLink size={14} className="text-emerald-600 group-hover:translate-x-1 transition-transform" />
                            </a>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Column: Results & Grid */}
        <div className="lg:col-span-2 space-y-6">
          {/* Enrichment & Scraper Results */}
          {enrichmentResults.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 p-8 rounded-[3rem] border border-dashed border-emerald-200 dark:border-emerald-800/50">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600">AI Intelligence Results</h3>
                  <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-widest">
                    {enrichmentResults.length} Identified
                  </div>
                </div>
                <button 
                  onClick={() => setEnrichmentResults([])} 
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase"
                >
                  Clear Feed
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {enrichmentResults.map((res, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={i} 
                    className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between group overflow-hidden relative shadow-sm hover:shadow-xl transition-all"
                  >
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      {activeAITool === 'scraper' ? <Globe size={48} /> : <Sparkles size={48} />}
                    </div>
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-black text-base text-gray-900 dark:text-white uppercase leading-tight pr-6">{res.name}</h4>
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, idx) => (
                            <Star key={idx} size={8} className={idx < (res.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 mb-4">
                        <MapPin size={12} />
                        {res.headquarters}
                      </div>
                      
                      <div className="space-y-3 mb-6">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400">Expertise</p>
                        <div className="flex flex-wrap gap-1.5">
                          {res.services.slice(0, 4).map((s: string) => (
                            <span key={s} className="bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded-lg text-[8px] font-bold uppercase text-gray-500 border border-gray-100 dark:border-gray-800">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {res.scraping_source && (
                        <p className="text-[8px] font-mono text-gray-400 mb-2 truncate">Source: {res.scraping_source}</p>
                      )}
                      <button 
                        onClick={() => saveEnrichedProvider(res)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
                      >
                        <CheckCircle2 size={16} />
                        Enrich Database
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search agencies or regions..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              />
            </div>
            <select 
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl text-xs font-bold px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Global Coverage</option>
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Main Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
              <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Accessing Network Records...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 pb-20">
              <AnimatePresence>
                {filteredProviders.map((provider) => (
                  <motion.div 
                    key={provider.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-xl transition-all group"
                  >
                    <div className="p-8">
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex items-start gap-6">
                          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100 dark:border-emerald-800">
                            <Building2 size={32} />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{provider.name}</h3>
                              {provider.ai_verified && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-800 flex items-center gap-1">
                                  <ShieldCheck size={12} />
                                  <span className="text-[10px] font-black uppercase tracking-tighter italic">AI Verified</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-500 mb-6">
                              <div className="flex items-center gap-1.5">
                                <MapPin size={14} className="text-emerald-500" />
                                {provider.headquarters}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Globe size={14} className="text-emerald-500" />
                                {provider.regions.join(', ')}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Specialized Regions</p>
                                <div className="flex flex-wrap gap-2">
                                  {provider.regions.map(region => (
                                    <span key={region} className="bg-gray-50 dark:bg-gray-900/50 px-3 py-1.5 rounded-xl text-[10px] font-black text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-800">
                                      {region}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Service Range</p>
                                <div className="flex flex-wrap gap-2">
                                  {provider.services.map(service => (
                                    <span key={service} className="bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-xl text-[10px] font-black text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                                      {service}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center md:items-end justify-between shrink-0">
                          <div className="flex gap-1 mb-4">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                size={14} 
                                className={i < (provider.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} 
                              />
                            ))}
                          </div>
                          
                          <div className="flex flex-col gap-2 w-full md:w-32">
                            {provider.contactEmail && (
                              <button 
                                onClick={() => window.open(`mailto:${provider.contactEmail}`)}
                                className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors group"
                              >
                                <Mail size={16} className="text-gray-400 group-hover:text-emerald-600" />
                                <span className="text-[10px] font-black uppercase text-gray-500">Email</span>
                              </button>
                            )}
                            {provider.website && (
                              <button 
                                onClick={() => window.open(provider.website?.startsWith('http') ? provider.website : `https://${provider.website}`)}
                                className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors group"
                              >
                                <Globe size={16} className="text-gray-400 group-hover:text-emerald-600" />
                                <span className="text-[10px] font-black uppercase text-gray-500">Portal</span>
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteProvider(provider.id)}
                              className="p-3 bg-rose-50 dark:bg-rose-900/10 rounded-2xl flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors group"
                            >
                              <Trash2 size={16} className="text-rose-400" />
                              <span className="text-[10px] font-black uppercase text-rose-500">Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredProviders.length === 0 && (
                <div className="bg-white dark:bg-gray-800 p-20 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800 flex flex-col items-center text-center gap-6">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center text-gray-300">
                    <Globe2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">No Agencies Found</h3>
                    <p className="text-gray-500 font-medium max-w-sm">Use the AI Scan on the left to discover permit service providers for this region.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-[3rem] w-full max-w-3xl shadow-2xl border border-white/10 overflow-hidden"
          >
            <div className="p-10">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Register Permit Agency</h2>
                  <p className="text-gray-500 text-sm font-medium mt-1">Onboard a specialized support provider to the network.</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <X />
                </button>
              </div>

              <form onSubmit={handleAddProvider} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Agency Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g., HADID International" 
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Headquarters</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g., Dubai, UAE" 
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, headquarters: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Regional Expertise</p>
                  <div className="flex flex-wrap gap-2">
                    {regions.map(r => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => {
                          const current = newProvider.regions || [];
                          const updated = current.includes(r) ? current.filter(x => x !== r) : [...current, r];
                          setNewProvider({...newProvider, regions: updated});
                        }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                          newProvider.regions?.includes(r)
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700 hover:border-emerald-200'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Provided Services</p>
                  <div className="flex flex-wrap gap-2">
                    {serviceCategories.map(s => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => {
                          const current = newProvider.services || [];
                          const updated = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
                          setNewProvider({...newProvider, services: updated});
                        }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                          newProvider.services?.includes(s)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700 hover:border-indigo-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Email</label>
                    <input 
                      type="email" 
                      placeholder="ops@agency.com" 
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, contactEmail: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Website URL</label>
                    <input 
                      type="url" 
                      placeholder="https://www.agency.com" 
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                      onChange={(e) => setNewProvider({...newProvider, website: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded-lg border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      onChange={(e) => setNewProvider({...newProvider, ai_verified: e.target.checked})}
                    />
                    <span className="text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest group-hover:text-emerald-600 transition-colors">Mark as AI Verified Specialist</span>
                  </label>
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-8 py-5 bg-gray-50 dark:bg-gray-900 text-gray-500 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-8 py-5 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Finalize Registration
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
