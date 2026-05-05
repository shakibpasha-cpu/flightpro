import React, { useState } from 'react';
import { Globe, Shield, DollarSign, Zap, Loader2, CheckCircle2, ChevronRight, AlertTriangle, CloudRain, Info, Phone, Mail, Link as LinkIcon, FileText } from 'lucide-react';
import { getOptimizedRoute, getFIRDetails, fetchSpecificCharge, fetchFIRRules, getLegFIRAnalysis } from '../services/aiService';
import { motion, AnimatePresence } from 'motion/react';

interface FIR {
  name: string;
  code?: string;
  country: string;
  rules?: string;
  address?: string;
  overflightCharge: number;
  navigationCharge: number;
  polygon?: [number, number][];
  details?: {
    address: string;
    phone: string;
    email: string;
    website: string;
    sop: string;
    rules?: string;
    documentationUrl: string;
  };
}

interface Leg {
  departure: string;
  destination: string;
  firs: FIR[];
  firName?: string;
  country?: string;
  overflightCharges?: number;
  navigationCharges?: number;
  costs?: {
    total: number;
  };
}

interface FIRAnalysisProps {
  legs?: Leg[];
  firs?: FIR[];
  departure: string;
  destination: string;
  onLegsChange?: (legs: Leg[]) => void;
}

export default function FIRAnalysis({ legs, firs: initialFirs, departure: initialDeparture, destination: initialDestination, onLegsChange }: FIRAnalysisProps) {
  const [firs, setFirs] = useState<FIR[]>(initialFirs || []);
  const [displayLegs, setDisplayLegs] = useState<Leg[]>(legs || []);
  const [departure, setDeparture] = useState(initialDeparture || '');
  const [destination, setDestination] = useState(initialDestination || '');
  const [optimizing, setOptimizing] = useState(false);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [analyzingRoute, setAnalyzingRoute] = useState(false);
  const [optimization, setOptimization] = useState<any>(null);
  const [fetchingDetails, setFetchingDetails] = useState<string | null>(null);
  const [optimizationCriteria, setOptimizationCriteria] = useState<string>('balanced');

  const handleRouteAnalysis = async () => {
    if (!departure || !destination) return;
    setAnalyzingRoute(true);
    setOptimization(null);
    try {
      const result = await getLegFIRAnalysis(departure, destination, 'Heavy Jet');
      if (result && result.firs) {
        const newLeg: Leg = {
          departure,
          destination,
          firs: result.firs.map((f: any) => ({
            name: f.firName,
            code: f.firCode,
            country: f.country,
            overflightCharge: f.overflightCharge,
            navigationCharge: f.navigationCharge,
            rules: f.rules
          })),
          firName: result.firs.map((f: any) => f.firName || f.name).join(', ') || 'N/A',
          country: [...new Set(result.firs.map((f: any) => f.country).filter(Boolean))].join(', ') || 'N/A',
          overflightCharges: result.totalOverflightCost || 0,
          navigationCharges: result.totalNavigationCost || 0,
          costs: { total: result.totalOverflightCost + result.totalNavigationCost }
        };
        setDisplayLegs([newLeg]);
        onLegsChange?.([newLeg]);
      }
    } catch (error) {
      console.error('Route Analysis Error:', error);
    } finally {
      setAnalyzingRoute(false);
    }
  };

  const handleFetchAllDetails = async () => {
    if (fetchingAll) return;
    setFetchingAll(true);
    try {
      const updatedLegs = [];
      for (const leg of displayLegs) {
        const enrichedFirs = [];
        for (const fir of leg.firs) {
          if (fir.address) {
            enrichedFirs.push(fir);
          } else {
            const details = await getFIRDetails(fir.code || fir.name?.split(' ')[0] || 'UNK', fir.name);
            enrichedFirs.push({
              ...fir,
              ...details,
              details,
              rules: details?.rules || details?.sop || fir.rules,
              overflightCharge: details?.overflightCharge || fir.overflightCharge,
              navigationCharge: details?.navigationCharge || fir.navigationCharge
            });
            // Delay to avoid quota burst
            await new Promise(r => setTimeout(r, 800));
          }
        }
        updatedLegs.push({ ...leg, firs: enrichedFirs });
      }
      
      setDisplayLegs(updatedLegs);
      onLegsChange?.(updatedLegs);
    } catch (error) {
      console.error('Error fetching all FIR details:', error);
    } finally {
      setFetchingAll(false);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const allFirs = displayLegs.length > 0 
        ? displayLegs.flatMap(l => l.firs)
        : firs;
      const result = await getOptimizedRoute(departure, destination, allFirs, undefined, optimizationCriteria);
      setOptimization(result);
    } catch (error) {
      console.error('Optimization Error:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const handleFetchDetails = async (firCode: string, firName: string) => {
    setFetchingDetails(firCode);
    try {
      const details = await getFIRDetails(firCode, firName);
      const overflight = await fetchSpecificCharge(firCode, firName, 'overflight');
      const navigation = await fetchSpecificCharge(firCode, firName, 'navigation');
      const rules = await fetchFIRRules(firCode, firName);

      const updatedFir = (f: FIR) => {
        if (f.name === firName) {
          return { 
            ...f, 
            ...details,
            details, 
            rules: rules || details?.sop || f.rules,
            overflightCharge: overflight || details?.overflightCharge || f.overflightCharge, 
            navigationCharge: navigation || details?.navigationCharge || f.navigationCharge 
          };
        }
        return f;
      };

      setFirs(prev => prev.map(updatedFir));
      const newLegs = displayLegs.map(leg => ({
        ...leg,
        firs: leg.firs.map(updatedFir)
      }));
      setDisplayLegs(newLegs);
      onLegsChange?.(newLegs);
    } catch (error) {
      console.error('Error fetching FIR details:', error);
    } finally {
      setFetchingDetails(null);
    }
  };

  const currentFirs = displayLegs.length > 0 ? displayLegs.flatMap(l => l.firs) : firs;
  const totalFIRCharges = currentFirs.reduce((acc, fir) => acc + (fir.overflightCharge || 0) + (fir.navigationCharge || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-500 uppercase">From</span>
            <input 
              type="text" 
              placeholder="ICAO (e.g. OPLR)" 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-xl outline-none transition dark:text-white text-sm font-bold"
              value={departure}
              onChange={(e) => setDeparture(e.target.value.toUpperCase())}
            />
          </div>
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-500 uppercase">To</span>
            <input 
              type="text" 
              placeholder="ICAO (e.g. OEJD)" 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-indigo-500 rounded-xl outline-none transition dark:text-white text-sm font-bold"
              value={destination}
              onChange={(e) => setDestination(e.target.value.toUpperCase())}
            />
          </div>
          <button
            onClick={handleRouteAnalysis}
            disabled={analyzingRoute || !departure || !destination}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {analyzingRoute ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
            Analyze Route
          </button>
        </div>
        <p className="text-[10px] text-gray-400 font-medium italic">
          AI will identify all FIRs crossed, calculate specific charges, and summarize overflight rules for this route.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="text-indigo-600 dark:text-indigo-400" size={20} />
          <h3 className="font-bold text-gray-800 dark:text-white">Airspace & FIR Analysis</h3>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={optimizationCriteria}
            onChange={(e) => setOptimizationCriteria(e.target.value)}
            disabled={optimizing}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="balanced">Balanced</option>
            <option value="cheapest">Cheapest</option>
            <option value="fastest">Fastest</option>
            <option value="most fuel-efficient">Fuel-Efficient</option>
          </select>
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center gap-2 disabled:opacity-50"
          >
            {optimizing ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
            {optimization ? 'Re-Optimize' : 'Optimize Route'}
          </button>
          <button
            onClick={handleFetchAllDetails}
            disabled={fetchingAll}
            className="text-xs font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/50 transition flex items-center gap-2 disabled:opacity-50"
          >
            {fetchingAll ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
            Fetch All FIR Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {displayLegs.length > 0 ? (
          displayLegs.map((leg, legIdx) => (
            <div key={legIdx} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                  {legIdx + 1}
                </div>
                <h4 className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  Leg: {leg.departure} → {leg.destination}
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {leg.firs.map((fir, idx) => (
                  <FIRCard 
                    key={idx} 
                    fir={fir} 
                    fetchingDetails={fetchingDetails} 
                    onFetchDetails={handleFetchDetails} 
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          firs.map((fir, idx) => (
            <FIRCard 
              key={idx} 
              fir={fir} 
              fetchingDetails={fetchingDetails} 
              onFetchDetails={handleFetchDetails} 
            />
          ))
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Total Airspace Charges</span>
        <span className="text-lg font-black text-gray-800 dark:text-white">${totalFIRCharges?.toLocaleString()}</span>
      </div>

      <AnimatePresence>
        {optimization && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={18} />
                  <h4 className="font-bold">AI Route Optimization Suggestion</h4>
                </div>
                <div className="bg-emerald-600 dark:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">
                  Save ${optimization.alternatives?.[0]?.totalSavings?.toLocaleString() || '0'}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {optimization.alternatives?.[0]?.firs?.map((fir: any, idx: number) => (
                    <React.Fragment key={idx}>
                      <div className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50 shadow-sm flex-shrink-0">
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{fir.name}</div>
                        <div className="text-[8px] text-gray-400 dark:text-gray-500 font-bold uppercase">{fir.country}</div>
                      </div>
                      {idx < optimization.alternatives[0].firs.length - 1 && (
                        <ChevronRight size={14} className="text-emerald-300 dark:text-emerald-700 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed italic">
                  "{optimization.alternatives?.[0]?.recommendation || optimization.summary}"
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                    <Shield size={12} className="text-indigo-500" />
                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Weather:</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{optimization.alternatives?.[0]?.weatherAvoidance}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                    <DollarSign size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">FIR:</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{optimization.alternatives?.[0]?.firOptimization}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-emerald-100 dark:border-emerald-800/50">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Optimized Total</span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">${optimization.alternatives?.[0]?.totalCost?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FIRCard({ fir, fetchingDetails, onFetchDetails }: { fir: FIR, fetchingDetails: string | null, onFetchDetails: (code: string, name: string) => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:border-indigo-100 dark:hover:border-indigo-500/50 transition-all group">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-gray-800 dark:text-white">{fir.name}</span>
            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
              {fir.country}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="flex flex-col items-end">
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                ${((fir.overflightCharge || 0) + (fir.navigationCharge || 0))?.toLocaleString()}
              </span>
              <div className="flex gap-2 text-[8px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-tighter">
                <span>Ovf: ${(fir.overflightCharge || 0).toLocaleString()}</span>
                <span>Nav: ${(fir.navigationCharge || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
          {!fir.details && (
            <button
              onClick={() => onFetchDetails(fir.name?.split(' ')[0] || 'UNK', fir.name)}
              disabled={fetchingDetails === (fir.name?.split(' ')[0] || 'UNK')}
              className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
              title="Fetch missing details"
            >
              {fetchingDetails === (fir.name?.split(' ')[0] || 'UNK') ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Info size={14} />
              )}
            </button>
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          <Shield size={14} className="mt-0.5 flex-shrink-0 text-gray-300 dark:text-gray-600" />
          <p>{fir.rules || 'Standard ICAO rules apply. Maintain assigned flight level and squawk code.'}</p>
        </div>

        {fir.details && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="pt-3 border-t border-gray-50 dark:border-gray-700 space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Contact Information</p>
                <div className="space-y-1">
                  {fir.details.phone && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                      <Phone size={10} />
                      <span>{fir.details.phone}</span>
                    </div>
                  )}
                  {fir.details.email && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                      <Mail size={10} />
                      <span>{fir.details.email}</span>
                    </div>
                  )}
                  {fir.details.website && (
                    <a href={fir.details.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline">
                      <LinkIcon size={10} />
                      <span>Official Website</span>
                    </a>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Documentation</p>
                {fir.details.documentationUrl && (
                  <a href={fir.details.documentationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline">
                    <FileText size={10} />
                    <span>AIP / Charts</span>
                  </a>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Specific Operating Rules</p>
              <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                {fir.details.rules || fir.details.sop}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
