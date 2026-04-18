import React, { useState, useEffect } from 'react';
import { Search, MapPin, Wind, Fuel, UserCheck, ParkingCircle, Loader2, Globe, DollarSign, X, Building2, Sparkles, Phone, Mail, ExternalLink, RefreshCw, Navigation, Download, Star } from 'lucide-react';
import { searchAirports, searchHandlingAgents, getAirportDetails, searchNearbyAirports, searchAirportsByCountry } from '../services/aiService';
import { getLiveWeather, getLiveNotams, MetarData, NotamData } from '../services/weatherService';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, limit, doc, updateDoc } from 'firebase/firestore';
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      // First check Firestore - check both ICAO and IATA
      const qIcao = query(
        collection(db, 'airports'), 
        where('icao', '==', searchQuery.toUpperCase()),
        limit(1)
      );
      const qIata = query(
        collection(db, 'airports'), 
        where('iata', '==', searchQuery.toUpperCase()),
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
      } else {
        // If not in Firestore, search via AI
        const aiResults = await searchAirports(searchQuery);
        setResults(aiResults.airports);
        
        // Optionally cache first result in Firestore
        if (aiResults.airports.length > 0) {
          const airport = aiResults.airports[0];
          try {
            await addDoc(collection(db, 'airports'), {
              ...airport,
              createdAt: new Date().toISOString()
            });
          } catch (e) {
            console.error("Error caching airport:", e);
          }
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
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

  const fetchHandlingAgents = async (icao: string, name?: string, city?: string) => {
    setFetchingAgents(true);
    setHandlingAgents([]);
    try {
      const result = await searchHandlingAgents(icao, name, city);
      setHandlingAgents(result.agents || []);
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
      fetchWeatherData(selectedAirport.icao);
      fetchHandlingAgents(selectedAirport.icao, selectedAirport.name, selectedAirport.city);
    } else {
      setLiveWeather(null);
      setLiveNotams(null);
      setHandlingAgents([]);
    }
  }, [selectedAirport]);

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

      alert(`Successfully updated details for ${airport.icao}`);
    } catch (error) {
      console.error('Error updating airport details:', error);
      alert('Failed to update airport details via AI.');
    } finally {
      setUpdatingDetails(false);
    }
  };

  const updateAirportScore = async (newScore: number) => {
    if (!selectedAirport.id) return;
    try {
      const airportRef = doc(db, 'airports', selectedAirport.id);
      await updateDoc(airportRef, { score: newScore });
      setSelectedAirport({ ...selectedAirport, score: newScore });
    } catch (error) {
      console.error('Error updating score:', error);
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Globe className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="font-bold text-gray-800 dark:text-white">Global Airport Database</h2>
          </div>
          <button
            onClick={seedData}
            disabled={loading}
            className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-1.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition border border-indigo-100 dark:border-indigo-800 text-xs"
          >
            <Sparkles size={14} />
            Seed Airports
          </button>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
          <input 
            type="text" 
            placeholder="Search by IATA, ICAO, or City..." 
            className="w-full pl-10 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition dark:text-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button 
            type="submit"
            disabled={loading}
            className="absolute right-2 top-2 bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Search'}
          </button>
        </form>
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
                  <ul className="text-xs space-y-1">
                    {countryResults.internationalAirports.map((a: any) => <li key={a.icao}>{a.name} ({a.icao})</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">Domestic Airports</h4>
                  <ul className="text-xs space-y-1">
                    {countryResults.domesticAirports.map((a: any) => <li key={a.icao}>{a.name} ({a.icao})</li>)}
                  </ul>
                </div>
              </div>
           </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-6">
          <Navigation className="text-indigo-600 dark:text-indigo-400" size={20} />
          <h2 className="font-bold text-gray-800 dark:text-white">Nearby Airport Search (PostGIS)</h2>
        </div>

        <form onSubmit={handleNearbySearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
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
                    <button key={star} onClick={() => updateAirportScore(star)} className="focus:outline-none">
                      <Star size={20} className={star <= (selectedAirport.score || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'} />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-bold text-gray-500">({selectedAirport.score || 0}/5)</span>
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
                <p className="text-sm text-gray-500 dark:text-gray-400">Parking: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.parkingSpots} spots</span></p>
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
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" />
                  Handling Agents
                </h3>
                <button
                  onClick={() => fetchHandlingAgents(selectedAirport.icao, selectedAirport.name, selectedAirport.city)}
                  disabled={fetchingAgents}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline disabled:opacity-50"
                >
                  {fetchingAgents ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                  {handlingAgents.length > 0 ? 'Refresh AI Suggestions' : 'Find Agents via AI'}
                </button>
              </div>

              {fetchingAgents && (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-indigo-600" size={24} />
                </div>
              )}

              {!fetchingAgents && handlingAgents.length > 0 && (
                <div className="space-y-3">
                  {handlingAgents.map((agent, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">{agent.companyName}</h4>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                          ${agent.baseFee} Base
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                          <Mail size={12} />
                          <span className="truncate">{agent.email}</span>
                        </div>
                        {agent.phone && (
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                            <Phone size={12} />
                            <a href={`tel:${agent.phone}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">{agent.phone}</a>
                          </div>
                        )}
                        {agent.website && (
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 col-span-2">
                            <Globe size={12} className="shrink-0" />
                            <a href={agent.website} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400 truncate flex items-center gap-1 transition">
                              {agent.website.replace(/^https?:\/\//, '')} <ExternalLink size={8} className="shrink-0" />
                            </a>
                          </div>
                        )}
                      </div>
                      {agent.additionalServices && (
                        <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 italic line-clamp-1">
                          "{agent.additionalServices}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!fetchingAgents && handlingAgents.length === 0 && (
                <p className="text-center py-8 text-xs text-gray-400 dark:text-gray-500 italic">
                  Click the button above to discover handling agents at this airport using AI.
                </p>
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
