import React, { useState, useEffect } from 'react';
import { Plane, Search, Calendar, MapPin, Shield, Info, DollarSign, UserCheck, Settings, Loader2, Filter, ChevronRight, ExternalLink, X, Weight, Sparkles, ArrowRight, TrendingUp, AlertTriangle, Mail, Globe } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { motion, AnimatePresence } from 'motion/react';
import { getFlightRouteDetails, getSuggestedAircraft, getOperatorDetails } from '../services/aiService';
import AircraftDetailPage from './AircraftDetailPage';
import { calculateAvailability, AvailabilityStatus } from '../services/availabilityService';

interface Aircraft {
  id?: string;
  registration?: string;
  icao24?: string;
  type: string;
  fuelBurnPerHour: number;
  cruiseSpeed: number;
  range: number;
  maxPayload: number;
  maxPassengers: number;
  hourlyRate: number;
  category: string;
  operatorName?: string;
  operatorEmail?: string;
  operatorWebsite?: string;
  operatorPhone?: string;
  operator_id?: string;
  acmiRate?: number;
  availability?: string;
  baseAirport?: string;
  crewIncluded?: boolean;
  maintenanceStatus?: string;
  insuranceCoverage?: string;
  operatorDetails?: string;
  crewInfo?: string;
  image?: string;
}

interface ACMIMarketplaceProps {
  onGenerateQuote?: (aircraft: Aircraft, missionData: any) => void;
  setActiveTab?: (tab: string) => void;
  initialData?: {
    departure: string;
    destination: string;
    date: string;
    passengers: number | '';
    payload: number | '';
    missionType: string;
  };
}

export default function ACMIMarketplace({ onGenerateQuote, setActiveTab, initialData }: ACMIMarketplaceProps) {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [isSmartSearching, setIsSmartSearching] = useState(false);
  const [availabilityCache, setAvailabilityCache] = useState<Record<string, { status: AvailabilityStatus, reason: string }>>({});
  const [smartSearchSuitableIds, setSmartSearchSuitableIds] = useState<string[] | null>(null);
  const [smartSearchResults, setSmartSearchResults] = useState<{
    cheapest: { type: string, notes: string },
    fastest: { type: string, notes: string },
    recommended: { type: string, notes: string },
    routeDetails: any
  } | null>(null);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0 });
  const [brokerMargin, setBrokerMargin] = useState(12); // Default 12%
  const hasProactivelyEnriched = React.useRef(false);

  // Mission State
  const [missionData, setMissionData] = useState({
    departure: initialData?.departure || '',
    destination: initialData?.destination || '',
    date: initialData?.date || '',
    passengers: initialData?.passengers || 0,
    payload: initialData?.payload || 0,
    missionType: initialData?.missionType || 'Passenger'
  });

  const enrichOperator = async (a: Aircraft, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!a.operatorName || a.operatorName === 'Unknown Operator' || !a.operator_id) return;

    setEnrichingId(a.id || null);
    try {
      const details = await getOperatorDetails(a.operatorName, a.baseAirport);
      if (details) {
        await updateDoc(doc(db, 'operators', a.operator_id), {
          contact_email: details.email || '',
          website: details.website || '',
          phone: details.phone || '',
          icao_code: details.icao_code || '',
          iata_code: details.iata_code || '',
          manual_notes: details.summary || '',
          last_enriched: new Date().toISOString()
        });
        await fetchAircraft(); // Refresh UI
      }
    } catch (error) {
      console.error(`Failed to enrich operator ${a.operatorName}:`, error);
    } finally {
      setEnrichingId(null);
    }
  };

  const enrichAllMissingOperators = async () => {
    const missing = aircraft.filter(a => !a.operatorEmail || !a.operatorWebsite);
    if (missing.length === 0) return;

    setIsEnrichingAll(true);
    setEnrichmentProgress({ current: 0, total: missing.length });

    for (let i = 0; i < missing.length; i++) {
      const a = missing[i];
      if (!a.operatorName || a.operatorName === 'Unknown Operator') continue;

      setEnrichmentProgress(prev => ({ ...prev, current: i + 1 }));
      
      try {
        const details = await getOperatorDetails(a.operatorName, a.baseAirport);
        if (details && a.operator_id) {
          await updateDoc(doc(db, 'operators', a.operator_id), {
            contact_email: details.email || '',
            website: details.website || '',
            phone: details.phone || '',
            icao_code: details.icao_code || '',
            iata_code: details.iata_code || '',
            manual_notes: details.summary || '',
            last_enriched: new Date().toISOString()
          });
        }
        // Small delay to avoid hitting rate limits too hard
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to enrich operator ${a.operatorName}:`, error);
      }
    }

    setIsEnrichingAll(false);
    fetchAircraft(); // Refresh data
  };

  const fetchAircraft = async () => {
    setLoading(true);
    try {
      // 1. Fetch Listings
      const listingSnapshot = await getDocs(collection(db, 'aircraft_listings'));
      const listings = listingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 2. Fetch Master Data and Operators to enrich
      const masterSnapshot = await getDocs(collection(db, 'aircraft_master'));
      const masterMap = new Map(masterSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
      
      const operatorSnapshot = await getDocs(collection(db, 'operators'));
      const operatorMap = new Map(operatorSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));

      const enrichedData = listings.map((l: any) => {
        const master = (masterMap.get(l.aircraft_id) || {}) as any;
        const operator = (operatorMap.get(l.operator_id) || {}) as any;
        
        return {
          id: l.id,
          registration: l.tail_number,
          type: master.aircraft_type || 'Unknown',
          fuelBurnPerHour: master.fuel_burn_kg_per_hr || 2500,
          cruiseSpeed: master.cruise_speed_kts || 450,
          range: master.range_nm || 3000,
          maxPayload: master.payload_kg || 20000,
          maxPassengers: master.passenger_capacity || 0,
          hourlyRate: l.acmi_rate_per_hr || 0,
          acmiRate: l.acmi_rate_per_hr || 0,
          category: master.category || 'Commercial',
          operatorName: operator.name || operator.operator_name || 'Unknown Operator',
          operatorEmail: operator.contact_email || operator.email || '',
          operatorWebsite: operator.website || '',
          operatorPhone: operator.phone || '',
          operator_id: l.operator_id,
          baseAirport: l.location_airport || 'TBD',
          crewIncluded: l.crew_included,
          maintenanceStatus: l.maintenance_included ? 'Included' : 'Not Included',
          insuranceCoverage: l.insurance_included ? 'Included' : 'Not Included',
          image: master.image_url || `https://loremflickr.com/800/600/aircraft,jet,plane?lock=${master.aircraft_type?.length || 1}`,
          ...l
        } as Aircraft;
      });

      setAircraft(enrichedData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'aircraft_listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAircraft();
  }, []);

  useEffect(() => {
    // Proactive background enrichment for first 3 missing operators
    const runProactiveEnrichment = async () => {
      if (aircraft.length > 0 && !hasProactivelyEnriched.current && !isEnrichingAll) {
        hasProactivelyEnriched.current = true;
        const missing = aircraft.filter(a => (!a.operatorEmail || !a.operatorWebsite) && a.operator_id).slice(0, 3);
        if (missing.length > 0) {
          console.log(`Proactively enriching ${missing.length} operators...`);
          for (const a of missing) {
            await enrichOperator(a);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit safety
          }
        }
      }
    };
    runProactiveEnrichment();
  }, [aircraft, isEnrichingAll]);

  const filteredAircraft = aircraft.filter(a => {
    const matchesSearch = a.type.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         a.operatorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         a.baseAirport?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
    
    // Filter by smart search suitability if active
    const matchesSmartSearch = !smartSearchSuitableIds || (a.id && smartSearchSuitableIds.includes(a.id));

    // Filter by mission requirements
    const matchesCapacity = missionData.missionType === 'Cargo' 
      ? a.maxPayload >= missionData.payload 
      : a.maxPassengers >= missionData.passengers;

    return matchesSearch && matchesCategory && matchesCapacity && matchesSmartSearch;
  });

  useEffect(() => {
    const fetchAvailability = async () => {
      const newCache = { ...availabilityCache };
      for (const a of filteredAircraft) {
        if (a.id && !newCache[a.id] && (a.icao24 || a.registration)) {
          const result = await calculateAvailability(a.id, a.icao24, a.registration);
          newCache[a.id] = { status: result.status, reason: result.reason };
        }
      }
      setAvailabilityCache(newCache);
    };

    if (filteredAircraft.length > 0) {
      fetchAvailability();
    }
  }, [filteredAircraft]);

  const handleSmartSearch = async () => {
    if (!missionData.departure || !missionData.destination) {
      alert('Please enter both departure and destination for Smart Search.');
      return;
    }

    setIsSmartSearching(true);
    setSmartSearchResults(null);

    try {
      // 1. Get Route Details (Distance)
      const route = await getFlightRouteDetails(missionData.departure, missionData.destination);
      const distance = route.routingDistance || route.gcDistance;

      // 2. Filter aircraft by range and capacity
      const suitableAircraft = aircraft.filter(a => {
        const matchesCapacity = missionData.missionType === 'Cargo' 
          ? a.maxPayload >= missionData.payload 
          : a.maxPassengers >= missionData.passengers;
        
        // Check range (with 10% buffer)
        const hasRange = a.range >= distance * 1.1;
        
        return matchesCapacity && hasRange;
      });

      if (suitableAircraft.length === 0) {
        alert('No aircraft in our database have the range for this mission. Try adding fuel stops or choosing a different aircraft type.');
        setIsSmartSearching(false);
        return;
      }

      // 3. Get AI Suggestions
      const suggestions = await getSuggestedAircraft(
        missionData.missionType === 'Cargo' ? 0 : missionData.passengers,
        missionData.missionType === 'Cargo' ? missionData.payload : 0,
        distance,
        suitableAircraft,
        missionData.departure
      );

      setSmartSearchResults({
        ...suggestions,
        routeDetails: route
      });
      setSmartSearchSuitableIds(suitableAircraft.map(a => a.id!));

    } catch (error) {
      console.error('Smart Search Error:', error);
    } finally {
      setIsSmartSearching(false);
    }
  };

  const clearSmartSearch = () => {
    setSmartSearchResults(null);
    setSmartSearchSuitableIds(null);
  };

  if (showFullDetails && selectedAircraft) {
    return (
      <AircraftDetailPage 
        aircraft={selectedAircraft} 
        onBack={() => setShowFullDetails(false)}
        setActiveTab={setActiveTab}
        onGenerateQuote={(a) => {
          setShowFullDetails(false);
          onGenerateQuote?.(a, missionData);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">ACMI Marketplace</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Search and lease aircraft with full crew, maintenance, and insurance.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab?.('ai-intelligence')}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none"
          >
            <Sparkles size={14} />
            AI Optimization
          </button>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100 dark:border-emerald-800 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Live Availability
          </div>
        </div>
      </div>

      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-4 flex items-start gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-800/50 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100 mb-1">Reality Check: The ACMI Data Problem</h4>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
            There is no public real ACMI pricing database, operators don't share availability easily, and data is highly fragmented. 
            This marketplace uses our <strong className="font-bold">AI + Scraping + Network</strong> combo to aggregate real-time availability and predict accurate block hour rates.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="text-indigo-600" size={20} />
          <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-widest text-xs">Mission Requirements</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">From (ICAO)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Departure"
                className="w-full pl-10 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                value={missionData.departure}
                onChange={e => setMissionData({...missionData, departure: e.target.value.toUpperCase()})}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">To (ICAO)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Destination"
                className="w-full pl-10 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                value={missionData.destination}
                onChange={e => setMissionData({...missionData, destination: e.target.value.toUpperCase()})}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="date" 
                className="w-full pl-10 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                value={missionData.date}
                onChange={e => setMissionData({...missionData, date: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Mission Type</label>
            <select 
              className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none dark:text-white"
              value={missionData.missionType}
              onChange={e => setMissionData({...missionData, missionType: e.target.value})}
            >
              <option value="Passenger">Passenger</option>
              <option value="Cargo">Cargo</option>
              <option value="VIP">VIP</option>
              <option value="ACMI Lease">ACMI Lease</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
              {missionData.missionType === 'Cargo' ? 'Payload (KG)' : 'Passengers'}
            </label>
            <div className="relative">
              {missionData.missionType === 'Cargo' ? <Weight className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /> : <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />}
              <input 
                type="number" 
                className="w-full pl-10 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                value={missionData.missionType === 'Cargo' ? missionData.payload : missionData.passengers}
                onChange={e => setMissionData({
                  ...missionData, 
                  [missionData.missionType === 'Cargo' ? 'payload' : 'passengers']: parseInt(e.target.value) || 0
                })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            onClick={handleSmartSearch}
            disabled={isSmartSearching || !missionData.departure || !missionData.destination}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-8 py-3 rounded-2xl font-bold hover:from-indigo-700 hover:to-violet-700 transition shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2 disabled:opacity-50"
          >
            {isSmartSearching ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
            Smart Search Engine
          </button>
        </div>
      </div>

      <AnimatePresence>
        {smartSearchResults && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 p-6 rounded-3xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-indigo-600" size={20} />
                <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-widest text-xs">AI Market Analysis & Suggestions</h3>
              </div>
              <button onClick={clearSmartSearch} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { type: 'cheapest', label: 'Most Economical', icon: <DollarSign size={16} />, color: 'emerald' },
                { type: 'fastest', label: 'Fastest Route', icon: <TrendingUp size={16} />, color: 'amber' },
                { type: 'recommended', label: 'AI Recommended', icon: <Sparkles size={16} />, color: 'indigo' }
              ].map((option) => {
                const data = smartSearchResults[option.type as keyof typeof smartSearchResults] as any;
                if (!data) return null;
                
                return (
                  <div key={option.type} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-2">
                    <div className={`flex items-center gap-2 text-${option.color}-600 dark:text-${option.color}-400`}>
                      {option.icon}
                      <span className="text-[10px] font-black uppercase tracking-widest">{option.label}</span>
                    </div>
                    <p className="text-sm font-black text-gray-900 dark:text-white">{data.type}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed italic">
                      "{data.notes}"
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl">
              <div className="flex items-center gap-1">
                <MapPin size={12} />
                {missionData.departure}
              </div>
              <ArrowRight size={12} />
              <div className="flex items-center gap-1">
                <MapPin size={12} />
                {missionData.destination}
              </div>
              <div className="h-3 w-px bg-indigo-200 dark:bg-indigo-800 mx-2" />
              <span>Distance: {smartSearchResults.routeDetails?.routingDistance || 0} NM</span>
              <div className="h-3 w-px bg-indigo-200 dark:bg-indigo-800 mx-2" />
              <span>Est. Flight Time: {Math.round((smartSearchResults.routeDetails?.routingDistance || 0) / 450 * 60)} mins</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by aircraft, operator, or base..."
            className="w-full pl-12 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select
              className="w-full pl-12 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none dark:text-white"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option>All Categories</option>
              <option>Light Jet</option>
              <option>Midsize Jet</option>
              <option>Heavy Jet</option>
              <option>Cargo</option>
              <option>Turboprop</option>
            </select>
          </div>
        </div>
        <button 
          onClick={fetchAircraft}
          className="bg-indigo-600 text-white p-4 rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
          Refresh Marketplace
        </button>
        <button 
          onClick={enrichAllMissingOperators}
          disabled={isEnrichingAll || aircraft.filter(a => !a.operatorEmail || !a.operatorWebsite).length === 0}
          className="bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 p-4 rounded-2xl font-bold border border-indigo-100 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-gray-700 transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isEnrichingAll ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Enriching ({enrichmentProgress.current}/{enrichmentProgress.total})</span>
            </>
          ) : (
            <>
              <Sparkles size={20} />
              <span>Smart Enrich Missing Data</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filteredAircraft.length === 0 && !loading ? (
            <div className="bg-white dark:bg-gray-800 p-12 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 text-center">
              <Plane size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No ACMI Aircraft Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or category filters.</p>
            </div>
          ) : (
            filteredAircraft.map((a) => (
              <motion.div
                layout
                key={a.id}
                onClick={() => setSelectedAircraft(a)}
                className={`bg-white dark:bg-gray-800 p-5 rounded-3xl border transition-all cursor-pointer group ${
                  selectedAircraft?.id === a.id 
                    ? 'border-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-900/20' 
                    : 'border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800'
                }`}
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-48 h-32 bg-gray-100 dark:bg-gray-900 rounded-2xl overflow-hidden relative flex-shrink-0">
                    {a.image ? (
                      <img src={a.image} alt={a.type} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Plane size={32} />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter">
                      {a.category}
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition">{a.type}</h3>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{a.operatorName}</p>
                            {(!a.operatorEmail || !a.operatorWebsite) && a.operator_id && (
                              <button
                                onClick={(e) => enrichOperator(a, e)}
                                disabled={enrichingId === a.id}
                                className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md text-indigo-600 transition-all group/enrich"
                                title="Enrich operator data with AI"
                              >
                                {enrichingId === a.id ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <Sparkles size={10} className="group-hover/enrich:scale-110 transition-transform" />
                                )}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {a.operatorEmail && (
                              <div className="flex items-center gap-1 text-[9px] text-gray-500">
                                <Mail size={10} />
                                <span>{a.operatorEmail}</span>
                              </div>
                            )}
                            {a.operatorWebsite && (
                              <div className="flex items-center gap-1 text-[9px] text-gray-500">
                                <Globe size={10} />
                                <span>{a.operatorWebsite}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ACMI Rate</p>
                        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">${a.acmiRate?.toLocaleString()}<span className="text-xs font-normal text-gray-400">/hr</span></p>
                        {a.id && availabilityCache[a.id] && (
                          <div className={`mt-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md inline-block ${
                            availabilityCache[a.id].status === 'Confirmed Available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            availabilityCache[a.id].status === 'Likely Available' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {availabilityCache[a.id].status}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{a.availability}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Base: {a.baseAirport}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{a.crewIncluded ? 'Crew Included' : 'No Crew'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Insured</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {selectedAircraft ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-indigo-100 dark:border-gray-700 shadow-xl sticky top-6"
              >
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">{selectedAircraft.type}</h3>
                    <button onClick={() => setSelectedAircraft(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600">
                          <Info size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Operator Details</p>
                          <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{selectedAircraft.operatorName}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {selectedAircraft.operatorDetails || 'No additional operator details provided.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Maintenance</p>
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{selectedAircraft.maintenanceStatus || 'Up to date'}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Insurance</p>
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{selectedAircraft.insuranceCoverage || 'Standard ACMI'}</p>
                      </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-widest">Broker Margin (%)</p>
                        <span className="text-sm font-black text-indigo-600">{brokerMargin}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="30" 
                        value={brokerMargin}
                        onChange={(e) => setBrokerMargin(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-800 flex justify-between items-center">
                        <p className="text-[10px] font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-widest">Est. Client Total</p>
                        <p className="text-lg font-black text-emerald-600">${Math.round((selectedAircraft.acmiRate || 0) * (1 + brokerMargin/100)).toLocaleString()}<span className="text-[10px] font-normal text-gray-400">/hr (approx)</span></p>
                      </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                      <div className="flex items-center gap-3 mb-2">
                        <UserCheck size={18} className="text-indigo-600" />
                        <p className="text-xs font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-widest">Crew Information</p>
                      </div>
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                        {selectedAircraft.crewInfo || 'Standard crew complement included in ACMI rate.'}
                      </p>
                    </div>

                    <div className="pt-4 space-y-3">
                      <button 
                        onClick={() => setShowFullDetails(true)}
                        className="w-full bg-white dark:bg-gray-900 border border-indigo-600 text-indigo-600 p-4 rounded-2xl font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition flex items-center justify-center gap-2 mb-2"
                      >
                        <Plane size={18} />
                        View Full Aircraft Details
                      </button>
                      <button 
                        onClick={() => onGenerateQuote?.(selectedAircraft, missionData)}
                        disabled={!missionData.departure || !missionData.destination}
                        className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <DollarSign size={20} />
                        Generate ACMI Quote
                      </button>
                      <button className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 p-4 rounded-2xl font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center justify-center gap-2">
                        <ExternalLink size={18} />
                        Contact Operator
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900/30 p-12 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 text-center">
                <Info size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-400">Select an aircraft</h3>
                <p className="text-sm text-gray-400">Click on an aircraft card to view full ACMI details and generate a quote.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
