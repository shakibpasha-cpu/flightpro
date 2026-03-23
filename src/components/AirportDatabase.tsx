import React, { useState, useEffect } from 'react';
import { Search, MapPin, Wind, Fuel, UserCheck, ParkingCircle, Loader2, Globe, DollarSign, X, Building2, Sparkles, Phone, Mail, ExternalLink } from 'lucide-react';
import { searchAirports, searchHandlingAgents } from '../services/aiService';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export default function AirportDatabase() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentAirports, setRecentAirports] = useState<any[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<any | null>(null);
  const [handlingAgents, setHandlingAgents] = useState<any[]>([]);
  const [fetchingAgents, setFetchingAgents] = useState(false);

  const seedData = async () => {
    setLoading(true);
    const sampleAirports = [
      {
        name: 'London Heathrow Airport',
        icao: 'EGLL',
        iata: 'LHR',
        country: 'United Kingdom',
        runwayLength: 12802,
        elevation: 83,
        fuelAvailability: ['Jet A-1', 'Avgas'],
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
        country: 'United States',
        runwayLength: 14511,
        elevation: 13,
        fuelAvailability: ['Jet A-1'],
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
        country: 'United Arab Emirates',
        runwayLength: 14590,
        elevation: 62,
        fuelAvailability: ['Jet A-1'],
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
        country: 'Singapore',
        runwayLength: 13123,
        elevation: 22,
        fuelAvailability: ['Jet A-1'],
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
        country: 'France',
        runwayLength: 13829,
        elevation: 392,
        fuelAvailability: ['Jet A-1', 'Avgas'],
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
      // First check Firestore
      const q = query(
        collection(db, 'airports'), 
        where('icao', '==', searchQuery.toUpperCase()),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
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

  const fetchHandlingAgents = async (icao: string) => {

    setFetchingAgents(true);
    setHandlingAgents([]);
    try {
      const result = await searchHandlingAgents(icao);
      setHandlingAgents(result.agents || []);
    } catch (error) {
      console.error('Error fetching handling agents:', error);
    } finally {
      setFetchingAgents(false);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(results.length > 0 ? results : recentAirports).map((airport) => (
          <div key={airport.id || airport.icao} className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-500 transition group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{airport.name}</h3>
                <div className="flex gap-2 mt-1">
                  <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{airport.icao}</span>
                  <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{airport.iata}</span>
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
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Fuel size={14} className="text-gray-400 dark:text-gray-500" />
                  <span className="truncate">Fuel: <span className="font-semibold text-gray-900 dark:text-white">{airport.fuelAvailability.join(', ')}</span></span>
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
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl w-full max-w-2xl border border-gray-100 dark:border-gray-700 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">{selectedAirport.name}</h2>
              <button onClick={() => setSelectedAirport(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">ICAO: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.icao}</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">IATA: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.iata}</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Country: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.country}</span></p>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Runway: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.runwayLength?.toLocaleString()} ft</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Elevation: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.elevation?.toLocaleString()} ft</span></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Parking: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.parkingSpots} spots</span></p>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" />
                  Handling Agents
                </h3>
                <button
                  onClick={() => fetchHandlingAgents(selectedAirport.icao)}
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
                            <span>{agent.phone}</span>
                          </div>
                        )}
                        {agent.website && (
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 col-span-2">
                            <Globe size={12} />
                            <a href={agent.website} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 truncate flex items-center gap-1">
                              {agent.website} <ExternalLink size={8} />
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Fuel Availability: <span className="font-bold text-gray-900 dark:text-white">{selectedAirport.fuelAvailability.join(', ')}</span></p>
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
