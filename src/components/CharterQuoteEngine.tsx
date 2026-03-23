import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, Clock, DollarSign, ShieldCheck, Zap, Star, Loader2, Info, ChevronDown, ChevronUp, MessageSquare, Send, Map as MapIcon, Route, FileText, Tag, Search, Globe, UserCheck, Fuel, ParkingCircle } from 'lucide-react';
import { generateCharterQuotes, parseNaturalLanguageQuote, getCommercialViabilitySuggestion } from '../services/aiService';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/errorService';

// Fix leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapBounds({ waypoints }: { waypoints: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (waypoints && waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map(w => [w.lat, w.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [waypoints, map]);
  return null;
}

interface QuoteEngineProps {
  aircraftList: any[];
}

export default function CharterQuoteEngine({ aircraftList }: QuoteEngineProps) {
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [quotesData, setQuotesData] = useState<any>(null);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [selectedQuoteIdx, setSelectedQuoteIdx] = useState<number>(0);
  const [inputMode, setInputMode] = useState<'manual' | 'chat'>('manual');
  const [chatInput, setChatInput] = useState('');

  const handleClearForm = () => {
    setFormData({
      departure: '',
      destination: '',
      stops: '',
      dateTime: '',
      returnDate: '',
      tripType: 'one-way',
      passengers: 4,
      cargoWeight: 100,
      aircraftPreference: '',
      brokerMargin: 15,
      operatorMargin: 0
    });
    setQuotesData(null);
    setAiSuggestion(null);
  };

  const handleSaveQuote = async (quote: any) => {
    if (!auth.currentUser) {
      alert('Please sign in to save quotes.');
      return;
    }
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'quotes'), {
        userId: auth.currentUser.uid,
        status: 'draft',
        legs: quote.waypoints.map((w: any, i: number) => {
          if (i === quote.waypoints.length - 1) return null;
          const next = quote.waypoints[i+1];
          return {
            departure: w.icao,
            destination: next.icao,
            distance: quote.route?.distance_nm || 0,
            flightTime: quote.flight_time_hours,
            aircraftType: quote.aircraft_name,
            costs: quote.cost_breakdown
          };
        }).filter(Boolean),
        totalCost: quote.total_price,
        createdAt: new Date().toISOString()
      });
      alert('Quote saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleGetAISuggestion = async () => {
    setAiSuggestionLoading(true);
    try {
      const suggestion = await getCommercialViabilitySuggestion(quotesData, formData);
      setAiSuggestion(suggestion);
    } catch (error) {
      console.error('Failed to get AI suggestion:', error);
      alert('Failed to get AI suggestion. Please try again.');
    } finally {
      setAiSuggestionLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    departure: '',
    destination: '',
    stops: '',
    dateTime: '',
    returnDate: '',
    tripType: 'one-way',
    passengers: 4,
    cargoWeight: 100,
    aircraftPreference: '',
    brokerMargin: 15,
    operatorMargin: 0
  });

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    setChatLoading(true);
    try {
      const parsed = await parseNaturalLanguageQuote(chatInput);
      setFormData({
        ...formData,
        departure: parsed.departure || formData.departure,
        destination: parsed.destination || formData.destination,
        dateTime: parsed.dateTime || formData.dateTime,
        passengers: parsed.passengers || formData.passengers,
        tripType: parsed.tripType || formData.tripType,
        returnDate: parsed.returnDate || formData.returnDate,
        aircraftPreference: parsed.aircraftPreference || formData.aircraftPreference
      });
      setInputMode('manual'); // Switch back to manual to let user review/submit
    } catch (error) {
      console.error('Failed to parse chat:', error);
      alert('Could not understand the request. Please try manual entry.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Fetch airport data from Firestore for departure and destination to provide context to AI
      const airportsData: any[] = [];
      const codes = [formData.departure, formData.destination, ...formData.stops.split(',').map(s => s.trim())].filter(Boolean);
      
      for (const code of codes) {
        const q = query(collection(db, 'airports'), where('icao', '==', code.toUpperCase()), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          airportsData.push(snapshot.docs[0].data());
        }
      }

      const result = await generateCharterQuotes({
        ...formData,
        brokerMargin: formData.brokerMargin,
        operatorMargin: formData.operatorMargin,
        currentDate: new Date().toISOString(),
        airportsContext: airportsData // Pass enriched airport data
      }, aircraftList);
      setQuotesData(result);
      setSelectedQuoteIdx(0); // Reset selection to first quote
    } catch (error) {
      console.error('Failed to generate quotes:', error);
      alert('Failed to generate quotes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getQuoteIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'cheapest': return <DollarSign size={20} className="text-emerald-500" />;
      case 'fastest': return <Zap size={20} className="text-amber-500" />;
      case 'recommended': return <Star size={20} className="text-indigo-500" />;
      default: return <Plane size={20} className="text-gray-500" />;
    }
  };

  const getQuoteColor = (type: string, isSelected: boolean) => {
    let base = 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';
    switch (type.toLowerCase()) {
      case 'cheapest': base = 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/20'; break;
      case 'fastest': base = 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/20'; break;
      case 'recommended': base = 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/20'; break;
    }
    if (isSelected) {
      base += ' ring-2 ring-indigo-500 shadow-xl shadow-indigo-100 dark:shadow-none';
    } else {
      base += ' hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer';
    }
    return base;
  };

  const renderCostSection = (title: string, data: any) => {
    if (!data) return null;
    return (
      <div className="mb-4">
        <h5 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">{title}</h5>
        <div className="space-y-1">
          {Object.entries(data).map(([key, value]: [string, any]) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {typeof value === 'number' ? 
                    (key.includes('margin') || key.includes('impact') ? `${value}%` : `$${value.toLocaleString()}`) : 
                    ''}
                </span>
              </div>
              {typeof value === 'object' && value !== null && (
                <div className="pl-3 border-l border-gray-100 dark:border-gray-800 ml-1 space-y-1">
                  {Object.entries(value).map(([subKey, subValue]: [string, any]) => (
                    <div key={subKey} className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-400 dark:text-gray-500 capitalize">{subKey.replace(/_/g, ' ')}</span>
                      <span className="text-gray-600 dark:text-gray-300">
                        {typeof subValue === 'number' ? 
                          (subKey.includes('margin') || subKey.includes('impact') ? `${subValue}%` : `$${subValue.toLocaleString()}`) : 
                          String(subValue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const selectedWaypoints = quotesData?.aircraft_options?.[selectedQuoteIdx]?.waypoints || [];
  const polylinePositions = selectedWaypoints.map((w: any) => [w.lat, w.lng] as [number, number]);

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Charter Quote Engine</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Professional Broker Pricing System</p>
          </div>
          
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
            <button
              onClick={() => setInputMode('manual')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${inputMode === 'manual' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              Manual Entry
            </button>
            <button
              onClick={() => setInputMode('chat')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${inputMode === 'chat' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              <MessageSquare size={14} /> AI Assistant
            </button>
          </div>
        </div>

        {inputMode === 'chat' ? (
          <div className="space-y-4">
            <motion.form 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              onSubmit={handleChatSubmit} 
              className="relative"
            >
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <MessageSquare className="text-indigo-400 dark:text-indigo-500" size={24} />
              </div>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="e.g., 'Quote a round trip from London to Dubai tomorrow for 6 passengers, returning next Friday'"
                className="w-full pl-12 pr-32 py-6 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-lg font-medium outline-none"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="absolute inset-y-2 right-2 bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {chatLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                {chatLoading ? 'Parsing...' : 'Parse'}
              </button>
            </motion.form>
            
            <div className="flex flex-wrap gap-2">
              {['London to Dubai tomorrow', 'JFK to LAX next week', 'Paris to Tokyo round trip'].map((suggestion) => (
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
          <motion.form 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onSubmit={handleGenerate} 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Trip Type</label>
              <select 
                value={formData.tripType}
                onChange={e => setFormData({...formData, tripType: e.target.value})}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              >
                <option value="one-way">One-Way</option>
                <option value="round-trip">Round Trip</option>
                <option value="multi-day">Multi-Day</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Departure (ICAO/IATA)</label>
              <input 
                required
                type="text" 
                placeholder="e.g., EGLL"
                value={formData.departure}
                onChange={e => setFormData({...formData, departure: e.target.value.toUpperCase()})}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Destination (ICAO/IATA)</label>
              <input 
                required
                type="text" 
                placeholder="e.g., KJFK"
                value={formData.destination}
                onChange={e => setFormData({...formData, destination: e.target.value.toUpperCase()})}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Stops / Via (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g., LFPB, LIRF"
                value={formData.stops}
                onChange={e => setFormData({...formData, stops: e.target.value.toUpperCase()})}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Departure Date</label>
              <input 
                required
                type="datetime-local" 
                value={formData.dateTime}
                onChange={e => setFormData({...formData, dateTime: e.target.value})}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            {formData.tripType !== 'one-way' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Return Date</label>
                <input 
                  required={formData.tripType !== 'one-way'}
                  type="datetime-local" 
                  value={formData.returnDate}
                  onChange={e => setFormData({...formData, returnDate: e.target.value})}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Passengers</label>
              <input 
                required
                type="number" 
                min="1"
                value={formData.passengers}
                onChange={e => setFormData({...formData, passengers: parseInt(e.target.value)})}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Cargo Weight (kg)</label>
              <input 
                required
                type="number" 
                min="0"
                value={formData.cargoWeight}
                onChange={e => setFormData({...formData, cargoWeight: parseInt(e.target.value)})}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Aircraft Preference (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g., Heavy Jet, Global 6000"
                value={formData.aircraftPreference}
                onChange={e => setFormData({...formData, aircraftPreference: e.target.value})}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Broker Margin (%)</label>
              <input 
                type="number" 
                min="10"
                max="30"
                value={formData.brokerMargin}
                onChange={e => setFormData({...formData, brokerMargin: parseInt(e.target.value)})}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Operator Margin (%)</label>
              <input 
                type="number" 
                value={formData.operatorMargin}
                onChange={e => setFormData({...formData, operatorMargin: parseInt(e.target.value)})}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            
            <div className="md:col-span-2 lg:col-span-4 mt-2 flex gap-4">
              <button 
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                {loading ? 'Analyzing Routes & Pricing...' : 'Generate Broker Quotes'}
              </button>
              <button 
                type="button"
                onClick={handleClearForm}
                className="px-6 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-200 dark:hover:bg-gray-800 transition-all"
              >
                Clear
              </button>
            </div>
          </motion.form>
        )}
      </div>

      {/* Results Section */}
      {quotesData && (
        <div className="space-y-6">
          {/* Map and Route Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-80 bg-gray-100 dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 relative z-0">
              <MapContainer center={[20, 0]} zoom={2} className="w-full h-full">
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  className="map-tiles"
                />
                {selectedWaypoints.length > 0 && (
                  <>
                    <Polyline positions={polylinePositions} color="#4f46e5" weight={3} dashArray="5, 10" />
                    {selectedWaypoints.map((wp: any, i: number) => (
                      <Marker key={i} position={[wp.lat, wp.lng]}>
                        <Popup className="dark-popup">
                          <div className="font-bold text-gray-900 dark:text-white">{wp.icao}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{wp.name}</div>
                          <div className="text-[10px] uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mt-1">{wp.type}</div>
                        </Popup>
                      </Marker>
                    ))}
                    <MapBounds waypoints={selectedWaypoints} />
                  </>
                )}
              </MapContainer>
            </div>

            {quotesData.route && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <MapIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white">Route Analysis</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span className="flex items-center gap-1"><Route size={14} /> {quotesData.route.routing_distance_nm?.toLocaleString()} nm</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex-grow">
                  <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl h-full border border-gray-100 dark:border-gray-700 space-y-4">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white mb-2 text-xs uppercase tracking-widest">Routing Notes</p>
                      <p className="text-xs">{quotesData.route.route_notes}</p>
                    </div>

                    {quotesData.route.optimization_suggestions && (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-3">
                        <p className="font-bold text-indigo-600 dark:text-indigo-400 text-[10px] uppercase tracking-widest">AI Optimization Suggestions</p>
                        {quotesData.route.optimization_suggestions.cheaper_route && (
                          <div className="flex gap-2 items-start">
                            <Zap size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Cheaper Route</p>
                              <p className="text-[11px] leading-relaxed">{quotesData.route.optimization_suggestions.cheaper_route}</p>
                            </div>
                          </div>
                        )}
                        {quotesData.route.optimization_suggestions.fuel_stop_recommendation && (
                          <div className="flex gap-2 items-start">
                            <DollarSign size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Fuel Stop Recommendation</p>
                              <p className="text-[11px] leading-relaxed">{quotesData.route.optimization_suggestions.fuel_stop_recommendation}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {selectedWaypoints.some((w: any) => w.type === 'fuel_stop') && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-lg">
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-500 uppercase tracking-widest mb-1">Fuel Stops Required</p>
                        <ul className="text-sm text-amber-700 dark:text-amber-400 list-disc list-inside">
                          {selectedWaypoints.filter((w: any) => w.type === 'fuel_stop').map((w: any, i: number) => (
                            <li key={i}>{w.icao} - {w.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Quotes Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {quotesData.aircraft_options?.map((quote: any, idx: number) => (
              <motion.div 
                key={idx}
                onClick={() => setSelectedQuoteIdx(idx)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`rounded-3xl ${getQuoteColor(quote.option_type, selectedQuoteIdx === idx)} overflow-hidden flex flex-col`}
              >
                <div className="p-6 border-b border-gray-100/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-black px-2 py-1 rounded-md">OPTION {idx + 1}</span>
                      {getQuoteIcon(quote.option_type)}
                      <span className="font-black uppercase tracking-widest text-sm text-gray-900 dark:text-white">{quote.option_type}</span>
                      {quote.is_empty_leg && (
                        <span className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1">
                          <Zap size={10} /> Empty Leg
                        </span>
                      )}
                    </div>
                    {quote.option_type.toLowerCase() === 'recommended' && (
                      <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">Best Value</span>
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{quote.aircraft_name}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{quote.flight_time_hours?.toFixed(1)} hrs</span>
                    </div>
                    {quote.round_trip_discount_applied > 0 && (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Tag size={14} />
                        <span>RT Discount: -${quote.round_trip_discount_applied?.toLocaleString()}</span>
                      </div>
                    )}
                    {quote.optimization_rank && (
                      <div className="flex items-center gap-1">
                        <Zap size={14} className="text-amber-500" />
                        <span>Rank: {quote.optimization_rank}/10</span>
                      </div>
                    )}
                    {quote.commercial_viability_score && (
                      <div className="flex items-center gap-1">
                        <ShieldCheck size={14} className="text-indigo-500" />
                        <span>Viability: {quote.commercial_viability_score}/10</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 flex-grow bg-white dark:bg-gray-800">
                  <div className="mb-6 grid grid-cols-3 gap-2 items-end">
                    <div className="col-span-1">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Total Est. Cost</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white">${quote.total_price?.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Est. Profit</p>
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">${quote.profit?.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Profit Margin</p>
                      <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                        {quote.profit_margin ? `${quote.profit_margin}%` : `${((quote.profit / quote.total_price) * 100).toFixed(1)}%`}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedQuote(expandedQuote === quote.option_type ? null : quote.option_type);
                      }}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Full Cost Breakdown</span>
                      {expandedQuote === quote.option_type ? <ChevronUp size={16} className="text-gray-500 dark:text-gray-400" /> : <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />}
                    </button>
                    
                    <AnimatePresence>
                      {expandedQuote === quote.option_type && quote.cost_breakdown && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 mt-2">
                            {quote.cost_breakdown.operator_base_cost && (
                              <div className="mb-4 flex justify-between items-center text-xs font-bold border-b border-gray-100 dark:border-gray-700 pb-2">
                                <span className="text-gray-600 dark:text-gray-300 uppercase tracking-widest">Operator Base Cost</span>
                                <span className="text-gray-900 dark:text-white">${quote.cost_breakdown.operator_base_cost?.toLocaleString()}</span>
                              </div>
                            )}
                            {renderCostSection('Flight Costs', quote.cost_breakdown.flight_costs)}
                            {renderCostSection('Airport Costs', quote.cost_breakdown.airport_costs)}
                            {renderCostSection('Airspace Costs', quote.cost_breakdown.airspace_costs)}
                            {renderCostSection('Operational Costs', quote.cost_breakdown.operational_costs)}
                            {renderCostSection('Margins', quote.cost_breakdown.margins)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="p-6 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                    <Info size={16} className="mt-0.5 flex-shrink-0 text-indigo-400 dark:text-indigo-500" />
                    <ul className="text-xs space-y-1">
                      {quote.notes?.map((note: string, i: number) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveQuote(quote);
                      }}
                      className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <FileText size={14} /> Save Quote
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // Placeholder for send functionality
                        alert('Sending to client...');
                      }}
                      className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
                    >
                      <Send size={14} /> Send to Client
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-6">
            <button 
              onClick={handleGetAISuggestion}
              disabled={aiSuggestionLoading}
              className="w-full bg-indigo-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {aiSuggestionLoading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
              {aiSuggestionLoading ? 'Analyzing Viability...' : 'Get AI Commercial Viability Suggestion'}
            </button>
          </div>

          {aiSuggestion && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800/30"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-black text-indigo-800 dark:text-indigo-500 uppercase tracking-widest">AI Commercial Viability Suggestion</h4>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    aiSuggestion.clientPriceCompetitiveness === 'High' ? 'bg-emerald-100 text-emerald-700' :
                    aiSuggestion.clientPriceCompetitiveness === 'Medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    Price: {aiSuggestion.clientPriceCompetitiveness}
                  </span>
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                    Profit: {aiSuggestion.estimatedProfitMargin}%
                  </span>
                </div>
              </div>
              <div className="space-y-4 text-sm text-indigo-900 dark:text-indigo-200">
                <p><strong>Best Aircraft:</strong> {aiSuggestion.bestAircraft}</p>
                <p><strong>Strategy:</strong> {aiSuggestion.bestRouteStrategy}</p>
                <p><strong>Commercial Reasoning:</strong> {aiSuggestion.commercialReasoning}</p>
              </div>
            </motion.div>
          )}

          {/* Export Options */}
          <div className="flex gap-4 mt-6">
            <button onClick={() => window.print()} className="flex-1 bg-gray-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
              <FileText size={20} /> PDF
            </button>
            <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Check out these charter quotes: ' + JSON.stringify(quotesData))}`)} className="flex-1 bg-emerald-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
              <MessageSquare size={20} /> WhatsApp
            </button>
            <button onClick={() => window.open(`mailto:?subject=Charter Quotes&body=${encodeURIComponent(JSON.stringify(quotesData))}`)} className="flex-1 bg-indigo-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
              <Send size={20} /> Email
            </button>
          </div>

          {/* General Notes */}
          {quotesData.general_notes && quotesData.general_notes.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-3xl border border-amber-100 dark:border-amber-800/30">
              <h4 className="text-xs font-black text-amber-800 dark:text-amber-500 uppercase tracking-widest mb-3">Broker Advisory Notes</h4>
              <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-2 list-disc list-inside">
                {quotesData.general_notes.map((note: string, i: number) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
