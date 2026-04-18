import { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Globe, Loader2, ExternalLink, Download, AlertCircle, Database, Filter, Sparkles, AlertTriangle, Plane, Calendar, MapPin, MessageSquare, TrendingUp } from 'lucide-react';
import { getAI, handleAiError } from '../services/aiService';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface ScrapedAircraft {
  type?: string;
  tail_number?: string;
  base?: string;
  location?: string;
  destination?: string;
  availability?: string;
  operator?: string;
  price?: string;
  sourceUrl: string;
  // Forum specific fields
  topic?: string;
  aircraft_mentioned?: string;
  region?: string;
  date_posted?: string;
  author?: string;
  sentiment?: string;
}

const OPERATOR_SOURCES = [
  { name: 'NetJets Fleet', url: 'https://www.netjets.com/en-us/our-fleet' },
  { name: 'VistaJet Fleet', url: 'https://www.vistajet.com/en/fleet/' },
  { name: 'Luxaviation Fleet', url: 'https://www.luxaviation.com/fleet' },
  { name: 'SmartLynx Fleet', url: 'https://www.smartlynx.aero/en/fleet' },
  { name: 'Avion Express Fleet', url: 'https://www.avionexpress.aero/fleet/' },
  { name: 'AirExplore Fleet', url: 'https://www.airexplore.sk/en/fleet' },
  { name: 'Magma Aviation Fleet', url: 'https://magma-aviation.com/fleet/' },
  { name: 'Qatar Executive', url: 'https://www.qatarexec.com.qa/en/our-fleet.html' },
  { name: 'Air Partner Fleet', url: 'https://www.airpartner.com/en/private-jets/aircraft-guide/' },
  { name: 'GlobeAir Fleet', url: 'https://www.globeair.com/fleet' }
];

const CHARTER_SOURCES = [
  { name: 'Air Charter Service (ACS)', url: 'https://www.aircharterservice.com/aircraft-guide' },
  { name: 'Chapman Freeborn', url: 'https://chapmanfreeborn.aero/fleet-guide/' },
  { name: 'Victor Empty Legs', url: 'https://www.flyvictor.com/en-us/empty-legs/' },
  { name: 'Jettly Empty Legs', url: 'https://jettly.com/empty_legs' },
  { name: 'PrivateFly Empty Legs', url: 'https://www.privatefly.com/private-jet-charter/empty-legs.html' },
  { name: 'LunaJets Empty Legs', url: 'https://www.lunajets.com/en/empty-legs' },
  { name: 'Avinode Empty Legs', url: 'https://www.avinode.com/empty-legs/' },
  { name: 'CharterScanner', url: 'https://charterscanner.com/empty-legs' }
];

const FORUM_SOURCES = [
  { name: 'PPRuNe Biz Jets', url: 'https://www.pprune.org/biz-jets-ag-flying-ga-etc-114/' },
  { name: 'Air Charter Guide News', url: 'https://www.aircharterguide.com/news' },
  { name: 'GlobalAir Charter Listings', url: 'https://www.globalair.com/charter' },
  { name: 'EuroGA Forums', url: 'https://www.euroga.org/' },
  { name: 'Airliners.net Biz Jets', url: 'https://www.airliners.net/forum/viewforum.php?f=3' },
  { name: 'BizJetJobs Forums', url: 'https://bizjetjobs.com/blog/' },
  { name: 'CorporateFlyer', url: 'https://www.corporateflyer.net/' }
];

export default function MarketScraper() {
  const [scrapeMode, setScrapeMode] = useState<'fleet' | 'charter' | 'forum'>('fleet');
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScrapedAircraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  const handleScrape = async (targetUrl: string = url, query: string = searchQuery) => {
    if (!targetUrl && !query) return;
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const ai = getAI();
      
      let prompt = "";
      if (isSearchMode && query) {
        prompt = `You are an Availability Intelligence Engine. Search for and extract ${scrapeMode === 'fleet' ? 'operator fleet data' : scrapeMode === 'charter' ? 'charter listings or empty legs' : 'aviation forum discussions'} related to: "${query}".
           Use Google Search to find the most recent and relevant pages, then extract the data.
           
           🎯 EXTRACTION GOALS:
           - For Fleets: Extract aircraft types, tail numbers (registrations), and base airports.
           - For Charters: Extract aircraft location, availability windows, and operator names.
           - For Forums: Extract availability hints, market rumors, and sentiment.
           
           Format the output as a JSON array of objects with these exact fields:
           ${scrapeMode === 'fleet' 
             ? 'type (aircraft model), tail_number (registration), base (home airport ICAO/Name), operator (company name), sourceUrl (the URL where you found this)' 
             : scrapeMode === 'charter'
             ? 'type (aircraft model), location (departure ICAO/Name), destination (arrival ICAO/Name if it\'s an empty leg), availability (dates/window), operator (company), price (estimated), sourceUrl (the URL)'
             : 'topic (summary), aircraft_mentioned (types), region (geographical), date_posted (date), author (user), sentiment (e.g. "High Demand", "Available"), sourceUrl (the URL)'}
           Return ONLY the JSON array.`;
      } else {
        prompt = scrapeMode === 'fleet' 
          ? `Extract a list of aircraft from this operator's fleet page. 
             Focus on aircraft types, tail numbers (registrations), and base airports.
             Format the output as a JSON array of objects with these exact fields: 
             type (aircraft model, e.g. "A320-200"), tail_number (registration if listed, otherwise "Unknown"), base (home airport ICAO or Name if listed, otherwise "Unknown").
             URL: ${targetUrl}`
          : scrapeMode === 'charter'
          ? `Extract a list of charter aircraft listings or empty legs from this URL.
             Focus on aircraft location, availability windows, and operator names.
             Format the output as a JSON array of objects with these exact fields:
             type (aircraft model), location (current location or departure airport ICAO), destination (arrival airport if it's an empty leg, otherwise "N/A"), availability (dates or availability window), operator (company name if listed, otherwise "Unknown"), price (estimated price if available, otherwise "N/A").
             URL: ${targetUrl}`
          : `Extract aviation charter availability hints, market rumors, or broker posts from this forum or news page.
             Format the output as a JSON array of objects with these exact fields:
             topic (summary of the hint or post), aircraft_mentioned (aircraft types mentioned, or "N/A"), region (geographical region mentioned, or "Global"), date_posted (date of the post/news), author (broker/user/author name), sentiment (e.g., "High Demand", "Available", "Seeking", "Neutral").
             URL: ${targetUrl}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: isSearchMode ? [{ googleSearch: {} }] : [{ urlContext: {} }],
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      if (text) {
        const data = JSON.parse(text);
        const formattedData = (Array.isArray(data) ? data : [data]).map((item: any) => ({
          type: item.type || item.aircraft_mentioned || 'Unknown',
          tail_number: item.tail_number || 'Unknown',
          base: item.base || 'Unknown',
          location: item.location || 'Unknown',
          destination: item.destination || 'N/A',
          availability: item.availability || 'Contact for details',
          operator: item.operator || 'Unknown',
          price: item.price || 'N/A',
          topic: item.topic || 'N/A',
          aircraft_mentioned: item.aircraft_mentioned || 'N/A',
          region: item.region || 'N/A',
          date_posted: item.date_posted || 'N/A',
          author: item.author || 'Unknown',
          sentiment: item.sentiment || 'Neutral',
          sourceUrl: targetUrl
        }));
        setResults(formattedData);
      } else {
        setError("No data could be extracted from this URL. The site might be protected or have no relevant data.");
      }
    } catch (err: any) {
      handleAiError(err, 'handleScrape');
      setError("Failed to scrape the website. AI service might be unavailable. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (aircraft: ScrapedAircraft) => {
    const importId = scrapeMode === 'fleet' ? aircraft.tail_number : scrapeMode === 'charter' ? `${aircraft.type}-${aircraft.location}` : `${aircraft.author}-${aircraft.topic}`;
    setImporting(importId || 'unknown');
    try {
      if (scrapeMode === 'fleet') {
        await addDoc(collection(db, 'aircraft'), {
          type: aircraft.type,
          tail_number: aircraft.tail_number,
          base: aircraft.base,
          sourceUrl: aircraft.sourceUrl,
          isExternal: true,
          importedAt: new Date().toISOString(),
          status: 'Available',
          range: 3000,
          cruiseSpeed: 450,
          passengers: 150,
          hourlyRate: 3500
        });
        alert(`Imported ${aircraft.type} (${aircraft.tail_number}) to local fleet database!`);
      } else if (scrapeMode === 'charter') {
        await addDoc(collection(db, 'empty_legs'), {
          aircraft: aircraft.type,
          departure: aircraft.location,
          destination: aircraft.destination,
          date: aircraft.availability,
          operator: aircraft.operator,
          price: aircraft.price === 'N/A' ? 0 : parseInt(aircraft.price?.replace(/[^0-9]/g, '') || '0'),
          sourceUrl: aircraft.sourceUrl,
          importedAt: new Date().toISOString(),
          category: 'Executive', // Default
          seats: 8
        });
        alert(`Imported ${aircraft.type} charter listing to empty legs database!`);
      } else {
        await addDoc(collection(db, 'market_intelligence'), {
          topic: aircraft.topic,
          aircraft_mentioned: aircraft.aircraft_mentioned,
          region: aircraft.region,
          date_posted: aircraft.date_posted,
          author: aircraft.author,
          sentiment: aircraft.sentiment,
          sourceUrl: aircraft.sourceUrl,
          importedAt: new Date().toISOString(),
        });
        alert(`Imported market intelligence to database!`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, scrapeMode === 'fleet' ? 'aircraft' : scrapeMode === 'charter' ? 'empty_legs' : 'market_intelligence');
    } finally {
      setImporting(null);
    }
  };

  const currentSources = scrapeMode === 'fleet' ? OPERATOR_SOURCES : scrapeMode === 'charter' ? CHARTER_SOURCES : FORUM_SOURCES;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
            <Globe className="text-indigo-600 dark:text-indigo-400" size={32} />
            Market Scraper
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Extract static fleet data, charter listings, or market intelligence from aviation forums.
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit flex-wrap">
        <button
          onClick={() => { setScrapeMode('fleet'); setResults([]); setUrl(''); }}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition ${
            scrapeMode === 'fleet' 
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Operator Fleets
        </button>
        <button
          onClick={() => { setScrapeMode('charter'); setResults([]); setUrl(''); }}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition ${
            scrapeMode === 'charter' 
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Charter Listings
        </button>
        <button
          onClick={() => { setScrapeMode('forum'); setResults([]); setUrl(''); }}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition ${
            scrapeMode === 'forum' 
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Aviation Forums
        </button>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-3xl p-5 flex gap-4 items-start shadow-sm">
        <AlertTriangle className="text-amber-600 dark:text-amber-500 shrink-0 mt-1" size={24} />
        <div>
          <h3 className="text-base font-black text-amber-900 dark:text-amber-400 tracking-tight">Scraping Reality Check</h3>
          <p className="text-sm text-amber-800 dark:text-amber-300/80 mt-1 leading-relaxed">
            {scrapeMode === 'fleet' 
              ? 'You CANNOT scrape real-time ACMI availability or private leasing data. You CAN scrape static fleet lists, aircraft types, and base locations. This tool uses AI to parse unstructured "Our Fleet" pages into structured data.'
              : scrapeMode === 'charter'
              ? 'Charter listings and empty legs are often outdated or used as lead generation. The AI extracts location and availability windows, but these must be verified manually with the operator.'
              : 'Forum posts and rumors provide "availability hints" useful for AI training and market intelligence, but are not confirmed data. Use this to gauge market sentiment and off-market availability.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Scraper Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Search size={18} className="text-indigo-600" />
                {isSearchMode ? 'Smart Search' : `Target ${scrapeMode === 'fleet' ? 'Operator' : scrapeMode === 'charter' ? 'Broker' : 'Forum'} URL`}
              </h2>
              <button 
                onClick={() => setIsSearchMode(!isSearchMode)}
                className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md transition-all ${
                  isSearchMode ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                }`}
              >
                {isSearchMode ? 'Switch to URL' : 'Switch to Search'}
              </button>
            </div>
            <div className="space-y-4">
              <div className="relative">
                {isSearchMode ? (
                  <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                ) : (
                  <Globe className="absolute left-3 top-3 text-gray-400" size={20} />
                )}
                <input 
                  type={isSearchMode ? "text" : "url"} 
                  placeholder={isSearchMode 
                    ? `Search for ${scrapeMode === 'fleet' ? 'fleets' : scrapeMode === 'charter' ? 'charters' : 'forums'}...` 
                    : (scrapeMode === 'fleet' ? "https://operator.com/fleet" : scrapeMode === 'charter' ? "https://broker.com/empty-legs" : "https://forum.com/biz-jets")
                  } 
                  value={isSearchMode ? searchQuery : url}
                  onChange={(e) => isSearchMode ? setSearchQuery(e.target.value) : setUrl(e.target.value)}
                  className="w-full pl-10 p-3 border dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button 
                onClick={() => handleScrape()}
                disabled={loading || (isSearchMode ? !searchQuery : !url)}
                className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                {loading ? 'Analyzing...' : isSearchMode ? 'Search & Extract' : `Extract ${scrapeMode === 'fleet' ? 'Fleet' : scrapeMode === 'charter' ? 'Listing' : 'Intelligence'} Data`}
              </button>
            </div>

            <div className="mt-8">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Example Targets</h3>
              <div className="space-y-2">
                {currentSources.map((source) => (
                  <button
                    key={source.name}
                    onClick={() => {
                      setUrl(source.url);
                      handleScrape(source.url);
                    }}
                    className="w-full text-left p-3 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800 transition flex items-center justify-between group"
                  >
                    <span>{source.name}</span>
                    <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-200 dark:shadow-none">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={20} />
              <h3 className="font-bold">AI Extraction</h3>
            </div>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Our AI engine uses the URL Context tool to browse target websites, bypass simple scrapers, and extract structured aircraft data directly into your marketplace.
            </p>
          </div>
        </div>

        {/* Results View */}
        <div className="lg:col-span-8 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 rounded-2xl flex items-start gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="shrink-0" size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <div className="bg-white dark:bg-gray-800 p-12 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <Database className="text-gray-300" size={32} />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-white">No Results Yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mt-2">
                {scrapeMode === 'fleet' 
                  ? "Enter an operator's fleet page URL to extract their aircraft types, tail numbers, and base locations."
                  : scrapeMode === 'charter'
                  ? "Enter a broker's listing page URL to extract aircraft locations, availability windows, and prices."
                  : "Enter an aviation forum or news URL to extract market intelligence and availability hints."}
              </p>
            </div>
          )}

          {loading && (
            <div className="bg-white dark:bg-gray-800 p-12 rounded-3xl border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center text-center">
              <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
              <h3 className="font-bold text-gray-800 dark:text-white">Analyzing Page...</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Our AI is reading the website and structuring the data.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  Extracted {scrapeMode === 'fleet' ? 'Fleet' : scrapeMode === 'charter' ? 'Listings' : 'Intelligence'} ({results.length})
                </h3>
                <button className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 hover:underline">
                  <Download size={16} /> Export CSV
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((aircraft, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={idx} 
                    className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          scrapeMode === 'forum' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600'
                        }`}>
                          {scrapeMode === 'forum' ? <MessageSquare size={20} /> : <Plane size={20} />}
                        </div>
                        <div>
                          <h4 className="font-black text-gray-900 dark:text-white line-clamp-1">
                            {scrapeMode === 'forum' ? aircraft.topic : aircraft.type}
                          </h4>
                          {scrapeMode === 'fleet' && (
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{aircraft.tail_number}</span>
                          )}
                          {scrapeMode === 'charter' && aircraft.operator !== 'Unknown' && (
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{aircraft.operator}</span>
                          )}
                          {scrapeMode === 'forum' && (
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{aircraft.author} • {aircraft.date_posted}</span>
                          )}
                        </div>
                      </div>
                      {scrapeMode === 'charter' && aircraft.price !== 'N/A' && (
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{aircraft.price}</span>
                      )}
                      {scrapeMode === 'forum' && (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                          aircraft.sentiment?.toLowerCase().includes('high') || aircraft.sentiment?.toLowerCase().includes('seeking')
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          {aircraft.sentiment}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      {scrapeMode === 'fleet' ? (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1"><MapPin size={12}/> Base Location:</span>
                          <span className="font-bold text-gray-900 dark:text-white">{aircraft.base}</span>
                        </div>
                      ) : scrapeMode === 'charter' ? (
                        <>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1"><MapPin size={12}/> Route/Location:</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {aircraft.location} {aircraft.destination !== 'N/A' ? `→ ${aircraft.destination}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1"><Calendar size={12}/> Availability:</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{aircraft.availability}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1"><Plane size={12}/> Aircraft:</span>
                            <span className="font-bold text-gray-900 dark:text-white line-clamp-1 text-right">{aircraft.aircraft_mentioned}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1"><Globe size={12}/> Region:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{aircraft.region}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <button 
                      onClick={() => handleImport(aircraft)}
                      disabled={importing === (scrapeMode === 'fleet' ? aircraft.tail_number : scrapeMode === 'charter' ? `${aircraft.type}-${aircraft.location}` : `${aircraft.author}-${aircraft.topic}`)}
                      className="w-full py-2 bg-gray-50 dark:bg-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2"
                    >
                      {importing === (scrapeMode === 'fleet' ? aircraft.tail_number : scrapeMode === 'charter' ? `${aircraft.type}-${aircraft.location}` : `${aircraft.author}-${aircraft.topic}`) ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Download size={14} />
                      )}
                      {importing === (scrapeMode === 'fleet' ? aircraft.tail_number : scrapeMode === 'charter' ? `${aircraft.type}-${aircraft.location}` : `${aircraft.author}-${aircraft.topic}`) ? 'Importing...' : 'Import to Database'}
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
