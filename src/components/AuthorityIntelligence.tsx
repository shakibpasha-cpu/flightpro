import React, { useState, useEffect } from 'react';
import { safeStringify } from '../utils/safeJson';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Search, 
  Database, 
  Activity, 
  ShieldCheck, 
  ExternalLink, 
  RefreshCw, 
  FileText, 
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Info,
  ChevronRight,
  Zap
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { getAI } from '../services/aiService';

interface AOCData {
  operator_name: string;
  aoc_number: string;
  operation_type: string;
}

interface Authority {
  id?: string;
  authority_name: string;
  country: string;
  website: string;
  scraping_type: 'HTML' | 'PDF' | 'API';
  last_scraped: string;
  aoc_data?: AOCData[];
}

export default function AuthorityIntelligence() {
  const [url, setUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrapedData, setScrapedData] = useState<Authority | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'aviation_authorities'), orderBy('last_scraped', 'desc')),
      (snapshot) => {
        setAuthorities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Authority)));
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsScraping(true);
    setError(null);
    setScrapedData(null);

    try {
      const response = await fetch('/api/scrape-authority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({ url })
      });

      if (!response.ok) throw new Error('Failed to fetch website content');

      const scrapeResult = await response.json();
      const content = scrapeResult.content;

      // 2. Process with AI in Frontend
      const prompt = `Analyze this aviation authority website content and extract the official authority name, country, and a list of AOC (Air Operator Certificate) holders mentioned.
      URL: ${url}
      Content: ${content}
      
      Return JSON format:
      {
        "authority_name": "...",
        "country": "...",
        "website": "${url}",
        "scraping_type": "${scrapeResult.isPdf ? 'PDF' : 'HTML'}",
        "last_scraped": "${new Date().toISOString()}",
        "aoc_data": [
          { "operator_name": "...", "aoc_number": "...", "operation_type": "Schduled/Charter/Cargo" }
        ]
      }`;

      const ai = getAI();
      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      if (!aiResponse.text) throw new Error("AI failed to parse the content");
      const data = JSON.parse(aiResponse.text);
      setScrapedData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsScraping(false);
    }
  };

  const seedUKCAA = async () => {
    setIsScraping(true);
    setError(null);
    try {
      const ukAocData = [
        { operator_name: "British Airways", aoc_number: "UK.AOC.0001", operation_type: "Scheduled" },
        { operator_name: "EasyJet UK", aoc_number: "UK.AOC.0002", operation_type: "Scheduled" },
        { operator_name: "Virgin Atlantic", aoc_number: "UK.AOC.0003", operation_type: "Scheduled" },
        { operator_name: "TUI Airways", aoc_number: "UK.AOC.0004", operation_type: "Charter" },
        { operator_name: "Jet2.com", aoc_number: "UK.AOC.0005", operation_type: "Scheduled" },
        { operator_name: "DHL Air UK", aoc_number: "UK.AOC.0006", operation_type: "Cargo" },
        { operator_name: "Loganair", aoc_number: "UK.AOC.0007", operation_type: "Scheduled" },
        { operator_name: "Eastern Airways", aoc_number: "UK.AOC.0008", operation_type: "Scheduled" },
        { operator_name: "Aurigny Air Services", aoc_number: "UK.AOC.0009", operation_type: "Scheduled" },
        { operator_name: "Blue Islands", aoc_number: "UK.AOC.0010", operation_type: "Scheduled" }
      ];

      const data: Authority = {
        authority_name: "Civil Aviation Authority (UK CAA)",
        country: "United Kingdom",
        website: "https://www.caa.co.uk",
        scraping_type: "HTML",
        last_scraped: new Date().toISOString(),
        aoc_data: ukAocData
      };

      setScrapedData(data);
      setUrl('https://www.caa.co.uk/commercial-industry/aircraft/air-operator-certificates/list-of-aoc-holders/');
    } catch (err) {
      setError('Failed to seed UK CAA data');
    } finally {
      setIsScraping(false);
    }
  };

  const saveAuthority = async () => {
    if (!scrapedData) return;

    try {
      const authDoc = await addDoc(collection(db, 'aviation_authorities'), scrapedData);
      
      // Also seed operators if AOC data exists
      if (scrapedData.aoc_data && scrapedData.aoc_data.length > 0) {
        for (const op of scrapedData.aoc_data) {
          // 1. Create/Update OperatorMaster
          const opRef = await addDoc(collection(db, 'operators_master'), {
            operator_name: op.operator_name,
            aoc_number: op.aoc_number,
            operation_type: op.operation_type,
            country: scrapedData.country,
            source: scrapedData.authority_name,
            status: 'Active',
            last_updated: new Date().toISOString()
          });

          // 2. Create AOCLicense record
          await addDoc(collection(db, 'aoc_licenses'), {
            operator_id: opRef.id,
            license_type: 'AOC',
            issuing_authority: scrapedData.authority_name,
            issue_date: new Date().toISOString().split('T')[0], // Placeholder
            status: 'Active'
          });
        }
      }

      setScrapedData(null);
      setUrl('');
      alert('Authority data, operators, and licenses saved successfully!');
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save data to database');
    }
  };

  const deleteAuthority = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this authority record?')) return;
    try {
      await deleteDoc(doc(db, 'aviation_authorities', id));
    } catch (err) {
      alert('Failed to delete record');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
            <ShieldCheck className="text-indigo-600 dark:text-indigo-400" />
            Authority Intelligence
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            Automated scraping and monitoring of Civil Aviation Authorities worldwide.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Scraper Input Section */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600">
                <Zap size={20} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-widest text-gray-900 dark:text-white">Live Scraper</h3>
            </div>

            <form onSubmit={handleScrape} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">CAA Website URL</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="url"
                    required
                    placeholder="https://www.caa.co.uk"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-sm"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="submit"
                  disabled={isScraping}
                  className="bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50"
                >
                  {isScraping ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                  Scrape
                </button>
                <button 
                  type="button"
                  onClick={seedUKCAA}
                  disabled={isScraping}
                  className="bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-600 transition flex items-center justify-center gap-2 border border-gray-100 dark:border-gray-600 disabled:opacity-50"
                >
                  <Database size={18} />
                  Seed UK
                </button>
              </div>
            </form>

            {error && (
              <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <AlertCircle size={18} />
                <p className="text-xs font-bold">{error}</p>
              </div>
            )}

            <AnimatePresence>
              {scrapedData && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="pt-6 border-t border-gray-50 dark:border-gray-700 space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Extracted Data</h4>
                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg uppercase">Success</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Authority</p>
                      <p className="text-sm font-black text-gray-900 dark:text-white">{scrapedData.authority_name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Country</p>
                      <p className="text-sm font-black text-gray-900 dark:text-white">{scrapedData.country}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Method</p>
                      <p className="text-sm font-black text-indigo-600">{scrapedData.scraping_type}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Operators Found</p>
                      <p className="text-sm font-black text-emerald-600">{scrapedData.aoc_data?.length || 0}</p>
                    </div>
                  </div>

                  <button 
                    onClick={saveAuthority}
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 dark:shadow-none"
                  >
                    <Database size={18} />
                    Commit to Database
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-6 rounded-3xl flex items-start gap-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-800/50 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
              <Info size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">Scraping Logic</h4>
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                The intelligence engine uses AI to parse complex regulatory websites. It prioritizes AOC (Air Operator Certificate) lists and operational permissions.
              </p>
            </div>
          </div>
        </div>

        {/* Authorities List Section */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-3">
                <Database className="text-indigo-600" />
                Monitored Authorities
              </h3>
              <span className="text-[10px] font-black bg-gray-100 dark:bg-gray-700 text-gray-500 px-3 py-1 rounded-full uppercase tracking-widest">
                {authorities.length} Records
              </span>
            </div>

            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {loading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="animate-spin text-indigo-600 mx-auto mb-4" size={32} />
                  <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Loading Database...</p>
                </div>
              ) : authorities.length === 0 ? (
                <div className="p-12 text-center">
                  <Globe className="text-gray-200 dark:text-gray-700 mx-auto mb-4" size={64} />
                  <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">No authorities monitored yet</p>
                </div>
              ) : (
                authorities.map((auth) => (
                  <div key={auth.id} className="p-6 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                          <FileText size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition">{auth.authority_name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Globe size={12} className="text-gray-400" />
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{auth.country}</span>
                            <span className="text-[10px] text-gray-300">•</span>
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{auth.scraping_type}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a 
                          href={auth.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition"
                        >
                          <ExternalLink size={18} />
                        </a>
                        <button 
                          onClick={() => auth.id && deleteAuthority(auth.id)}
                          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Last Scraped: {new Date(auth.last_scraped).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Activity size={14} className="text-indigo-500" />
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{auth.aoc_data?.length || 0} Operators</span>
                        </div>
                      </div>
                      <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        View Details <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
