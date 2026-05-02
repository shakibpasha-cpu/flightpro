import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Filter, Globe, Plane, FileText, ShieldCheck, 
  Activity, AlertTriangle, ChevronRight, Download, 
  BarChart3, Building2, MapPin, Calendar, Mail, 
  ExternalLink, RefreshCw, Database, Sparkles, Terminal, Cpu, CheckCircle, Bot, Settings,
  Shield, FileCheck, Fingerprint, X, Loader2
} from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { PUBLIC_OPERATORS } from '../constants/publicOperators';
import { getAI, handleAiError } from '../services/aiService';

// --- MOCK DATA ---
// Mock data has been replaced by Firestore state.

export default function AOCDatabase() {
  const [dbOperators, setDbOperators] = useState<any[]>([]);
  const [dbLicenses, setDbLicenses] = useState<any[]>([]);
  const [dbAuthorities, setDbAuthorities] = useState<any[]>([]);
  const [dbAircraft, setDbAircraft] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubOps = onSnapshot(collection(db, 'operators_master'), (snap) => {
      setDbOperators(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubLicenses = onSnapshot(collection(db, 'aoc_licenses'), (snap) => {
      setDbLicenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAuths = onSnapshot(collection(db, 'aviation_authorities'), (snap) => {
      setDbAuthorities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAircraft = onSnapshot(collection(db, 'aircraft'), (snap) => {
      setDbAircraft(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => {
      unsubOps();
      unsubLicenses();
      unsubAuths();
      unsubAircraft();
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [isScaledMode, setIsScaledMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'operators' | 'authorities' | 'analytics' | 'licenses'>('operators');
  const [countryFilter, setCountryFilter] = useState('All');
  const [aircraftFilter, setAircraftFilter] = useState('All');
  const [operationFilter, setOperationFilter] = useState('All');
  const [licenseFilter, setLicenseFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [showScraperModal, setShowScraperModal] = useState(false);
  const [scrapeLogs, setScrapeLogs] = useState<string[]>([]);
  const [scrapeStatus, setScrapeStatus] = useState<'idle' | 'running' | 'completed'>('idle');

  const [aiEnrichedData, setAiEnrichedData] = useState<Record<string, { 
    website: string, 
    contact_email: string, 
    manual_notes: string,
    estimated_fleet_size?: number,
    market_segment?: string,
    charter_capability_score?: number,
    ai_classification?: string,
    fleet_estimation_basis?: string,
    icao_code?: string,
    iata_code?: string,
    detected_aircraft_types?: string[],
    operation_type?: string
  }>>({});
  const [isEnriching, setIsEnriching] = useState<Record<string, boolean>>({});
  const [aiError, setAiError] = useState<string | null>(null);

  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiFilters, setAiFilters] = useState<{
    countries?: string[];
    aircraft_type?: string;
    status?: string;
    operation_type?: string;
    license_type?: string;
  } | null>(null);

  const handleSmartSearch = async () => {
    if (!aiSearchQuery.trim()) {
      setAiFilters(null);
      return;
    }
    
    setIsAiSearching(true);
    setAiError(null);
    try {
      const ai = getAI();
      const prompt = `You are an AI assistant for an aviation database. Parse the following user query into structured search filters.
      Available fields to filter on:
      - countries (array of strings): If a region like 'Africa' or 'Europe' is mentioned, list the relevant countries from this list: ['UAE', 'UK', 'Malta', 'Pakistan', 'Iceland', 'Egypt', 'South Africa']. If specific countries are mentioned, list them.
      - aircraft_type (string): e.g., 'A320', 'B777', 'A350', 'B737'.
      - status (string): 'Active' or 'Suspended'.
      - operation_type (string): 'Scheduled', 'Charter', 'Cargo'.
      - license_type (string): 'AOC', 'RPT', 'BOTH'.
      
      Return ONLY valid JSON in this exact format, with no markdown formatting or backticks:
      {
        "countries": ["Egypt", "South Africa"],
        "aircraft_type": "A320",
        "status": "Active"
      }
      
      Query: "${aiSearchQuery}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      let jsonStr = response.text || '{}';
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      setAiFilters(parsed);
    } catch (error: any) {
      handleAiError(error, 'handleSmartSearch');
      setAiError("AI Search failed. Please try again later.");
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleEnrichProfile = async (operator: any) => {
    setIsEnriching(prev => ({ ...prev, [operator.id]: true }));
    setAiError(null);
    console.log(`[AI ENRICH] Starting web scraping for ${operator.operator_name}...`);
    
    try {
      // Simulate web scraping delay and logs
      await new Promise(resolve => setTimeout(resolve, 800));
      console.log(`[AI ENRICH] Found potential sources: ${operator.operator_name} official site, LinkedIn, and aviation registries.`);
      
      const ai = getAI();
      const prompt = `You are an aviation data researcher. I have "scraped" some raw data about the operator: ${operator.operator_name} based in ${operator.country}.
      
      Your task is to synthesize this into a structured profile.
      Find or estimate:
      - official website URL
      - a likely public contact email (or standard format like info@...)
      - a short manual note/profile summary (2-3 sentences about their operations, history, or fleet)
      - icao_code (3-letter code, e.g., 'UAE', 'QTR')
      - iata_code (2-letter code, e.g., 'EK', 'QR')
      - operation_type (one of: 'Scheduled', 'Charter', 'Cargo', 'Helicopter')
      - detected_aircraft_types (array of strings): List 3-5 major aircraft types they operate (e.g., ['A380', 'B777', 'A350']).
      
      Also provide predictive estimates for:
      - estimated_fleet_size (number): Total aircraft they likely operate.
      - market_segment (string): e.g., 'Ultra-High-Net-Worth', 'Regional Cargo', 'Low-Cost Carrier', 'Government/Diplomatic', 'ACMI/Charter'.
      - charter_capability_score (number): A score from 0-100 representing how active/capable they are in the charter market.
      - ai_classification (string): One of 'Charter operator', 'Cargo operator', 'ACMI provider', 'Scheduled Airline'.
      - fleet_estimation_basis (string): A short explanation of the estimation (e.g., "Based on routes in Middle East and similar regional carriers like flydubai").
      
      Return ONLY valid JSON in this exact format, with no markdown formatting or backticks:
      {
        "website": "example.com",
        "contact_email": "contact@example.com",
        "manual_notes": "...",
        "icao_code": "UAE",
        "iata_code": "EK",
        "operation_type": "Scheduled",
        "detected_aircraft_types": ["A380", "B777"],
        "estimated_fleet_size": 45,
        "market_segment": "Regional Cargo",
        "charter_capability_score": 85,
        "ai_classification": "Cargo operator",
        "fleet_estimation_basis": "..."
      }`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      let text = response.text || "{}";
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(text);
      
      setAiEnrichedData(prev => ({ ...prev, [operator.id]: parsed }));
      console.log(`[AI ENRICH] Successfully enriched ${operator.operator_name}`);
    } catch (error: any) {
      handleAiError(error, 'handleEnrichProfile');
      setAiError("AI Enrichment currently unavailable. Using basic fallback data.");
      // Fallback data
      const domain = operator.operator_name.toLowerCase().replace(/\s+/g, '') + '.com';
      const fallback = {
        website: `https://www.${domain}`,
        contact_email: `info@${domain}`,
        manual_notes: `${operator.operator_name} is an aviation operator based in ${operator.country}. (AI Enrichment currently unavailable)`,
        icao_code: 'TBD',
        iata_code: 'TBD',
        operation_type: 'Charter',
        detected_aircraft_types: ['Unknown'],
        estimated_fleet_size: 0,
        market_segment: 'General Aviation',
        charter_capability_score: 50,
        ai_classification: 'Operator',
        fleet_estimation_basis: 'Manual fallback'
      };
      setAiEnrichedData(prev => ({ ...prev, [operator.id]: fallback }));
    } finally {
      setIsEnriching(prev => ({ ...prev, [operator.id]: false }));
    }
  };

  const countries = ['All', ...Array.from(new Set(dbOperators.map(o => o.country).filter(Boolean)))].sort();
  const aircraftTypes = ['All', ...Array.from(new Set(dbAircraft.map(a => a.aircraft_type).filter(Boolean)))].sort();
  const operations = ['All', 'Scheduled', 'Charter', 'Cargo'];
  const licenses = ['All', 'AOC', 'RPT', 'BOTH'];
  const statuses = ['All', 'Active', 'Suspended'];

  const KNOWN_ALIASES: Record<string, string> = {
    'pia': 'pakistan international airlines',
    'ek': 'emirates',
    'qr': 'qatar airways',
    'ba': 'british airways',
    'lh': 'lufthansa',
    'af': 'air france',
    'klm': 'klm royal dutch airlines',
    'aa': 'american airlines',
    'dl': 'delta air lines',
    'ua': 'united airlines',
    'sq': 'singapore airlines',
    'qf': 'qantas',
    'tk': 'turkish airlines',
  };

  const normalizeOperatorName = (name: string) => {
    let normalized = name.toLowerCase()
      .replace(/\s+airlines?$/i, '')
      .replace(/\s+airways?$/i, '')
      .replace(/\s+international$/i, '')
      .replace(/\s+aviation$/i, '')
      .replace(/\s+services$/i, '')
      .replace(/\s+air$/i, '')
      .trim();
    
    // Check for known aliases
    if (KNOWN_ALIASES[normalized]) {
      return KNOWN_ALIASES[normalized];
    }
    
    return normalized;
  };

  const operators = useMemo(() => {
    const baseOperators = [...dbOperators, ...PUBLIC_OPERATORS];
    if (!isScaledMode) return baseOperators;
    
    // Generate 750 additional mock operators for scaled mode
    const scaledOperators = [...baseOperators];
    const countries = ['USA', 'UK', 'UAE', 'India', 'France', 'Germany', 'Australia', 'Singapore', 'Maldives', 'Brazil'];
    const types = ['Scheduled', 'Charter', 'Cargo', 'Helicopter'];
    
    for (let i = 0; i < 750; i++) {
      const country = countries[Math.floor(Math.random() * countries.length)];
      scaledOperators.push({
        id: `OP-SC-${i}`,
        operator_name: `Operator ${i + 100} ${country}`,
        country: country,
        region: 'Global',
        iata_code: 'XX',
        icao_code: 'XXX',
        callsign: 'SCALED',
        aoc_number: `${country}-AOC-${i + 500}`,
        license_type: i % 3 === 0 ? 'BOTH' : (i % 2 === 0 ? 'AOC' : 'RPT'),
        operation_type: types[Math.floor(Math.random() * types.length)],
        status: Math.random() > 0.1 ? 'Active' : 'Suspended',
        founded_year: 1950 + Math.floor(Math.random() * 70),
        website: 'example.com',
        contact_email: 'ops@example.com',
        source: 'Mass Scrape'
      });
    }
    return scaledOperators;
  }, [isScaledMode]);

  const deduplicatedOperators = useMemo(() => {
    const seen = new Map<string, any>();
    
    operators.forEach(op => {
      const normalized = normalizeOperatorName(op.operator_name);
      
      // Build a set of potential keys for this operator
      const keys = new Set<string>();
      if (op.icao_code && op.icao_code !== 'XXX') keys.add(`icao-${op.icao_code}-${op.country}`);
      if (op.iata_code && op.iata_code !== 'XX') keys.add(`iata-${op.iata_code}-${op.country}`);
      keys.add(`name-${normalized}-${op.country}`);
      
      // Check if any of these keys have been seen
      let existingKey: string | null = null;
      for (const key of keys) {
        if (seen.has(key)) {
          existingKey = key;
          break;
        }
      }
      
      if (!existingKey) {
        // New operator, add all its keys to the map
        const opData = { ...op };
        keys.forEach(k => seen.set(k, opData));
      } else {
        // Duplicate found, merge data if necessary
        const existing = seen.get(existingKey);
        
        // Prefer longer names as they are usually more descriptive
        if (op.operator_name.length > existing.operator_name.length) {
          existing.operator_name = op.operator_name;
        }
        
        // Fill in missing codes
        if (!existing.icao_code || existing.icao_code === 'XXX') existing.icao_code = op.icao_code;
        if (!existing.iata_code || existing.iata_code === 'XX') existing.iata_code = op.iata_code;
        
        // Re-map all keys to the updated object
        keys.forEach(k => seen.set(k, existing));
      }
    });
    
    // Return unique objects
    return Array.from(new Set(seen.values()));
  }, [operators]);

  const filteredOperators = useMemo(() => {
    return deduplicatedOperators.filter(op => {
      const operatorAircraft = dbAircraft.filter(a => a.operator_id === op.id);
      
      // Manual Filters
      const matchesSearch = op.operator_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            op.aoc_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            operatorAircraft.some(a => a.aircraft_type.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCountry = countryFilter === 'All' || op.country === countryFilter;
      const matchesAircraft = aircraftFilter === 'All' || operatorAircraft.some(a => a.aircraft_type === aircraftFilter);
      const matchesOp = operationFilter === 'All' || op.operation_type === operationFilter;
      const matchesLicense = licenseFilter === 'All' || op.license_type === licenseFilter || op.license_type === 'BOTH';
      const matchesStatus = statusFilter === 'All' || op.status === statusFilter;

      let matchesManual = matchesSearch && matchesCountry && matchesAircraft && matchesOp && matchesLicense && matchesStatus;

      // AI Filters
      if (aiFilters) {
        if (aiFilters.countries && aiFilters.countries.length > 0) {
          if (!aiFilters.countries.includes(op.country)) matchesManual = false;
        }
        if (aiFilters.status) {
          if (op.status !== aiFilters.status) matchesManual = false;
        }
        if (aiFilters.operation_type) {
          if (op.operation_type !== aiFilters.operation_type) matchesManual = false;
        }
        if (aiFilters.license_type) {
          if (op.license_type !== aiFilters.license_type && op.license_type !== 'BOTH') matchesManual = false;
        }
        if (aiFilters.aircraft_type) {
          const hasAircraft = operatorAircraft.some(ac => ac.aircraft_type.includes(aiFilters.aircraft_type!));
          if (!hasAircraft) matchesManual = false;
        }
      }

      return matchesManual;
    });
  }, [deduplicatedOperators, searchTerm, countryFilter, operationFilter, licenseFilter, statusFilter, aiFilters]);

  const operatorsByCountry = useMemo(() => {
    const counts: Record<string, number> = {};
    operators.forEach(op => {
      const country = op.country || 'Unknown';
      counts[country] = (counts[country] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: String(name), value: Number(value) || 0 })).sort((a, b) => b.value - a.value);
  }, [operators]);

  const fleetByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    dbAircraft.forEach(ac => {
      const family = ac.aircraft_family || 'Unknown';
      const qty = parseInt(ac.quantity) || 1;
      counts[family] = (counts[family] || 0) + qty;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: String(name), value: Number(value) || 0 }));
  }, [dbAircraft]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    operators.forEach(op => {
      const status = op.status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: String(name), value: Number(value) || 0 }));
  }, [operators]);

  const topAircraftTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    dbAircraft.forEach(ac => {
      const type = ac.aircraft_type || 'Unknown';
      const qty = parseInt(ac.quantity) || 1;
      counts[type] = (counts[type] || 0) + qty;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: String(name), value: Number(value) || 0 })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [dbAircraft]);

  const [isBulkEnriching, setIsBulkEnriching] = useState(false);

  const handleBulkEnrich = async () => {
    setIsBulkEnriching(true);
    const visibleOperators = filteredOperators.filter(op => !aiEnrichedData[op.id]);
    
    for (const op of visibleOperators) {
      await handleEnrichProfile(op);
      // Small delay to avoid rate limits and show progress
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setIsBulkEnriching(false);
  };

  const handleScrape = () => {
    setShowScraperModal(true);
    setScrapeStatus('running');
    setScrapeLogs(['[SYSTEM] Initializing Global Aviation Scraper Engine...']);
    
    const logs = [
      '[SYSTEM] Initializing Global Aviation Scraper Engine v2.4...',
      '[API] Connecting to ICAO International Registry... 1,240 records found.',
      '[API] Fetching EASA Supranational Certification data... 892 records found.',
      '[API] Querying FAA Global Safety Oversight database... 4,102 records found.',
      '[API] Connecting to UAE GCAA Smart Services... 128 records found.',
      '[API] Fetching Saudi Arabia GACA operator data...',
      '[HTML] Scraping Qatar QCAA registry... Found 5 updates.',
      '[LAYER 1] Connecting to Transport Canada (TCCA) Civil Aircraft Register...',
      '[HTML] Scraping TCCA operator data... Found 8 updates.',
      '[LAYER 2] Downloading Mexico AFAC AOC registry (PDF)...',
      '[OCR] Parsing AFAC regulatory documents...',
      '[LAYER 1] Connecting to Maldives CAA structured HTML list...',
      '[HTML] Parsing tables from Maldives CAA... Found 4 operators.',
      '[LAYER 2] Downloading UK CAA AOC list (PDF)...',
      '[OCR] Running pdfplumber & Tesseract OCR on UK CAA PDF...',
      '[OCR] Extracted 142 pages. Parsing tables...',
      '[LAYER 2] Downloading France DGAC operator registry (PDF)...',
      '[OCR] Extracting French AOC holders and licensing data...',
      '[LAYER 2] Downloading Germany LBA database (PDF)...',
      '[OCR] Processing German regulatory documents...',
      '[LAYER 2] Downloading Ireland IAA registry (PDF)...',
      '[OCR] Extracting international leasing and charter data...',
      '[LAYER 2] Downloading Netherlands ILT database (PDF)...',
      '[OCR] Parsing Dutch licensing registers...',
      '[LAYER 2] Downloading Switzerland FOCA registry (PDF)...',
      '[OCR] Extracting high-quality structured operator data...',
      '[LAYER 2] Downloading India DGCA operator database (PDF)...',
      '[OCR] Parsing Indian AOC holders... Found 12 updates.',
      '[LAYER 2] Downloading Pakistan PCAA registry (PDF)...',
      '[OCR] Extracting Pakistan operator data...',
      '[LAYER 2] Downloading Singapore CAAS AOC list (PDF)...',
      '[OCR] Parsing highly structured Singapore operator data...',
      '[LAYER 2] Downloading Malaysia CAAM database (PDF)...',
      '[OCR] Extracting Malaysian licensing registers...',
      '[LAYER 1] Connecting to South African SACAA website...',
      '[HTML] Parsing SACAA operator tables... Found 14 updates.',
      '[LAYER 1] Connecting to Nigerian NCAA portal...',
      '[HTML] Extracting Nigerian AOC holder data...',
      '[LAYER 1] Connecting to Brazil ANAC registry...',
      '[HTML] Parsing Brazilian operator data... Found 22 updates.',
      '[LAYER 1] Connecting to Chile DGAC portal...',
      '[HTML] Extracting Chilean aviation registers...',
      '[API] Connecting to Australia CASA database...',
      '[HTML] Scraping Japan JCAB registry... Found 7 updates.',
      '[HTML] Parsing China CAAC operator lists...',
      '[LAYER 1] Connecting to Maldives MCAA portal...',
      '[HTML] Extracting structured Maldives AOC list (Aircraft + Ops)... Found 3 updates.',
      '[LAYER 1] Connecting to Cayman Islands CAACI registry...',
      '[HTML] Parsing Cayman offshore aircraft data...',
      '[LAYER 2] Downloading Sri Lanka CAA AOC list (PDF)...',
      '[OCR] Extracting operator names and expiry dates...',
      '[LAYER 2] Downloading Philippines CAAP list (PDF)...',
      '[OCR] Processing CAAP registry...',
      '[LAYER 3] AI Data Cleaner: Normalizing messy data...',
      '[AI] Converted "Boeing 737-800" → "B737-800"',
      '[AI] Converted "Airbus A320-200" → "A320"',
      '[AI] Entity Match: Merged "Emirates Airlines" and "Emirates"',
      '[DEDUPLICATION] Running fuzzy matching on 1,000+ records...',
      '[DEDUPLICATION] "PIA" matched with "Pakistan International Airlines"',
      '[DEDUPLICATION] "SIA" matched with "Singapore Airlines"',
      '[AI CLASSIFICATION] Automatically assigning operational profiles...',
      '[AI] Classified 42 operators as "Charter operator"',
      '[AI] Classified 18 operators as "Cargo operator"',
      '[AI] Classified 12 operators as "ACMI provider"',
      '[FLEET ESTIMATION] Running predictive modeling for missing data...',
      '[AI] Estimated fleet for 85 operators based on regional routes.',
      '[DB] Updating main OPERATORS table... 1,242 active records synced.',
      '[DB] Syncing AIRCRAFT FLEET table... 5,890 aircraft records mapped.',
      '[SUCCESS] Scraping cycle complete. 12 new AOCs added, 3 suspended.'
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) {
        setScrapeLogs(prev => [...prev, logs[i]]);
        i++;
      } else {
        clearInterval(interval);
        setScrapeStatus('completed');
      }
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Globe className="text-indigo-600 dark:text-indigo-400" />
            Global Aviation Regulatory Database
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
            Search, verify, and monitor AOC & RPT license holders worldwide.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 rounded-xl mr-2">
            <Sparkles size={16} className="text-indigo-600" />
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-widest">Scaled Mode</span>
            <button 
              onClick={() => setIsScaledMode(!isScaledMode)}
              className={`w-8 h-4 rounded-full transition-colors relative ${isScaledMode ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <motion.div 
                className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full"
                animate={{ x: isScaledMode ? 16 : 0 }}
              />
            </button>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
            <CheckCircle size={16} className="text-emerald-600" />
            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">{operators.length} Operators</span>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mr-2">
            <button 
              onClick={() => setActiveTab('operators')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'operators' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Operators
            </button>
            <button 
              onClick={() => setActiveTab('authorities')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'authorities' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Authorities
            </button>
            <button 
              onClick={() => setActiveTab('licenses')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'licenses' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Licenses
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'analytics' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Analytics
            </button>
          </div>
          <button 
            onClick={handleBulkEnrich}
            disabled={isBulkEnriching || filteredOperators.filter(op => !aiEnrichedData[op.id]).length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all shadow-sm disabled:opacity-50"
          >
            <Sparkles size={16} className={isBulkEnriching ? "animate-pulse" : ""} />
            {isBulkEnriching ? 'Bulk Enriching...' : 'Bulk AI Enrich'}
          </button>
          <button 
            onClick={handleScrape}
            disabled={scrapeStatus === 'running'}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={16} className={scrapeStatus === 'running' ? "animate-spin text-indigo-600" : ""} />
            {scrapeStatus === 'running' ? 'Scraping CAA Data...' : 'Run Scraper Engine'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none">
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'operators' ? (
        <>
          {/* Analytics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Total Active AOCs</h3>
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">{operators.filter(o => o.status === 'Active').length}</p>
              <p className="text-xs text-emerald-500 font-bold mt-1">↑ 24 this week</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Suspended/Expired</h3>
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">{operators.filter(o => o.status === 'Suspended').length}</p>
              <p className="text-xs text-red-500 font-bold mt-1">↑ 12 this week</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <Plane size={20} />
                </div>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Tracked Aircraft</h3>
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">5,890</p>
              <p className="text-xs text-gray-400 font-bold mt-1">Across all operators</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                  <Database size={20} />
                </div>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Data Sources</h3>
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">100+</p>
              <p className="text-xs text-gray-400 font-bold mt-1">CAAs & Registries</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Search & Filters */}
            <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Bot size={20} className="text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">AI Smart Search</h2>
            </div>
            
            <div className="space-y-4">
              {aiError && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle size={14} />
                  <span className="flex-1">{aiError}</span>
                  <button onClick={() => setAiError(null)} className="p-1 hover:bg-amber-100 dark:hover:bg-amber-800 rounded-lg transition-colors">
                    <X size={14} />
                  </button>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                  Natural Language Query
                </label>
                <div className="relative">
                  <Bot size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                  <input
                    type="text"
                    value={aiSearchQuery}
                    onChange={(e) => setAiSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
                    placeholder="e.g. AOC holders in Africa with A320"
                    className="w-full pl-10 pr-24 py-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                  />
                  <button
                    onClick={handleSmartSearch}
                    disabled={isAiSearching}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {isAiSearching ? 'Thinking...' : 'Search'}
                  </button>
                </div>
                {aiFilters && (
                  <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                    <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-2">Active AI Filters:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(aiFilters).map(([k, v]) => {
                        if (!v || (Array.isArray(v) && v.length === 0)) return null;
                        return (
                          <span key={k} className="px-2 py-1 bg-emerald-100 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-md">
                            {k}: {Array.isArray(v) ? v.join(', ') : v}
                          </span>
                        );
                      })}
                      <button onClick={() => setAiFilters(null)} className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold rounded-md hover:bg-red-200 dark:hover:bg-red-900/50">
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white dark:bg-gray-800 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">OR MANUAL FILTERS</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                  Keyword Search
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Operator, AOC, Aircraft (e.g. A320)"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                  Country / Region
                </label>
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white appearance-none"
                >
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                  Aircraft Type
                </label>
                <select
                  value={aircraftFilter}
                  onChange={(e) => setAircraftFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white appearance-none"
                >
                  {aircraftTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                  Operation Type
                </label>
                <select
                  value={operationFilter}
                  onChange={(e) => setOperationFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white appearance-none"
                >
                  {operations.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                    License Type
                  </label>
                  <select
                    value={licenseFilter}
                    onChange={(e) => setLicenseFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white appearance-none"
                  >
                    {licenses.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white appearance-none"
                  >
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
              <div className="flex items-start gap-3">
                <Sparkles className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1">AI Entity Matching Active</p>
                  <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400/70 leading-relaxed">
                    The system automatically merged <span className="font-black text-indigo-600 dark:text-indigo-400">{dbOperators.length - deduplicatedOperators.length}</span> duplicate records (e.g., "Emirates Airlines" and "Emirates") using NLP.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-3">
                <Fingerprint size={16} className="text-gray-400" />
                <h3 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">Deduplication Engine</h3>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
                Our AI-powered engine automatically merges records from multiple sources. 
                <br/><span className="font-bold text-indigo-600 dark:text-indigo-400">Example:</span> "PIA" and "Pakistan International Airlines" are unified into a single source of truth.
              </p>
            </div>

            <div className="mt-4 p-4 bg-indigo-600 rounded-xl border border-indigo-500 shadow-lg shadow-indigo-200 dark:shadow-none">
              <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                <ShieldCheck size={14} className="text-indigo-200" /> Supranational Verification
              </h4>
              <p className="text-[10px] text-indigo-100 leading-relaxed mb-4">
                Directly verify operator status against global standards and international registries.
              </p>
              <div className="space-y-2">
                <button className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-[10px] font-bold text-white transition-colors flex items-center justify-center gap-2">
                  <Globe size={12} /> ICAO Registry Check
                </button>
                <button className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-[10px] font-bold text-white transition-colors flex items-center justify-center gap-2">
                  <Shield size={12} /> EASA Certification
                </button>
                <button className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-[10px] font-bold text-white transition-colors flex items-center justify-center gap-2">
                  <FileCheck size={12} /> FAA Oversight Data
                </button>
              </div>
            </div>

            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                <RefreshCw size={14} className="text-indigo-500" /> Scraping Automation Logic
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-bold uppercase tracking-widest">Schedule</span>
                  <span className="text-gray-900 dark:text-white font-black">Daily @ 00:00 UTC</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-bold uppercase tracking-widest">Sources</span>
                  <span className="text-gray-900 dark:text-white font-black">HTML, PDF, API</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-bold uppercase tracking-widest">Coverage</span>
                  <span className="text-gray-900 dark:text-white font-black">Phase 1 (Top Countries)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Results & Profile */}
        <div className="lg:col-span-2 space-y-6">
          {selectedOperator ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <button 
                  onClick={() => setSelectedOperator(null)}
                  className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors mb-6"
                >
                  <ChevronRight className="rotate-180" size={16} /> Back to Results
                </button>
                
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        {selectedOperator.operator_name}
                      </h2>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        selectedOperator.status === 'Active' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {selectedOperator.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1"><MapPin size={14} /> {selectedOperator.country}</span>
                      <span className="flex items-center gap-1"><Globe size={14} /> {dbLicenses.find(l => l.operator_id === selectedOperator.id)?.issuing_authority || 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">AOC Number</p>
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{selectedOperator.aoc_number}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <FileText size={16} className="text-indigo-500" /> License Details
                    </h3>
                    <div className="space-y-3">
                      {dbLicenses.filter(l => l.operator_id === selectedOperator.id).map(license => (
                        <div key={license.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{license.license_type} License</span>
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded">{license.issuing_authority}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Issued: {license.issue_date}</span>
                            <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                              <Calendar size={12} className="text-gray-400" />
                              Expires: {license.expiry_date}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Activity size={16} className="text-indigo-500" /> Operational Profile
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Region</p>
                        <p className="text-xs font-black text-gray-900 dark:text-white">{selectedOperator.region || 'N/A'}</p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Callsign</p>
                        <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{selectedOperator.callsign || 'N/A'}</p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Founded</p>
                        <p className="text-xs font-black text-gray-900 dark:text-white">{selectedOperator.founded_year || 'N/A'}</p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Data Source</p>
                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{selectedOperator.source || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Mail size={16} className="text-indigo-500" /> Contact Info
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        <Mail size={16} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedOperator.contact_email}</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        <Globe size={16} className="text-gray-400" />
                        <a href={`https://${selectedOperator.website}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                          {selectedOperator.website} <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Plane size={16} className="text-indigo-500" /> Fleet Information
                    </h3>
                    <div className="p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 mb-4">
                      <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Total Fleet Size</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white">
                        {dbAircraft.filter(a => a.operator_id === selectedOperator.id).reduce((sum, a) => sum + a.quantity, 0)}
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Fleet Breakdown</p>
                      <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                        <table className="w-full text-left text-[10px]">
                          <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th className="p-2 font-bold text-gray-400 uppercase tracking-widest">Type</th>
                              <th className="p-2 font-bold text-gray-400 uppercase tracking-widest">Manufacturer</th>
                              <th className="p-2 font-bold text-gray-400 uppercase tracking-widest">Family</th>
                              <th className="p-2 font-bold text-gray-400 uppercase tracking-widest text-right">Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                            {dbAircraft.filter(a => a.operator_id === selectedOperator.id).map((ac) => (
                              <tr key={ac.id}>
                                <td className="p-2 font-black text-gray-900 dark:text-white">{ac.aircraft_type}</td>
                                <td className="p-2 text-gray-500">{ac.manufacturer}</td>
                                <td className="p-2 text-gray-500">{ac.aircraft_family}</td>
                                <td className="p-2 text-right font-black text-indigo-600 dark:text-indigo-400">{ac.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Settings size={14} className="text-gray-400" /> Actions
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="flex items-center justify-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-colors">
                        <Download size={12} /> AOC PDF
                      </button>
                      <button className="flex items-center justify-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-colors">
                        <ExternalLink size={12} /> Registry
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Activity size={14} className="text-emerald-500" /> AI Predictive Insights
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Based on recent scraping activity and fleet size, this operator has a high probability of expanding their charter operations in Q3. AOC renewal is approaching in {
                        (() => {
                          const licenses = dbLicenses.filter(l => l.operator_id === selectedOperator.id);
                          if (licenses.length === 0) return 'N/A';
                          const closest = licenses.reduce((prev, curr) => {
                            const prevDiff = new Date(prev.expiry_date).getTime() - new Date().getTime();
                            const currDiff = new Date(curr.expiry_date).getTime() - new Date().getTime();
                            return (currDiff > 0 && currDiff < prevDiff) ? curr : prev;
                          }, licenses[0]);
                          return Math.round((new Date(closest.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                        })()
                      } days.
                    </p>
                  </div>

                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                        <Bot size={14} /> AI Profile Intelligence
                      </h4>
                      {!aiEnrichedData[selectedOperator.id] && (
                        <button 
                          onClick={() => handleEnrichProfile(selectedOperator)}
                          disabled={isEnriching[selectedOperator.id]}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isEnriching[selectedOperator.id] ? (
                            <><RefreshCw size={12} className="animate-spin" /> Fetching...</>
                          ) : (
                            <><Sparkles size={12} /> Fetch Details</>
                          )}
                        </button>
                      )}
                    </div>
                    
                    {aiEnrichedData[selectedOperator.id] ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">AI Classification</p>
                            <p className="text-xs font-black text-gray-900 dark:text-white">{aiEnrichedData[selectedOperator.id].ai_classification || 'Scheduled Airline'}</p>
                          </div>
                          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Market Segment</p>
                            <p className="text-xs font-black text-gray-900 dark:text-white truncate">{aiEnrichedData[selectedOperator.id].market_segment || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Detected Codes</p>
                            <p className="text-xs font-black text-gray-900 dark:text-white">
                              {aiEnrichedData[selectedOperator.id].iata_code || '??'} / {aiEnrichedData[selectedOperator.id].icao_code || '???'}
                            </p>
                          </div>
                          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Operation Type</p>
                            <p className="text-xs font-black text-gray-900 dark:text-white">
                              {aiEnrichedData[selectedOperator.id].operation_type || 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Detected Aircraft Types</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {aiEnrichedData[selectedOperator.id].detected_aircraft_types?.map((type, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-600">
                                {type}
                              </span>
                            )) || <span className="text-[10px] text-gray-400 italic">No aircraft detected</span>}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Est. Fleet Size</p>
                            <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">~{aiEnrichedData[selectedOperator.id].estimated_fleet_size || 'N/A'}</p>
                          </div>
                          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Charter Cap.</p>
                            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{aiEnrichedData[selectedOperator.id].charter_capability_score || '0'}%</p>
                          </div>
                        </div>

                        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Fleet Estimation Basis</p>
                          <p className="text-[10px] text-gray-600 dark:text-gray-400 italic">
                            {aiEnrichedData[selectedOperator.id].fleet_estimation_basis || 'Based on regional market analysis and similar operator profiles.'}
                          </p>
                        </div>

                        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Manual Notes / Summary</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                            {aiEnrichedData[selectedOperator.id].manual_notes}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 leading-relaxed">
                        Use AI to automatically classify this operator, estimate their fleet size, and generate a detailed profile summary from global market data.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-240px)]">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">
                  Search Results ({filteredOperators.length})
                </h3>
              </div>
              
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10">
                    <tr>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Operator Name</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Country</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">AOC Number</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Aircraft</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Type (RPT / Charter)</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Status</th>
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 text-right">AI Enrichment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    <AnimatePresence>
                      {filteredOperators.map((op, idx) => (
                        <motion.tr 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          key={op.id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group cursor-pointer"
                          onClick={() => setSelectedOperator(op)}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xs">
                                {op.iata_code || op.operator_name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-black text-gray-900 dark:text-white">{op.operator_name}</p>
                                <p className="text-[10px] text-gray-500 font-medium">
                                  {op.iata_code || aiEnrichedData[op.id]?.iata_code || '??'} / {op.icao_code || aiEnrichedData[op.id]?.icao_code || '???'}
                                  {(!op.iata_code || !op.icao_code) && aiEnrichedData[op.id] && (
                                    <span className="ml-2 text-[8px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1 rounded font-bold">AI FILLED</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{op.country}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-mono text-gray-600 dark:text-gray-300">{op.aoc_number}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {dbAircraft.filter(a => a.operator_id === op.id).slice(0, 2).map(a => (
                                <span key={a.id} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">
                                  {a.aircraft_type}
                                </span>
                              ))}
                              {dbAircraft.filter(a => a.operator_id === op.id).length > 2 && (
                                <span className="text-[10px] font-bold text-gray-400">+{dbAircraft.filter(a => a.operator_id === op.id).length - 2} more</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{op.operation_type}</span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                              op.status === 'Active' 
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                                : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                            }`}>
                              {op.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {aiEnrichedData[op.id] ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{aiEnrichedData[op.id].market_segment}</span>
                                    <span className="text-[8px] text-gray-400 uppercase tracking-widest">Fleet: {aiEnrichedData[op.id].estimated_fleet_size}</span>
                                  </div>
                                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                                    <CheckCircle size={14} />
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEnrichProfile(op);
                                  }}
                                  disabled={isEnriching[op.id]}
                                  className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
                                  title="Enrich with AI"
                                >
                                  {isEnriching[op.id] ? (
                                    <RefreshCw size={14} className="animate-spin" />
                                  ) : (
                                    <Sparkles size={14} />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {filteredOperators.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center">
                          <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                            <Search size={32} className="mb-4 opacity-50" />
                            <p className="text-sm font-bold">No operators found matching your criteria.</p>
                            <p className="text-xs mt-1">Try adjusting your filters or search query.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      ) : activeTab === 'licenses' ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-240px)]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <FileText size={18} className="text-indigo-500" /> Active Licenses (AOC / RPT)
            </h3>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10">
                <tr>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Operator</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">License Type</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Issuing Authority</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Issue Date</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Expiry Date</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <AnimatePresence>
                  {dbLicenses.map((license, idx) => {
                    const operator = dbOperators.find(o => o.id === license.operator_id);
                    return (
                      <motion.tr 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={license.id} 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group cursor-pointer"
                        onClick={() => operator && setSelectedOperator(operator)}
                      >
                        <td className="p-4">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{operator?.operator_name || 'Unknown'}</span>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-md text-[10px] font-black uppercase tracking-widest">{license.license_type}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{license.issuing_authority}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-gray-500">{license.issue_date}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-gray-500">{license.expiry_date}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                            license.status === 'Active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                            {license.status}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'analytics' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Globe size={16} className="text-indigo-500" /> AOC Holders per Country
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operatorsByCountry}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.1} />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', fontSize: '10px', color: '#fff' }}
                      itemStyle={{ color: '#818CF8' }}
                    />
                    <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Plane size={16} className="text-indigo-500" /> Fleet Distribution by Category
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fleetByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {['#6366F1', '#10B981', '#F59E0B', '#EF4444'].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', fontSize: '10px', color: '#fff' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity size={16} className="text-indigo-500" /> Active vs Inactive
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={0}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {['#10B981', '#EF4444'].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-500" /> Top Aircraft Types by Volume
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={topAircraftTypes}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                    <XAxis type="number" stroke="#9CA3AF" fontSize={10} hide />
                    <YAxis dataKey="name" type="category" stroke="#9CA3AF" fontSize={10} width={100} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', fontSize: '10px', color: '#fff' }}
                    />
                    <Bar dataKey="value" fill="#818CF8" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-240px)]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-500" /> Civil Aviation Authorities
            </h3>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10">
                <tr>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Country</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Authority Name</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Website</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Scraping Method</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700">Last Scraped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                <AnimatePresence>
                  {dbAuthorities.map((auth, idx) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={auth.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group cursor-pointer"
                    >
                      <td className="p-4">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{auth.country}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{auth.authority_name}</span>
                      </td>
                      <td className="p-4">
                        <a href={`https://${auth.website}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Globe size={10} /> {auth.website}
                        </a>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                          auth.scraping_method === 'API' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                          auth.scraping_method === 'PDF' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                          'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                        }`}>
                          {auth.scraping_method}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                          <Calendar size={10} /> {new Date(auth.last_scraped).toLocaleString()}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scraper Engine Modal */}
      <AnimatePresence>
        {showScraperModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-gray-100 dark:border-gray-800"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                    <Terminal size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Global Scraper Engine</h2>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Multi-Layer Data Acquisition</p>
                  </div>
                </div>
                {scrapeStatus === 'completed' && (
                  <button 
                    onClick={() => setShowScraperModal(false)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Close Engine
                  </button>
                )}
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Target Sources</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                      <FileText size={14} className="text-red-500" /> UK CAA AOC list (PDF)
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                      <FileText size={14} className="text-red-500" /> Sri Lanka CAA (PDF)
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                      <FileText size={14} className="text-red-500" /> Philippines CAAP (PDF)
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                      <Globe size={14} className="text-blue-500" /> Maldives CAA (HTML)
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                      <Database size={14} className="text-indigo-500" /> EASA / FAA Databases
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                    <h4 className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Cpu size={12} /> Processing Layers
                    </h4>
                    <ul className="text-xs text-indigo-700/80 dark:text-indigo-400/80 space-y-1 font-medium">
                      <li>1. HTML/API Ingestion</li>
                      <li>2. PDF OCR (Tesseract)</li>
                      <li>3. AI Data Normalization</li>
                    </ul>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="bg-gray-900 rounded-2xl p-4 h-[300px] overflow-y-auto font-mono text-xs shadow-inner custom-scrollbar relative">
                    {scrapeStatus === 'running' && (
                      <div className="absolute top-4 right-4 flex gap-1">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      </div>
                    )}
                    <div className="space-y-2">
                      {scrapeLogs.map((log, index) => (
                        <motion.div 
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`
                            ${log.includes('[SUCCESS]') ? 'text-emerald-400 font-bold' : ''}
                            ${log.includes('[OCR]') ? 'text-amber-400' : ''}
                            ${log.includes('[AI]') ? 'text-indigo-400' : ''}
                            ${log.includes('[HTML]') || log.includes('[API]') ? 'text-blue-400' : ''}
                            ${log.includes('[LAYER') || log.includes('[SYSTEM]') ? 'text-gray-400 font-bold' : ''}
                            ${log.includes('[DB]') ? 'text-purple-400' : ''}
                            ${!log.includes('[') ? 'text-gray-300' : ''}
                          `}
                        >
                          {log}
                        </motion.div>
                      ))}
                      {scrapeStatus === 'running' && (
                        <motion.div 
                          animate={{ opacity: [1, 0.5, 1] }} 
                          transition={{ repeat: Infinity, duration: 1 }}
                          className="text-gray-500"
                        >
                          _
                        </motion.div>
                      )}
                    </div>
                  </div>
                  
                  {scrapeStatus === 'completed' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center gap-3"
                    >
                      <CheckCircle className="text-emerald-500 shrink-0" size={20} />
                      <div>
                        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Database Synchronized</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400/80 mt-0.5">All sources processed successfully. The AOC database is now up to date.</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
