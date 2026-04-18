import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plane, MapPin, Activity, History, Loader2, AlertCircle, RefreshCw, Navigation, Info, ExternalLink, Sparkles, Clock, Calendar, Zap } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import FlightMap from './FlightMap';
import { predictAircraftAvailability, AIPrediction } from '../services/aiPredictionService';

interface Aircraft {
  id: string;
  registration?: string;
  type: string;
  operator: string;
  icao24?: string;
  status: string;
}

interface TrackingData {
  latitude: number;
  longitude: number;
  velocity: number;
  baro_altitude: number;
  true_track: number;
  on_ground: boolean;
  callsign?: string;
}

interface UtilizationData {
  total_recent_flights: number;
  active_missions: number;
  history: any[];
}

export default function LiveFleetTracking() {
  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [utilizationData, setUtilizationData] = useState<UtilizationData | null>(null);
  const [aiPrediction, setAiPrediction] = useState<AIPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const fetchAircraft = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'aircraft'));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aircraft));
        setAircraftList(data);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'aircraft');
      }
    };
    fetchAircraft();
  }, []);

  const handleTrackAircraft = async (aircraft: Aircraft) => {
    setSelectedAircraft(aircraft);
    setLoading(true);
    setError(null);
    setTrackingData(null);
    setUtilizationData(null);
    setAiPrediction(null);

    try {
      const fetchWithRetry = async (url: string, retries = 2): Promise<Response> => {
        try {
          const res = await fetch(url);
          if (!res.ok && retries > 0) throw new Error(`Status ${res.status}`);
          return res;
        } catch (e) {
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRetry(url, retries - 1);
          }
          throw e;
        }
      };

      // 1. Fetch Live Tracking (OpenSky)
      if (aircraft.icao24) {
        const trackRes = await fetchWithRetry(`/api/v1/aircraft/track/${encodeURIComponent(aircraft.icao24.trim())}`);
        if (trackRes.ok) {
          const trackJson = await trackRes.json();
          setTrackingData(trackJson.data);
        } else {
          console.warn('Live tracking not available for this aircraft');
        }
      }

      // 2. Fetch Utilization (Aviationstack)
      if (aircraft.registration) {
        const utilRes = await fetchWithRetry(`/api/v1/aircraft/utilization/${encodeURIComponent(aircraft.registration.trim())}`);
        if (utilRes.ok) {
          const utilJson = await utilRes.json();
          setUtilizationData(utilJson.metrics);
        } else {
          console.warn('Utilization data not available for this registration');
        }
      }
    } catch (err) {
      console.error('Tracking error:', err);
      setError('Failed to fetch live data from aviation APIs.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedAircraft) return;
    setRefreshing(true);
    await handleTrackAircraft(selectedAircraft);
    setRefreshing(false);
  };

  const handleAIPredict = async () => {
    if (!selectedAircraft || !utilizationData) return;
    setPredicting(true);
    try {
      const prediction = await predictAircraftAvailability(
        selectedAircraft.type,
        selectedAircraft.registration || 'Unknown',
        utilizationData.history,
        trackingData
      );
      setAiPrediction(prediction);
    } catch (err) {
      console.error('AI Prediction error:', err);
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="text-indigo-600 dark:text-indigo-400" />
            Live Fleet Intelligence
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Source 3: Real-time tracking via OpenSky Network and utilization metrics via Aviationstack.
          </p>
        </div>
        {selectedAircraft && (
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh Live Data
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Fleet List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Your Fleet</h3>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-[600px] overflow-y-auto custom-scrollbar">
              {aircraftList.map((aircraft) => (
                <button
                  key={aircraft.id}
                  onClick={() => handleTrackAircraft(aircraft)}
                  className={`w-full text-left p-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition flex items-center justify-between group ${selectedAircraft?.id === aircraft.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-600' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedAircraft?.id === aircraft.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 group-hover:text-indigo-600'}`}>
                      <Plane size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{aircraft.registration}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{aircraft.type} • {aircraft.operator}</p>
                    </div>
                  </div>
                  <Navigation size={16} className={`opacity-0 group-hover:opacity-100 transition ${selectedAircraft?.id === aircraft.id ? 'opacity-100 text-indigo-600' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Intelligence View */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedAircraft ? (
            <div className="bg-white dark:bg-gray-800 p-12 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <Navigation className="text-gray-300" size={32} />
              </div>
              <h3 className="font-bold text-gray-800 dark:text-white">Select an Aircraft</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mt-2">
                Choose an aircraft from your fleet to view its real-time position, utilization metrics, and flight history.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Live Status Header */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 dark:shadow-none">
                      <Plane size={32} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">{selectedAircraft.registration}</h2>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${trackingData?.on_ground === false ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                          {trackingData?.on_ground === false ? 'In Flight' : 'On Ground'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{selectedAircraft.type} • {selectedAircraft.operator}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ICAO24</p>
                      <p className="text-sm font-black text-gray-800 dark:text-white">{selectedAircraft.icao24 || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Callsign</p>
                      <p className="text-sm font-black text-gray-800 dark:text-white">{trackingData?.callsign || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Altitude</p>
                      <p className="text-sm font-black text-gray-800 dark:text-white">{trackingData?.baro_altitude ? `${Math.round(trackingData.baro_altitude * 3.28084)} ft` : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map & Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Live Position Map */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 h-[400px] relative overflow-hidden">
                  <div className="absolute top-6 left-6 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-red-500" />
                      <span className="text-xs font-bold text-gray-800 dark:text-white">Live Position</span>
                    </div>
                  </div>
                  {trackingData ? (
                    <FlightMap 
                      legs={[]} 
                      aircraftType={selectedAircraft.type}
                      previewAirports={[]}
                      onMapClick={() => {}}
                      onRemoveLastCoordinate={() => {}}
                      isDarkMode={false}
                      livePosition={{
                        lat: trackingData.latitude,
                        lng: trackingData.longitude,
                        track: trackingData.true_track,
                        registration: selectedAircraft.registration || 'LIVE'
                      }}
                      isLoading={loading}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-50 dark:bg-gray-700/30 flex flex-col items-center justify-center text-center p-8">
                      <MapPin size={48} className="text-gray-200 mb-4" />
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No Live GPS Data</p>
                      <p className="text-xs text-gray-400 mt-2">Aircraft is likely on ground or outside OpenSky coverage.</p>
                    </div>
                  )}
                </div>

                {/* AI Prediction Layer */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                      <Sparkles size={120} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-black text-lg flex items-center gap-2">
                          <Sparkles size={20} className="text-yellow-400" />
                          AI Prediction Layer
                        </h3>
                        {!aiPrediction && (
                          <button 
                            onClick={handleAIPredict}
                            disabled={predicting || !utilizationData}
                            className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
                          >
                            {predicting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                            Predict Availability
                          </button>
                        )}
                      </div>

                      {aiPrediction ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock size={12} className="text-indigo-200" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Idle Time</span>
                              </div>
                              <p className="text-xs font-bold leading-tight">{aiPrediction.idleTimePrediction}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar size={12} className="text-indigo-200" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Maintenance</span>
                              </div>
                              <p className="text-xs font-bold leading-tight">{aiPrediction.maintenanceWindowPrediction}</p>
                            </div>
                          </div>

                          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Empty Leg Opportunities</span>
                              <span className="text-[10px] bg-yellow-400 text-indigo-900 px-2 py-0.5 rounded-full font-black">AI INSIGHT</span>
                            </div>
                            <div className="space-y-2">
                              {aiPrediction.emptyLegs.map((leg, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span className="font-bold">{leg.route}</span>
                                  <span className="text-indigo-200 font-black">{(leg.probability * 100).toFixed(0)}% Prob.</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Confidence: {aiPrediction.confidenceScore}%</span>
                            </div>
                            <button 
                              onClick={() => setAiPrediction(null)}
                              className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 hover:text-white transition"
                            >
                              Reset Analysis
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-sm text-indigo-100 opacity-80 leading-relaxed">
                            {predicting 
                              ? "Gemini is analyzing flight history, current position, and typical maintenance cycles for this aircraft type..." 
                              : "Unlock predictive insights for idle time, empty legs, and maintenance windows using AI analysis of historical data."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Utilization Metrics */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                      <Activity size={18} className="text-indigo-600" />
                      Utilization Metrics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Recent Flights</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{utilizationData?.total_recent_flights || 0}</p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Active Missions</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{utilizationData?.active_missions || 0}</p>
                      </div>
                    </div>
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Availability Estimation</span>
                        <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">High</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        Based on recent utilization ({(utilizationData?.total_recent_flights || 0) / 7} flights/day), this aircraft has high availability for the next 72 hours.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                      <History size={18} className="text-indigo-600" />
                      Recent Flight History
                    </h3>
                    <div className="space-y-3">
                      {utilizationData?.history && utilizationData.history.length > 0 ? (
                        utilizationData.history.map((flight: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 border border-gray-100 dark:border-gray-700">
                                <Navigation size={14} className="rotate-45" />
                              </div>
                              <div>
                                <p className="text-xs font-black text-gray-800 dark:text-white">{flight.departure.iata} → {flight.arrival.iata}</p>
                                <p className="text-[10px] text-gray-400 font-bold">{new Date(flight.flight_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${flight.flight_status === 'landed' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                              {flight.flight_status.toUpperCase()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-4">No recent history available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
