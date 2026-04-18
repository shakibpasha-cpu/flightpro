import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, Calendar, Users, MapPin, Search, ArrowRight, CheckCircle2, ShieldCheck, FileText, Download, ChevronRight, Star, Clock, Activity, Zap, MessageSquare, Loader2, Package } from 'lucide-react';
import { generateCharterQuotes } from '../services/aiService';
import { generateQuotePDF } from '../utils/pdfGenerator';

type Step = 'search' | 'results' | 'details' | 'quote';

export default function CharterBookingFlow({ aircraftList = [] }: { aircraftList?: any[] }) {
  const [currentStep, setCurrentStep] = useState<Step>('search');
  const [inputMode, setInputMode] = useState<'manual' | 'chat'>('manual');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [searchParams, setSearchParams] = useState({
    departure: '',
    destination: '',
    date: '',
    passengers: 1,
    missionType: 'Passenger'
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<any | null>(null);
  const [quoteDetails, setQuoteDetails] = useState<any | null>(null);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    setChatLoading(true);
    try {
      // Use AI to parse the natural language input
      const parsed = await generateCharterQuotes({
        tripType: 'one-way',
        missionType: 'Passenger',
        departure: chatInput,
        destination: '',
        dateTime: new Date().toISOString(),
        passengers: 1,
        cargoWeight: 0,
        aircraftPreference: '',
        specialInstructions: chatInput,
        brokerMargin: 15,
        operatorMargin: 10,
        currentDate: new Date().toISOString()
      }, aircraftList);
      
      if (parsed && parsed.data && parsed.data.aircraft_options) {
        setResults(parsed.data.aircraft_options.map((q: any, i: number) => ({
          id: String(i),
          type: q.aircraft_name,
          model: q.aircraft_name,
          operator: q.operator || 'Premium Operator',
          year: new Date().getFullYear() - Math.floor(Math.random() * 10),
          seats: aircraftList.find(a => a.type === q.aircraft_name)?.maxPassengers || q.passenger_capacity || 8,
          range: `${aircraftList.find(a => a.type === q.aircraft_name)?.range || 3000} nm`,
          speed: 'Mach 0.80',
          price: q.total_price,
          availability: q.availability_status || 'On Request',
          rating: 4.8,
          image: aircraftList.find(a => a.type === q.aircraft_name)?.image || `https://loremflickr.com/800/600/aircraft,jet,plane?lock=${q.aircraft_name?.length || 1}`
        })));
      }
      
      setChatLoading(false);
      setCurrentStep('results');
    } catch (error) {
      console.error('Error parsing chat:', error);
      setChatLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const parsed = await generateCharterQuotes({
        tripType: 'one-way', // Default for search
        missionType: searchParams.missionType,
        departure: searchParams.departure,
        destination: searchParams.destination,
        dateTime: searchParams.date || new Date().toISOString(),
        passengers: Number(searchParams.passengers) || 1,
        cargoWeight: searchParams.missionType === 'Cargo' ? (Number(searchParams.passengers) || 0) : 0,
        brokerMargin: 15,
        operatorMargin: 10,
        currentDate: new Date().toISOString()
      }, aircraftList);
      
      if (parsed && parsed.data && parsed.data.aircraft_options) {
        setResults(parsed.data.aircraft_options.map((q: any, i: number) => ({
          id: String(i),
          type: q.aircraft_name,
          model: q.aircraft_name,
          operator: q.operator || 'Premium Operator',
          year: new Date().getFullYear() - Math.floor(Math.random() * 10),
          seats: aircraftList.find(a => a.type === q.aircraft_name)?.maxPassengers || q.passenger_capacity || 8,
          range: `${aircraftList.find(a => a.type === q.aircraft_name)?.range || 3000} nm`,
          speed: 'Mach 0.80',
          price: q.total_price,
          availability: q.availability_status || 'On Request',
          rating: 4.8,
          image: aircraftList.find(a => a.type === q.aircraft_name)?.image || `https://loremflickr.com/800/600/aircraft,jet,plane?lock=${q.aircraft_name?.length || 1}`
        })));
      }
      
      setLoading(false);
      setCurrentStep('results');
    } catch (error) {
      console.error('Error searching:', error);
      setLoading(false);
    }
  };

  const handleSelectAircraft = (aircraft: any) => {
    setSelectedAircraft(aircraft);
    setCurrentStep('details');
  };

  const handleGenerateQuote = async () => {
    setLoading(true);
    
    // Simulate AI quote generation
    setTimeout(() => {
      setQuoteDetails({
        basePrice: selectedAircraft.price,
        taxes: selectedAircraft.price * 0.07,
        fees: 2500,
        total: selectedAircraft.price * 1.07 + 2500,
        itinerary: [
          { leg: 1, from: searchParams.departure || 'EGLL', to: searchParams.destination || 'KJFK', date: searchParams.date || '2024-05-20', time: '10:00 AM', duration: '7h 30m' }
        ],
        terms: 'Payment due 48 hours prior to departure. Cancellation fees apply.'
      });
      setLoading(false);
      setCurrentStep('quote');
    }, 2000);
  };

  const steps = [
    { id: 'search', label: 'Search' },
    { id: 'results', label: 'Results' },
    { id: 'details', label: 'Aircraft Details' },
    { id: 'quote', label: 'Quote Generator' }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-12">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full z-0"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 rounded-full z-0 transition-all duration-500"
            style={{ width: `${(steps.findIndex(s => s.id === currentStep) / (steps.length - 1)) * 100}%` }}
          ></div>
          
          {steps.map((step, index) => {
            const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
            const isCurrent = currentStep === step.id;
            
            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                    isCompleted ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' :
                    isCurrent ? 'bg-white dark:bg-gray-900 border-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 shadow-lg' :
                    'bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 size={20} /> : index + 1}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Search */}
        {currentStep === 'search' && (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800"
          >
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-4">Find Your Perfect Flight</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">Enter your mission details below and our AI engine will instantly scan the global fleet to find the optimal aircraft for your journey.</p>
              
              <div className="flex justify-center mt-6">
                <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl inline-flex">
                  <button 
                    onClick={() => setInputMode('manual')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${inputMode === 'manual' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    Manual Entry
                  </button>
                  <button 
                    onClick={() => setInputMode('chat')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${inputMode === 'chat' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    <MessageSquare size={12} /> AI Assistant
                  </button>
                </div>
              </div>
            </div>

            {inputMode === 'chat' ? (
              <div className="max-w-4xl mx-auto space-y-4">
                <form onSubmit={handleChatSubmit} className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <MessageSquare className="text-indigo-400 dark:text-indigo-500" size={24} />
                  </div>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="e.g., 'Quote a round trip from London to Dubai tomorrow for 6 passengers'"
                    className="w-full pl-12 pr-32 py-6 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-lg font-medium outline-none"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="absolute inset-y-2 right-2 bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {chatLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                    {chatLoading ? 'Parsing...' : 'Search'}
                  </button>
                </form>
                
                <div className="flex flex-wrap gap-2 justify-center">
                  {['London to Dubai B777-300ER', 'JFK to LAX 300 passengers', 'Paris to Tokyo round trip'].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setChatInput(suggestion)}
                      className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSearch} className="space-y-6 max-w-4xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">Mission Type</label>
                  <div className="relative">
                    <Plane className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <select 
                      value={searchParams.missionType}
                      onChange={e => setSearchParams({...searchParams, missionType: e.target.value})}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white font-medium outline-none appearance-none"
                    >
                      <option value="Passenger">Passenger</option>
                      <option value="Cargo">Cargo</option>
                      <option value="VIP">VIP</option>
                      <option value="ACMI Lease">ACMI Lease</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">Departure</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      required
                      type="text" 
                      placeholder="City or Airport Code"
                      value={searchParams.departure}
                      onChange={e => setSearchParams({...searchParams, departure: e.target.value})}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white font-medium outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">Destination</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      required
                      type="text" 
                      placeholder="City or Airport Code"
                      value={searchParams.destination}
                      onChange={e => setSearchParams({...searchParams, destination: e.target.value})}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white font-medium outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      required
                      type="date" 
                      value={searchParams.date}
                      onChange={e => setSearchParams({...searchParams, date: e.target.value})}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white font-medium outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">
                    {searchParams.missionType === 'Cargo' ? 'Cargo Weight (kg)' : 'Passengers'}
                  </label>
                  <div className="relative">
                    {searchParams.missionType === 'Cargo' ? (
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    ) : (
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    )}
                    <input 
                      required
                      type="number" 
                      min={searchParams.missionType === 'Cargo' ? "0" : "1"}
                      value={searchParams.passengers}
                      onChange={e => setSearchParams({...searchParams, passengers: parseInt(e.target.value)})}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white font-medium outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-200 dark:shadow-none disabled:opacity-70"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Searching Global Fleet...
                    </div>
                  ) : (
                    <>
                      <Search size={20} />
                      Search Aircraft
                    </>
                  )}
                </button>
              </div>
            </form>
            )}
          </motion.div>
        )}

        {/* Step 2: Results */}
        {currentStep === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Available Aircraft</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Found {results.length} options matching your criteria</p>
              </div>
              <button 
                onClick={() => setCurrentStep('search')}
                className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Modify Search
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((aircraft) => (
                <motion.div 
                  key={aircraft.id}
                  whileHover={{ y: -5 }}
                  className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-800 group cursor-pointer"
                  onClick={() => handleSelectAircraft(aircraft)}
                >
                  <div className="h-48 relative overflow-hidden">
                    <img src={aircraft.image} alt={aircraft.model} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                    <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-gray-900 dark:text-white shadow-sm flex items-center gap-1">
                      <Star size={12} className="text-amber-500 fill-amber-500" />
                      {aircraft.rating}
                    </div>
                    <div className="absolute bottom-4 left-4 bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm">
                      {aircraft.type}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white">{aircraft.model}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{aircraft.operator}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">${aircraft.price.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Est. Total</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Users size={16} className="text-gray-400" />
                        <span className="text-sm font-medium">{aircraft.seats} Seats</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Activity size={16} className="text-gray-400" />
                        <span className="text-sm font-medium">{aircraft.range}</span>
                      </div>
                    </div>

                    <div className={`px-4 py-3 rounded-xl flex items-center gap-3 ${
                      aircraft.availability === 'Confirmed Available' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
                      aircraft.availability === 'Likely Available' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' :
                      'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      <CheckCircle2 size={18} />
                      <span className="text-sm font-bold">{aircraft.availability}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 3: Aircraft Details */}
        {currentStep === 'details' && selectedAircraft && (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <button 
              onClick={() => setCurrentStep('results')}
              className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors"
            >
              <ArrowRight size={16} className="rotate-180" /> Back to Results
            </button>

            <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-xl border border-gray-100 dark:border-gray-800">
              <div className="h-80 relative">
                <img src={selectedAircraft.image} alt={selectedAircraft.model} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute bottom-8 left-8 text-white">
                  <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block mb-3">
                    {selectedAircraft.type}
                  </div>
                  <h2 className="text-4xl font-black tracking-tight mb-2">{selectedAircraft.model}</h2>
                  <p className="text-lg text-gray-300 font-medium">Operated by {selectedAircraft.operator} • YOM {selectedAircraft.year}</p>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4">Aircraft Specifications</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                        <Users className="text-indigo-500 mb-2" size={24} />
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-1">Capacity</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white">{selectedAircraft.seats} Pax</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                        <Activity className="text-indigo-500 mb-2" size={24} />
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-1">Range</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white">{selectedAircraft.range}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                        <Zap className="text-indigo-500 mb-2" size={24} />
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-1">Speed</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white">{selectedAircraft.speed}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                        <Clock className="text-indigo-500 mb-2" size={24} />
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-1">Endurance</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white">12h 30m</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {['Wi-Fi', 'Flight Attendant', 'Hot Meals', 'Lie-flat Beds', 'Entertainment System', 'Satellite Phone'].map(amenity => (
                        <span key={amenity} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 h-fit">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6">Pricing Summary</h3>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Estimated Base Price</span>
                      <span className="font-bold text-gray-900 dark:text-white">${selectedAircraft.price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Taxes & Fees</span>
                      <span className="font-bold text-gray-900 dark:text-white">Calculated next step</span>
                    </div>
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <span className="font-bold text-gray-900 dark:text-white">Total Estimate</span>
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">${selectedAircraft.price.toLocaleString()}</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleGenerateQuote}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-70"
                  >
                    {loading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Generating Quote...
                      </div>
                    ) : (
                      <>
                        Generate Official Quote <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 4: Quote Generator */}
        {currentStep === 'quote' && quoteDetails && selectedAircraft && (
          <motion.div
            key="quote"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Official Charter Quote</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Quote Reference: #CQ-{Math.floor(Math.random() * 100000)}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => generateQuotePDF({ ...quoteDetails, type: selectedAircraft.model, operator: selectedAircraft.operator }, 'Charter')}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
                >
                  <Download size={16} /> Download PDF
                </button>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none">
                  <ShieldCheck size={16} /> Book Now
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                    <Plane className="text-indigo-500" /> Flight Itinerary
                  </h3>
                  
                  <div className="space-y-6">
                    {quoteDetails.itinerary.map((leg: any, idx: number) => (
                      <div key={idx} className="flex gap-6">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                            {leg.leg}
                          </div>
                          {idx < quoteDetails.itinerary.length - 1 && (
                            <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-800 my-2"></div>
                          )}
                        </div>
                        <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">{leg.date}</p>
                              <div className="flex items-center gap-4">
                                <span className="text-2xl font-black text-gray-900 dark:text-white">{leg.from}</span>
                                <ArrowRight className="text-gray-400" size={20} />
                                <span className="text-2xl font-black text-gray-900 dark:text-white">{leg.to}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{leg.time}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{leg.duration}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                    <FileText className="text-indigo-500" /> Terms & Conditions
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {quoteDetails.terms} This quote is valid for 48 hours. Subject to aircraft availability and owner approval. 
                    Price includes standard catering, landing fees, and navigation charges. De-icing, VIP catering, and ground transportation are not included unless explicitly stated.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                  
                  <h3 className="text-lg font-black mb-6 relative z-10">Cost Breakdown</h3>
                  
                  <div className="space-y-4 relative z-10">
                    <div className="flex justify-between items-center">
                      <span className="text-indigo-100 font-medium">Aircraft Charter</span>
                      <span className="font-bold">${quoteDetails.basePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-indigo-100 font-medium">Taxes (7%)</span>
                      <span className="font-bold">${quoteDetails.taxes.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-indigo-100 font-medium">Handling & Fees</span>
                      <span className="font-bold">${quoteDetails.fees.toLocaleString()}</span>
                    </div>
                    
                    <div className="pt-6 mt-6 border-t border-indigo-500/50 flex justify-between items-end">
                      <div>
                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Total Amount</p>
                        <p className="text-3xl font-black">${quoteDetails.total.toLocaleString()}</p>
                      </div>
                      <span className="text-sm font-bold text-indigo-200">USD</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-4 mb-4">
                    <img src={selectedAircraft.image} alt={selectedAircraft.model} className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
                    <div>
                      <h4 className="font-black text-gray-900 dark:text-white">{selectedAircraft.model}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{selectedAircraft.operator}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg text-center">
                      <span className="block text-gray-500 dark:text-gray-400 font-bold mb-0.5">Seats</span>
                      <span className="font-black text-gray-900 dark:text-white">{selectedAircraft.seats}</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg text-center">
                      <span className="block text-gray-500 dark:text-gray-400 font-bold mb-0.5">YOM</span>
                      <span className="font-black text-gray-900 dark:text-white">{selectedAircraft.year}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
