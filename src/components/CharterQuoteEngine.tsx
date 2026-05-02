import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, Clock, DollarSign, ShieldCheck, Zap, Star, Loader2, Info, ChevronDown, ChevronUp, MessageSquare, Send, Map as MapIcon, Route, FileText, Tag, Search, Globe, UserCheck, Fuel, ParkingCircle, RefreshCw, Sparkles, Package, Layers, User, Keyboard, Navigation, Moon, X, ChevronRight, Mail, Phone, Cloud } from 'lucide-react';
import { generateCharterQuotes, parseNaturalLanguageQuote, getCommercialViabilitySuggestion, generateACMIQuote, getFlightRouteDetails, getSuggestedAircraft, searchHandlingAgents } from '../services/aiService';
import { generateQuotePDF } from '../utils/pdfGenerator';
import { safeStringify } from '../utils/safeJson';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/errorService';
import { CHART_LAYERS, DefaultIcon } from '../lib/mapConfig';

// Set default icon for all markers
L.Marker.prototype.options.icon = DefaultIcon;

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

function MapEventsHandler({ onMapClick }: { onMapClick: (e: any) => void }) {
  useMapEvents({
    click: onMapClick,
  });
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Force a resize calculation after a short delay to ensure container is ready
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    // Also use ResizeObserver for more robust handling
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    const container = map.getContainer();
    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [map]);
  return null;
}

interface QuoteEngineProps {
  aircraftList: any[];
  isDarkMode?: boolean;
}

export default function CharterQuoteEngine({ aircraftList, isDarkMode = false }: QuoteEngineProps) {
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [quotesData, setQuotesData] = useState<any>(null);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [missionAnalysis, setMissionAnalysis] = useState<any>(null);
  const [isAnalyzingMission, setIsAnalyzingMission] = useState(false);
  const [acmiQuote, setAcmiQuote] = useState<any>(null);
  const [isGeneratingACMI, setIsGeneratingACMI] = useState(false);
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);

  const handleGenerateACMI = async () => {
    if (!formData.departure || !formData.destination || !formData.aircraftPreference) {
      alert("Please fill in departure, destination, and aircraft preference.");
      return;
    }

    setIsGeneratingACMI(true);
    try {
      const quote = await generateACMIQuote({
        departure: formData.departure,
        destination: formData.destination,
        aircraftType: formData.aircraftPreference,
        missionType: 'ACMI Lease',
        departureDate: formData.dateTime,
        payload: Number(formData.cargoWeight) || 0,
        currentDate: new Date().toISOString()
      });
      setAcmiQuote(quote);
      if (quote.isFallback) {
        setIsFallback(true);
      }
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota') || error?.status === 429) {
        setIsFallback(true);
      } else {
        alert("Failed to generate ACMI quote");
      }
    } finally {
      setIsGeneratingACMI(false);
    }
  };
  const [selectedQuoteIdx, setSelectedQuoteIdx] = useState<number>(0);
  const [inputMode, setInputMode] = useState<'manual' | 'chat'>('manual');
  const [chatInput, setChatInput] = useState('');
  const [isFallback, setIsFallback] = useState(false);
  const [missionType, setMissionType] = useState<'Passenger' | 'Cargo' | 'VIP' | 'ACMI Lease'>('Passenger');
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [activeChart, setActiveChart] = useState<string>('standard');
  const [chartNightMode, setChartNightMode] = useState(isDarkMode || false);
  const [showChartSelector, setShowChartSelector] = useState(false);

  const displayLoading = loading || chatLoading || aiSuggestionLoading || isAnalyzingMission || isGeneratingACMI;

  useEffect(() => {
    setChartNightMode(isDarkMode || false);
  }, [isDarkMode]);

  const getTileLayer = (chartId: string) => {
    const chart = CHART_LAYERS[chartId as keyof typeof CHART_LAYERS];
    const url = typeof chart.url === 'function' ? chart.url(isDarkMode) : chart.url;
    const isAero = chartId !== 'standard';
    const filterStyle = (isAero && chartNightMode) 
      ? 'invert(100%) hue-rotate(180deg) brightness(0.7) contrast(1.2)' 
      : '';

    return (
      <TileLayer 
        key={`${chartId}-${chartNightMode}-${isDarkMode}`}
        url={url}
        attribution={chart.attribution}
        subdomains={chart.subdomains && (Array.isArray(chart.subdomains) ? chart.subdomains.length > 0 : chart.subdomains.length > 0) ? chart.subdomains : 'abc'}
        maxZoom={18}
        maxNativeZoom={(chart as any).maxZoom || 18}
        tms={chart.tms}
        className="map-tiles"
        crossOrigin="anonymous"
        detectRetina={true}
        eventHandlers={{
          add: (e) => {
            const container = e.target.getContainer();
            if (container) {
              container.style.filter = filterStyle;
            }
          }
        }}
      />
    );
  };

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
      operatorMargin: 0,
      specialInstructions: '',
      customWaypoints: [] as {lat: number, lng: number}[]
    });
    setMissionType('Passenger');
    setShowMapEditor(false);
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
    passengers: 4 as number | '',
    cargoWeight: 100 as number | '',
    aircraftPreference: '',
    brokerMargin: 15 as number | '',
    operatorMargin: 0 as number | '',
    specialInstructions: '',
    customWaypoints: [] as {lat: number, lng: number}[]
  });

  const [departureAgents, setDepartureAgents] = useState<any[]>([]);
  const [destinationAgents, setDestinationAgents] = useState<any[]>([]);
  const [departureNotams, setDepartureNotams] = useState<any[]>([]);
  const [destinationNotams, setDestinationNotams] = useState<any[]>([]);
  const [departureWeather, setDepartureWeather] = useState<any>(null);
  const [destinationWeather, setDestinationWeather] = useState<any>(null);
  const [depNotamFilter, setDepNotamFilter] = useState<string>('All');
  const [destNotamFilter, setDestNotamFilter] = useState<string>('All');
  const [fetchingDepAgents, setFetchingDepAgents] = useState(false);
  const [fetchingDestAgents, setFetchingDestAgents] = useState(false);
  const [selectedDepAgent, setSelectedDepAgent] = useState<any>(null);
  const [selectedDestAgent, setSelectedDestAgent] = useState<any>(null);

  useEffect(() => {
    if (formData.departure && formData.departure.length >= 4) {
      const fetchAgents = async () => {
        setFetchingDepAgents(true);
        try {
          const [agentResult, notamResult, weatherResult] = await Promise.all([
            searchHandlingAgents(formData.departure, formData.aircraftPreference).catch(() => ({ agents: [] })),
            import('../services/weatherService').then(m => m.getLiveNotams(formData.departure)).catch(() => ({ notams: [] })),
            import('../services/weatherService').then(m => m.getLiveWeather(formData.departure)).catch(() => null)
          ]);
          setDepartureAgents(agentResult.agents || []);
          setDepartureNotams(notamResult.notams || []);
          setDepartureWeather(weatherResult || null);
        } catch (error) {
          console.error('Error fetching departure data:', error);
        } finally {
          setFetchingDepAgents(false);
        }
      };
      const timer = setTimeout(fetchAgents, 1000);
      return () => clearTimeout(timer);
    } else {
      setDepartureAgents([]);
      setDepartureNotams([]);
      setDepartureWeather(null);
    }
  }, [formData.departure]);

  useEffect(() => {
    if (formData.destination && formData.destination.length >= 4) {
      const fetchAgents = async () => {
        setFetchingDestAgents(true);
        try {
          const [agentResult, notamResult, weatherResult] = await Promise.all([
            searchHandlingAgents(formData.destination, formData.aircraftPreference).catch(() => ({ agents: [] })),
            import('../services/weatherService').then(m => m.getLiveNotams(formData.destination)).catch(() => ({ notams: [] })),
            import('../services/weatherService').then(m => m.getLiveWeather(formData.destination)).catch(() => null)
          ]);
          setDestinationAgents(agentResult.agents || []);
          setDestinationNotams(notamResult.notams || []);
          setDestinationWeather(weatherResult || null);
        } catch (error) {
          console.error('Error fetching destination data:', error);
        } finally {
          setFetchingDestAgents(false);
        }
      };
      const timer = setTimeout(fetchAgents, 1000);
      return () => clearTimeout(timer);
    } else {
      setDestinationAgents([]);
      setDestinationNotams([]);
      setDestinationWeather(null);
    }
  }, [formData.destination]);

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
        cargoWeight: parsed.cargoWeight || formData.cargoWeight,
        tripType: parsed.tripType || formData.tripType,
        returnDate: parsed.returnDate || formData.returnDate,
        aircraftPreference: parsed.aircraftPreference || formData.aircraftPreference
      });
      
      if (parsed.cargoWeight > 0 && (!parsed.passengers || parsed.passengers === 0)) {
        setMissionType('Cargo');
      } else {
        setMissionType('Passenger');
      }
      
      setInputMode('manual'); // Switch back to manual to let user review/submit
    } catch (error: any) {
      console.error('Failed to parse chat:', error);
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota') || error?.status === 429) {
        alert('AI Quota Exceeded. Please try manual entry.');
      } else {
        alert('Could not understand the request. Please try manual entry.');
      }
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIsFallback(false);
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
        missionType: missionType,
        passengers: (missionType === 'Passenger' || missionType === 'VIP') ? (Number(formData.passengers) || 0) : 0,
        cargoWeight: missionType === 'Cargo' ? (Number(formData.cargoWeight) || 0) : 0,
        brokerMargin: Number(formData.brokerMargin) || 0,
        operatorMargin: Number(formData.operatorMargin) || 0,
        currentDate: new Date().toISOString(),
        airportsContext: airportsData // Pass enriched airport data
      }, aircraftList);
      setQuotesData(result.data);
      setIsFallback(result.isFallback);
      setSelectedQuoteIdx(0); // Reset selection to first quote
    } catch (error: any) {
      console.error('Failed to generate quotes:', error);
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota') || error?.status === 429) {
        setIsFallback(true);
      } else {
        alert('Failed to generate quotes. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAIAnalysis = async () => {
    if (!formData.departure || !formData.destination) {
      alert('Please enter departure and destination.');
      return;
    }

    setIsAnalyzingMission(true);
    setMissionAnalysis(null);
    try {
      // 1. Get route details to get distance
      const routeDetails = await getFlightRouteDetails(formData.departure, formData.destination);
      const distance = routeDetails.routingDistance || routeDetails.gcDistance;

      // 2. Get suggested aircraft
      const passengers = (missionType === 'Passenger' || missionType === 'VIP') ? (Number(formData.passengers) || 0) : 0;
      const cargoWeight = missionType === 'Cargo' ? (Number(formData.cargoWeight) || 0) : 0;

      const suggestions = await getSuggestedAircraft(
        passengers,
        cargoWeight,
        distance,
        aircraftList,
        formData.departure,
        missionType
      );

      setMissionAnalysis({
        ...suggestions,
        distance,
        routeDetails
      });
    } catch (error: any) {
      console.error('AI Analysis failed:', error);
      if (error?.message?.includes('429') || error?.message?.toLowerCase().includes('quota') || error?.status === 429) {
        alert('AI Quota Exceeded. Please try again later.');
      } else {
        alert('Failed to perform AI analysis. Please try again.');
      }
    } finally {
      setIsAnalyzingMission(false);
    }
  };

  const getQuoteIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'cheapest': return <DollarSign size={20} className="text-emerald-500" />;
      case 'fastest': return <Zap size={20} className="text-amber-500" />;
      case 'recommended': return <Star size={20} className="text-indigo-500" />;
      case 'Cargo': return <Package size={20} className="text-blue-500" />;
      default: return <Plane size={20} className="text-gray-500" />;
    }
  };

  const getQuoteColor = (type: string, isSelected: boolean) => {
    let base = 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';
    switch (type.toLowerCase()) {
      case 'cheapest': base = 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/20'; break;
      case 'fastest': base = 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/20'; break;
      case 'recommended': base = 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/20'; break;
      case 'Cargo': base = 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/20'; break;
    }
    if (isSelected) {
      base += ' ring-2 ring-indigo-500 shadow-xl shadow-indigo-100 dark:shadow-none';
    } else {
      base += ' hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer';
    }
    return base;
  };

  const handleQuoteCostChange = (quoteIdx: number, sectionPath: string, key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newQuotesData = { ...quotesData };
    const quote = newQuotesData.aircraft_options[quoteIdx];
    
    const pathParts = sectionPath.split('.');
    let target = quote.cost_breakdown;
    
    if (sectionPath !== 'root') {
      for (const part of pathParts) {
        if (part) {
          if (!target[part]) target[part] = {};
          target = target[part];
        }
      }
    }
    
    target[key] = numValue;
    
    // Recalculate total price
    const sumAll = (obj: any): number => {
      let sum = 0;
      for (const k in obj) {
        if (k === 'total' || k === 'total_price' || k.includes('margin')) continue;
        if (typeof obj[k] === 'number') sum += obj[k];
        else if (typeof obj[k] === 'object' && obj[k] !== null) sum += sumAll(obj[k]);
      }
      return sum;
    };
    
    const baseCosts = sumAll(quote.cost_breakdown);
    const margins = quote.cost_breakdown.margins || {};
    const brokerMargin = margins.broker_margin_amount || 0;
    const operatorMargin = margins.operator_margin_amount || 0;
    
    quote.total_price = baseCosts + brokerMargin + operatorMargin;
    quote.profit = brokerMargin;
    quote.profit_margin = quote.total_price > 0 ? parseFloat(((quote.profit / quote.total_price) * 100).toFixed(1)) : 0;
    
    setQuotesData(newQuotesData);
  };

  const renderCostSection = (title: string, data: any, quoteIdx: number, sectionKey: string) => {
    if (!data) return null;
    return (
      <div className="mb-4">
        <h5 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">{title}</h5>
        <div className="space-y-2">
          {Object.entries(data).map(([key, value]: [string, any]) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                {typeof value === 'number' ? (
                  <div className="relative">
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">$</span>
                    <input 
                      type="number"
                      value={value}
                      onChange={(e) => handleQuoteCostChange(quoteIdx, sectionKey, key, e.target.value)}
                      className="w-24 p-1 pl-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-right font-bold text-gray-900 dark:text-white text-[10px] outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                ) : (
                  <span className="font-bold text-gray-900 dark:text-white">
                    {typeof value === 'object' && value !== null ? '' : String(value)}
                  </span>
                )}
              </div>
              {typeof value === 'object' && value !== null && (
                <div className="pl-3 border-l border-gray-100 dark:border-gray-800 ml-1 space-y-2">
                  {Object.entries(value).map(([subKey, subValue]: [string, any]) => (
                    <div key={subKey} className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-400 dark:text-gray-500 capitalize">{subKey.replace(/_/g, ' ')}</span>
                      <div className="relative">
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] text-gray-400">$</span>
                        <input 
                          type="number"
                          value={typeof subValue === 'number' ? subValue : 0}
                          onChange={(e) => handleQuoteCostChange(quoteIdx, `${sectionKey}.${key}`, subKey, e.target.value)}
                          className="w-20 p-1 pl-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-right font-bold text-gray-600 dark:text-gray-300 text-[9px] outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
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

  const handleMapClick = (e: any) => {
    const { lat, lng } = e.latlng;
    setFormData(prev => ({
      ...prev,
      customWaypoints: [...prev.customWaypoints, { lat, lng }]
    }));
  };

  const handleWaypointDrag = (index: number, e: any) => {
    const { lat, lng } = e.target.getLatLng();
    setFormData(prev => {
      const newWaypoints = [...prev.customWaypoints];
      newWaypoints[index] = { lat, lng };
      return { ...prev, customWaypoints: newWaypoints };
    });
  };

  const removeCustomWaypoint = (index: number) => {
    setFormData(prev => {
      const newWaypoints = [...prev.customWaypoints];
      newWaypoints.splice(index, 1);
      return { ...prev, customWaypoints: newWaypoints };
    });
  };

  const selectedWaypoints = quotesData?.aircraft_options?.[selectedQuoteIdx]?.waypoints || [];
  const polylinePositions = selectedWaypoints.map((w: any) => [w.lat, w.lng] as [number, number]);

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Charter Quote Engine</h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Professional Broker Pricing System</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Mission Type Dropdown */}
            <div className="relative">
              <select
                value={missionType}
                onChange={(e) => setMissionType(e.target.value as any)}
                className="pl-4 pr-10 py-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
              >
                <option value="Passenger">Passenger</option>
                <option value="Cargo">Cargo</option>
                <option value="VIP">VIP</option>
                <option value="ACMI Lease">ACMI Lease</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12} />
            </div>

            {/* Manual/AI Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
              <button
                onClick={() => setInputMode('manual')}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${inputMode === 'manual' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                <Keyboard size={12} /> Manual Entry
              </button>
              <button
                onClick={() => setInputMode('chat')}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${inputMode === 'chat' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                <MessageSquare size={12} /> AI Assistant
              </button>
            </div>
          </div>
        </div>

        {isFallback && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-start gap-3">
            <div className="mt-0.5 text-amber-600 dark:text-amber-500">
              <Sparkles size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">API Rate Limit Exceeded</h4>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                We are currently showing sample charter quotes data because the AI generation quota has been reached. Please try again later for live results.
              </p>
            </div>
          </div>
        )}

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
                placeholder={missionType === 'Passenger' 
                  ? "e.g., 'Quote a round trip from London to Dubai tomorrow for 6 passengers, returning next Friday'"
                  : "e.g., 'Quote 5000kg of medical supplies from Frankfurt to Nairobi, urgent delivery'"
                }
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
              {(missionType === 'Passenger' 
                ? ['London to Dubai B777-300ER', 'JFK to LAX 300 passengers', 'Paris to Tokyo round trip']
                : ['Frankfurt to Nairobi 5000kg', 'Dubai to Hong Kong electronics', 'Liege to Chicago urgent cargo']
              ).map((suggestion) => (
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
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Mission Type</label>
              <select 
                value={missionType}
                onChange={e => setMissionType(e.target.value as any)}
                className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none appearance-none"
              >
                <option value="Passenger">Passenger</option>
                <option value="Cargo">Cargo</option>
                <option value="VIP">VIP</option>
                <option value="ACMI Lease">ACMI Lease</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Trip Type</label>
              <select 
                value={formData.tripType}
                onChange={e => setFormData({...formData, tripType: e.target.value})}
                className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none appearance-none"
              >
                <option value="one-way">One-Way</option>
                <option value="round-trip">Round Trip</option>
                <option value="multi-day">Multi-Day</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Departure (ICAO/IATA)</label>
              <div className="relative">
                <input 
                  required
                  type="text" 
                  placeholder="e.g., EGLL"
                  value={formData.departure}
                  onChange={e => setFormData({...formData, departure: e.target.value.toUpperCase()})}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
                {fetchingDepAgents && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="animate-spin text-indigo-500" size={14} />
                  </div>
                )}
              </div>
              {departureAgents.length > 0 && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <UserCheck size={10} /> Handling Agents at {formData.departure}
                  </p>
                  <div className="space-y-2">
                    {departureAgents.map((agent, idx) => {
                      const isSelected = selectedDepAgent?.companyName === agent.companyName;
                      return (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedDepAgent(isSelected ? null : agent)}
                          className={`p-2 rounded-lg border transition-all cursor-pointer ${
                            isSelected 
                              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' 
                              : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                          }`}
                        >
                          <div className="flex justify-between items-center text-[9px] mb-1">
                            <span className="text-gray-900 dark:text-white font-bold truncate max-w-[120px]">{agent.companyName}</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-black">${agent.baseFee}</span>
                          </div>
                          {isSelected && (
                            <div className="space-y-1 mt-1 pt-1 border-t border-indigo-100 dark:border-indigo-800/50">
                              <div className="flex items-center gap-1.5 text-[8px] text-gray-500 dark:text-gray-400">
                                <Mail size={10} /> <span className="truncate">{agent.email}</span>
                              </div>
                              {agent.phone && (
                                <div className="flex items-center gap-1.5 text-[8px] text-gray-500 dark:text-gray-400">
                                  <Phone size={10} /> <span>{agent.phone}</span>
                                </div>
                              )}
                              {agent.website && (
                                <div className="flex items-center gap-1.5 text-[8px] text-indigo-500">
                                  <Globe size={10} /> <a href={agent.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{agent.website.replace(/^https?:\/\//, '')}</a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {departureWeather && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Cloud size={10} /> Live Weather at {formData.departure}
                  </p>
                  <div className="space-y-2 text-[9px]">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                      <span className="font-bold text-gray-700 dark:text-gray-300 block mb-1">METAR</span>
                      <span className="font-mono text-gray-600 dark:text-gray-400 break-words">{departureWeather.metar}</span>
                    </div>
                    {departureWeather.taf && departureWeather.taf !== "N/A" && (
                      <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                        <span className="font-bold text-gray-700 dark:text-gray-300 block mb-1">TAF</span>
                        <span className="font-mono text-gray-600 dark:text-gray-400 break-words line-clamp-3" title={departureWeather.taf}>{departureWeather.taf}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {departureNotams.length > 0 && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <ShieldCheck size={10} /> Active NOTAMs at {formData.departure}
                    </p>
                    <select 
                      value={depNotamFilter}
                      onChange={(e) => setDepNotamFilter(e.target.value)}
                      className="text-[9px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 outline-none"
                    >
                      <option value="All">All</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {departureNotams.filter(n => depNotamFilter === 'All' || n.severity === depNotamFilter).map((notam, idx) => (
                      <div key={idx} className={`p-2 rounded-lg border text-[9px] ${
                        notam.severity === 'High' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50 text-red-800 dark:text-red-200' :
                        notam.severity === 'Medium' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/50 text-amber-800 dark:text-amber-200' :
                        'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/50 text-blue-800 dark:text-blue-200'
                      }`}>
                        <div className="font-bold mb-0.5">{notam.id}</div>
                        <div className="line-clamp-2" title={notam.description}>{notam.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Destination (ICAO/IATA)</label>
              <div className="relative">
                <input 
                  required
                  type="text" 
                  placeholder="e.g., KJFK"
                  value={formData.destination}
                  onChange={e => setFormData({...formData, destination: e.target.value.toUpperCase()})}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
                {fetchingDestAgents && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="animate-spin text-indigo-500" size={14} />
                  </div>
                )}
              </div>
              {destinationAgents.length > 0 && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <UserCheck size={10} /> Handling Agents at {formData.destination}
                  </p>
                  <div className="space-y-2">
                    {destinationAgents.map((agent, idx) => {
                      const isSelected = selectedDestAgent?.companyName === agent.companyName;
                      return (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedDestAgent(isSelected ? null : agent)}
                          className={`p-2 rounded-lg border transition-all cursor-pointer ${
                            isSelected 
                              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' 
                              : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                          }`}
                        >
                          <div className="flex justify-between items-center text-[9px] mb-1">
                            <span className="text-gray-900 dark:text-white font-bold truncate max-w-[120px]">{agent.companyName}</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-black">${agent.baseFee}</span>
                          </div>
                          {isSelected && (
                            <div className="space-y-1 mt-1 pt-1 border-t border-indigo-100 dark:border-indigo-800/50">
                              <div className="flex items-center gap-1.5 text-[8px] text-gray-500 dark:text-gray-400">
                                <Mail size={10} /> <span className="truncate">{agent.email}</span>
                              </div>
                              {agent.phone && (
                                <div className="flex items-center gap-1.5 text-[8px] text-gray-500 dark:text-gray-400">
                                  <Phone size={10} /> <span>{agent.phone}</span>
                                </div>
                              )}
                              {agent.website && (
                                <div className="flex items-center gap-1.5 text-[8px] text-indigo-500">
                                  <Globe size={10} /> <a href={agent.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{agent.website.replace(/^https?:\/\//, '')}</a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {destinationWeather && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Cloud size={10} /> Live Weather at {formData.destination}
                  </p>
                  <div className="space-y-2 text-[9px]">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                      <span className="font-bold text-gray-700 dark:text-gray-300 block mb-1">METAR</span>
                      <span className="font-mono text-gray-600 dark:text-gray-400 break-words">{destinationWeather.metar}</span>
                    </div>
                    {destinationWeather.taf && destinationWeather.taf !== "N/A" && (
                      <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                        <span className="font-bold text-gray-700 dark:text-gray-300 block mb-1">TAF</span>
                        <span className="font-mono text-gray-600 dark:text-gray-400 break-words line-clamp-3" title={destinationWeather.taf}>{destinationWeather.taf}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {destinationNotams.length > 0 && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <ShieldCheck size={10} /> Active NOTAMs at {formData.destination}
                    </p>
                    <select 
                      value={destNotamFilter}
                      onChange={(e) => setDestNotamFilter(e.target.value)}
                      className="text-[9px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 outline-none"
                    >
                      <option value="All">All</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {destinationNotams.filter(n => destNotamFilter === 'All' || n.severity === destNotamFilter).map((notam, idx) => (
                      <div key={idx} className={`p-2 rounded-lg border text-[9px] ${
                        notam.severity === 'High' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50 text-red-800 dark:text-red-200' :
                        notam.severity === 'Medium' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/50 text-amber-800 dark:text-amber-200' :
                        'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/50 text-blue-800 dark:text-blue-200'
                      }`}>
                        <div className="font-bold mb-0.5">{notam.id}</div>
                        <div className="line-clamp-2" title={notam.description}>{notam.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Stops / Via (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g., LFPB, LIRF"
                value={formData.stops}
                onChange={e => setFormData({...formData, stops: e.target.value.toUpperCase()})}
                className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Departure Date</label>
              <input 
                required
                type="datetime-local" 
                value={formData.dateTime}
                onChange={e => setFormData({...formData, dateTime: e.target.value})}
                className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
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
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>
            )}
            {(missionType === 'Passenger' || missionType === 'VIP' || missionType === 'ACMI Lease') ? (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Passengers</label>
                <input 
                  required
                  type="number" 
                  min="1"
                  value={formData.passengers}
                  onChange={e => setFormData({...formData, passengers: e.target.value === '' ? '' : Number(e.target.value)})}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Cargo Weight (kg)</label>
                <input 
                  required
                  type="number" 
                  min="1"
                  value={formData.cargoWeight}
                  onChange={e => setFormData({...formData, cargoWeight: e.target.value === '' ? '' : Number(e.target.value)})}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>
            )}
            <div className="space-y-1 lg:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Aircraft Preference (Optional)</label>
              <input 
                type="text" 
                placeholder={missionType === 'Passenger' ? "e.g., Heavy Jet, B777-300ER, Global 6000" : "e.g., Boeing 747-8F, A330-200F, IL-76"}
                value={formData.aircraftPreference}
                onChange={e => setFormData({...formData, aircraftPreference: e.target.value})}
                className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Broker Margin (%)</label>
              <input 
                type="number" 
                min="10"
                max="30"
                value={formData.brokerMargin}
                onChange={e => setFormData({...formData, brokerMargin: e.target.value === '' ? '' : Number(e.target.value)})}
                className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Operator Margin (%)</label>
              <input 
                type="number" 
                value={formData.operatorMargin}
                onChange={e => setFormData({...formData, operatorMargin: e.target.value === '' ? '' : Number(e.target.value)})}
                className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-bold text-gray-900 dark:text-white outline-none"
              />
            </div>

            {/* Route Customization Section */}
            <div className="md:col-span-2 lg:col-span-4 mt-6 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                  <Navigation size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Route Customization</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowMapEditor(!showMapEditor)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
                >
                  <MapIcon size={12} /> {showMapEditor ? 'Hide Map Editor' : 'Edit Route on Map'}
                </button>
              </div>

              {showMapEditor && (
                <div className="mb-6 h-[400px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative z-0">
                  <AnimatePresence>
                    {displayLoading && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-white/40 dark:bg-gray-900/40 backdrop-blur-[1px] z-[1000] flex items-center justify-center pointer-events-none"
                      >
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col items-center gap-4">
                          <div className="relative">
                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Plane size={14} className="text-indigo-600" />
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">AI Planning In Progress</p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Calculating Routes & Market Adjustments</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <MapContainer 
                    center={[20, 0]} 
                    zoom={2} 
                    className="h-full w-full"
                  >
                    <MapResizer />
                    {getTileLayer('standard')}
                    <MapEventsHandler onMapClick={handleMapClick} />
                    {formData.customWaypoints.map((wp, idx) => (
                      <Marker 
                        key={idx} 
                        position={[wp.lat, wp.lng]} 
                        draggable={true}
                        icon={DefaultIcon}
                        eventHandlers={{ dragend: (e) => handleWaypointDrag(idx, e) }}
                      >
                        <Popup>
                          <div className="p-2">
                            <p className="text-xs font-bold mb-2">Waypoint {idx + 1}</p>
                            <button 
                              onClick={() => removeCustomWaypoint(idx)}
                              className="text-[10px] text-red-500 font-bold uppercase"
                            >
                              Remove
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    {formData.customWaypoints.length > 1 && (
                      <Polyline positions={formData.customWaypoints.map(wp => [wp.lat, wp.lng])} color="#6366f1" weight={3} dashArray="5, 10" />
                    )}
                  </MapContainer>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Special Routing Instructions</label>
                <textarea 
                  rows={3}
                  placeholder="e.g., Avoid Iran FIR, Route via Turkey, Stay south of conflict zones, Avoid ORMM FIR..."
                  value={formData.specialInstructions}
                  onChange={e => setFormData({...formData, specialInstructions: e.target.value})}
                  className="w-full p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-medium text-gray-900 dark:text-white outline-none resize-none"
                />
                
                <div className="flex flex-wrap gap-2 pt-2">
                  {['Avoid Iran FIR', 'Avoid Conflict Zones', 'Route via Turkey', 'Stay over water', 'Shortest Overland Route', 'Avoid Russian Airspace'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const current = formData.specialInstructions;
                        if (!current.includes(tag)) {
                          setFormData({...formData, specialInstructions: current ? `${current}, ${tag}` : tag});
                        }
                      }}
                      className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="md:col-span-2 lg:col-span-4 mt-8 flex flex-col md:flex-row gap-4">
              <button 
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 text-white p-5 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                {loading 
                  ? 'Analyzing Routes & Pricing...' 
                  : `Generate ${missionType === 'Passenger' ? 'Passenger' : 'Cargo'} Quote`
                }
              </button>
              
              <button 
                type="button"
                onClick={handleAIAnalysis}
                disabled={isAnalyzingMission || !formData.departure || !formData.destination}
                className="flex-1 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-100 dark:border-indigo-900/50 p-5 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isAnalyzingMission ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                {isAnalyzingMission ? 'Analyzing Mission...' : 'AI Mission Analysis'}
              </button>

              <button 
                type="button"
                onClick={handleClearForm}
                className="px-8 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-200 dark:hover:bg-gray-800 transition-all"
              >
                Clear
              </button>
            </div>
          </motion.form>
        )}
      </div>

      {/* AI Mission Analysis Results */}
      <AnimatePresence>
        {missionAnalysis && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-gray-900 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl p-6 shadow-xl shadow-indigo-100/50 dark:shadow-none">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">AI Mission Analysis</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Suggested aircraft strategies based on mission parameters.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setMissionAnalysis(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {missionAnalysis?.options?.map((option: any, idx: number) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-5 rounded-2xl border ${
                      option.type === 'Cheapest' ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' :
                      option.type === 'Fastest' ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30' :
                      'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                        option.type === 'Cheapest' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                        option.type === 'Fastest' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400'
                      }`}>
                        {option.type}
                      </span>
                      {option.type === 'Cheapest' ? <DollarSign size={16} className="text-emerald-500" /> :
                       option.type === 'Fastest' ? <Zap size={16} className="text-amber-500" /> :
                       <Star size={16} className="text-indigo-500" />}
                    </div>
                    <h4 className="font-black text-gray-900 dark:text-white text-sm mb-2">{option.aircraftName}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed italic">"{option.reasoning}"</p>
                    
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-2">
                      <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Efficiency</p>
                        <p className="text-xs font-black text-gray-900 dark:text-white">{option.fuelEfficiencyScore}/10</p>
                      </div>
                      <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Availability</p>
                        <p className="text-xs font-black text-gray-900 dark:text-white">{option.availabilityScore}/10</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-white/50 dark:bg-gray-800/50 rounded-2xl border border-indigo-50 dark:border-indigo-900/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Route size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Distance:</span>
                    <span className="text-xs font-black text-gray-900 dark:text-white">{Math.round(missionAnalysis?.distance || 0)} NM</span>
                  </div>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">FIRs:</span>
                    <span className="text-xs font-black text-gray-900 dark:text-white">{missionAnalysis?.routeDetails?.firs?.length || 0} Crossed</span>
                  </div>
                </div>
                <button 
                  onClick={(e) => handleGenerate(e as any)}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  Proceed to Full Quote <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Section */}
      {quotesData && (
        <div className="space-y-6">
          {/* Map and Route Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-[450px] bg-gray-100 dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 relative z-0">
              <AnimatePresence>
                {displayLoading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/40 dark:bg-gray-900/40 backdrop-blur-[1px] z-[1000] flex items-center justify-center pointer-events-none"
                  >
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col items-center gap-4">
                      <div className="relative">
                        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Plane size={14} className="text-indigo-600" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Optimizing Mission</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Analyzing Airspace & Performance</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Chart Selector & Night Mode */}
              <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  {activeChart !== 'standard' && (
                    <button 
                      onClick={() => setChartNightMode(!chartNightMode)}
                      className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-2.5 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group"
                      title="Toggle Chart Night Mode"
                    >
                      <Moon className={`w-4 h-4 ${chartNightMode ? 'text-indigo-500 fill-indigo-500' : 'text-gray-600 dark:text-gray-400'}`} />
                    </button>
                  )}
                  <button 
                    onClick={() => setShowChartSelector(!showChartSelector)}
                    className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-2.5 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">Charts</span>
                  </button>
                </div>

                {showChartSelector && (
                  <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-1.5 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 w-48 animate-in slide-in-from-top-2 duration-200">
                    {Object.values(CHART_LAYERS).map((chart) => (
                      <button
                        key={chart.id}
                        onClick={() => {
                          setActiveChart(chart.id);
                          setShowChartSelector(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          activeChart === chart.id 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                      >
                        {chart.name}
                        {activeChart === chart.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <MapContainer center={[20, 0]} zoom={2} className="w-full h-full">
                <MapResizer />
                {getTileLayer(activeChart)}
                <MapEventsHandler onMapClick={handleMapClick} />
                {selectedWaypoints.length > 0 && (
                  <>
                    <Polyline positions={polylinePositions} color="#4f46e5" weight={3} dashArray="5, 10" />
                    {selectedWaypoints.map((wp: any, i: number) => (
                      <Marker key={i} position={[wp.lat, wp.lng]} icon={DefaultIcon}>
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
                {formData.customWaypoints.map((wp, i) => (
                  <Marker 
                    key={`custom-${i}`} 
                    position={[wp.lat, wp.lng]} 
                    draggable={true}
                    icon={DefaultIcon}
                    eventHandlers={{
                      dragend: (e) => handleWaypointDrag(i, e)
                    }}
                  >
                    <Popup className="dark-popup">
                      <div className="font-bold text-gray-900 dark:text-white">Custom Waypoint {i + 1}</div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeCustomWaypoint(i); }}
                        className="mt-2 text-xs text-red-500 hover:text-red-700 font-bold uppercase tracking-widest"
                      >
                        Remove
                      </button>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
              <div className="absolute top-4 left-4 z-[1000] bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-3 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg pointer-events-auto">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Click map to add custom routing waypoints.
                </p>
                {formData.customWaypoints.length > 0 && (
                  <button 
                    onClick={handleGenerate}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                    Re-plan Route
                  </button>
                )}
              </div>
            </div>

                    {/* ACMI Specific Section */}
                    {missionType === 'ACMI Lease' && (
                      <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">ACMI Pricing Engine</h3>
                            <p className="text-xs text-gray-500 font-medium">Detailed ACMI breakdown based on production-level dataset</p>
                          </div>
                          <button
                            onClick={handleGenerateACMI}
                            disabled={isGeneratingACMI}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            {isGeneratingACMI ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                            Generate Detailed ACMI Quote
                          </button>
                        </div>

                        {acmiQuote && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                          >
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                              <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                <DollarSign size={16} className="text-emerald-500" />
                                Final Rate Calculation
                              </h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                  <span className="text-xs font-bold text-gray-500 uppercase">Base ACMI Rate (Hourly)</span>
                                  <span className="text-sm font-black text-gray-900 dark:text-white">${acmiQuote.breakdown.acmiRatePerHour.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                  <span className="text-xs font-bold text-gray-500 uppercase">Block Hours</span>
                                  <span className="text-sm font-black text-gray-900 dark:text-white">{acmiQuote.operationalDetails.blockHours} hrs</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase">ACMI Subtotal</span>
                                  <span className="text-sm font-black text-indigo-900 dark:text-white">${acmiQuote.breakdown.acmiCost.toLocaleString()}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Fuel</p>
                                    <p className="text-sm font-black text-gray-900 dark:text-white">${acmiQuote.breakdown.fuelCost.toLocaleString()}</p>
                                  </div>
                                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">FIR/Overflight</p>
                                    <p className="text-sm font-black text-gray-900 dark:text-white">${acmiQuote.breakdown.overflightCharges.toLocaleString()}</p>
                                  </div>
                                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Airport/Handling</p>
                                    <p className="text-sm font-black text-gray-900 dark:text-white">${(acmiQuote.breakdown.landingFees + acmiQuote.breakdown.groundHandling).toLocaleString()}</p>
                                  </div>
                                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Crew/Insurance</p>
                                    <p className="text-sm font-black text-gray-900 dark:text-white">${(acmiQuote.breakdown.crewCost + acmiQuote.breakdown.insurance).toLocaleString()}</p>
                                  </div>
                                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-800/20">
                                    <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Broker Margin</p>
                                    <p className="text-sm font-black text-indigo-900 dark:text-white">{acmiQuote.breakdown.brokerMarginPercentage}%</p>
                                  </div>
                                  <div className="p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100/50 dark:border-amber-800/20">
                                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">Dynamic Factor</p>
                                    <p className="text-sm font-black text-amber-900 dark:text-white">x{acmiQuote.breakdown.dynamicPricingFactor}</p>
                                  </div>
                                </div>
                                <div className="p-4 bg-gray-900 dark:bg-white rounded-2xl flex justify-between items-center">
                                  <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase">Total Estimated Cost</span>
                                  <span className="text-xl font-black text-white dark:text-gray-900">${acmiQuote.breakdown.totalEstimatedCost.toLocaleString()}</span>
                                </div>
                                <button 
                                  onClick={() => generateQuotePDF(acmiQuote, 'ACMI')}
                                  className="w-full mt-4 bg-indigo-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                >
                                  <FileText size={20} /> Download ACMI Quote PDF
                                </button>
                              </div>
                            </div>

                            <div className="space-y-6">
                              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <ShieldCheck size={16} className="text-blue-500" />
                                  Operational Assumptions
                                </h4>
                                <div className="space-y-2">
                                  {acmiQuote.notes.map((note: string, i: number) => (
                                    <div key={i} className="flex gap-2 items-start text-xs text-gray-600 dark:text-gray-400">
                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
                                      <span>{note}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {acmiQuote.operationalDetails.suggestedAlternative && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-800/30">
                                  <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Zap size={16} />
                                    AI Optimization Tip
                                  </h4>
                                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium leading-relaxed">
                                    {acmiQuote.operationalDetails.suggestedAlternative}
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}

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
                      <span className="flex items-center gap-1"><Route size={14} /> {(Number(quotesData.route.routing_distance_nm) || 0).toLocaleString()} nm</span>
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
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-black px-2 py-1 rounded-md">OPTION {idx + 1}</span>
                      {getQuoteIcon(quote.option_type)}
                      <span className="font-black uppercase tracking-widest text-sm text-gray-900 dark:text-white">{quote.option_type}</span>
                      {quote.is_empty_leg && (
                        <span className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1">
                          <Zap size={10} /> Empty Leg
                        </span>
                      )}
                      {missionType === 'Cargo' && (
                        <span className="bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1">
                          <Package size={10} /> Cargo Mission
                        </span>
                      )}
                    </div>
                    {quote.option_type.toLowerCase() === 'recommended' && (
                      <span className="bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">Best Value</span>
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-1">{quote.aircraft_name}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 font-medium flex-wrap">
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{quote.flight_time_hours?.toFixed(1)} hrs</span>
                    </div>
                    {(quote.cargo_capacity_kg > 0 || Number(formData.cargoWeight) > 0) && (
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <Package size={14} />
                        <span>{quote.cargo_capacity_kg || formData.cargoWeight} kg Cargo</span>
                      </div>
                    )}
                    {quote.round_trip_discount_applied > 0 && (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Tag size={14} />
                        <span>RT Discount: -${(Number(quote.round_trip_discount_applied) || 0).toLocaleString()}</span>
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
                  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                    <div className="flex-1 min-w-[120px]">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Total Est. Cost</p>
                      <p className="text-2xl font-black text-gray-900 dark:text-white">${(Number(quote.total_price) || 0).toLocaleString()}</p>
                    </div>
                    <div className="flex-1 min-w-[80px] text-center sm:text-left">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Est. Profit</p>
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">${(Number(quote.profit) || 0).toLocaleString()}</p>
                    </div>
                    <div className="flex-1 min-w-[80px] text-right">
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
                                <div className="relative">
                                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">$</span>
                                  <input 
                                    type="number"
                                    value={quote.cost_breakdown.operator_base_cost}
                                    onChange={(e) => handleQuoteCostChange(idx, 'root', 'operator_base_cost', e.target.value)}
                                    className="w-24 p-1 pl-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-right font-bold text-gray-900 dark:text-white text-[10px] outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>
                            )}
                            {renderCostSection('Flight Costs', quote.cost_breakdown.flight_costs, idx, 'flight_costs')}
                            {renderCostSection('Airport Costs', quote.cost_breakdown.airport_costs, idx, 'airport_costs')}
                            {renderCostSection('Airspace Costs', quote.cost_breakdown.airspace_costs, idx, 'airspace_costs')}
                            {renderCostSection('Operational Costs', quote.cost_breakdown.operational_costs, idx, 'operational_costs')}
                            {renderCostSection('Margins', quote.cost_breakdown.margins, idx, 'margins')}
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
                      <FileText size={14} /> Save
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        generateQuotePDF({
                          ...quote,
                          route: quotesData.route,
                          missionType: missionType
                        }, 'Charter');
                      }}
                      className="flex-1 bg-gray-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                    >
                      <FileText size={14} /> PDF
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        // Placeholder for send functionality
                        alert('Sending to client...');
                      }}
                      className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
                    >
                      <Send size={14} /> Send
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
            <button 
              onClick={() => {
                const selectedQuote = quotesData.aircraft_options[selectedQuoteIdx];
                generateQuotePDF({
                  ...selectedQuote,
                  route: quotesData.route,
                  missionType: missionType
                }, 'Charter');
              }} 
              className="flex-1 bg-gray-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
            >
              <FileText size={20} /> PDF Quote
            </button>
            <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Check out these charter quotes: ' + safeStringify(quotesData))}`)} className="flex-1 bg-emerald-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
              <MessageSquare size={20} /> WhatsApp
            </button>
            <button onClick={() => window.open(`mailto:?subject=Charter Quotes&body=${encodeURIComponent(safeStringify(quotesData))}`)} className="flex-1 bg-indigo-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
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
