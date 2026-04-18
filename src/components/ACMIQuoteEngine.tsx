import React, { useState, useEffect } from 'react';
import { Calculator, Plane, MapPin, DollarSign, Fuel, Users, Zap, Search, Globe, AlertCircle, Loader2, ChevronRight, TrendingUp, PieChart as PieChartIcon, BarChart3, Sparkles, Target } from 'lucide-react';
import { calculateACMIQuote } from '../services/aiService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ACMIQuoteEngineProps {
  onQuoteGenerated?: (quote: any) => void;
}

export default function ACMIQuoteEngine({ onQuoteGenerated }: ACMIQuoteEngineProps) {
  const [departure, setDeparture] = useState('OPLA');
  const [destination, setDestination] = useState('OMDB');
  const [aircraftType, setAircraftType] = useState('A320');
  const [distance, setDistance] = useState(1200);
  const [fuelPrice, setFuelPrice] = useState(0.8);
  const [seasonMultiplier, setSeasonMultiplier] = useState(1.0);
  const [urgencyMultiplier, setUrgencyMultiplier] = useState(1.0);
  const [regionMultiplier, setRegionMultiplier] = useState(1.0);
  const [brokerMargin, setBrokerMargin] = useState(12);
  const [riskLevel, setRiskLevel] = useState('Normal');
  const [budget, setBudget] = useState<number | ''>('');
  
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [operators, setOperators] = useState<any[]>([]);
  const [searchingOperators, setSearchingOperators] = useState(false);

  const aircraftOptions = [
    { type: 'A320', rate: '$4,500 – $6,500', burn: '2,500 kg', speed: '450 kt' },
    { type: 'B737-800', rate: '$4,000 – $6,000', burn: '2,600 kg', speed: '450 kt' },
    { type: 'A330', rate: '$8,000 – $12,000', burn: '5,500 kg', speed: '470 kt' },
    { type: 'B777', rate: '$12,000 – $18,000', burn: '7,000 kg', speed: '490 kt' },
    { type: 'ATR72', rate: '$2,000 – $3,000', burn: '1,000 kg', speed: '280 kt' },
  ];

  const handleCalculate = async () => {
    setLoading(true);
    try {
      // Call the new Full-Stack API
      const response = await fetch('/api/acmi/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departure,
          destination,
          aircraftType,
          fuelPrice,
          brokerMargin: brokerMargin / 100,
          riskLevel,
          totalBudget: budget || undefined,
          multipliers: {
            seasonality: seasonMultiplier,
            urgency: urgencyMultiplier,
            region: regionMultiplier
          }
        })
      });

      if (!response.ok) throw new Error('API Error');
      
      const result = await response.json();
      setQuote(result);
      if (onQuoteGenerated) onQuoteGenerated(result);
      
      // Also search for operators
      searchOperators(aircraftType);
    } catch (error) {
      console.error('Error calculating ACMI quote:', error);
      // Fallback to local calculation if API fails
      const fallback = await calculateACMIQuote({
        departure,
        destination,
        aircraftType,
        distanceNm: distance,
        fuelPricePerKg: fuelPrice,
        seasonMultiplier,
        urgencyMultiplier,
        regionMultiplier
      });
      setQuote(fallback);
    } finally {
      setLoading(false);
    }
  };

  const searchOperators = async (type: string) => {
    setSearchingOperators(true);
    try {
      // First find operators with this aircraft in their fleet
      const fleetRef = collection(db, 'aircraft_fleet');
      const q = query(fleetRef, where('aircraft_type', '==', type));
      const fleetSnap = await getDocs(q);
      
      const operatorIds = fleetSnap.docs.map(doc => doc.data().operator_id);
      
      if (operatorIds.length > 0) {
        const operatorsRef = collection(db, 'operators_master');
        // Firestore 'in' query limited to 10 items, but for demo we'll just take the first few
        const opsSnap = await getDocs(operatorsRef);
        const matchedOps = opsSnap.docs
          .filter(doc => operatorIds.includes(doc.id))
          .map(doc => ({ id: doc.id, ...doc.data() }));
        setOperators(matchedOps);
      } else {
        setOperators([]);
      }
    } catch (error) {
      console.error('Error searching operators:', error);
    } finally {
      setSearchingOperators(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
            <Calculator size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">ACMI Pricing Engine</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Instant Aircraft + Crew + Maintenance + Insurance Quotation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Route */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Mission Route</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value.toUpperCase())}
                  className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="DEP"
                />
              </div>
              <ChevronRight className="text-gray-300" size={16} />
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value.toUpperCase())}
                  className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="DEST"
                />
              </div>
            </div>
          </div>

          {/* Aircraft */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Aircraft Type</label>
            <div className="relative">
              <Plane className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <select
                value={aircraftType}
                onChange={(e) => setAircraftType(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 appearance-none transition-all"
              >
                {aircraftOptions.map(opt => (
                  <option key={opt.type} value={opt.type}>{opt.type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Distance */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Distance (NM)</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="number"
                value={distance}
                onChange={(e) => setDistance(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Fuel Price */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Fuel Price ($/kg)</label>
            <div className="relative">
              <Fuel className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="number"
                step="0.01"
                value={fuelPrice}
                onChange={(e) => setFuelPrice(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Client Budget */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Client Budget (Target)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={14} />
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full pl-9 pr-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/10 border-none rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        {/* Multipliers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Seasonality</label>
              <span className="text-xs font-bold text-indigo-600">x{seasonMultiplier.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={seasonMultiplier}
              onChange={(e) => setSeasonMultiplier(Number(e.target.value))}
              className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[8px] font-bold text-gray-400 uppercase tracking-tighter">
              <span>Low</span>
              <span>Standard</span>
              <span>Peak</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Urgency</label>
              <span className="text-xs font-bold text-indigo-600">x{urgencyMultiplier.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="2.5"
              step="0.1"
              value={urgencyMultiplier}
              onChange={(e) => setUrgencyMultiplier(Number(e.target.value))}
              className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[8px] font-bold text-gray-400 uppercase tracking-tighter">
              <span>Planned</span>
              <span>Urgent</span>
              <span>AOG/Critical</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Region Demand</label>
              <span className="text-xs font-bold text-indigo-600">x{regionMultiplier.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.8"
              step="0.1"
              value={regionMultiplier}
              onChange={(e) => setRegionMultiplier(Number(e.target.value))}
              className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[8px] font-bold text-gray-400 uppercase tracking-tighter">
              <span>Oversupply</span>
              <span>Stable</span>
              <span>High Demand</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">Risk Level</label>
              <span className="text-xs font-bold text-orange-600">{riskLevel}</span>
            </div>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="w-full p-2 bg-orange-50 dark:bg-orange-900/10 border-none rounded-xl text-xs font-bold text-orange-600 focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="Normal">Normal Operations</option>
              <option value="High Risk">High Risk Sector</option>
              <option value="War Zone">Conflict Zone / War Risk</option>
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Broker Margin</label>
              <span className="text-xs font-bold text-emerald-600">{brokerMargin}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={brokerMargin}
              onChange={(e) => setBrokerMargin(Number(e.target.value))}
              className="w-full h-1.5 bg-emerald-200 dark:bg-emerald-900 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <div className="flex justify-between text-[8px] font-bold text-gray-400 uppercase tracking-tighter">
              <span>0%</span>
              <span>15%</span>
              <span>30%</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleCalculate}
          disabled={loading}
          className="w-full mt-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Running Pricing Engine...
            </>
          ) : (
            <>
              <Zap size={18} />
              Generate ACMI Quote
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {quote && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Quote Result */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <TrendingUp size={120} />
                </div>
                
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Quotation Summary</h3>
                  <div className="px-4 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                    AI Verified
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'ACMI', value: quote.breakdown.acmi },
                              { name: 'Fuel', value: quote.breakdown.fuel },
                              { name: 'Overflight', value: quote.breakdown.overflight },
                              { name: 'Airport', value: (quote.breakdown.landing || 0) + (quote.breakdown.handling || 0) },
                              { name: 'Crew', value: quote.breakdown.crew },
                              { name: 'Margin', value: quote.breakdown.brokerMargin || 0 },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {[
                              '#4f46e5', // Indigo
                              '#10b981', // Emerald
                              '#f59e0b', // Amber
                              '#ef4444', // Red
                              '#8b5cf6', // Violet
                            ].map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cost']}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-gray-50 dark:border-gray-700">
                      <div className="group relative">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 cursor-help">
                          Block Hours
                          <AlertCircle size={10} />
                        </span>
                        <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-gray-900 text-[10px] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          Formula: (Distance / Speed) × 1.15 + 0.45hr taxi Time
                        </div>
                      </div>
                      <span className="text-lg font-black text-gray-900 dark:text-white">{(quote.metrics?.blockHours || quote.blockHours || quote.flightTimeHours).toFixed(1)} hrs</span>
                    </div>
                    <div className="flex items-center justify-between pb-4 border-b border-gray-50 dark:border-gray-700">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Distance</span>
                      <span className="text-lg font-black text-gray-900 dark:text-white">{Math.round(quote.metrics?.distance || quote.distanceNm).toLocaleString()} NM</span>
                    </div>
                    <div className="flex items-center justify-between pb-4 border-b border-gray-50 dark:border-gray-700">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Quote</span>
                      <span className="text-3xl font-black text-indigo-600">${quote.totalCost.toLocaleString()}</span>
                    </div>
                    
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">AI Recommendation</p>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300 italic">
                        {quote.aiInsights?.tip || "Optimize route for fuel efficiency."}
                      </p>
                    </div>
                  </div>
                </div>

                {quote.detailedBreakdown && (
                  <div className="mt-8 p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-inner">
                    <div className="flex items-center gap-2 mb-6">
                      <Sparkles size={16} className="text-indigo-600" />
                      <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Detailed Operational Note</h4>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Departure */}
                      <div className="flex gap-4">
                        <div className="shrink-0 w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center text-emerald-600 font-black text-xs">DEP</div>
                        <div className="flex-1">
                          <p className="text-xs font-black text-gray-900 dark:text-white">{quote.detailedBreakdown.departure.name} ({quote.detailedBreakdown.departure.icao}/{quote.detailedBreakdown.departure.iata})</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Agent: {quote.detailedBreakdown.departure.handlingAgency}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                             <div>
                               <p className="text-[8px] font-black text-gray-400 uppercase">Navigational</p>
                               <p className="text-xs font-bold">${quote.detailedBreakdown.departure.navigational.toLocaleString()}</p>
                             </div>
                             <div>
                               <p className="text-[8px] font-black text-gray-400 uppercase">Terminal</p>
                               <p className="text-xs font-bold">${quote.detailedBreakdown.departure.terminal.toLocaleString()}</p>
                             </div>
                             <div>
                               <p className="text-[8px] font-black text-gray-400 uppercase">Parking</p>
                               <p className="text-xs font-bold">${quote.detailedBreakdown.departure.parking.toLocaleString()}</p>
                             </div>
                             <div>
                               <p className="text-[8px] font-black text-gray-400 uppercase">Fuel</p>
                               <p className="text-xs font-bold">${quote.detailedBreakdown.departure.fuel.toLocaleString()}</p>
                             </div>
                          </div>
                        </div>
                      </div>

                      {/* Route/FIRs */}
                      <div className="flex gap-4">
                        <div className="shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600">
                          <Globe size={14} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-black text-gray-900 dark:text-white">Route Distance: {quote.detailedBreakdown.route.totalDistanceNm.toLocaleString()} NM</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {quote.detailedBreakdown.route.firs.map((fir: any, i: number) => (
                              <div key={i} className="px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
                                <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400">{fir.name} ({fir.code}): </span>
                                <span className="text-[9px] font-black text-indigo-600">${fir.charge.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Arrival */}
                      <div className="flex gap-4">
                        <div className="shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 font-black text-xs">ARR</div>
                        <div className="flex-1">
                          <p className="text-xs font-black text-gray-900 dark:text-white">{quote.detailedBreakdown.arrival.name} ({quote.detailedBreakdown.arrival.icao}/{quote.detailedBreakdown.arrival.iata})</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Agent: {quote.detailedBreakdown.arrival.handlingAgency}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                             <div>
                               <p className="text-[8px] font-black text-gray-400 uppercase">Navigational</p>
                               <p className="text-xs font-bold">${quote.detailedBreakdown.arrival.navigational.toLocaleString()}</p>
                             </div>
                             <div>
                               <p className="text-[8px] font-black text-gray-400 uppercase">Terminal</p>
                               <p className="text-xs font-bold">${quote.detailedBreakdown.arrival.terminal.toLocaleString()}</p>
                             </div>
                             <div>
                               <p className="text-[8px] font-black text-gray-400 uppercase">Parking</p>
                               <p className="text-xs font-bold">${quote.detailedBreakdown.arrival.parking.toLocaleString()}</p>
                             </div>
                             <div>
                               <p className="text-[8px] font-black text-gray-400 uppercase">Fuel</p>
                               <p className="text-xs font-bold">${quote.detailedBreakdown.arrival.fuel.toLocaleString()}</p>
                             </div>
                          </div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Full Flight Charges</span>
                        <span className="text-lg font-black text-indigo-600">${quote.totalCost.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-12 p-6 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle size={16} className="text-indigo-600" />
                    <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Calculation Logic</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Time</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{quote.breakdown.timeCalculation}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fuel</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{quote.breakdown.fuelCalculation}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ACMI</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{quote.breakdown.acmiCalculation}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operators */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Search size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Matching Operators</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">AOC Database matches for {aircraftType}</p>
                    </div>
                  </div>
                </div>

                {searchingOperators ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Searching AOC Database...</p>
                  </div>
                ) : operators.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {operators.map((op) => (
                      <div key={op.id} className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all group">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{op.operator_name}</h4>
                          <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[8px] font-black uppercase tracking-widest">{op.country}</span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <div className="flex items-center gap-1">
                            <Plane size={10} />
                            <span>Fleet: {op.fleet_size || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp size={10} />
                            <span>Score: {op.priority_score || 'N/A'}</span>
                          </div>
                        </div>
                        <button className="mt-4 w-full py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all">
                          Request Formal Quote
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-700">
                      <Search size={32} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-500 dark:text-gray-400">No direct matches found</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">We couldn't find operators with {aircraftType} in their fleet. Try another aircraft type or expand search.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Market Insights */}
            <div className="space-y-8">
              {quote.intelligence && quote.intelligence.length > 0 && (
                <div className="bg-emerald-600 p-8 rounded-3xl text-white shadow-xl shadow-emerald-200 dark:shadow-none relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10">
                    <Target size={160} />
                  </div>
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles size={18} className="text-emerald-200" />
                    <h3 className="text-lg font-black uppercase tracking-tight">AI Decision Intelligence</h3>
                  </div>
                  <div className="space-y-3">
                    {quote.intelligence.map((signal: string, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                        <Zap size={14} className="mt-0.5 text-emerald-200 shrink-0" />
                        <p className="text-xs font-bold leading-relaxed">{signal}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 italic">
                      Intelligence Engine: Decision Support Active
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-indigo-600 p-8 rounded-3xl text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10">
                  <Zap size={160} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-6">Market Insights</h3>
                <div className="space-y-6">
                  <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Seasonality Impact</p>
                    <p className="text-sm font-bold">{(seasonMultiplier > 1.2) ? 'High demand season detected. Rates are inflated by up to 40%.' : 'Stable market conditions. Standard seasonal rates apply.'}</p>
                  </div>
                  <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Urgency Factor</p>
                    <p className="text-sm font-bold">{(urgencyMultiplier > 1.5) ? 'Critical urgency detected. Operators prioritizing AOG and high-yield missions.' : 'Planned mission. Standard lead times allow for competitive bidding.'}</p>
                  </div>
                  <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Regional Demand</p>
                    <p className="text-sm font-bold">{(regionMultiplier > 1.3) ? 'High regional demand. Limited availability in the specified sector.' : 'Balanced regional supply. Multiple operator options available.'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6">Rate Benchmarks</h3>
                <div className="space-y-4">
                  {aircraftOptions.map(opt => (
                    <div key={opt.type} className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">{opt.type}</span>
                      <span className="text-xs font-black text-gray-900 dark:text-white">{opt.rate}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-gray-50 dark:border-gray-700">
                  <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                    * Rates are estimated based on current market ACMI benchmarks. Final pricing depends on operator availability, maintenance status, and specific mission requirements.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
