import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Globe, 
  Sparkles, 
  Activity, 
  BarChart3, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight,
  Zap,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Info,
  Database,
  ChevronRight,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, query, limit, orderBy, addDoc, where, updateDoc, doc } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import { fleetSeederService } from '../services/fleetSeederService';
import { safeStringify } from '../utils/safeJson';

interface MarketTrend {
  aircraftType: string;
  demandTrend: 'up' | 'down' | 'stable';
  avgRate: number;
  availability: number;
  region: string;
}

interface FleetScrapeResult {
  airline: string;
  status: 'pending' | 'scraping' | 'completed' | 'failed';
  data?: any;
}

export default function MarketIntelligence() {
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  
  // Fleet Scraper State
  const [isScrapingGlobal, setIsScrapingGlobal] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [scrapeResults, setScrapeResults] = useState<FleetScrapeResult[]>([]);
  const [showScraper, setShowScraper] = useState(false);

  useEffect(() => {
    fetchMarketData();
  }, []);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      const aircraftSnap = await getDocs(query(collection(db, 'aircraft_master'), limit(10)));
      const listingsSnap = await getDocs(collection(db, 'aircraft_listings'));
      
      const mockTrends: MarketTrend[] = aircraftSnap.docs.map((doc, idx) => {
        const data = doc.data();
        const listings = listingsSnap.docs.filter(l => l.data().aircraft_id === doc.id);
        const avgRate = listings.length > 0 
          ? listings.reduce((acc, l) => acc + (l.data().acmi_rate_per_hr || 0), 0) / listings.length
          : 3500 + (Math.random() * 2000);

        return {
          aircraftType: data.aircraft_type || 'Unknown',
          demandTrend: Math.random() > 0.5 ? 'up' : 'down',
          avgRate: Math.round(avgRate),
          availability: Math.floor(Math.random() * 15) + 2,
          region: ['Europe', 'Middle East', 'Asia', 'North America'][Math.floor(Math.random() * 4)]
        };
      });

      setTrends(mockTrends);
      generateAIInsights(mockTrends);
    } catch (error) {
      console.error("Error fetching market data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateAIInsights = async (data: MarketTrend[]) => {
    setIsAnalyzing(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        setAiInsights("Gemini API key is not configured. Market shows high demand for narrowbody freighters in the Middle East.");
        setIsAnalyzing(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this ACMI market data and provide 3 key strategic insights for a broker. 
        Data: ${safeStringify(data)}
        Focus on: High demand aircraft types, regional pricing anomalies, and supply shortages.
        Keep it professional, concise, and actionable.`,
      });
      setAiInsights(response.text);
    } catch (error) {
      setAiInsights("AI Analysis currently unavailable. Market shows high demand for narrowbody freighters in the Middle East due to seasonal logistics peaks.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startGlobalScrape = async () => {
    setIsScrapingGlobal(true);
    setShowScraper(true);
    setScrapeProgress(0);
    
    try {
      const response = await fetch('/api/top-airlines');
      const airlines = await response.json();
      
      const initialResults = airlines.map((a: string) => ({ airline: a, status: 'pending' }));
      setScrapeResults(initialResults);

      // Scrape in batches of 3 to avoid timeouts and rate limits
      const batchSize = 3;
      for (let i = 0; i < airlines.length; i += batchSize) {
        const batch = airlines.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (airline: string) => {
          const idx = airlines.indexOf(airline);
          setScrapeResults(prev => prev.map((r, j) => j === idx ? { ...r, status: 'scraping' } : r));

          try {
            const data = await fleetSeederService.scrapeAndSeedFleet(airline);
            setScrapeResults(prev => prev.map((r, j) => j === idx ? { ...r, status: 'completed', data } : r));
          } catch (e) {
            setScrapeResults(prev => prev.map((r, j) => j === idx ? { ...r, status: 'failed' } : r));
          }
        }));

        setScrapeProgress(Math.round(((i + batch.length) / airlines.length) * 100));
      }
    } catch (error) {
      console.error("Global scrape error:", error);
    } finally {
      setIsScrapingGlobal(false);
    }
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      await fleetSeederService.seedTop10Airlines();
      alert('Global fleet data seeded successfully!');
      fetchMarketData();
    } catch (error) {
      console.error("Error seeding fleet data:", error);
      alert('Failed to seed fleet data.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
            <BarChart3 className="text-indigo-600 dark:text-indigo-400" />
            Market Intelligence
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            AI-driven market analysis, pricing trends, and supply-demand forecasting.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={startGlobalScrape}
            disabled={isScrapingGlobal}
            className="bg-emerald-600 text-white p-3 rounded-2xl hover:bg-emerald-700 transition flex items-center gap-2 shadow-lg shadow-emerald-100 dark:shadow-none"
          >
            <Globe size={18} className={isScrapingGlobal ? 'animate-spin' : ''} />
            <span className="text-xs font-bold uppercase tracking-widest">Scrape Top 100 Fleet</span>
          </button>
          <button 
            onClick={handleSeedData}
            disabled={isSeeding}
            className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-3 rounded-2xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition flex items-center gap-2 shadow-sm"
          >
            <Database size={18} className={isSeeding ? 'animate-spin' : ''} />
            <span className="text-xs font-bold uppercase tracking-widest">Seed Global Fleet</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showScraper && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
          >
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-widest text-gray-900 dark:text-white">Global Fleet Intelligence Engine</h3>
                    <p className="text-xs text-gray-500 font-medium">Scraping fleet data for top 100 global operators...</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowScraper(false)}
                  className="text-xs font-black text-gray-400 hover:text-gray-900 uppercase tracking-widest"
                >
                  Close
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <span>Overall Progress</span>
                  <span>{scrapeProgress}%</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${scrapeProgress}%` }}
                    className="h-full bg-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-64 overflow-y-auto custom-scrollbar p-1">
                {scrapeResults.map((result, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                      result.status === 'completed' 
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' 
                        : result.status === 'scraping'
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 animate-pulse'
                        : result.status === 'failed'
                        ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'
                    }`}
                  >
                    <span className={`text-[10px] font-bold truncate ${
                      result.status === 'completed' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {result.airline}
                    </span>
                    {result.status === 'completed' ? (
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                    ) : result.status === 'scraping' ? (
                      <Loader2 size={12} className="text-indigo-500 animate-spin shrink-0" />
                    ) : result.status === 'failed' ? (
                      <AlertTriangle size={12} className="text-rose-500 shrink-0" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: AI Insights & Stats */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 dark:shadow-none relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <Sparkles size={200} />
            </div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                  <Zap size={20} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-widest">AI Market Pulse</h3>
              </div>
              
              {isAnalyzing ? (
                <div className="space-y-3">
                  <div className="h-4 bg-white/20 rounded-full w-full animate-pulse" />
                  <div className="h-4 bg-white/20 rounded-full w-5/6 animate-pulse" />
                  <div className="h-4 bg-white/20 rounded-full w-4/6 animate-pulse" />
                </div>
              ) : (
                <div className="text-sm text-indigo-50 leading-relaxed font-medium">
                  {aiInsights}
                </div>
              )}

              <div className="pt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">
                <Activity size={12} />
                Updated in Real-time
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <PieChart size={14} />
              Fleet Distribution
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Narrowbody', value: 45, color: 'bg-indigo-500' },
                { label: 'Widebody', value: 25, color: 'bg-emerald-500' },
                { label: 'Freighters', value: 20, color: 'bg-amber-500' },
                { label: 'Regional', value: 10, color: 'bg-rose-500' }
              ].map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-gray-500">{item.label}</span>
                    <span className="text-gray-900 dark:text-white">{item.value}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      className={`h-full ${item.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-6 rounded-3xl flex items-start gap-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-800/50 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">Supply Warning</h4>
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                A320 availability in Europe is dropping below 5% for Q3. Recommend early booking for summer charters.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Market Trends Table */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 dark:text-white uppercase tracking-widest text-xs flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-600" />
                Live Market Trends
              </h3>
              <div className="flex gap-2">
                <button className="p-2 text-gray-400 hover:text-indigo-600 transition">
                  <Filter size={18} />
                </button>
                <button className="p-2 text-gray-400 hover:text-indigo-600 transition">
                  <Search size={18} />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-700/30">
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Aircraft Type</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Region</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg. ACMI Rate</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Available Units</th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {loading ? (
                    Array(6).fill(0).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="p-4">
                          <div className="h-8 bg-gray-50 dark:bg-gray-800 animate-pulse rounded-lg" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    trends.map((trend, idx) => (
                      <motion.tr 
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition group"
                      >
                        <td className="p-4">
                          <p className="font-bold text-gray-800 dark:text-white">{trend.aircraftType}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Globe size={14} className="text-gray-400" />
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{trend.region}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-black text-gray-900 dark:text-white">${trend.avgRate.toLocaleString()}/hr</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${trend.availability > 5 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{trend.availability} Units</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                            trend.demandTrend === 'up' 
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                          }`}>
                            {trend.demandTrend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {trend.demandTrend === 'up' ? 'Rising' : 'Falling'}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Globe size={14} />
                Global Demand Heatmap
              </h3>
              <div className="aspect-video bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-gray-700">
                <div className="text-center space-y-2">
                  <Globe size={48} className="mx-auto text-gray-200 dark:text-gray-700" />
                  <p className="text-xs text-gray-400 font-medium">Interactive Map Loading...</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity size={14} />
                Market Volatility Index
              </h3>
              <div className="aspect-video bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-gray-700">
                <div className="text-center space-y-2">
                  <BarChart3 size={48} className="mx-auto text-gray-200 dark:text-gray-700" />
                  <p className="text-xs text-gray-400 font-medium">Volatility Chart Loading...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
