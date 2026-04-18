import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, Cpu, FileText, Globe, Database, 
  UploadCloud, CheckCircle, AlertTriangle, 
  Settings, Layers, Code, FileJson, ArrowRight,
  RefreshCw, Calendar, PlusCircle, XCircle, Activity,
  Search, MapPin, ChevronRight, Play, History, Sparkles, ShieldCheck,
  Target, TrendingUp, Zap, Building2, Plane
} from 'lucide-react';

const MOCK_AUTHORITIES = [
  { id: 'AUTH-001', country: 'Global', authority_name: 'International Civil Aviation Organization (ICAO)', website: 'icao.int', scraping_method: 'API', frequency: 'Daily', last_run: '2026-04-10 08:00', status: 'Healthy' },
  { id: 'AUTH-002', country: 'Europe', authority_name: 'European Union Aviation Safety Agency (EASA)', website: 'easa.europa.eu', scraping_method: 'API', frequency: 'Daily', last_run: '2026-04-10 08:00', status: 'Healthy' },
  { id: 'AUTH-006', country: 'UK', authority_name: 'Civil Aviation Authority (UK CAA)', website: 'caa.co.uk', scraping_method: 'PDF', frequency: 'Weekly', last_run: '2026-04-05 09:15', status: 'Healthy' },
  { id: 'AUTH-007', country: 'France', authority_name: 'Direction Générale de l’Aviation Civile (DGAC)', website: 'ecologie.gouv.fr/dgac', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-08 10:00', status: 'Healthy' },
  { id: 'AUTH-008', country: 'Germany', authority_name: 'Luftfahrt-Bundesamt (LBA)', website: 'lba.de', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-07 11:30', status: 'Healthy' },
  { id: 'AUTH-009', country: 'Italy', authority_name: 'Ente Nazionale per l\'Aviazione Civile (ENAC)', website: 'enac.gov.it', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-06 09:00', status: 'Healthy' },
  { id: 'AUTH-010', country: 'Ireland', authority_name: 'Irish Aviation Authority (IAA)', website: 'iaa.ie', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-09 15:45', status: 'Healthy' },
  { id: 'AUTH-011', country: 'Netherlands', authority_name: 'Civil Aviation Authority of the Netherlands (ILT)', website: 'ilent.nl', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-05 14:20', status: 'Healthy' },
  { id: 'AUTH-012', country: 'Norway', authority_name: 'Civil Aviation Authority Norway', website: 'luftfartstilsynet.no', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-08 12:00', status: 'Healthy' },
  { id: 'AUTH-013', country: 'Sweden', authority_name: 'Swedish Transport Agency', website: 'transportstyrelsen.se', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-07 10:30', status: 'Healthy' },
  { id: 'AUTH-014', country: 'Switzerland', authority_name: 'Federal Office of Civil Aviation (FOCA)', website: 'bazl.admin.ch', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-09 08:15', status: 'Healthy' },
  { id: 'AUTH-003', country: 'USA', authority_name: 'Federal Aviation Administration (FAA)', website: 'faa.gov', scraping_method: 'API', frequency: 'Daily', last_run: '2026-04-10 08:00', status: 'Healthy' },
  { id: 'AUTH-015', country: 'UAE', authority_name: 'General Civil Aviation Authority (GCAA)', website: 'gcaa.gov.ae', scraping_method: 'Navigation', frequency: 'Daily', last_run: '2026-04-10 06:00', status: 'Healthy' },
  { id: 'AUTH-016', country: 'Saudi Arabia', authority_name: 'General Authority of Civil Aviation (GACA)', website: 'gaca.gov.sa', scraping_method: 'HTML', frequency: 'Daily', last_run: '2026-04-10 05:30', status: 'Healthy' },
  { id: 'AUTH-017', country: 'Qatar', authority_name: 'Qatar Civil Aviation Authority (QCAA)', website: 'caa.gov.qa', scraping_method: 'HTML', frequency: 'Daily', last_run: '2026-04-10 04:00', status: 'Healthy' },
  { id: 'AUTH-018', country: 'Bahrain', authority_name: 'Civil Aviation Affairs Bahrain', website: 'mtt.gov.bh', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-09 11:00', status: 'Healthy' },
  { id: 'AUTH-019', country: 'Kuwait', authority_name: 'Directorate General of Civil Aviation Kuwait', website: 'dgca.gov.kw', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-08 10:30', status: 'Healthy' },
  { id: 'AUTH-020', country: 'Oman', authority_name: 'Civil Aviation Authority Oman', website: 'caa.gov.om', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-07 09:15', status: 'Healthy' },
  { id: 'AUTH-021', country: 'Pakistan', authority_name: 'Pakistan Civil Aviation Authority (PCAA)', website: 'caapakistan.com.pk', scraping_method: 'PDF', frequency: 'Weekly', last_run: '2026-04-03 11:45', status: 'Warning' },
  { id: 'AUTH-022', country: 'India', authority_name: 'Directorate General of Civil Aviation India (DGCA)', website: 'dgca.gov.in', scraping_method: 'Navigation', frequency: 'Daily', last_run: '2026-04-10 02:30', status: 'Healthy' },
  { id: 'AUTH-023', country: 'Bangladesh', authority_name: 'Civil Aviation Authority of Bangladesh (CAAB)', website: 'caab.gov.bd', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-05 10:00', status: 'Healthy' },
  { id: 'AUTH-024', country: 'Sri Lanka', authority_name: 'Civil Aviation Authority of Sri Lanka (CAASL)', website: 'caa.lk', scraping_method: 'PDF', frequency: 'Weekly', last_run: '2026-04-08 09:30', status: 'Healthy' },
  { id: 'AUTH-025', country: 'Nepal', authority_name: 'Civil Aviation Authority Nepal (CAAN)', website: 'caanepal.gov.np', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-06 14:00', status: 'Healthy' },
  { id: 'AUTH-026', country: 'Singapore', authority_name: 'Civil Aviation Authority of Singapore (CAAS)', website: 'caas.gov.sg', scraping_method: 'PDF', frequency: 'Weekly', last_run: '2026-04-10 09:00', status: 'Healthy' },
  { id: 'AUTH-027', country: 'Malaysia', authority_name: 'Civil Aviation Authority of Malaysia (CAAM)', website: 'caam.gov.my', scraping_method: 'PDF', frequency: 'Weekly', last_run: '2026-04-08 14:00', status: 'Healthy' },
  { id: 'AUTH-028', country: 'Indonesia', authority_name: 'Directorate General of Civil Aviation Indonesia', website: 'hubud.dephub.go.id', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-07 10:30', status: 'Healthy' },
  { id: 'AUTH-029', country: 'Thailand', authority_name: 'Civil Aviation Authority of Thailand (CAAT)', website: 'caat.or.th', scraping_method: 'PDF', frequency: 'Weekly', last_run: '2026-04-09 11:45', status: 'Healthy' },
  { id: 'AUTH-030', country: 'Philippines', authority_name: 'Civil Aviation Authority of the Philippines (CAAP)', website: 'caap.gov.ph', scraping_method: 'PDF', frequency: 'Weekly', last_run: '2026-04-05 16:20', status: 'Healthy' },
  { id: 'AUTH-031', country: 'Vietnam', authority_name: 'Civil Aviation Authority of Vietnam (CAAV)', website: 'caa.gov.vn', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-06 08:00', status: 'Healthy' },
  { id: 'AUTH-032', country: 'South Africa', authority_name: 'South African Civil Aviation Authority (SACAA)', website: 'caa.co.za', scraping_method: 'HTML', frequency: 'Daily', last_run: '2026-04-10 09:30', status: 'Healthy' },
  { id: 'AUTH-033', country: 'Nigeria', authority_name: 'Nigerian Civil Aviation Authority (NCAA)', website: 'ncaa.gov.ng', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-08 11:00', status: 'Healthy' },
  { id: 'AUTH-034', country: 'Kenya', authority_name: 'Kenya Civil Aviation Authority (KCAA)', website: 'kcaa.or.ke', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-07 14:20', status: 'Healthy' },
  { id: 'AUTH-035', country: 'Egypt', authority_name: 'Egyptian Civil Aviation Authority (ECAA)', website: 'civilaviation.gov.eg', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-09 10:00', status: 'Healthy' },
  { id: 'AUTH-036', country: 'Ghana', authority_name: 'Ghana Civil Aviation Authority (GCAA)', website: 'gcaa.com.gh', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-05 12:45', status: 'Healthy' },
  { id: 'AUTH-037', country: 'Ethiopia', authority_name: 'Ethiopian Civil Aviation Authority (ECAA)', website: 'ecaa.gov.et', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-06 15:30', status: 'Healthy' },
  { id: 'AUTH-038', country: 'Argentina', authority_name: 'Administración Nacional de Aviación Civil (ANAC)', website: 'anac.gov.ar', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-08 14:00', status: 'Healthy' },
  { id: 'AUTH-039', country: 'Brazil', authority_name: 'Agência Nacional de Aviação Civil (ANAC)', website: 'gov.br/anac', scraping_method: 'HTML', frequency: 'Daily', last_run: '2026-04-10 07:30', status: 'Healthy' },
  { id: 'AUTH-040', country: 'Chile', authority_name: 'Dirección General de Aeronáutica Civil Chile (DGAC)', website: 'dgac.gob.cl', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-09 11:00', status: 'Healthy' },
  { id: 'AUTH-041', country: 'Colombia', authority_name: 'Aerocivil Colombia', website: 'aerocivil.gov.co', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-07 10:30', status: 'Healthy' },
  { id: 'AUTH-042', country: 'Peru', authority_name: 'Dirección General de Aeronáutica Civil Peru (DGAC)', website: 'gob.pe/mtc', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-05 16:20', status: 'Healthy' },
  { id: 'AUTH-043', country: 'China', authority_name: 'Civil Aviation Administration of China (CAAC)', website: 'caac.gov.cn', scraping_method: 'HTML', frequency: 'Daily', last_run: '2026-04-10 05:00', status: 'Healthy' },
  { id: 'AUTH-044', country: 'Japan', authority_name: 'Japan Civil Aviation Bureau (JCAB)', website: 'mlit.go.jp/koku', scraping_method: 'HTML', frequency: 'Daily', last_run: '2026-04-10 04:30', status: 'Healthy' },
  { id: 'AUTH-045', country: 'Australia', authority_name: 'Civil Aviation Safety Authority (CASA)', website: 'casa.gov.au', scraping_method: 'API', frequency: 'Daily', last_run: '2026-04-10 08:00', status: 'Healthy' },
  { id: 'AUTH-046', country: 'New Zealand', authority_name: 'Civil Aviation Authority of New Zealand (CAA)', website: 'aviation.govt.nz', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-09 12:00', status: 'Healthy' },
  { id: 'AUTH-047', country: 'Taiwan', authority_name: 'Civil Aeronautics Administration Taiwan (CAA)', website: 'caa.gov.tw', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-08 10:00', status: 'Healthy' },
  { id: 'AUTH-048', country: 'Maldives', authority_name: 'Maldives Civil Aviation Authority (MCAA)', website: 'caa.gov.mv', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-10 10:00', status: 'Healthy' },
  { id: 'AUTH-049', country: 'Cayman Islands', authority_name: 'Civil Aviation Authority Cayman Islands (CAACI)', website: 'caacayman.com', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-09 15:00', status: 'Healthy' },
  { id: 'AUTH-050', country: 'Malta', authority_name: 'TM-CAD Malta', website: 'transport.gov.mt', scraping_method: 'HTML', frequency: 'Weekly', last_run: '2026-04-07 16:20', status: 'Healthy' }
];

const RECENT_INTELLIGENCE = [
  { id: 1, type: 'NEW_AOC', operator: 'SkyLink Express', country: 'USA', date: '2026-04-10', details: 'Part 121 Certificate Issued' },
  { id: 2, type: 'SUSPENDED', operator: 'Blue Horizon Air', country: 'UK', date: '2026-04-09', details: 'Safety Compliance Audit Failure' },
  { id: 3, type: 'EXPIRED', operator: 'Desert Wings', country: 'UAE', date: '2026-04-08', details: 'License Renewal Overdue' },
  { id: 4, type: 'NEW_AOC', operator: 'Indus Aero', country: 'Pakistan', date: '2026-04-07', details: 'Charter Operations Approved' }
];

export default function AOCScraperEngine() {
  const [testFile, setTestFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionLogs, setExtractionLogs] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<any[] | null>(null);

  // Workflow Simulator State
  const [selectedCountry, setSelectedCountry] = useState('UK');
  const [workflowStep, setWorkflowStep] = useState<number>(-1);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [workflowLogs, setWorkflowLogs] = useState<string[]>([]);
  const [isMassScraping, setIsMassScraping] = useState(false);
  const [massScrapeProgress, setMassScrapeProgress] = useState(0);
  const [massScrapeResults, setMassScrapeResults] = useState<{ operators: number, aircraft: number, licenses: number } | null>(null);

  const workflowSteps = [
    { id: 0, label: 'Select Country', icon: MapPin },
    { id: 1, label: 'Identify Authority', icon: ShieldCheck },
    { id: 2, label: 'Detect Source Type', icon: FileText },
    { id: 3, label: 'Scrape Data', icon: RefreshCw },
    { id: 4, label: 'Normalize (AI)', icon: Sparkles },
    { id: 5, label: 'Store in DB', icon: Database },
    { id: 6, label: 'Delta Comparison', icon: Activity },
    { id: 7, label: 'Update Changes', icon: CheckCircle }
  ];

  const runWorkflow = () => {
    // ... existing runWorkflow logic
  };

  const runMassScrape = () => {
    setIsMassScraping(true);
    setMassScrapeProgress(0);
    setMassScrapeResults(null);
    setWorkflowLogs(['[SYSTEM] Initializing Global Mass Scrape (100+ URLs)...']);

    const totalUrls = 100;
    const batchSize = 10;
    let currentUrl = 0;

    const interval = setInterval(() => {
      if (currentUrl < totalUrls) {
        currentUrl += batchSize;
        const progress = (currentUrl / totalUrls) * 100;
        setMassScrapeProgress(progress);
        
        const randomCountry = MOCK_AUTHORITIES[Math.floor(Math.random() * MOCK_AUTHORITIES.length)].country;
        setWorkflowLogs(prev => [
          ...prev, 
          `[SCRAPE] Batch ${currentUrl/batchSize}/${totalUrls/batchSize} complete. Fetched data from ${randomCountry} and 9 other sources.`
        ]);
      } else {
        clearInterval(interval);
        setIsMassScraping(false);
        setMassScrapeResults({
          operators: 742,
          aircraft: 3850,
          licenses: 812
        });
        setWorkflowLogs(prev => [
          ...prev, 
          '[SUCCESS] Mass Scrape Complete.',
          '[SYSTEM] 742 New Operators identified.',
          '[SYSTEM] 3,850 Aircraft records normalized.',
          '[SYSTEM] 812 License records verified.',
          '[DATABASE] Scaling complete. Total operators in database: 1,000+'
        ]);
      }
    }, 600);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTestFile(e.target.files[0]);
      setExtractedData(null);
      setExtractionLogs([]);
    }
  };

  const runExtraction = () => {
    if (!testFile) return;
    setIsExtracting(true);
    setExtractionLogs(['[SYSTEM] Initializing PDF Extraction Pipeline...']);
    
    const logs = [
      '[LAYER 2] Loading PDF document into memory...',
      '[PDFPLUMBER] Analyzing document structure and metadata...',
      '[PDFPLUMBER] Detected 14 pages. Extracting raw text...',
      '[TESSERACT] Running OCR on scanned image regions (Pages 3-5)...',
      '[TESSERACT] OCR confidence: 94.2%. Text extracted.',
      '[AI PARSER] Identifying table boundaries and headers...',
      '[AI PARSER] Mapping columns: Operator Name, AOC Number, Aircraft Types, Expiry Date, Operation Type',
      '[LAYER 3] AI Data Cleaner initialized...',
      '[AI CLEANER] Normalizing: "Boeing 737-800" → "B737-800"',
      '[AI CLEANER] Normalizing: "Airbus A320-200" → "A320"',
      '[LAYER 4] Auto Update Engine running delta comparison...',
      '[ALERT] Detected 1 New AOC Issued (Titan Airways)',
      '[ALERT] Detected 1 Expired License (Loganair)',
      '[VALIDATION] Checking AOC expiry dates against current date...',
      '[SUCCESS] Extraction complete. 3 records parsed successfully.'
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) {
        const currentLog = logs[i];
        setExtractionLogs(prev => [...prev, currentLog]);
        i++;
      } else {
        clearInterval(interval);
        setIsExtracting(false);
        setExtractedData([
          {
            operator_name: 'Titan Airways',
            aoc_number: 'GB-AOC-014',
            aircraft_types: ['A321', 'A330', 'B757'],
            expiry_date: '2026-05-12',
            operation_type: 'Charter'
          },
          {
            operator_name: 'Loganair',
            aoc_number: 'GB-AOC-088',
            aircraft_types: ['ATR 42', 'ATR 72', 'Embraer 145'],
            expiry_date: '2025-11-30',
            operation_type: 'RPT (Scheduled airline)'
          },
          {
            operator_name: 'DHL Air UK',
            aoc_number: 'GB-AOC-102',
            aircraft_types: ['B757-200F', 'B767-300F', 'B777F'],
            expiry_date: '2027-02-15',
            operation_type: 'Cargo'
          }
        ]);
      }
    }, 800);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Cpu className="text-indigo-600 dark:text-indigo-400" />
            Backend Scraping Engine
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
            Multi-layer data acquisition system for global Civil Aviation Authorities.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={runMassScrape}
            disabled={isMassScraping}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isMassScraping ? (
              <><RefreshCw size={16} className="animate-spin" /> Scaling to 1000+...</>
            ) : (
              <><Zap size={16} /> Scale to 1000+ Operators</>
            )}
          </button>
        </div>
      </div>

      {/* Mass Scrape Progress */}
      <AnimatePresence>
        {isMassScraping && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-indigo-600 rounded-3xl p-6 text-white overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Globe size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Global Mass Scrape in Progress</h3>
                  <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest">Targeting 100+ Regulatory URLs</p>
                </div>
              </div>
              <span className="text-2xl font-black">{Math.round(massScrapeProgress)}%</span>
            </div>
            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${massScrapeProgress}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mass Scrape Results */}
      <AnimatePresence>
        {massScrapeResults && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div className="bg-emerald-500 p-6 rounded-3xl text-white shadow-lg shadow-emerald-500/20">
              <div className="flex items-center justify-between mb-4">
                <Building2 size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded">New Operators</span>
              </div>
              <p className="text-4xl font-black">+{massScrapeResults.operators}</p>
              <p className="text-xs font-bold text-emerald-100 mt-2 uppercase tracking-widest">Total: 1,000+ Records</p>
            </div>
            <div className="bg-blue-500 p-6 rounded-3xl text-white shadow-lg shadow-blue-500/20">
              <div className="flex items-center justify-between mb-4">
                <Plane size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded">Aircraft Fleet</span>
              </div>
              <p className="text-4xl font-black">+{massScrapeResults.aircraft}</p>
              <p className="text-xs font-bold text-blue-100 mt-2 uppercase tracking-widest">Normalized & Verified</p>
            </div>
            <div className="bg-purple-500 p-6 rounded-3xl text-white shadow-lg shadow-purple-500/20">
              <div className="flex items-center justify-between mb-4">
                <ShieldCheck size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded">Licenses</span>
              </div>
              <p className="text-4xl font-black">+{massScrapeResults.licenses}</p>
              <p className="text-xs font-bold text-purple-100 mt-2 uppercase tracking-widest">AOC / RPT Compliance</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Architecture Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Layers size={18} className="text-blue-500" /> Layer 1: Structured Websites
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
              <Code size={20} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300">HTML Parsing & Tables</h3>
                <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-1 leading-relaxed">
                  Direct extraction from structured CAA websites using BeautifulSoup and Puppeteer.
                </p>
                <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                  <Globe size={12} /> Example: Maldives CAA
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <Database size={20} className="text-gray-500 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">API Integrations</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Direct connections to ICAO registry references, EASA, and FAA databases.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-500/30 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
            Critical Path
          </div>
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <FileText size={18} className="text-indigo-500" /> Layer 2: PDF Scraper
          </h2>
          <div className="space-y-4 relative z-10">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Pipeline Stack</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800/50 text-center">
                <p className="text-xs font-black text-indigo-900 dark:text-indigo-300">pdfplumber</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">Text & Tables</p>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800/50 text-center">
                <p className="text-xs font-black text-indigo-900 dark:text-indigo-300">Tesseract</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">OCR Engine</p>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800/50 text-center">
                <p className="text-xs font-black text-indigo-900 dark:text-indigo-300">AI Parser</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">Data Mapping</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-gray-900 rounded-xl border border-gray-800">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Extraction Targets</p>
              <div className="flex flex-wrap gap-2">
                {['Operator Name', 'AOC Number', 'Aircraft Types', 'Expiry Date', 'Operation Type'].map(target => (
                  <span key={target} className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-[10px] font-mono border border-gray-700">
                    {target}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-500/30 shadow-sm relative overflow-hidden">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Cpu size={18} className="text-emerald-500" /> Layer 3: AI Data Cleaner
          </h2>
          <div className="space-y-4 relative z-10">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Normalize Messy Data</p>
            
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-red-500 dark:text-red-400 line-through">"Boeing 737-800"</span>
                  <ArrowRight size={14} className="text-emerald-500" />
                  <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">B737-800</span>
                </div>
              </div>
              
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-red-500 dark:text-red-400 line-through">"Airbus A320-200"</span>
                  <ArrowRight size={14} className="text-emerald-500" />
                  <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">A320</span>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-red-500 dark:text-red-400 line-through">"Emirates Airlines"</span>
                  <ArrowRight size={14} className="text-emerald-500" />
                  <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">Emirates</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Uses LLMs to map unstructured and inconsistent string formats into standardized ICAO/IATA codes and clean operator names.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-purple-100 dark:border-purple-500/30 shadow-sm relative overflow-hidden">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <RefreshCw size={18} className="text-purple-500" /> Layer 4: Auto Update
          </h2>
          <div className="space-y-4 relative z-10">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Cron Scheduling</p>
            <div className="flex gap-2">
              <span className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold border border-purple-100 dark:border-purple-800/50 flex items-center gap-1">
                <Calendar size={12} /> Daily
              </span>
              <span className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 rounded-lg text-xs font-bold border border-gray-200 dark:border-gray-800 flex items-center gap-1">
                <Calendar size={12} /> Weekly
              </span>
            </div>

            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-4">Anomaly Detection</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                <PlusCircle size={16} className="text-emerald-500" />
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">New AOC Issued</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                <AlertTriangle size={16} className="text-amber-500" />
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300">Suspended Operators</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/30">
                <XCircle size={16} className="text-red-500" />
                <span className="text-xs font-bold text-red-900 dark:text-red-300">Expired Licenses</span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Automatically compares new scrapes against the existing database to flag delta changes and trigger alerts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scraper Control Center & Intelligence Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Scraper Monitor */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Settings size={18} className="text-indigo-500" /> Scraper Control Center
            </h2>
            <button className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 transition-colors">
              Trigger All Scrapers
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Authority</th>
                  <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Method</th>
                  <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Frequency</th>
                  <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Last Run</th>
                  <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {MOCK_AUTHORITIES.map((auth) => (
                  <tr key={auth.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors">
                    <td className="py-4">
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{auth.authority_name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{auth.country}</p>
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                        auth.scraping_method === 'API' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                        auth.scraping_method === 'PDF' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {auth.scraping_method}
                      </span>
                    </td>
                    <td className="py-4 text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">{auth.frequency}</td>
                    <td className="py-4 text-[10px] font-mono text-gray-500">{auth.last_run}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${auth.status === 'Healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">{auth.status}</span>
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <button className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        <Play size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Intelligence Feed */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity size={18} className="text-emerald-500" /> Intelligence Feed
          </h2>
          <div className="space-y-4">
            {RECENT_INTELLIGENCE.map((item) => (
              <div key={item.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${
                  item.type === 'NEW_AOC' ? 'bg-emerald-500' :
                  item.type === 'SUSPENDED' ? 'bg-red-500' :
                  'bg-amber-500'
                }`}></div>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    item.type === 'NEW_AOC' ? 'text-emerald-600' :
                    item.type === 'SUSPENDED' ? 'text-red-600' :
                    'text-amber-600'
                  }`}>
                    {item.type.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{item.date}</span>
                </div>
                <p className="text-xs font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{item.operator}</p>
                <p className="text-[10px] text-gray-500 mt-1">{item.country} • {item.details}</p>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-3 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
            View All Intelligence
          </button>
        </div>
      </div>

      {/* Global Coverage Strategy */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
            <Globe size={18} className="text-indigo-500" /> Global Coverage Strategy
          </h2>
          <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
            Phase 1 Active
          </span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { country: 'Global', authority: 'ICAO', status: 'Active', color: 'bg-indigo-500', fullName: 'International Civil Aviation Organization' },
            { country: 'Europe', authority: 'EASA', status: 'Active', color: 'bg-blue-600', fullName: 'European Union Aviation Safety Agency' },
            { country: 'USA', authority: 'FAA', status: 'Active', color: 'bg-blue-500', fullName: 'Federal Aviation Administration' },
            { country: 'Canada', authority: 'TCCA', status: 'Active', color: 'bg-red-600', fullName: 'Transport Canada Civil Aviation' },
            { country: 'Mexico', authority: 'AFAC', status: 'Active', color: 'bg-green-600', fullName: 'Agencia Federal de Aviación Civil' },
            { country: 'UK', authority: 'CAA', status: 'Active', color: 'bg-red-500', fullName: 'Civil Aviation Authority' },
            { country: 'UAE', authority: 'GCAA', status: 'Active', color: 'bg-emerald-500', fullName: 'General Civil Aviation Authority' },
            { country: 'Saudi Arabia', authority: 'GACA', status: 'Active', color: 'bg-green-700', fullName: 'General Authority of Civil Aviation' },
            { country: 'India', authority: 'DGCA', status: 'Active', color: 'bg-orange-500', fullName: 'Directorate General of Civil Aviation' },
            { country: 'Singapore', authority: 'CAAS', status: 'Active', color: 'bg-red-500', fullName: 'Civil Aviation Authority of Singapore' },
            { country: 'South Africa', authority: 'SACAA', status: 'Active', color: 'bg-yellow-600', fullName: 'South African Civil Aviation Authority' },
            { country: 'Brazil', authority: 'ANAC', status: 'Active', color: 'bg-blue-600', fullName: 'Agência Nacional de Aviação Civil' },
            { country: 'Australia', authority: 'CASA', status: 'Active', color: 'bg-indigo-600', fullName: 'Civil Aviation Safety Authority' },
            { country: 'Maldives', authority: 'MCAA', status: 'Active', color: 'bg-teal-500', fullName: 'Maldives Civil Aviation Authority' },
            { country: 'Norway', authority: 'CAA-N', status: 'Active', color: 'bg-sky-500', fullName: 'Civil Aviation Authority Norway' }
          ].map((item) => (
            <div key={item.country} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                <span className="text-xs font-black text-gray-900 dark:text-white">{item.country}</span>
              </div>
              <p className="text-lg font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{item.authority}</p>
              <p className="text-[8px] font-bold text-gray-400 uppercase truncate" title={item.fullName}>{item.fullName}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{item.status}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-2">Phase 2 (Q3 2026)</h4>
            <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400/70 leading-relaxed">
              Expanding to Africa (AFCAC), Southeast Asia (ASEAN), and broader Middle East (ACAO) regional authorities.
            </p>
          </div>
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800/50">
            <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-widest mb-2">Phase 3 (2027)</h4>
            <p className="text-[10px] text-purple-700/70 dark:text-purple-400/70 leading-relaxed">
              Full global coverage including small island nations and integration of specialized private aviation registries (e.g., Isle of Man, San Marino, Aruba).
            </p>
          </div>
        </div>
      </div>

      {/* Priority Scraping Strategy */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Target size={18} className="text-red-500" /> Priority Scraping Strategy
            </h2>
            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">How to use this list for maximum intelligence value</p>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1 bg-gray-100 dark:bg-gray-900 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest">
              80% Value in Tier 1
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tier 1 */}
          <div className="relative p-6 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl text-white shadow-xl shadow-indigo-500/20">
            <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
              Tier 1
            </div>
            <h3 className="text-lg font-black mb-1">Start Here</h3>
            <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest mb-6">80% of Global Intelligence Value</p>
            
            <ul className="space-y-3">
              {[
                { name: 'FAA (USA)', detail: 'World\'s largest registry' },
                { name: 'UK CAA', detail: 'Primary European hub' },
                { name: 'UAE GCAA', detail: 'Middle East connectivity' },
                { name: 'India DGCA', detail: 'Fastest growing market' },
                { name: 'EASA', detail: 'EU-wide safety oversight' }
              ].map((item) => (
                <li key={item.name} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={10} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-black">{item.name}</p>
                    <p className="text-[9px] text-indigo-100/70">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Tier 2 */}
          <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">Expansion</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Tier 2</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <TrendingUp size={20} className="text-emerald-500" />
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest mb-3">Africa</p>
                <div className="flex flex-wrap gap-2">
                  {['SACAA', 'NCAA', 'KCAA', 'ECAA'].map(tag => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-[9px] font-bold text-gray-600 dark:text-gray-400">{tag}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest mb-3">Southeast Asia</p>
                <div className="flex flex-wrap gap-2">
                  {['CAAS', 'CAAM', 'CAAT', 'CAAV'].map(tag => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-[9px] font-bold text-gray-600 dark:text-gray-400">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tier 3 */}
          <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">Hidden Gold</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Tier 3</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <Zap size={20} className="text-amber-500" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100/50 dark:border-amber-800/30">
                <p className="text-xs font-black text-amber-900 dark:text-amber-300 mb-1">Small Island Authorities</p>
                <p className="text-[9px] text-amber-700/70 dark:text-amber-400/70">Maldives, Cayman, Bermuda. High-value private aircraft data.</p>
              </div>
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
                <p className="text-xs font-black text-indigo-900 dark:text-indigo-300 mb-1">Offshore Registries</p>
                <p className="text-[9px] text-indigo-700/70 dark:text-indigo-400/70">Isle of Man, San Marino. Critical for corporate charter tracking.</p>
              </div>
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-[9px] text-gray-500 italic leading-relaxed text-center">
                  "Maldives provides structured AOC lists with aircraft + operations (perfect scraping format)"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Global Scrapers */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
          <Activity size={18} className="text-emerald-500" /> Active Global Scrapers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-start mb-3">
              <FileText size={16} className="text-red-500" />
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">UK CAA AOC List</p>
            <p className="text-xs text-gray-500 mt-1">PDF Document</p>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-3">Running OCR...</p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-start mb-3">
              <FileText size={16} className="text-red-500" />
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">France DGAC Registry</p>
            <p className="text-xs text-gray-500 mt-1">PDF Document</p>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-3">Active Scrape</p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-start mb-3">
              <FileText size={16} className="text-red-500" />
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Germany LBA Database</p>
            <p className="text-xs text-gray-500 mt-1">PDF Document</p>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-3">Active Scrape</p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-start mb-3">
              <FileText size={16} className="text-red-500" />
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Ireland IAA Registry</p>
            <p className="text-xs text-gray-500 mt-1">PDF Document</p>
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-3">Pending Queue</p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-start mb-3">
              <Globe size={16} className="text-blue-500" />
              <CheckCircle size={12} className="text-gray-400" />
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Maldives CAA</p>
            <p className="text-xs text-gray-500 mt-1">Structured HTML</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-3">Completed (2h ago)</p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="flex justify-between items-start mb-3">
              <Globe size={16} className="text-blue-500" />
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">South Africa SACAA</p>
            <p className="text-xs text-gray-500 mt-1">Structured HTML</p>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-3">Active Scrape</p>
          </div>
        </div>
      </div>

      {/* Interactive PDF Extraction Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PDF Extraction Sandbox */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Terminal size={18} className="text-gray-500" /> PDF Extraction Sandbox
          </h2>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors relative">
              <input 
                type="file" 
                accept=".pdf"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud size={32} className="mx-auto text-indigo-500 mb-4" />
              <p className="text-sm font-bold text-gray-900 dark:text-white">Drop CAA PDF here or click to upload</p>
              <p className="text-xs text-gray-500 mt-2">Tests the Layer 2 OCR & AI Parsing pipeline</p>
              
              {testFile && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-800/50">
                  <FileText size={14} /> {testFile.name}
                </div>
              )}
            </div>

            <button 
              onClick={runExtraction}
              disabled={!testFile || isExtracting}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isExtracting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing Pipeline...</>
              ) : (
                <><Cpu size={16} /> Run Extraction Test</>
              )}
            </button>

            {/* Terminal Logs */}
            <div className="bg-gray-900 rounded-2xl p-4 h-[200px] overflow-y-auto font-mono text-xs shadow-inner custom-scrollbar">
              {extractionLogs.length === 0 ? (
                <p className="text-gray-600 text-center mt-16">Upload a PDF to view extraction logs...</p>
              ) : (
                <div className="space-y-2">
                  {extractionLogs.map((log, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`
                        ${log.includes('[SUCCESS]') ? 'text-emerald-400 font-bold' : ''}
                        ${log.includes('[TESSERACT]') ? 'text-amber-400' : ''}
                        ${log.includes('[AI PARSER]') ? 'text-indigo-400' : ''}
                        ${log.includes('[PDFPLUMBER]') ? 'text-blue-400' : ''}
                        ${log.includes('[VALIDATION]') ? 'text-purple-400' : ''}
                        ${!log.includes('[') ? 'text-gray-300' : ''}
                      `}
                    >
                      {log}
                    </motion.div>
                  ))}
                  {isExtracting && (
                    <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-gray-500">_</motion.div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Automation Workflow Simulator */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <RefreshCw size={18} className="text-purple-500" /> Workflow Simulator
            </h2>
            <div className="flex items-center gap-2">
              <select 
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                disabled={isWorkflowRunning}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              >
                {MOCK_AUTHORITIES.map(a => (
                  <option key={a.id} value={a.country}>{a.country}</option>
                ))}
              </select>
              <button 
                onClick={runWorkflow}
                disabled={isWorkflowRunning}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Play size={16} fill="currentColor" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {workflowSteps.map((step) => {
                const Icon = step.icon;
                const isActive = workflowStep === step.id;
                const isCompleted = workflowStep > step.id;
                
                return (
                  <div 
                    key={step.id}
                    className={`p-3 rounded-xl border transition-all duration-500 flex flex-col items-center text-center gap-2 ${
                      isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-500/50 shadow-md scale-105' : 
                      isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30 opacity-60' :
                      'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-40'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${
                      isActive ? 'bg-indigo-600 text-white' :
                      isCompleted ? 'bg-emerald-500 text-white' :
                      'bg-gray-200 dark:bg-gray-800 text-gray-400'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-tight leading-tight">
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-900 rounded-2xl p-4 h-[180px] overflow-y-auto font-mono text-[10px] shadow-inner custom-scrollbar">
              {workflowLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2">
                  <History size={24} className="opacity-20" />
                  <p>Select a country and start the workflow...</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {workflowLogs.map((log, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, x: 5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-gray-300 flex gap-2"
                    >
                      <span className="text-indigo-500 font-bold">»</span>
                      {log}
                    </motion.div>
                  ))}
                  {isWorkflowRunning && (
                    <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-indigo-500 font-black ml-4">_</motion.div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results Zone (Moved out of grid) */}
      {extractedData && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center justify-between">
            <span>Extracted Structured Data</span>
            <FileJson size={14} />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {extractedData.map((data, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-black text-gray-900 dark:text-white">{data.operator_name}</p>
                    <p className="text-[10px] font-mono text-gray-500 mt-0.5">{data.aoc_number}</p>
                  </div>
                  <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-bold uppercase tracking-widest">
                    {data.operation_type}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Aircraft Types</p>
                    <div className="flex flex-wrap gap-1">
                      {data.aircraft_types.map((ac: string) => (
                        <span key={ac} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-[10px] font-bold">
                          {ac}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Expiry Date</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{data.expiry_date}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
