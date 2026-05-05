import React, { useState, useEffect } from 'react';
import { Search, MapPin, Wind, Fuel, UserCheck, ParkingCircle, Loader2, Globe, DollarSign, X, Building2, Sparkles, Phone, Mail, ExternalLink, RefreshCw, Navigation, Download, Star } from 'lucide-react';
import { searchAirports, searchHandlingAgents, getAirportDetails, searchNearbyAirports, searchAirportsByCountry } from '../services/aiService';
import { getLiveWeather, getLiveNotams, MetarData, NotamData } from '../services/weatherService';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, limit, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AirportDatabase() {
  const [searchQuery, setSearchQuery] = useState('');
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [countryResults, setCountryResults] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCountry, setLoadingCountry] = useState(false);
  const [recentAirports, setRecentAirports] = useState<any[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<any | null>(null);
  const [handlingAgents, setHandlingAgents] = useState<any[]>([]);
  const [agentsLastUpdated, setAgentsLastUpdated] = useState<string | undefined>(undefined);
  const [isAgentsFromCache, setIsAgentsFromCache] = useState(false);
  const [fetchingAgents, setFetchingAgents] = useState(false);
  const [updatingDetails, setUpdatingDetails] = useState(false);
  const [liveWeather, setLiveWeather] = useState<MetarData | null>(null);
  const [liveNotams, setLiveNotams] = useState<NotamData | null>(null);
  const [notamSeverityFilter, setNotamSeverityFilter] = useState<string>('All');
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [nearbyLat, setNearbyLat] = useState('');
  const [nearbyLng, setNearbyLng] = useState('');
  const [nearbyRadius, setNearbyRadius] = useState('50');
  const [isNearbySearch, setIsNearbySearch] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  const handleNearMeSearch = async () => {
    setDetectingLocation(true);
    setLoading(true);
    setIsNearbySearch(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      const loc = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      setNearbyLat(loc.lat.toFixed(4));
      setNearbyLng(loc.lng.toFixed(4));

      // Utilize searchAirports function as requested
      const queryStr = `operational airports within ${nearbyRadius} nautical miles`;
      const aiResults = await searchAirports(queryStr, loc);
      setResults(aiResults.airports || []);
      
    } catch (error) {
      console.error('Geolocation or Search Error:', error);
      // Fallback or error message could be added here
    } finally {
      setDetectingLocation(false);
      setLoading(false);
    }
  };

  const handleGetLocation = () => {
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNearbyLat(position.coords.latitude.toFixed(4));
        setNearbyLng(position.coords.longitude.toFixed(4));
        setDetectingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleTogglePreferred = async (agent: any) => {
    setFetchingAgents(true);
    try {
      // 1. Identify which agent we are toggling
      const isCurrentlyPreferred = !!agent.preferred;
      const targetIcao = selectedAirport.icao.toUpperCase();

      // 2. Fetch all individual agent docs for this ICAO to unset others if naming a new preferred
      const agentsRef = collection(db, 'handling_agents');
      const q = query(agentsRef, where('icao', '==', targetIcao));
      const snapshot = await getDocs(q);

      // 3. For any doc that is NOT the cache doc, if it was preferred, unset it
      const batch: Promise<any>[] = [];
      snapshot.docs.forEach(d => {
        const data = d.data();
        if (!d.id.startsWith('cache_') && data.preferred && d.id !== agent.id) {
          batch.push(updateDoc(doc(db, 'handling_agents', d.id), { preferred: false }));
        }
      });

      // 4. Handle the target agent
      if (agent.id && !agent.id.startsWith('cache_')) {
        // It's an individual doc, just update it
        batch.push(updateDoc(doc(db, 'handling_agents', agent.id), { 
          preferred: !isCurrentlyPreferred,
          updatedAt: new Date().toISOString()
        }));
      } else {
        // It's from cache array, create an individual doc for it
        if (!isCurrentlyPreferred) {
          batch.push(addDoc(collection(db, 'handling_agents'), {
            ...agent,
            icao: targetIcao,
            preferred: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));
        }
      }

      await Promise.all(batch);
      
      // Refresh list to show change
      await fetchHandlingAgents(selectedAirport.icao, selectedAirport.name, selectedAirport.city);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'handling_agents');
    } finally {
      setFetchingAgents(false);
    }
  };

  const seedData = async () => {
    setLoading(true);
    const sampleAirports = [
      {
        name: 'London Heathrow Airport',
        icao: 'EGLL',
        iata: 'LHR',
        city: 'London',
        country: 'United Kingdom',
        runwayLength: 12802,
        elevation: 83,
        fuelAvailability: ['Jet A-1', 'Avgas'],
        atisFrequency: '128.725',
        parkingSpots: 150,
        fuelRate: 1.85,
        landingFee: 1200,
        parkingFee: 450,
        handlingFee: 800,
        terminalNavigationFee: 150,
        cateringFee: 45,
        groundTransportFee: 120,
        deicingFee: 500,
        handlingAvailable: true,
        handlingStatus: 'Available'
      },
      {
        name: 'John F. Kennedy International Airport',
        icao: 'KJFK',
        iata: 'JFK',
        city: 'New York',
        country: 'United States',
        runwayLength: 14511,
        elevation: 13,
        fuelAvailability: ['Jet A-1'],
        atisFrequency: '128.725',
        parkingSpots: 200,
        fuelRate: 1.95,
        landingFee: 1500,
        parkingFee: 600,
        handlingFee: 1000,
        terminalNavigationFee: 200,
        cateringFee: 55,
        groundTransportFee: 150,
        deicingFee: 600,
        handlingAvailable: true,
        handlingStatus: 'Available'
      },
      {
        name: 'Dubai International Airport',
        icao: 'OMDB',
        iata: 'DXB',
        city: 'Dubai',
        country: 'United Arab Emirates',
        runwayLength: 14590,
        elevation: 62,
        fuelAvailability: ['Jet A-1'],
        atisFrequency: '120.425',
        parkingSpots: 300,
        fuelRate: 1.65,
        landingFee: 1800,
        parkingFee: 800,
        handlingFee: 1200,
        terminalNavigationFee: 250,
        cateringFee: 65,
        groundTransportFee: 180,
        deicingFee: 0,
        handlingAvailable: true,
        handlingStatus: 'Available'
      },
      {
        name: 'Singapore Changi Airport',
        icao: 'WSSS',
        iata: 'SIN',
        city: 'Singapore',
        country: 'Singapore',
        runwayLength: 13123,
        elevation: 22,
        fuelAvailability: ['Jet A-1'],
        atisFrequency: '128.4',
        parkingSpots: 250,
        fuelRate: 1.75,
        landingFee: 1400,
        parkingFee: 550,
        handlingFee: 900,
        terminalNavigationFee: 180,
        cateringFee: 50,
        groundTransportFee: 130,
        deicingFee: 0,
        handlingAvailable: true,
        handlingStatus: 'Available'
      },
      {
        name: 'Paris Charles de Gaulle Airport',
        icao: 'LFPG',
        iata: 'CDG',
        city: 'Paris',
        country: 'France',
        runwayLength: 13829,
        elevation: 392,
        fuelAvailability: ['Jet A-1', 'Avgas'],
        atisFrequency: '127.125',
        parkingSpots: 180,
        fuelRate: 1.90,
        landingFee: 1300,
        parkingFee: 500,
        handlingFee: 850,
        terminalNavigationFee: 160,
        cateringFee: 48,
        groundTransportFee: 125,
        deicingFee: 550,
        handlingAvailable: true,
        handlingStatus: 'Available'
      }
    ];

    try {
      for (const airport of sampleAirports) {
        await addDoc(collection(db, 'airports'), {
          ...airport,
          createdAt: new Date().toISOString()
        });
      }
      // Refresh recent airports
      const q = query(collection(db, 'airports'), limit(5));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentAirports(Array.from(new Map(data.map(item => [item.id, item])).values()));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'airports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const q = query(collection(db, 'airports'), limit(5));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecentAirports(Array.from(new Map(data.map(item => [item.id, item])).values()));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'airports');
      }
    };
    fetchRecent();
  }, []);

  const performAirportSearch = async (queryStr: string) => {
    if (!queryStr.trim()) return;
    
    setSearchQuery(queryStr);
    setLoading(true);
    setIsNearbySearch(false);
    
    try {
      // 1. Detect if it's a "near me" or specific location-based query
      let userLocation: { lat: number, lng: number } | undefined = undefined;
      const lowerQuery = queryStr.toLowerCase();
      
      if (lowerQuery.includes('near me') || lowerQuery.includes('nearby')) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('Using user location for search:', userLocation);
        } catch (geoError) {
          console.warn('Geolocation failed or timed out:', geoError);
          // Continue without location, AI will try to guess or search generally
        }
      }

      // 2. Decide strategy: Simple ICAO/IATA search OR AI-first natural language search
      const isSimpleCode = /^[A-Z]{3,4}$/.test(queryStr.toUpperCase().trim());
      
      if (isSimpleCode) {
        // Try Firestore first for simple codes
        const qIcao = query(
          collection(db, 'airports'), 
          where('icao', '==', queryStr.toUpperCase()),
          limit(1)
        );
        const qIata = query(
          collection(db, 'airports'), 
          where('iata', '==', queryStr.toUpperCase()),
          limit(1)
        );
        
        const [snapshotIcao, snapshotIata] = await Promise.all([
          getDocs(qIcao),
          getDocs(qIata)
        ]);
        
        if (!snapshotIcao.empty || !snapshotIata.empty) {
          const snapshot = !snapshotIcao.empty ? snapshotIcao : snapshotIata;
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setResults(Array.from(new Map(data.map(item => [item.id, item])).values()));
          setLoading(false);
          return;
        }
      }

      // 3. Natural Language Search via AI (or no result in Firestore)
      const aiResults = await searchAirports(queryStr, userLocation);
      setResults(aiResults.airports);
      
      // Auto-scroll to results
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performAirportSearch(searchQuery);
  };

  const handleNearbySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nearbyLat || !nearbyLng) return;

    setLoading(true);
    setIsNearbySearch(true);
    try {
      const result = await searchNearbyAirports(parseFloat(nearbyLat), parseFloat(nearbyLng), parseFloat(nearbyRadius));
      setResults(result.airports || []);
    } catch (error) {
      console.error('Nearby search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHandlingAgents = async (icao: string, name?: string, city?: string, force: boolean = false) => {
    setFetchingAgents(true);
    if (force) setHandlingAgents([]);
    setAgentsLastUpdated(undefined);
    setIsAgentsFromCache(false);
    try {
      const result = await searchHandlingAgents(icao, name, city, undefined, force);
      setHandlingAgents(result.agents || []);
      setAgentsLastUpdated(result.lastUpdated);
      setIsAgentsFromCache(!!result.isFromCache);
    } catch (error) {
      console.error('Error fetching handling agents:', error);
    } finally {
      setFetchingAgents(false);
    }
  };

  const fetchWeatherData = async (icao: string) => {
    setFetchingWeather(true);
    try {
      const [weather, notams] = await Promise.all([
        getLiveWeather(icao).catch(() => null),
        getLiveNotams(icao).catch(() => null)
      ]);
      setLiveWeather(weather);
      setLiveNotams(notams);
    } catch (error) {
      console.error('Error fetching weather data:', error);
    } finally {
      setFetchingWeather(false);
    }
  };

  useEffect(() => {
    if (selectedAirport) {
      setInternalNotes(selectedAirport.internalNotes || '');
      fetchWeatherData(selectedAirport.icao);
      fetchHandlingAgents(selectedAirport.icao, selectedAirport.name, selectedAirport.city);
      
      // Auto-enrich technical details if important fields are missing
      if (!selectedAirport.runwayLength || !selectedAirport.elevation) {
        updateAirportDetails(selectedAirport);
      }
    } else {
      setInternalNotes('');
      setLiveWeather(null);
      setLiveNotams(null);
      setHandlingAgents([]);
      setAgentsLastUpdated(undefined);
      setIsAgentsFromCache(false);
    }
  }, [selectedAirport?.icao]);

  const saveAirportMetadata = async (newRating?: number, newNotes?: string) => {
    if (!selectedAirport) return;
    
    setIsSavingMetadata(true);
    try {
      let airportId = selectedAirport.id;
      const ratingToSave = newRating !== undefined ? newRating : (selectedAirport.rating || selectedAirport.score || 0);
      const notesToSave = newNotes !== undefined ? newNotes : internalNotes;

      // If no ID, it means it's an AI result not yet in our DB, so we create it
      if (!airportId) {
        const airportsRef = collection(db, 'airports');
        const q = query(airportsRef, where('icao', '==', selectedAirport.icao));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          airportId = snapshot.docs[0].id;
        } else {
          const docRef = await addDoc(airportsRef, {
            ...selectedAirport,
            rating: ratingToSave,
            internalNotes: notesToSave,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          airportId = docRef.id;
        }
      }

      const airportRef = doc(db, 'airports', airportId);
      await setDoc(airportRef, {
        rating: ratingToSave,
        internalNotes: notesToSave,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      const updatedAirport = { 
        ...selectedAirport, 
        id: airportId, 
        rating: ratingToSave, 
        score: ratingToSave, // Keep score in sync for compatibility
        internalNotes: notesToSave 
      };
      
      setSelectedAirport(updatedAirport);
      setResults(prev => prev.map(a => a.icao === selectedAirport.icao ? updatedAirport : a));
      setRecentAirports(prev => {
        const filtered = prev.filter(a => a.icao !== selectedAirport.icao);
        return [updatedAirport, ...filtered].slice(0, 10);
      });
      
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'airports');
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const updateAirportDetails = async (airport: any) => {
    if (!airport.icao) return;
    setUpdatingDetails(true);
    try {
      const details = await getAirportDetails(airport.icao);
      
      const updatedData = {
        ...details,
        updatedAt: new Date().toISOString()
      };

      // Update in Firestore if id exists
      if (airport.id) {
        const airportRef = doc(db, 'airports', airport.id);
        await updateDoc(airportRef, updatedData);
      }

      // Update local state
      const newAirport = { ...airport, ...updatedData };
      setSelectedAirport(newAirport);
      
      // Update results list
      setResults(prev => prev.map(a => (a.icao === airport.icao ? newAirport : a)));
      setRecentAirports(prev => prev.map(a => (a.icao === airport.icao ? newAirport : a)));
    } catch (error) {
      console.error('Error updating airport details:', error);
      // Only alert on manual update failure if we ever distinguish them, 
      // but for now, just logging to console is cleaner for auto-enrichment.
    } finally {
      setUpdatingDetails(false);
    }
  };

  const generatePDF = () => {
    if (!selectedAirport) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(selectedAirport.name, 14, 20);
    doc.setFontSize(12);
    doc.text(`ICAO: ${selectedAirport.icao} | IATA: ${selectedAirport.iata}`, 14, 30);
    doc.text(`City: ${selectedAirport.city} | Country: ${selectedAirport.country}`, 14, 37);

    const airportData = [
      ['Runway', `${selectedAirport.runwayLength?.toLocaleString()} ft`],
      ['Elevation', `${selectedAirport.elevation?.toLocaleString()} ft`],
      ['Parking', `${selectedAirport.parkingSpots} spots`],
      ['Fuel (Jet A-1)', `${selectedAirport.fuelRate || 'N/A'}/L`],
      ['Landing Fee', `$${selectedAirport.landingFee || 0}`]
    ];

    autoTable(doc, {
      startY: 45,
      head: [['Metric', 'Value']],
      body: airportData,
    });
    doc.save(`${selectedAirport.icao}_DataCard.pdf`);
  };

  const handleCountrySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countrySearchQuery.trim()) return;

    setLoadingCountry(true);
    try {
      const result = await searchAirportsByCountry(countrySearchQuery);
      setCountryResults(result);
    } catch (error) {
      console.error('Country search error:', error);
    } finally {
      setLoadingCountry(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Search Section */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-3xl shadow-xl shadow-indigo-200 dark:shadow-none mb-12 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
          <Sparkles size={120} className="text-white" />
        </div>
        
        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight flex items-center gap-3">
            <Globe size={24} className="animate-pulse" />
            AI Airport Intelligence
          </h2>
          <div className="flex justify-between items-center mb-8">
            <p className="text-indigo-100 text-sm max-w-md font-medium">Search using natural language: "Airports in London with Jet A1", "Helipads near NYC", or "Longest runway in France".</p>
            <button
              onClick={seedData}
              disabled={loading}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-xl font-bold flex items-center gap-2 transition border border-white/20 text-xs backdrop-blur-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Reset DB
            </button>
          </div>
          
          <form onSubmit={handleSearch} className="relative max-w-3xl">
            <input
              type="text"
              placeholder="Query airports, cities, or technical requirements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl py-5 pl-12 pr-36 text-white placeholder:text-indigo-200 outline-none focus:ring-4 focus:ring-white/20 transition-all font-medium text-lg lg:text-xl shadow-2xl"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-100" size={24} />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <button
                type="submit"
                disabled={loading}
                className="bg-white text-indigo-600 px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-xl outline-none active:scale-95 disabled:opacity-75"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Search
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="text-xs text-indigo-200 font-bold uppercase tracking-widest mr-2 py-1 flex items-center">Example Queries:</span>
            {['airports near me', 'airports in London with Jet A1', 'Runways > 10000ft in UAE'].map((hint) => (
              <button
                key={hint}
                onClick={() => performAirportSearch(hint)}
                className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-full border border-white/10 transition-all font-bold backdrop-blur-sm"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-6">
          <Globe className="text-indigo-600 dark:text-indigo-400" size={20} />
          <h2 className="font-bold text-gray-800 dark:text-white">Country-Level Airport Search</h2>
        </div>
        <form onSubmit={handleCountrySearch} className="relative">
          <input 
            type="text" 
            placeholder="Enter country name (e.g. 'United Arab Emirates')..." 
            className="w-full pl-4 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition dark:text-white"
            value={countrySearchQuery}
            onChange={(e) => setCountrySearchQuery(e.target.value)}
          />
          <button 
            type="submit"
            disabled={loadingCountry}
            className="absolute right-2 top-2 bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loadingCountry ? <Loader2 className="animate-spin" size={18} /> : 'Search By Country'}
          </button>
        </form>

        {countryResults && (
           <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-white mb-4">Results for: {countrySearchQuery}</h3>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-4">Total Airports Available: {countryResults.totalCount}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">International Airports</h4>
                  <ul className="text-xs space-y-2">
                    {countryResults.internationalAirports.map((a: any, idx: number) => (
                      <li key={`intl-${a.icao || idx}`}>
                        <button 
                          onClick={() => performAirportSearch(a.icao)}
                          className="text-left w-full hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center justify-between group"
                        >
                          <span>{a.name} <span className="text-gray-400 font-mono text-[10px] ml-1">({a.icao})</span></span>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 px-2 py-0.5 rounded">View</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">Domestic Airports</h4>
                  <ul className="text-xs space-y-2">
                    {countryResults.domesticAirports.map((a: any, idx: number) => (
                      <li key={`dom-${a.icao || idx}`}>
                        <button 
                          onClick={() => performAirportSearch(a.icao)}
                          className="text-left w-full hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center justify-between group"
                        >
                          <span>{a.name} <span className="text-gray-400 font-mono text-[10px] ml-1">({a.icao})</span></span>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 px-2 py-0.5 rounded">View</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
           </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Navigation className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="font-bold text-gray-800 dark:text-white">Nearby Airport Search (PostGIS & AI)</h2>
          </div>
          <button
            onClick={handleNearMeSearch}
            disabled={loading || detectingLocation}
            className="flex items-center gap-2 text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition disabled:opacity-50"
          >
            {detectingLocation ? <Loader2 className="animate-spin" size={14} /> : <MapPin size={14} />}
            Find Near Me (AI)
          </button>
        </div>

        <form onSubmit={handleNearbySearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Latitude</label>
            <input 
              type="number" 
              step="any"
              placeholder="e.g. 25.25" 
              className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition dark:text-white text-sm"
              value={nearbyLat}
              onChange={(e) => setNearbyLat(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={handleGetLocation}
              className="absolute right-2 top-6 p-1 text-indigo-500 hover:text-indigo-700 transition"
              title="Get current location"
            >
              <Navigation size={14} className={detectingLocation ? 'animate-pulse' : ''} />
            </button>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Longitude</label>
            <input 
              type="number" 
              step="any"
              placeholder="e.g. 55.36" 
              className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition dark:text-white text-sm"
              value={nearbyLng}
              onChange={(e) => setNearbyLng(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Radius (NM)</label>
            <input 
              type="number" 
              placeholder="50" 
              className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition dark:text-white text-sm"
              value={nearbyRadius}
              onChange={(e) => setNearbyRadius(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 font-bold text-sm flex items-center justify-center gap-2"
            >
              {loading && isNearbySearch ? <Loader2 className="animate-spin" size={18} /> : <Navigation size={18} />}
              Find Nearby
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(results.length > 0 ? results : recentAirports).map((airport) => (
          <div key={airport.id || airport.icao} className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-500 transition group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{airport.name}</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{airport.city}, {airport.country}</p>
                <div className="flex gap-2 mt-1">
                  <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{airport.icao}</span>
                  <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{airport.iata}</span>
                  {airport.distance_nm !== undefined && (
                    <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                      {parseFloat(airport.distance_nm).toFixed(1)} NM
                    </span>
                  )}
                </div>
              </div>
              <MapPin className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition" size={20} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Wind size={14} className="text-gray-400 dark:text-gray-500" />
                  <span>Runway: <span className="font-semibold text-gray-900 dark:text-white">{airport.runwayLength?.toLocaleString()} ft</span></span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Globe size={14} className="text-gray-400 dark:text-gray-500" />
                  <span>Elevation: <span className="font-semibold text-gray-900 dark:text-white">{airport.elevation?.toLocaleString()} ft</span></span>
                </div>
                {airport.atisFrequency && (
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                    <Sparkles size={14} />
                    <span>ATIS: <span className="text-gray-900 dark:text-white">{airport.atisFrequency}</span></span>
                  </div>
                )}
                {(airport.towerFrequency || airport.groundFrequency) && (
                  <div className="flex items-center gap-2 text-gray-500 font-medium text-[10px]">
                    {airport.towerFrequency && <span>TWR: {airport.towerFrequency}</span>}
                    {airport.groundFrequency && <span>GND: {airport.groundFrequency}</span>}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Fuel size={14} className="text-gray-400 dark:text-gray-500" />
                  <span className="truncate">Fuel: <span className="font-semibold text-gray-900 dark:text-white">{(airport.fuelAvailability || []).join(', ')}</span></span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <ParkingCircle size={14} className="text-gray-400 dark:text-gray-500" />
                  <span>Parking: <span className="font-semibold text-gray-900 dark:text-white">{airport.parkingSpots} spots</span></span>
                </div>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mt-2">
                  <DollarSign size={14} />
                  <span>Fuel: <span className="text-gray-900 dark:text-white">${airport.fuelRate}/L</span></span>
                </div>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                  <DollarSign size={14} />
                  <span>Landing: <span className="text-gray-900 dark:text-white">${airport.landingFee}</span></span>
                </div>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                  <DollarSign size={14} />
                  <span>Parking: <span className="text-gray-900 dark:text-white">${airport.parkingFee}/day</span></span>
                </div>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                  <DollarSign size={14} />
                  <span>Handling: <span className="text-gray-900 dark:text-white">${airport.handlingFee}</span></span>
                </div>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                  <DollarSign size={14} />
                  <span>Terminal Nav: <span className="text-gray-900 dark:text-white">${airport.terminalNavigationFee || 0}</span></span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${airport.handlingAvailable ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Handling: <span className="font-bold text-gray-900 dark:text-white">{airport.handlingStatus || (airport.handlingAvailable ? 'Available' : 'Unavailable')}</span></span>
              </div>
              <button 
                onClick={() => setSelectedAirport(airport)}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View Full Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedAirport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">{selectedAirport.name}</h2>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      key={star} 
                      onClick={() => saveAirportMetadata(star)} 
                      disabled={isSavingMetadata}
                      className="focus:outline-none disabled:opacity-50"
                    >
                      <Star size={20} className={star <= (selectedAirport.rating || selectedAirport.score || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'} />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-bold text-gray-500">({selectedAirport.rating || selectedAirport.score || 0}/5)</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={generatePDF}
                  className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-2 rounded-xl border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition"
                  title="Download PDF"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => updateAirportDetails(selectedAirport)}
                  disabled={updatingDetails}
                  className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition border border-indigo-100 dark:border-indigo-800 disabled:opacity-50"
                >
                  {updatingDetails ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Update via AI
                </button>
                <button onClick={() => setSelectedAirport(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">City: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.city}</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">ICAO: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.icao}</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">IATA: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.iata}</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Country: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.country}</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lat: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.latitude ?? 'N/A'}</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lng: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.longitude ?? 'N/A'}</span></p>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Runway: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.runwayLength?.toLocaleString()} ft</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Elevation: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.elevation?.toLocaleString()} ft</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">ATIS Frequency: <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedAirport.atisFrequency || 'N/A'}</span></p>
                {selectedAirport.towerFrequency && <p className="text-sm text-gray-500 dark:text-gray-400">Tower: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.towerFrequency}</span></p>}
                {selectedAirport.groundFrequency && <p className="text-sm text-gray-500 dark:text-gray-400">Ground: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.groundFrequency}</span></p>}
                <p className="text-sm text-gray-500 dark:text-gray-400">Fuel: <span className="font-bold text-gray-900 dark:text-white">{(selectedAirport.fuelTypes || selectedAirport.fuelAvailability || []).join(', ') || 'N/A'}</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Parking: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.parkingSpots} spots</span></p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Star size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-gray-800 dark:text-white uppercase tracking-wider text-sm">Internal Intelligence & Notes</h3>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Enter internal operational notes, ground handling experiences, or specific airport requirements..."
                    className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all placeholder:text-gray-400"
                  />
                  <div className="absolute bottom-3 right-3">
                    <button
                      onClick={() => saveAirportMetadata(undefined, internalNotes)}
                      disabled={isSavingMetadata || internalNotes === (selectedAirport.internalNotes || '')}
                      className="bg-indigo-600 text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
                    >
                      {isSavingMetadata ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      {isSavingMetadata ? 'Saving...' : 'Save Notes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Wind size={18} className="text-indigo-600 dark:text-indigo-400" />
                  Live Weather & NOTAMs
                </h3>
                <button
                  onClick={() => fetchWeatherData(selectedAirport.icao)}
                  disabled={fetchingWeather}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline disabled:opacity-50"
                >
                  {fetchingWeather ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                  Refresh Data
                </button>
              </div>

              {fetchingWeather && (
                <div className="flex justify-center py-4">
                  <Loader2 className="animate-spin text-indigo-600" size={24} />
                </div>
              )}

              {!fetchingWeather && (
                <div className="space-y-4">
                  {liveWeather ? (
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">METAR</h4>
                      <p className="font-mono text-sm text-gray-800 dark:text-gray-200">{liveWeather.metar}</p>
                      <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-4 mb-2">TAF</h4>
                      <p className="font-mono text-sm text-gray-800 dark:text-gray-200">{liveWeather.taf}</p>
                      <p className="text-[10px] text-indigo-400 dark:text-indigo-400 mt-4 font-bold uppercase tracking-widest">Last Updated: {liveWeather.last_updated ? new Date(liveWeather.last_updated).toLocaleString() : new Date().toLocaleString()}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">Weather data unavailable.</p>
                  )}

                  {liveNotams && liveNotams.notams.length > 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active NOTAMs ({liveNotams.notams.length})</h4>
                        <select 
                          value={notamSeverityFilter}
                          onChange={(e) => setNotamSeverityFilter(e.target.value)}
                          className="text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 outline-none"
                        >
                          <option value="All">All</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {liveNotams.notams.filter(n => notamSeverityFilter === 'All' || n.severity === notamSeverityFilter).map((notam, idx) => (
                          <div key={idx} className="flex gap-3 text-sm">
                            <span className={`shrink-0 w-2 h-2 mt-1.5 rounded-full ${
                              notam.severity === 'High' ? 'bg-red-500' :
                              notam.severity === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'
                            }`} />
                            <div>
                              <span className="font-bold text-gray-900 dark:text-white mr-2">{notam.id}</span>
                              <span className="text-gray-600 dark:text-gray-300">{notam.description}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No active NOTAMs found.</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-gray-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                    <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" />
                    Ground Handling Agents
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-gray-400 font-medium">Verified local FBOs and handlers</p>
                    {agentsLastUpdated && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600 px-1">•</span>
                        <span className={`text-[9px] font-bold uppercase tracking-tight ${isAgentsFromCache ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {isAgentsFromCache ? 'From Database' : 'Live Search'}
                        </span>
                        <span className="text-[9px] text-gray-400 font-medium">
                          ({new Date(agentsLastUpdated).toLocaleDateString()} {new Date(agentsLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => fetchHandlingAgents(selectedAirport.icao, selectedAirport.name, selectedAirport.city, true)}
                  disabled={fetchingAgents}
                  className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition border border-indigo-100 dark:border-indigo-800 disabled:opacity-50 shadow-sm"
                >
                  {fetchingAgents ? <Loader2 className="animate-spin text-indigo-600" size={12} /> : <Sparkles size={12} />}
                  {handlingAgents.length > 0 ? 'Refresh Agents' : 'Find Agents'}
                </button>
              </div>

              {fetchingAgents && (
                <div className="flex flex-col items-center justify-center py-12 bg-gray-50/50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                  <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                  <p className="text-xs font-bold text-gray-500 animate-pulse uppercase tracking-widest">Searching local station contacts...</p>
                </div>
              )}

              {!fetchingAgents && handlingAgents.length > 0 && (
                <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {handlingAgents.map((agent, idx) => (
                    <div key={idx} className="group p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-600 transition-all hover:shadow-md">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleTogglePreferred(agent); }}
                            className={`mt-0.5 transition-colors ${agent.preferred ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
                            title={agent.preferred ? "Remove from preferred" : "Mark as preferred"}
                          >
                            <Star size={16} fill={agent.preferred ? "currentColor" : "none"} />
                          </button>
                          <div>
                            <h4 className="font-black text-sm text-gray-900 dark:text-white uppercase leading-none mb-1 flex items-center gap-2">
                              {agent.companyName}
                              {agent.preferred && (
                                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[7px] px-1.5 py-0.5 rounded-full font-black tracking-widest uppercase">Preferred</span>
                              )}
                            </h4>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Verified Local Handler</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            ${agent.baseFee?.toLocaleString()}
                          </span>
                          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Base Fee</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 mb-3">
                        {agent.email && (
                          <a 
                            href={`mailto:${agent.email}`}
                            className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition font-medium"
                          >
                            <Mail size={12} className="text-indigo-400" />
                            <span className="truncate max-w-[120px]">{agent.email}</span>
                          </a>
                        )}
                        {agent.phone && (
                          <a 
                            href={`tel:${agent.phone}`}
                            className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition font-medium"
                          >
                            <Phone size={12} className="text-indigo-400" />
                            <span>{agent.phone}</span>
                          </a>
                        )}
                        {agent.website && (
                          <a 
                            href={agent.website} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition font-medium"
                          >
                            <Globe size={12} className="text-indigo-400" />
                            <span className="truncate max-w-[120px]">{agent.website.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink size={8} />
                          </a>
                        )}
                      </div>

                      {agent.additionalServices && (
                        <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed italic">
                             "{agent.additionalServices}"
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!fetchingAgents && handlingAgents.length === 0 && (
                <div className="text-center py-10 bg-gray-50/50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                  <Building2 className="mx-auto text-gray-300 dark:text-gray-600 mb-3 opacity-50" size={32} />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">No local handlers discovered yet</p>
                  <button
                    onClick={() => fetchHandlingAgents(selectedAirport.icao, selectedAirport.name, selectedAirport.city, true)}
                    className="mx-auto bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition border border-gray-100 dark:border-gray-700 shadow-sm"
                  >
                    <Sparkles size={12} />
                    Auto-Discover with AI
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Handling Status: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.handlingStatus || (selectedAirport.handlingAvailable ? 'Available' : 'Unavailable')}</span></p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Fuel Availability: <span className="font-bold text-gray-900 dark:text-white">{(selectedAirport.fuelAvailability || []).join(', ')}</span></p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Fuel Rate: <span className="font-bold text-gray-900 dark:text-white">${selectedAirport.fuelRate}/L</span></p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Landing Fee: <span className="font-bold text-gray-900 dark:text-white">${selectedAirport.landingFee}</span></p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Parking Fee: <span className="font-bold text-gray-900 dark:text-white">${selectedAirport.parkingFee}/day</span></p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Handling Fee: <span className="font-bold text-gray-900 dark:text-white">${selectedAirport.handlingFee}</span></p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Terminal Navigation Fee: <span className="font-bold text-gray-900 dark:text-white">${selectedAirport.terminalNavigationFee || 0}</span></p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Catering Fee: <span className="font-bold text-gray-900 dark:text-white">${selectedAirport.cateringFee || 0}/pax</span></p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Ground Transport Fee: <span className="font-bold text-gray-900 dark:text-white">${selectedAirport.groundTransportFee || 0}</span></p>
              <p className="text-sm text-gray-500 dark:text-gray-400">De-icing Fee: <span className="font-bold text-gray-900 dark:text-white">${selectedAirport.deicingFee || 0}</span></p>
            </div>
          </div>
        </div>
      )}

      {results.length === 0 && recentAirports.length === 0 && !loading && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <Search className="mx-auto text-gray-300 dark:text-gray-600 mb-2" size={32} />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Search for an airport to see details</p>
        </div>
      )}
    </div>
  );
}
