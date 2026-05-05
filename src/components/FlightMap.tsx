import { MapContainer, TileLayer, Polyline, Marker, Popup, useMapEvents, useMap, ScaleControl, Tooltip, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getAirportDetails, searchAirports, searchHandlingAgents, getLegFIRAnalysis } from '../services/aiService';
import { getLiveWeather, getLiveNotams, MetarData, NotamData } from '../services/weatherService';
import { Layers, Map as MapIcon, Compass, Wind, Shield, Info, X, ChevronRight, ChevronDown, GripVertical, ListOrdered, Clock, Trash2, Plus, Globe, Plane, Route, Users, Sparkles, Loader2, Mail, Phone, ExternalLink, Cloud, Activity, MousePointer2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getGlobalRestrictedAirspaces, getLiveSafetyAlerts, RestrictedAirspace as GlobalRestrictedAirspace } from '../services/safetyService';
import { CHART_LAYERS, DefaultIcon, getBearing, getMidpoint, calculateDistance } from '../lib/mapConfig';



// Set default icon for all markers
L.Marker.prototype.options.icon = DefaultIcon;

const getNumberedIcon = (number: number, isSelected: boolean = false) => {
  return L.divIcon({
    className: 'numbered-marker',
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-7 h-7 ${isSelected ? 'bg-indigo-600' : 'bg-white dark:bg-gray-800'} rounded-full border-2 border-indigo-500 shadow-lg flex items-center justify-center transition-all transform hover:scale-110">
          <span class="text-[10px] font-black ${isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}">${number}</span>
        </div>
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-indigo-500 rotate-45"></div>
      </div>
    `,
    iconSize: [28, 32],
    iconAnchor: [14, 32],
    popupAnchor: [0, -32]
  });
};

function AirportPopup({ code }: { code: string }) {
  const [details, setDetails] = useState<any>(null);
  const [weather, setWeather] = useState<MetarData | null>(null);
  const [notams, setNotams] = useState<NotamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notamSeverityFilter, setNotamSeverityFilter] = useState<string>('All');

  useEffect(() => {
    if (code === 'Custom' || code.includes(',')) {
      setDetails({
        runwayLength: 'N/A',
        elevation: 'N/A',
        fuelAvailability: 'N/A',
        atisFrequency: 'N/A'
      });
      setLoading(false);
      return;
    }
    
    Promise.all([
      getAirportDetails(code),
      getLiveWeather(code).catch(() => null),
      getLiveNotams(code).catch(() => null)
    ]).then(([airportData, weatherData, notamData]) => {
      setDetails(airportData);
      setWeather(weatherData);
      setNotams(notamData);
      setLoading(false);
    });
  }, [code]);

  return (
    <div className="min-w-[200px] max-w-[300px]">
      <p className="font-bold text-indigo-600 dark:text-indigo-400 border-b dark:border-gray-700 pb-1 mb-2">
        {code === 'Custom' || code.includes(',') ? 'Custom Waypoint' : `Airport: ${code}`}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs">
          <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading details...
        </div>
      ) : (
        <div className="space-y-2 text-xs text-gray-800 dark:text-gray-200">
          {code !== 'Custom' && !code.includes(',') && (
            <>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <p><strong>Runway:</strong> {details.runwayLength?.toLocaleString()} ft</p>
                <p><strong>Elevation:</strong> {details.elevation?.toLocaleString()} ft</p>
                <p className="col-span-2"><strong>Timezone:</strong> {details.timezone || 'N/A'}</p>
                <p className="col-span-2"><strong>Fuel:</strong> {details.fuelAvailability}</p>
                <p className="col-span-2 text-indigo-600 dark:text-indigo-400 font-bold"><strong>ATIS:</strong> {details.atisFrequency || 'N/A'}</p>
              </div>
              
              {weather && (
                <div className="mt-2 pt-2 border-t dark:border-gray-700">
                  <p className="font-bold text-gray-900 dark:text-white mb-1">Live Weather</p>
                  <p className="font-mono text-[10px] text-gray-600 dark:text-gray-400 break-words mb-1"><span className="font-bold text-gray-700 dark:text-gray-300">METAR:</span> {weather.metar}</p>
                  {weather.taf && weather.taf !== "N/A" && (
                    <p className="font-mono text-[10px] text-gray-600 dark:text-gray-400 break-words line-clamp-3" title={weather.taf}><span className="font-bold text-gray-700 dark:text-gray-300">TAF:</span> {weather.taf}</p>
                  )}
                </div>
              )}
              
              {notams && notams.notams.length > 0 && (
                <div className="mt-2 pt-2 border-t dark:border-gray-700">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-gray-900 dark:text-white">Active NOTAMs ({notams.notams.length})</p>
                    <select 
                      value={notamSeverityFilter}
                      onChange={(e) => setNotamSeverityFilter(e.target.value)}
                      className="text-[9px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 outline-none"
                    >
                      <option value="All">All</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                    {notams.notams.filter(n => notamSeverityFilter === 'All' || n.severity === notamSeverityFilter).map((notam, idx) => (
                      <div key={idx} className="flex gap-1.5">
                        <span className={`shrink-0 w-1.5 h-1.5 mt-1 rounded-full ${
                          notam.severity === 'High' ? 'bg-red-500' :
                          notam.severity === 'Medium' ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 leading-tight">{notam.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {(code === 'Custom' || code.includes(',')) && (
            <p className="text-gray-500 italic">User-defined coordinate waypoint.</p>
          )}
        </div>
      )}
    </div>
  );
}

interface RestrictedArea {
  name: string;
  reason: string;
  severity: 'Low' | 'Medium' | 'High';
  coordinates?: [number, number][];
}

interface HandlingAgent {
  companyName: string;
  email: string;
  phone?: string;
  website?: string;
  baseFee: number;
  additionalServices?: string;
}

interface Leg {
  departure: string;
  destination: string;
  departureCoords: { lat: number, lng: number };
  destinationCoords: { lat: number, lng: number };
  gcDistance: number;
  routingDistance: number;
  flightTime: number;
  fuelBurn: number;
  altitude?: number;
  restrictedAreas?: RestrictedArea[];
  firs?: { firCode?: string; firName?: string; name?: string; country: string; rules?: string; overflightCharge?: number; navigationCharge?: number; }[];
  etd?: string;
  eta?: string;
  handlingAgents?: HandlingAgent[];
  costs?: {
    total: number;
    fuel: number;
    landing: number;
    handling: number;
    departureHandling: number;
    parking: number;
    overflight: number;
  };
}

function calculateDurationFromEtdEta(etd?: string, eta?: string): { hours: number, minutes: number } | null {
  if (!etd || !eta) return null;
  
  // Check if ISO string
  if (etd.includes('T') && eta.includes('T')) {
    const d1 = new Date(etd);
    const d2 = new Date(eta);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      let diffMs = d2.getTime() - d1.getTime();
      if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return { hours, minutes };
    }
  }
  
  // Assuming HH:mm format
  const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return hours * 60 + minutes;
    }
    return null;
  };
  
  const t1 = parseTime(etd);
  const t2 = parseTime(eta);
  
  if (t1 !== null && t2 !== null) {
    let diffMins = t2 - t1;
    if (diffMins < 0) diffMins += 24 * 60; // Next day
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    return { hours, minutes };
  }
  
  return null;
}

interface SafetyData {
  notams: { id: string, airport: string, description: string, severity: 'Low' | 'Medium' | 'High' }[];
  weather: { location: string, condition: string, impact: string, severity: 'Low' | 'Medium' | 'High' }[];
}

interface FlightMapProps {
  legs?: Leg[];
  restrictedAreas?: RestrictedArea[];
  aircraftType?: string;
  passengerCount?: number;
  missionType?: string;
  departure?: string;
  destination?: string;
  previewAirports?: string[];
  onMapClick?: (lat: number, lng: number) => void;
  onRemoveLastCoordinate?: () => void;
  onLegsChange?: (legs: Leg[], isFinal?: boolean) => void;
  onRestrictedAreasChange?: (areas: RestrictedArea[]) => void;
  isDarkMode?: boolean;
  livePosition?: { lat: number, lng: number, track?: number, registration?: string };
  liveHistory?: { lat: number, lng: number }[];
  optimizedRoute?: any;
  safetyData?: SafetyData;
  hoveredLegIndex?: number | null;
  isLoading?: boolean;
}

function MapEvents({ onMapClick, onMouseMove, isDrawing, drawingPoints, setDrawingPoints }: { 
  onMapClick?: (lat: number, lng: number) => void, 
  onMouseMove?: (lat: number, lng: number) => void,
  isDrawing?: boolean,
  drawingPoints?: [number, number][],
  setDrawingPoints?: (points: [number, number][]) => void
}) {
  useMapEvents({
    click(e) {
      if (isDrawing && setDrawingPoints && drawingPoints) {
        setDrawingPoints([...drawingPoints, [e.latlng.lat, e.latlng.lng]]);
      } else if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
    mousemove(e) {
      if (onMouseMove) {
        onMouseMove(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

function MapController({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  
  useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [coords, map]);
  
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

function MapInstanceSetter({ setMap }: { setMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      setMap(map);
    }
  }, [map, setMap]);
  return null;
}

export default function FlightMap({ 
  legs, 
  aircraftType, 
  passengerCount, 
  missionType,
  departure,
  destination,
  previewAirports, 
  onMapClick, 
  onRemoveLastCoordinate, 
  onLegsChange, 
  onRestrictedAreasChange,
  restrictedAreas,
  isDarkMode, 
  livePosition,
  liveHistory,
  optimizedRoute,
  safetyData,
  hoveredLegIndex,
  isLoading
}: FlightMapProps) {
  const [previewCoords, setPreviewCoords] = useState<{ code: string, lat: number, lng: number }[]>([]);
  const [lastClicked, setLastClicked] = useState<{ lat: number, lng: number } | null>(null);
  const [mouseCoords, setMouseCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [activeChart, setActiveChart] = useState<string>('standard');
  const [showChartSelector, setShowChartSelector] = useState(false);
  const [showWaypoints, setShowWaypoints] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [chartNightMode, setChartNightMode] = useState(isDarkMode || false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [localLegs, setLocalLegs] = useState<Leg[]>(legs || []);
  const [selectedLegIndex, setSelectedLegIndex] = useState<number | null>(null);
  const [showRestrictedAreas, setShowRestrictedAreas] = useState(true);
  const [globalRestrictedAirspaces, setGlobalRestrictedAirspaces] = useState<GlobalRestrictedAirspace[]>([]);
  const [showWeather, setShowWeather] = useState(true);
  const [showRisks, setShowRisks] = useState(true);
  const [isDrawingRestrictedArea, setIsDrawingRestrictedArea] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaReason, setNewAreaReason] = useState('');
  const [newAreaSeverity, setNewAreaSeverity] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [fetchingAgents, setFetchingAgents] = useState(false);
  const [fetchingFIRsForLeg, setFetchingFIRsForLeg] = useState<number | null>(null);

  const handleFetchFIRInfo = async (idx: number) => {
    setFetchingFIRsForLeg(idx);
    try {
      const leg = localLegs[idx];
      const data = await getLegFIRAnalysis(leg.departure, leg.destination, aircraftType || 'Jet');
      if (data && data.firs) {
        const newLegs = [...localLegs];
        newLegs[idx] = { ...newLegs[idx], firs: data.firs };
        setLocalLegs(newLegs);
        onLegsChange?.(newLegs, true);
      }
    } catch (error) {
      console.error("Error fetching FIRs:", error);
    } finally {
      setFetchingFIRsForLeg(null);
    }
  };

  const handleRefreshHandlingAgents = async (idx: number) => {
    setFetchingAgents(true);
    try {
      const leg = localLegs[idx];
      const data = await searchHandlingAgents(leg.destination, undefined, undefined, aircraftType, true);
      if (data && data.agents) {
        const newLegs = [...localLegs];
        newLegs[idx] = { ...newLegs[idx], handlingAgents: data.agents };
        setLocalLegs(newLegs);
        onLegsChange?.(newLegs, true);
      }
    } catch (err) {
      console.error('Error refreshing handling agents:', err);
    } finally {
      setFetchingAgents(false);
    }
  };

  useEffect(() => {
    if (selectedLegIndex !== null && localLegs && localLegs[selectedLegIndex]) {
      const leg = localLegs[selectedLegIndex];
      if (leg.destination && (!leg.handlingAgents || leg.handlingAgents.length === 0)) {
        setFetchingAgents(true);
        searchHandlingAgents(leg.destination).then(data => {
          if (data.agents) {
            const newLegs = [...localLegs];
            newLegs[selectedLegIndex] = { ...newLegs[selectedLegIndex], handlingAgents: data.agents.slice(0, 3) };
            setLocalLegs(newLegs);
            onLegsChange?.(newLegs);
          }
          setFetchingAgents(false);
        }).catch(err => {
          console.error('Error fetching handling agents:', err);
          setFetchingAgents(false);
        });
      }
    }
  }, [selectedLegIndex, localLegs?.[selectedLegIndex]?.destination]);

  useEffect(() => {
    if (legs) {
      setLocalLegs(legs);
      setSelectedLegIndex(null);
    }
  }, [legs]);

  useEffect(() => {
    const fetchAirspaces = async () => {
      try {
        const [airspaces, liveAlerts] = await Promise.all([
          getGlobalRestrictedAirspaces(),
          getLiveSafetyAlerts()
        ]);
        
        // Merge and remove duplicates by ID
        const merged = [...airspaces, ...liveAlerts];
        const unique = merged.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
        
        setGlobalRestrictedAirspaces(unique);
      } catch (e) {
        console.error("Failed to fetch global restricted airspaces", e);
      }
    };
    fetchAirspaces();
  }, []);

  const weatherMarkers = useMemo(() => {
    if (!safetyData?.weather || !localLegs.length) return [];
    
    const airportCoords: Record<string, { lat: number, lng: number }> = {};
    localLegs.forEach(leg => {
      airportCoords[leg.departure] = leg.departureCoords;
      airportCoords[leg.destination] = leg.destinationCoords;
    });

    return safetyData.weather.map((w, idx) => {
      const coords = airportCoords[w.location];
      if (!coords) return null;
      return { ...w, coords, id: `weather-${idx}` };
    }).filter((w): w is any => w !== null);
  }, [safetyData?.weather, localLegs]);

  const riskHighlights = useMemo(() => {
    if (!safetyData?.notams || !localLegs.length) return [];
    
    const airportCoords: Record<string, { lat: number, lng: number }> = {};
    localLegs.forEach(leg => {
      airportCoords[leg.departure] = leg.departureCoords;
      airportCoords[leg.destination] = leg.destinationCoords;
    });

    return safetyData.notams.map((n, idx) => {
      const coords = airportCoords[n.airport];
      if (!coords) return null;
      return { ...n, coords, id: `risk-${idx}` };
    }).filter((n): n is any => n !== null);
  }, [safetyData?.notams, localLegs]);

  const getWeatherIcon = (condition: string, severity: 'Low' | 'Medium' | 'High') => {
    const color = severity === 'High' ? '#ef4444' : severity === 'Medium' ? '#f59e0b' : '#3b82f6';
    return L.divIcon({
      className: 'weather-icon',
      html: `
        <div class="flex items-center justify-center w-8 h-8 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg border-2" style="border-color: ${color}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.5 19a3.5 3.5 0 0 0 0-7h-1.5a7 7 0 1 0-11.91 4.91"/>
            ${condition.toLowerCase().includes('storm') || condition.toLowerCase().includes('lightning') ? '<path d="m13 10-4 6h6l-4 6"/>' : ''}
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  const getRiskIcon = (severity: 'Low' | 'Medium' | 'High') => {
    const color = severity === 'High' ? '#ef4444' : severity === 'Medium' ? '#f59e0b' : '#3b82f6';
    return L.divIcon({
      className: 'risk-icon',
      html: `
        <div class="flex items-center justify-center w-8 h-8 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg border-2" style="border-color: ${color}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/>
            <path d="M12 17h.01"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  const waypoints = useMemo(() => {
    if (!localLegs || localLegs.length === 0) return [];
    const wps = [];
    wps.push({ id: 'wp-0', name: localLegs[0].departure, coords: localLegs[0].departureCoords });
    localLegs.forEach((leg, idx) => {
      wps.push({ id: `wp-${idx + 1}`, name: leg.destination, coords: leg.destinationCoords });
    });
    return wps;
  }, [localLegs]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !localLegs || !onLegsChange) return;
    
    const items = Array.from(waypoints);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Reconstruct legs from reordered waypoints
    const newLegs: Leg[] = [];
    
    const totalOriginalDistance = localLegs.reduce((acc, leg) => acc + (leg.gcDistance || 1), 0);
    const totalOriginalFlightTime = localLegs.reduce((acc, leg) => acc + (leg.flightTime || 1), 0);
    const totalOriginalFuelBurn = localLegs.reduce((acc, leg) => acc + (leg.fuelBurn || 1), 0);
    const totalOriginalCost = localLegs.reduce((acc, leg) => acc + (leg.costs?.total || 0), 0);
    const avgSpeed = totalOriginalDistance > 0 ? totalOriginalDistance / totalOriginalFlightTime : 450;
    const avgFuelPerNm = totalOriginalDistance > 0 ? totalOriginalFuelBurn / totalOriginalDistance : 4.5;
    const avgCostPerNm = totalOriginalDistance > 0 ? totalOriginalCost / totalOriginalDistance : 15;

    for (let i = 0; i < items.length - 1; i++) {
      const wp1 = items[i];
      const wp2 = items[i+1];
      
      const gcDistance = Math.round(calculateDistance(wp1.coords.lat, wp1.coords.lng, wp2.coords.lat, wp2.coords.lng));
      const routingDistance = Math.round(gcDistance * 1.05);
      
      newLegs.push({
        departure: wp1.name,
        destination: wp2.name,
        departureCoords: wp1.coords,
        destinationCoords: wp2.coords,
        gcDistance,
        routingDistance,
        flightTime: gcDistance / avgSpeed,
        fuelBurn: gcDistance * avgFuelPerNm,
        costs: {
          total: routingDistance * avgCostPerNm,
          fuel: (gcDistance * avgFuelPerNm) * 1.2,
          landing: 0,
          handling: 0,
          departureHandling: 0,
          parking: 0,
          overflight: 0
        }
      });
    }
    
    setLocalLegs(newLegs);
    onLegsChange(newLegs);
  };

  const handleWaypointDrag = (index: number, newLat: number, newLng: number, isFinal: boolean = true) => {
    if (!localLegs || !onLegsChange) return;
    
    const newLegs = [...localLegs];
    
    // Calculate global averages for more stable updates during drag
    const totalOriginalDistance = localLegs.reduce((acc, leg) => acc + (leg.gcDistance || 1), 0);
    const totalOriginalFlightTime = localLegs.reduce((acc, leg) => acc + (leg.flightTime || 1), 0);
    const totalOriginalFuelBurn = localLegs.reduce((acc, leg) => acc + (leg.fuelBurn || 1), 0);
    const totalOriginalCost = localLegs.reduce((acc, leg) => acc + (leg.costs?.total || 0), 0);
    const avgSpeed = totalOriginalDistance > 0 ? totalOriginalDistance / totalOriginalFlightTime : 450;
    const avgFuelPerNm = totalOriginalDistance > 0 ? totalOriginalFuelBurn / totalOriginalDistance : 4.5;
    const avgCostPerNm = totalOriginalDistance > 0 ? totalOriginalCost / totalOriginalDistance : 15;

    const updateLegMetrics = (leg: Leg) => {
      leg.gcDistance = Math.round(calculateDistance(leg.departureCoords.lat, leg.departureCoords.lng, leg.destinationCoords.lat, leg.destinationCoords.lng));
      leg.routingDistance = Math.round(leg.gcDistance * 1.05);
      leg.flightTime = leg.gcDistance / avgSpeed;
      leg.fuelBurn = leg.gcDistance * avgFuelPerNm;
      if (leg.costs) {
        leg.costs.total = leg.routingDistance * avgCostPerNm;
      }
      return leg;
    };

    const coordString = `${newLat.toFixed(4)}, ${newLng.toFixed(4)}`;

    if (index === 0) {
      const leg = { ...newLegs[0] };
      leg.departureCoords = { lat: newLat, lng: newLng };
      leg.departure = coordString;
      newLegs[0] = updateLegMetrics(leg);
    } 
    else if (index === localLegs.length) {
      const leg = { ...newLegs[localLegs.length - 1] };
      leg.destinationCoords = { lat: newLat, lng: newLng };
      leg.destination = coordString;
      newLegs[localLegs.length - 1] = updateLegMetrics(leg);
    }
    else {
      const prevLeg = { ...newLegs[index - 1] };
      const nextLeg = { ...newLegs[index] };
      
      prevLeg.destinationCoords = { lat: newLat, lng: newLng };
      prevLeg.destination = coordString;
      newLegs[index - 1] = updateLegMetrics(prevLeg);
      
      nextLeg.departureCoords = { lat: newLat, lng: newLng };
      nextLeg.departure = coordString;
      newLegs[index] = updateLegMetrics(nextLeg);
    }
    
    setLocalLegs(newLegs);
    onLegsChange(newLegs, isFinal);
  };

  const handleMidpointDrag = (index: number, newLat: number, newLng: number, isFinal: boolean = true) => {
    if (!localLegs || !onLegsChange) return;

    const currentLeg = localLegs[index];
    const totalOriginalDistance = localLegs.reduce((acc, leg) => acc + (leg.gcDistance || 1), 0);
    const totalOriginalFlightTime = localLegs.reduce((acc, leg) => acc + (leg.flightTime || 1), 0);
    const totalOriginalFuelBurn = localLegs.reduce((acc, leg) => acc + (leg.fuelBurn || 1), 0);
    const totalOriginalCost = localLegs.reduce((acc, leg) => acc + (leg.costs?.total || 0), 0);

    const avgSpeed = totalOriginalDistance > 0 ? totalOriginalDistance / totalOriginalFlightTime : 450;
    const avgFuelPerNm = totalOriginalDistance > 0 ? totalOriginalFuelBurn / totalOriginalDistance : 4.5;
    const avgCostPerNm = totalOriginalDistance > 0 ? totalOriginalCost / totalOriginalDistance : 15;

    const coordString = `${newLat.toFixed(4)}, ${newLng.toFixed(4)}`;

    // Create two new legs from the one being split
    const leg1Coords = {
      departure: currentLeg.departure,
      destination: coordString,
      departureCoords: currentLeg.departureCoords,
      destinationCoords: { lat: newLat, lng: newLng },
      costs: currentLeg.costs ? { ...currentLeg.costs } : undefined
    };

    const leg2Coords = {
      departure: coordString,
      destination: currentLeg.destination,
      departureCoords: { lat: newLat, lng: newLng },
      destinationCoords: currentLeg.destinationCoords,
      costs: currentLeg.costs ? { ...currentLeg.costs } : undefined
    };

    const calculateLeg = (l: any) => {
      const gcDistance = Math.round(calculateDistance(l.departureCoords.lat, l.departureCoords.lng, l.destinationCoords.lat, l.destinationCoords.lng));
      const routingDistance = Math.round(gcDistance * 1.05);
      return {
        ...l,
        gcDistance,
        routingDistance,
        flightTime: gcDistance / avgSpeed,
        fuelBurn: gcDistance * avgFuelPerNm,
        costs: l.costs ? {
          ...l.costs,
          total: routingDistance * avgCostPerNm
        } : undefined
      };
    };

    const newLeg1 = calculateLeg(leg1Coords);
    const newLeg2 = calculateLeg(leg2Coords);

    const newLegs = [...localLegs];
    newLegs.splice(index, 1, newLeg1, newLeg2);

    setLocalLegs(newLegs);
    onLegsChange(newLegs, isFinal);
  };

  const handleDeleteWaypoint = (index: number) => {
    if (!localLegs || !onLegsChange || localLegs.length <= 1) return;

    const newLegs = [...localLegs];
    
    if (index === 0) {
      // Remove first waypoint: remove first leg
      newLegs.shift();
    } else if (index === localLegs.length) {
      // Remove last waypoint: remove last leg
      newLegs.pop();
    } else {
      // Remove middle waypoint: merge two legs
      const prevLeg = localLegs[index - 1];
      const nextLeg = localLegs[index];
      
      const mergedLegCoords = {
        departure: prevLeg.departure,
        destination: nextLeg.destination,
        departureCoords: prevLeg.departureCoords,
        destinationCoords: nextLeg.destinationCoords
      };

      const totalOriginalDistance = localLegs.reduce((acc, leg) => acc + (leg.gcDistance || 1), 0);
      const totalOriginalFlightTime = localLegs.reduce((acc, leg) => acc + (leg.flightTime || 1), 0);
      const totalOriginalFuelBurn = localLegs.reduce((acc, leg) => acc + (leg.fuelBurn || 1), 0);
      const totalOriginalCost = localLegs.reduce((acc, leg) => acc + (leg.costs?.total || 0), 0);
      const avgSpeed = totalOriginalDistance > 0 ? totalOriginalDistance / totalOriginalFlightTime : 450;
      const avgFuelPerNm = totalOriginalDistance > 0 ? totalOriginalFuelBurn / totalOriginalDistance : 4.5;
      const avgCostPerNm = totalOriginalDistance > 0 ? totalOriginalCost / totalOriginalDistance : 15;

      const gcDistance = Math.round(calculateDistance(mergedLegCoords.departureCoords.lat, mergedLegCoords.departureCoords.lng, mergedLegCoords.destinationCoords.lat, mergedLegCoords.destinationCoords.lng));
      const routingDistance = Math.round(gcDistance * 1.05);
      const mergedLeg = {
        ...mergedLegCoords,
        gcDistance,
        routingDistance,
        flightTime: gcDistance / avgSpeed,
        fuelBurn: gcDistance * avgFuelPerNm,
        costs: prevLeg.costs ? {
          ...prevLeg.costs,
          total: routingDistance * avgCostPerNm
        } : undefined
      };

      newLegs.splice(index - 1, 2, mergedLeg);
    }

    setLocalLegs(newLegs);
    onLegsChange(newLegs);
  };

  useEffect(() => {
    setChartNightMode(isDarkMode || false);
  }, [isDarkMode]);

  useEffect(() => {
    if (previewAirports && previewAirports.length > 0) {
      const fetchCoords = async () => {
        const coords = await Promise.all(
          previewAirports.filter(code => code.length >= 3).map(async (code) => {
            // Check if it's a coordinate string like "lat,lng"
            if (code.includes(',')) {
              const [latStr, lngStr] = code.split(',');
              const lat = parseFloat(latStr);
              const lng = parseFloat(lngStr);
              if (!isNaN(lat) && !isNaN(lng)) {
                return { code: 'Custom', lat, lng };
              }
            }
            
            try {
              const result = await searchAirports(code);
              if (result.airports && result.airports.length > 0) {
                const airport = result.airports[0];
                return { code, lat: airport.lat, lng: airport.lng };
              }
            } catch (e) {
              console.error(`Failed to fetch coords for ${code}`, e);
            }
            return null;
          })
        );
        setPreviewCoords(coords.filter((c): c is { code: string, lat: number, lng: number } => c !== null));

        
        // Update lastClicked to the last coordinate if available
        if (coords.length > 0) {
            const last = coords[coords.length - 1];
            if (last) {
                setLastClicked({ lat: last.lat, lng: last.lng });
            } else {
                setLastClicked(null);
            }
        } else {
            setLastClicked(null);
        }
      };
      fetchCoords();
    } else {
      setPreviewCoords([]);
      setLastClicked(null);
    }
  }, [previewAirports]);

  const hasLegs = localLegs && localLegs.length > 0;
  const hasPreview = previewCoords.length > 0;

  // HUD Component for critical flight info
  const HUD = () => {
    if (!livePosition && (!localLegs || localLegs.length === 0)) return null;

    // Calculate some mock but plausible metrics if livePosition exists
    const speed = livePosition ? 450 + Math.floor(Math.random() * 20) : null;
    const altitude = livePosition ? 38000 + Math.floor(Math.random() * 100) : null;
    const heading = livePosition?.track || 0;
    
    return (
      <div className="absolute top-24 left-6 z-[1000] pointer-events-none select-none">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl p-4 w-64 shadow-2xl overflow-hidden"
        >
          {/* Decorative scanner line */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.5)] animate-scan"></div>
          
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-emerald-400" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Flight Systems</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[8px] font-bold text-emerald-400">ACTIVE</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[8px] font-black text-white/40 uppercase tracking-tighter">Ground Speed</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-white font-mono">{speed || '---'}</span>
                <span className="text-[8px] font-bold text-white/50">KTS</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] font-black text-white/40 uppercase tracking-tighter">Altitude</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-white font-mono">{altitude?.toLocaleString() || '---'}</span>
                <span className="text-[8px] font-bold text-white/50">FT</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] font-black text-white/40 uppercase tracking-tighter">Heading</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-white font-mono">{heading.toString().padStart(3, '0')}</span>
                <span className="text-[8px] font-bold text-white/50">DEG</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] font-black text-white/40 uppercase tracking-tighter">Vert Speed</span>
              <div className="flex items-baseline gap-1 text-emerald-400">
                <span className="text-sm font-black font-mono">+050</span>
                <span className="text-[8px] font-bold">FPM</span>
              </div>
            </div>
          </div>

          {localLegs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
              <div className="flex justify-between items-center text-[8px] font-black text-white/40 uppercase tracking-widest">
                <span>Progress</span>
                <span className="text-indigo-400">42% Complete</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-[42%] shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[6px] font-bold text-white/30 uppercase">Destination</p>
                  <p className="text-xs font-black text-white">{localLegs[localLegs.length-1].destination}</p>
                </div>
                <div className="text-right">
                  <p className="text-[6px] font-bold text-white/30 uppercase">ETE</p>
                  <p className="text-xs font-black text-indigo-400">02:45</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  };

  const getTileLayer = (chartId: string) => {
    const chart = CHART_LAYERS[chartId as keyof typeof CHART_LAYERS];
    const url = typeof chart.url === 'function' ? chart.url(isDarkMode || false) : chart.url;
    
    // Apply night mode filter for aeronautical charts if enabled
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

  const allCoords: [number, number][] = useMemo(() => {
    const coords: [number, number][] = [];
    if (hasLegs) {
      localLegs!.forEach(leg => {
        coords.push([leg.departureCoords.lat, leg.departureCoords.lng]);
        coords.push([leg.destinationCoords.lat, leg.destinationCoords.lng]);
      });
    } else if (hasPreview) {
      previewCoords.forEach(c => coords.push([c.lat, c.lng]));
    }
    
    if (livePosition) {
      coords.push([livePosition.lat, livePosition.lng]);
    }

    if (liveHistory && liveHistory.length > 0) {
      liveHistory.forEach(h => coords.push([h.lat, h.lng]));
    }
    
    return coords;
  }, [hasLegs, localLegs, previewCoords, hasPreview, livePosition]);

  const centerLat = allCoords.length > 0 ? allCoords.reduce((acc, coord) => acc + coord[0], 0) / allCoords.length : 20;
  const centerLng = allCoords.length > 0 ? allCoords.reduce((acc, coord) => acc + coord[1], 0) / allCoords.length : 0;
  const center = [centerLat, centerLng] as [number, number];

  const handleRecenter = () => {
    if (mapInstance && allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      mapInstance.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const totalDuration = useMemo(() => {
    if (!localLegs || localLegs.length === 0) return null;
    let totalMinutes = 0;
    let hasValidEtdEta = false;
    
    for (const leg of localLegs) {
      const duration = calculateDurationFromEtdEta(leg.etd, leg.eta);
      if (duration) {
        totalMinutes += duration.hours * 60 + duration.minutes;
        hasValidEtdEta = true;
      } else if (leg.flightTime) {
        totalMinutes += Math.round(leg.flightTime * 60);
      }
    }
    
    if (totalMinutes === 0 && !hasValidEtdEta) return null;
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }, [localLegs]);

  const totalDistance = useMemo(() => {
    if (!localLegs) return 0;
    return Math.round(localLegs.reduce((acc, leg) => acc + (leg.routingDistance || 0), 0));
  }, [localLegs]);

  const totalCost = useMemo(() => {
    if (!localLegs) return 0;
    return Math.round(localLegs.reduce((acc, leg) => acc + (leg.costs?.total || 0), 0));
  }, [localLegs]);

  const totalFuel = useMemo(() => {
    if (!localLegs) return 0;
    return Math.round(localLegs.reduce((acc, leg) => acc + (leg.fuelBurn || 0), 0));
  }, [localLegs]);

  return (
    <div className="relative h-full w-full group/map">
      <HUD />
      {/* Mission Summary Panel */}
      {(hasLegs || aircraftType || passengerCount || departure || destination) && (
        <div className="absolute top-4 left-4 z-[1000] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 flex flex-col gap-3 min-w-[220px]">
          <div className="flex items-center gap-2 border-b dark:border-gray-800 pb-2">
            <Sparkles size={16} className="text-indigo-500" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Mission Summary</span>
              {missionType && (
                <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-tighter">{missionType} Mission</span>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            {(hasLegs && localLegs.length > 0) ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Route</span>
                  <span className="text-xs font-black text-gray-900 dark:text-white">
                    {localLegs[0].departure} → {localLegs[localLegs.length - 1].destination}
                  </span>
                </div>
                <Route size={14} className="text-indigo-500/50" />
              </div>
            ) : (departure || destination) ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Route</span>
                  <span className="text-xs font-black text-gray-900 dark:text-white">
                    {departure || '?'} → {destination || '?'}
                  </span>
                </div>
                <Route size={14} className="text-indigo-500/50" />
              </div>
            ) : null}

            {totalDuration && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Total Duration</span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{totalDuration}</span>
                </div>
                <Clock size={14} className="text-indigo-500/50" />
              </div>
            )}
            
            {aircraftType && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Aircraft</span>
                  <span className="text-xs font-black text-gray-900 dark:text-white">{aircraftType}</span>
                </div>
                <Plane size={14} className="text-indigo-500/50" />
              </div>
            )}
            
            {passengerCount !== undefined && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Passengers</span>
                  <span className="text-xs font-black text-gray-900 dark:text-white">{passengerCount} PAX</span>
                </div>
                <Users size={14} className="text-indigo-500/50" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mission Stats Overlay */}
      {hasLegs && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] flex gap-4">
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-4 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800 flex items-center gap-8"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl">
                <Route size={18} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total Distance</p>
                <p className="text-sm font-black text-gray-900 dark:text-white">{totalDistance.toLocaleString()} <span className="text-[10px] text-gray-400">nm</span></p>
              </div>
            </div>

            <div className="w-px h-8 bg-gray-100 dark:bg-gray-800" />

            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/40 rounded-xl">
                <Clock size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Flight Time</p>
                <p className="text-sm font-black text-gray-900 dark:text-white">{totalDuration}</p>
              </div>
            </div>

            <div className="w-px h-8 bg-gray-100 dark:bg-gray-800" />

            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/40 rounded-xl">
                <Wind size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Fuel Burn</p>
                <p className="text-sm font-black text-gray-900 dark:text-white">{totalFuel.toLocaleString()} <span className="text-[10px] text-gray-400">kg</span></p>
              </div>
            </div>

            {totalCost > 0 && (
              <>
                <div className="w-px h-8 bg-gray-100 dark:bg-gray-800" />
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Est. Total Cost</p>
                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">${totalCost.toLocaleString()}</p>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Chart Selector UI */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
        <button 
          onClick={() => setShowChartSelector(!showChartSelector)}
          className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest"
        >
          <Layers size={18} />
          <span>Charts</span>
          {showChartSelector ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {allCoords.length > 0 && (
          <button 
            onClick={handleRecenter}
            className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest"
            title="Recenter Map"
          >
            <Compass size={18} className="animate-spin-slow" />
            <span>Recenter</span>
          </button>
        )}

        {waypoints.length > 1 && (
          <button 
            onClick={() => setShowWaypoints(!showWaypoints)}
            className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest"
            title="Reorder Waypoints"
          >
            <ListOrdered size={18} />
            <span>Waypoints</span>
            {showWaypoints ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        <button 
          onClick={() => {
            setIsDrawingRestrictedArea(!isDrawingRestrictedArea);
            if (!isDrawingRestrictedArea) {
              setDrawingPoints([]);
            }
          }}
          className={`bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${
            isDrawingRestrictedArea ? 'border-rose-600 !text-rose-600' : 'border-gray-100 dark:border-gray-700'
          }`}
          title="Draw Custom Restricted Area"
        >
          <MousePointer2 size={18} />
          <span>{isDrawingRestrictedArea ? 'Exit Drawing' : 'Draw Area'}</span>
        </button>

        {hasLegs && (
          <button 
            onClick={() => setShowSchedule(!showSchedule)}
            className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest"
            title="Flight Schedule"
          >
            <Clock size={18} />
            <span>Schedule</span>
            {showSchedule ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        <div className="flex flex-col gap-2">
          <button 
            onClick={() => setShowWeather(!showWeather)}
            className={`p-3 rounded-2xl shadow-xl border transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${
              showWeather 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-gray-100 dark:border-gray-700'
            }`}
            title="Toggle Weather"
          >
            <Cloud size={18} />
            <span>Weather</span>
          </button>

          <button 
            onClick={() => setShowRisks(!showRisks)}
            className={`p-3 rounded-2xl shadow-xl border transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${
              showRisks 
                ? 'bg-red-600 text-white border-red-600' 
                : 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border-gray-100 dark:border-gray-700'
            }`}
            title="Toggle Risks"
          >
            <Shield size={18} />
            <span>Risks</span>
          </button>

          <button 
            onClick={() => setShowRestrictedAreas(!showRestrictedAreas)}
            className={`p-3 rounded-2xl shadow-xl border transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${
              showRestrictedAreas 
                ? 'bg-amber-500 text-white border-amber-500' 
                : 'bg-white dark:bg-gray-800 text-amber-500 dark:text-amber-500 border-gray-100 dark:border-gray-700'
            }`}
            title="Toggle Restricted Areas"
          >
            <Shield size={18} />
            <span>Airspaces</span>
          </button>

          <button 
            onClick={() => {
              setIsDrawingRestrictedArea(!isDrawingRestrictedArea);
              setDrawingPoints([]);
              setNewAreaName('');
              setNewAreaReason('');
            }}
            className={`p-3 rounded-2xl shadow-xl border transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${
              isDrawingRestrictedArea 
                ? 'bg-indigo-600 text-white border-indigo-600' 
                : 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border-gray-100 dark:border-gray-700'
            }`}
            title="Draw Restricted Area"
          >
            <Plus size={18} />
            <span>Draw Area</span>
          </button>
        </div>

        {showSchedule && hasLegs && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-80 animate-in slide-in-from-top-2 duration-200">
            <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 px-1 flex items-center justify-between">
              <span>Leg Schedule (UTC)</span>
              <span className="text-indigo-500">{totalDuration} total</span>
            </h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
              {localLegs!.map((leg, idx) => {
                const duration = calculateDurationFromEtdEta(leg.etd, leg.eta);
                return (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">Leg {idx + 1}: {leg.departure} → {leg.destination}</span>
                      {duration && (
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{duration.hours}h {duration.minutes}m</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">ETD</label>
                        <input 
                          type="time" 
                          value={leg.etd || ''} 
                          onChange={(e) => {
                            const newLegs = [...localLegs!];
                            newLegs[idx] = { ...newLegs[idx], etd: e.target.value };
                            onLegsChange?.(newLegs);
                          }}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">ETA</label>
                        <input 
                          type="time" 
                          value={leg.eta || ''} 
                          onChange={(e) => {
                            const newLegs = [...localLegs!];
                            newLegs[idx] = { ...newLegs[idx], eta: e.target.value };
                            onLegsChange?.(newLegs);
                          }}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showWaypoints && waypoints.length > 1 && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-64 animate-in slide-in-from-top-2 duration-200">
            <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 px-1">Drag to Reorder</h3>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="waypoints-list">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {waypoints.map((wp, index) => (
                      <Draggable key={wp.id} draggableId={wp.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-3 p-2 rounded-xl border ${
                              snapshot.isDragging 
                                ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 shadow-md' 
                                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                            }`}
                          >
                            <div {...provided.dragHandleProps} className="text-gray-400 hover:text-indigo-500 cursor-grab active:cursor-grabbing">
                              <GripVertical size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {wp.name}
                              </div>
                              <div className="text-[9px] text-gray-500 dark:text-gray-400">
                                {wp.coords.lat.toFixed(4)}, {wp.coords.lng.toFixed(4)}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteWaypoint(index)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Remove Waypoint"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        )}

        {showChartSelector && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 w-56 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              {Object.values(CHART_LAYERS).map((chart) => (
                <button
                  key={chart.id}
                  onClick={() => {
                    setActiveChart(chart.id);
                    setShowChartSelector(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between ${
                    activeChart === chart.id 
                      ? 'bg-indigo-600 text-white shadow-lg' 
                      : 'text-gray-500 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  <span>{chart.name}</span>
                  {activeChart === chart.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </button>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 px-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Night Mode</span>
                <button 
                  onClick={() => setChartNightMode(!chartNightMode)}
                  className={`w-8 h-4 rounded-full transition-all relative ${chartNightMode ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${chartNightMode ? 'left-4.5' : 'left-0.5'}`} />
                </button>
              </div>
              <a 
                href="https://skyvector.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[8px] text-indigo-500 hover:text-indigo-600 font-bold uppercase tracking-tighter transition-colors"
              >
                <Info size={10} />
                <span>Open SkyVector Reference</span>
              </a>
              <p className="text-[7px] text-gray-400 dark:text-gray-500 font-medium leading-tight">
                Aeronautical charts provided by FAA & OpenFlightMaps.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Leg Information Side Panel */}
      {/* Drawing Controls Overlay (when no sidebar is open) */}
      <AnimatePresence>
        {isDrawingRestrictedArea && selectedLegIndex === null && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1200] max-w-sm w-full pointer-events-auto"
          >
            <div className="p-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-indigo-100 dark:border-indigo-800 shadow-2xl rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Global Drawing Mode</p>
                <button onClick={() => setIsDrawingRestrictedArea(false)} className="text-gray-400 hover:text-red-500">
                  <X size={16} />
                </button>
              </div>
              <p className="text-[8px] text-gray-500 dark:text-gray-400">Click on the map to define a restricted airspace for the entire mission.</p>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Tactical Ident</label>
                  <input 
                    type="text" 
                    placeholder="e.g. ALPHA-RESTRICTED"
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Reason for Restriction</label>
                  <textarea 
                    placeholder="Enter strategic reason for this drawn boundary..."
                    value={newAreaReason}
                    onChange={(e) => setNewAreaReason(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold h-20 resize-none outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Severity / Risk Level</label>
                  <div className="flex gap-2">
                    {(['Low', 'Medium', 'High'] as const).map((sev) => (
                      <button
                        key={sev}
                        onClick={() => setNewAreaSeverity(sev)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                          newAreaSeverity === sev 
                            ? (sev === 'High' ? 'bg-rose-600 text-white border-rose-600' : sev === 'Medium' ? 'bg-amber-500 text-white border-amber-500' : 'bg-blue-500 text-white border-blue-500')
                            : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    if (drawingPoints.length < 3) {
                      alert('Add at least 3 points.');
                      return;
                    }
                    if (!newAreaName) {
                      alert('Name required.');
                      return;
                    }
                    
                    const newArea: RestrictedArea = {
                      name: newAreaName,
                      reason: newAreaReason,
                      severity: newAreaSeverity,
                      coordinates: drawingPoints
                    };

                    onRestrictedAreasChange?.([...(restrictedAreas || []), newArea]);
                    setIsDrawingRestrictedArea(false);
                    setDrawingPoints([]);
                  }}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase hover:bg-indigo-700 transition-all"
                >
                  Save Global Area
                </button>
                <button 
                  onClick={() => setDrawingPoints([])}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-xl font-black text-[10px] uppercase hover:bg-gray-200 transition-all"
                >
                  Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedLegIndex !== null && localLegs && localLegs[selectedLegIndex] && (
          <motion.div 
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            className="absolute top-4 left-4 bottom-4 z-[1100] w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b dark:border-gray-800 flex items-center justify-between bg-indigo-600 dark:bg-indigo-900/40">
              <div>
                <h2 className="text-white font-black text-lg tracking-tighter">LEG {selectedLegIndex + 1} DETAILS</h2>
                <p className="text-indigo-100 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-widest">Mission Analysis</p>
              </div>
              <button 
                onClick={() => setSelectedLegIndex(null)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Route Header */}
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{localLegs[selectedLegIndex].departure}</div>
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">ICAO Origin</div>
                </div>
                <div className="px-4 flex flex-col items-center">
                  <div className="w-16 h-[2px] bg-indigo-500/30 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 p-1.5 rounded-full border border-gray-100 dark:border-gray-800">
                      <Plane size={16} className="text-indigo-500 rotate-90" />
                    </div>
                  </div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{localLegs[selectedLegIndex].destination}</div>
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">ICAO Destination</div>
                </div>
              </div>

              {/* Core Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:border-indigo-500/30 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Route size={14} className="text-indigo-500" />
                    <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Distance</span>
                  </div>
                  <div className="text-lg font-black text-gray-900 dark:text-white">{localLegs[selectedLegIndex]?.routingDistance || 0} <span className="text-xs font-bold text-gray-400">nm</span></div>
                  <div className="text-[8px] text-gray-400 font-medium">GC: {localLegs[selectedLegIndex]?.gcDistance || 0} nm</div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:border-indigo-500/30 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={14} className="text-indigo-500" />
                    <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Flight Time</span>
                  </div>
                  <div className="text-lg font-black text-gray-900 dark:text-white">
                    {(() => {
                      const duration = calculateDurationFromEtdEta(localLegs[selectedLegIndex].etd, localLegs[selectedLegIndex].eta);
                      return duration ? `${duration.hours}h ${duration.minutes}m` : `${localLegs[selectedLegIndex].flightTime.toFixed(1)}h`;
                    })()}
                  </div>
                  <div className="text-[8px] text-gray-400 font-medium">Avg Speed: {Math.round(localLegs[selectedLegIndex].gcDistance / localLegs[selectedLegIndex].flightTime)} kts</div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:border-indigo-500/30 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Wind size={14} className="text-indigo-500" />
                    <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Fuel Burn</span>
                  </div>
                  <div className="text-lg font-black text-gray-900 dark:text-white">{Math.round(localLegs[selectedLegIndex].fuelBurn).toLocaleString()} <span className="text-xs font-bold text-gray-400">kg</span></div>
                  <div className="text-[8px] text-gray-400 font-medium">Est. {aircraftType || 'Aircraft'}</div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:border-indigo-500/30 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Compass size={14} className="text-indigo-500" />
                    <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Bearing</span>
                  </div>
                  <div className="text-lg font-black text-gray-900 dark:text-white">
                    {Math.round(getBearing(
                      localLegs[selectedLegIndex].departureCoords.lat, 
                      localLegs[selectedLegIndex].departureCoords.lng, 
                      localLegs[selectedLegIndex].destinationCoords.lat, 
                      localLegs[selectedLegIndex].destinationCoords.lng
                    ))}°
                  </div>
                  <div className="text-[8px] text-gray-400 font-medium">Initial Heading</div>
                </div>

                {localLegs[selectedLegIndex].altitude && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50 hover:border-indigo-500/30 transition-colors col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Layers size={14} className="text-indigo-500" />
                      <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Target Altitude</span>
                    </div>
                    <div className="text-lg font-black text-gray-900 dark:text-white">{localLegs[selectedLegIndex].altitude.toLocaleString()} <span className="text-xs font-bold text-gray-400">ft</span></div>
                    <div className="text-[8px] text-gray-400 font-medium">Flight Level: FL{Math.round(localLegs[selectedLegIndex].altitude / 100)}</div>
                  </div>
                )}
              </div>

              {/* Restricted Airspaces */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-red-500" />
                    <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Restricted Airspaces</h3>
                  </div>
                  <button 
                    onClick={() => {
                      setIsDrawingRestrictedArea(!isDrawingRestrictedArea);
                      setDrawingPoints([]);
                      setNewAreaName('');
                      setNewAreaReason('');
                    }}
                    className={`p-1.5 rounded-lg transition-all ${
                      isDrawingRestrictedArea 
                        ? 'bg-red-500 text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-indigo-500'
                    }`}
                    title={isDrawingRestrictedArea ? "Cancel Drawing" : "Draw Restricted Area"}
                  >
                    {isDrawingRestrictedArea ? <X size={14} /> : <Plus size={14} />}
                  </button>
                </div>

                {isDrawingRestrictedArea && (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Drawing Mode Active</p>
                    <p className="text-[8px] text-gray-500 dark:text-gray-400">Click on the map to add points for the restricted area polygon.</p>
                    
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        placeholder="Area Name (e.g. Restricted Zone R-44)"
                        value={newAreaName}
                        onChange={(e) => setNewAreaName(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <textarea 
                        placeholder="Reason for restriction..."
                        value={newAreaReason}
                        onChange={(e) => setNewAreaReason(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none h-16 resize-none"
                      />
                      <select 
                        value={newAreaSeverity}
                        onChange={(e) => setNewAreaSeverity(e.target.value as any)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="Low">Low Severity</option>
                        <option value="Medium">Medium Severity</option>
                        <option value="High">High Severity</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          if (drawingPoints.length < 3) {
                            alert('Please add at least 3 points to create a polygon.');
                            return;
                          }
                          if (!newAreaName) {
                            alert('Please enter a name for the restricted area.');
                            return;
                          }
                          
                          const newArea: RestrictedArea = {
                            name: newAreaName,
                            reason: newAreaReason,
                            severity: newAreaSeverity,
                            coordinates: drawingPoints
                          };

                          if (selectedLegIndex !== null) {
                            const newLegs = [...localLegs];
                            const currentLeg = { ...newLegs[selectedLegIndex] };
                            currentLeg.restrictedAreas = [...(currentLeg.restrictedAreas || []), newArea];
                            newLegs[selectedLegIndex] = currentLeg;
                            
                            setLocalLegs(newLegs);
                            onLegsChange?.(newLegs);
                          } else {
                            // Global plan-level
                            onRestrictedAreasChange?.([...(restrictedAreas || []), newArea]);
                          }
                          
                          setIsDrawingRestrictedArea(false);
                          setDrawingPoints([]);
                        }}
                        className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all"
                      >
                        Save Area
                      </button>
                      <button 
                        onClick={() => setDrawingPoints([])}
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {localLegs[selectedLegIndex].restrictedAreas && localLegs[selectedLegIndex].restrictedAreas!.length > 0 && (
                  <div className="space-y-2">
                    {localLegs[selectedLegIndex].restrictedAreas!.map((area, aidx) => (
                      <div key={aidx} className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl group/area relative">
                        <button 
                          onClick={() => {
                            const newLegs = [...localLegs];
                            const currentLeg = { ...newLegs[selectedLegIndex] };
                            currentLeg.restrictedAreas = currentLeg.restrictedAreas?.filter((_, i) => i !== aidx);
                            newLegs[selectedLegIndex] = currentLeg;
                            setLocalLegs(newLegs);
                            onLegsChange?.(newLegs);
                          }}
                          className="absolute top-2 right-2 p-1 text-red-300 hover:text-red-600 opacity-0 group-hover/area:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-red-700 dark:text-red-400">{area.name}</span>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${
                            area.severity === 'High' ? 'bg-red-500 text-white' : 
                            area.severity === 'Medium' ? 'bg-orange-500 text-white' : 
                            'bg-yellow-500 text-white'
                          }`}>{area.severity}</span>
                        </div>
                        <p className="text-[10px] text-red-600 dark:text-red-500/80 leading-relaxed font-medium italic">"{area.reason}"</p>
                        {area.coordinates && (
                          <div className="mt-2 flex items-center gap-1 text-[8px] font-bold text-red-400 uppercase">
                            <MapIcon size={10} />
                            <span>Polygon Area Defined</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Handling Agents */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-amber-500" />
                    <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Suggested Handling Agents</h3>
                  </div>
                  {fetchingAgents ? (
                    <Loader2 size={14} className="animate-spin text-amber-500" />
                  ) : (
                    <button
                      onClick={() => handleRefreshHandlingAgents(selectedLegIndex)}
                      className="text-[9px] font-black uppercase bg-amber-50 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-100 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Sparkles size={10} /> Update Agents
                    </button>
                  )}
                </div>

                {localLegs[selectedLegIndex].handlingAgents && localLegs[selectedLegIndex].handlingAgents!.length > 0 ? (
                  <div className="space-y-3">
                    {localLegs[selectedLegIndex].handlingAgents!.map((agent, aidx) => (
                      <div key={aidx} className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-900 dark:text-amber-400">{agent.companyName}</span>
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">${agent.baseFee?.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                            <Mail size={12} className="shrink-0" />
                            <span className="truncate">{agent.email}</span>
                          </div>
                          {agent.phone && (
                            <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                              <Phone size={12} className="shrink-0" />
                              <a href={`tel:${agent.phone}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">{agent.phone}</a>
                            </div>
                          )}
                          {agent.website && (
                            <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                              <Globe size={12} className="shrink-0" />
                              <a href={agent.website} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition truncate flex items-center gap-1">
                                {agent.website.replace(/^https?:\/\//, '')} <ExternalLink size={8} className="shrink-0" />
                              </a>
                            </div>
                          )}
                        </div>
                        {agent.additionalServices && (
                          <p className="text-[9px] text-gray-500 dark:text-gray-500 italic leading-tight mt-1">
                            {agent.additionalServices}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : !fetchingAgents && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold">No agents found for this airport</p>
                  </div>
                )}
              </div>

              {/* FIR Data */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-indigo-500" />
                    <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">FIR Overflight Data</h3>
                  </div>
                  {fetchingFIRsForLeg === selectedLegIndex ? (
                    <Loader2 size={14} className="animate-spin text-indigo-500" />
                  ) : (
                    <button
                      onClick={() => handleFetchFIRInfo(selectedLegIndex)}
                      className="text-[9px] font-black uppercase bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <Sparkles size={10} /> Fetch Rules & Charges
                    </button>
                  )}
                </div>

                {localLegs[selectedLegIndex].firs && localLegs[selectedLegIndex].firs!.length > 0 ? (
                  <div className="space-y-2">
                    {localLegs[selectedLegIndex].firs!.map((fir, fidx) => (
                      <div key={fidx} className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-2xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-gray-900 dark:text-white">{fir.name || fir.firName || fir.firCode}</span>
                          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{fir.country}</span>
                        </div>
                        {fir.rules && (
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 italic leading-tight">{fir.rules}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-2 text-center">
                          {fir.overflightCharge !== undefined && (
                            <div className="bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700 flex flex-col items-center">
                              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Overflight</span>
                              <span className="text-[10px] font-black text-green-600 dark:text-green-400">
                                {fir.overflightCharge === 0 ? 'Exempt' : `$${fir.overflightCharge.toLocaleString()}`}
                              </span>
                            </div>
                          )}
                          {fir.navigationCharge !== undefined && (
                            <div className="bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700 flex flex-col items-center">
                              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Navigation</span>
                              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                                {fir.navigationCharge === 0 ? 'Exempt' : `$${fir.navigationCharge.toLocaleString()}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !fetchingFIRsForLeg && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-center">
                    <p className="text-[10px] text-gray-400 font-medium">No FIR analysis available.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-800">
              <button 
                onClick={() => setSelectedLegIndex(null)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
              >
                Close Analysis
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isLoading || fetchingAgents) && (
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
                <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Calculating Optimal Path</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Verifying FIRs & Wind Impact</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MapContainer 
        center={center} 
        zoom={3} 
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <MapInstanceSetter setMap={setMapInstance} />
        <MapResizer />
        {getTileLayer(activeChart)}
        <MapEvents 
          onMapClick={onMapClick} 
          onMouseMove={(lat, lng) => setMouseCoords({ lat, lng })}
          isDrawing={isDrawingRestrictedArea}
          drawingPoints={drawingPoints}
          setDrawingPoints={setDrawingPoints}
        />
        <MapController coords={allCoords} />
        <ScaleControl position="bottomleft" />

        {/* Current Drawing Polygon */}
        {isDrawingRestrictedArea && drawingPoints.length > 0 && (
          <>
            {drawingPoints.map((point, idx) => (
              <Marker 
                key={`draw-${idx}`}
                position={point}
                icon={L.divIcon({
                  className: 'drawing-point-icon',
                  html: `<div class="w-2 h-2 bg-indigo-600 rounded-full border border-white shadow-sm"></div>`,
                  iconSize: [8, 8],
                  iconAnchor: [4, 4]
                })}
              />
            ))}
            {drawingPoints.length >= 3 && (
              <Polygon 
                positions={drawingPoints}
                color="#6366f1"
                fillColor="#6366f1"
                fillOpacity={0.2}
                weight={2}
                dashArray="5, 5"
              />
            )}
            {drawingPoints.length >= 2 && (
              <Polyline 
                positions={drawingPoints}
                color="#6366f1"
                weight={2}
                dashArray="5, 5"
              />
            )}
          </>
        )}

        {/* Alternative Routes from AI Optimizer */}
        {optimizedRoute?.alternatives?.map((alt: any, idx: number) => {
          if (!localLegs.length) return null;
          const firstLeg = localLegs[0];
          const lastLeg = localLegs[localLegs.length - 1];
          
          // Create a slightly curved path for the alternative
          const start: [number, number] = [firstLeg.departureCoords.lat, firstLeg.departureCoords.lng];
          const end: [number, number] = [lastLeg.destinationCoords.lat, lastLeg.destinationCoords.lng];
          
          // Simple offset for visualization
          const midLat = (start[0] + end[0]) / 2 + (idx + 1) * 0.5;
          const midLng = (start[1] + end[1]) / 2 + (idx + 1) * 0.5;
          
          return (
            <Polyline
              key={`alt-route-${idx}`}
              positions={[start, [midLat, midLng], end]}
              color={idx === 0 ? '#10b981' : idx === 1 ? '#6366f1' : '#f59e0b'}
              weight={2}
              dashArray="10, 10"
              opacity={0.6}
            >
              <Tooltip sticky>
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">AI Suggestion: {alt.name || alt.label}</p>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">Savings: ${alt.totalSavings?.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500 mt-1 italic">"{alt.recommendation}"</p>
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {/* Global Restricted Areas Visualization */}
        {showRestrictedAreas && globalRestrictedAirspaces.map((area, idx) => {
          const typeColor = area.type === 'TFR' ? '#a855f7' : // Purple
                           area.type === 'ConflictZone' ? '#ef4444' : // Red
                           area.severity === 'High' ? '#f43f5e' : // Rose
                           area.severity === 'Medium' ? '#f59e0b' : // Amber
                           '#eab308'; // Yellow

          return (
            <Polygon 
              key={`global-restricted-${idx}`}
              positions={area.coordinates}
              color={typeColor}
              fillColor={typeColor}
              fillOpacity={0.4}
              weight={area.type === 'TFR' ? 2 : 1.5}
              dashArray={area.type === 'TFR' ? "10, 5" : "5, 10"}
            >
              <Tooltip sticky>
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 max-w-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield size={14} style={{ color: typeColor }} />
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-black uppercase tracking-widest`} style={{ color: typeColor }}>
                        {area.type || 'Restricted'}: {area.name}
                      </span>
                      {area.activeUntil && (
                        <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">Expires: {area.activeUntil}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 italic mb-1 font-medium">"{area.reason}"</p>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-gray-400 font-medium">Source: {area.source}</span>
                      <span className={`text-[7px] font-black px-1 rounded border`} style={{ color: typeColor, borderColor: typeColor }}>{area.severity}</span>
                    </div>
                    {area.sourceUrl && (
                      <a href={area.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[8px] text-indigo-500 flex items-center gap-1 hover:underline">
                        View <ExternalLink size={8} />
                      </a>
                    )}
                  </div>
                </div>
              </Tooltip>
            </Polygon>
          );
        })}

        {/* Existing Restricted Area Polygons (Leg Specific) */}
        {showRestrictedAreas && localLegs.map((leg, lidx) => (
          leg.restrictedAreas?.map((area, aidx) => (
            area.coordinates && (
              <Polygon 
                key={`area-${lidx}-${aidx}`}
                positions={area.coordinates}
                color={area.severity === 'High' ? '#ef4444' : area.severity === 'Medium' ? '#f59e0b' : '#eab308'}
                fillColor={area.severity === 'High' ? '#ef4444' : area.severity === 'Medium' ? '#f59e0b' : '#eab308'}
                fillOpacity={0.3}
                weight={2}
              >
                <Popup className="dark-popup">
                  <div className="p-2 min-w-[150px]">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{area.name}</p>
                      <button 
                        onClick={() => {
                          const newLegs = [...localLegs];
                          newLegs[lidx] = { ...newLegs[lidx], restrictedAreas: newLegs[lidx].restrictedAreas?.filter((_, i) => i !== aidx) };
                          setLocalLegs(newLegs);
                          onLegsChange?.(newLegs);
                        }}
                        className="text-rose-500 hover:text-rose-700 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">"{area.reason}"</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${
                        area.severity === 'High' ? 'bg-red-50 text-red-600' :
                        area.severity === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>{area.severity} Risk</span>
                      <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">Leg {lidx + 1} tactical zone</span>
                    </div>
                  </div>
                </Popup>
              </Polygon>
            )
          ))
        ))}

        {/* Global Plan Restricted Areas */}
        {showRestrictedAreas && restrictedAreas?.map((area, idx) => (
          area.coordinates && (
            <Polygon 
              key={`global-area-${idx}`}
              positions={area.coordinates}
              color={area.severity === 'High' ? '#ef4444' : area.severity === 'Medium' ? '#f59e0b' : '#6366f1'}
              fillColor={area.severity === 'High' ? '#ef4444' : area.severity === 'Medium' ? '#f59e0b' : '#6366f1'}
              fillOpacity={0.25}
              weight={3}
              dashArray={area.severity === 'High' ? "1, 10" : "10, 5"}
            >
              <Popup className="dark-popup">
                <div className="p-3 min-w-[180px]">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${area.severity === 'High' ? 'bg-red-500 animate-pulse' : 'bg-indigo-500'}`} />
                      <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{area.name}</p>
                    </div>
                    <button 
                      onClick={() => {
                        const newAreas = restrictedAreas.filter((_, i) => i !== idx);
                        onRestrictedAreasChange?.(newAreas);
                      }}
                      className="text-gray-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium leading-relaxed">"{area.reason}"</p>
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${
                      area.severity === 'High' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'
                    }`}>{area.severity || 'Tactical'} Zone</span>
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Global Invariant</p>
                  </div>
                </div>
              </Popup>
            </Polygon>
          )
        ))}

        {/* Weather Patterns */}
        {showWeather && weatherMarkers.map(w => (
          <Marker key={w.id} position={[w.coords.lat, w.coords.lng]} icon={getWeatherIcon(w.condition, w.severity)}>
            <Popup className="dark-popup">
              <div className="p-2">
                <h4 className="font-black text-xs uppercase text-blue-600 mb-1">Weather: {w.location}</h4>
                <p className="text-[10px] font-bold text-gray-700">{w.condition}</p>
                <p className="text-[10px] text-gray-500 mt-1 italic">{w.impact}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Risk Highlights */}
        {showRisks && riskHighlights.map(r => (
          <Marker key={r.id} position={[r.coords.lat, r.coords.lng]} icon={getRiskIcon(r.severity)}>
            <Popup className="dark-popup">
              <div className="p-2">
                <h4 className="font-black text-xs uppercase text-red-600 mb-1">Risk: {r.airport}</h4>
                <p className="text-[10px] font-bold text-gray-700">{r.description}</p>
                <div className="mt-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-[8px] font-black uppercase rounded inline-block">
                  {r.severity} Severity
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {liveHistory && liveHistory.length > 1 && (
          <Polyline 
            positions={liveHistory.map(h => [h.lat, h.lng])}
            color="#ef4444"
            weight={2}
            dashArray="5, 5"
            opacity={0.6}
          />
        )}
        
        {livePosition && (
          <Marker
            position={[livePosition.lat, livePosition.lng]}
            icon={L.divIcon({
              className: 'live-aircraft-icon',
              html: `<div style="transform: rotate(${livePosition.track || 0}deg)">
                       <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                         <path d="M21 16V14.5L13 9.5V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9.5L2 14.5V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z" fill="#ef4444" stroke="white" stroke-width="1.5"/>
                       </svg>
                       <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm text-[8px] font-black text-gray-900 dark:text-white whitespace-nowrap border border-gray-100 dark:border-gray-700">
                         ${livePosition.registration || 'LIVE'}
                       </div>
                     </div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 16]
            })}
          >
            <Popup className="dark-popup">
              <div className="p-2 text-xs font-bold text-gray-800 dark:text-white">
                Live Tracking: {livePosition.registration}
              </div>
            </Popup>
          </Marker>
        )}
        
        {(!hasLegs && !hasPreview && !livePosition) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700">
              Click map to set coordinates or type ICAO codes
            </div>
          </div>
        )}
        
        {lastClicked && (
        <Marker 
          position={[lastClicked.lat, lastClicked.lng]}
          icon={L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="relative">
                     <div class="w-4 h-4 bg-indigo-500 rounded-full shadow-lg ring-4 ring-indigo-500/30 animate-pulse"></div>
                     <button class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold shadow-sm">X</button>
                   </div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })}
          eventHandlers={{
            click: () => {
              if (onRemoveLastCoordinate) {
                onRemoveLastCoordinate();
                setLastClicked(null);
              }
            }
          }}
        />
      )}
      
      {hasLegs ? (
        <>
          {/* Entire Path Overlay */}
          <Polyline 
            positions={localLegs!.flatMap(leg => [
              [leg.departureCoords.lat, leg.departureCoords.lng],
              [leg.destinationCoords.lat, leg.destinationCoords.lng]
            ])}
            color="#ffffff"
            weight={1}
            opacity={0.2}
            dashArray="10, 10"
          />
          
          {localLegs!.map((leg, idx) => {
            const isHovered = hoveredLegIndex === idx;
            const hasRestricted = leg.restrictedAreas && leg.restrictedAreas.length > 0;
            const hasSafetyIssues = hasRestricted || 
                                   safetyData?.notams?.some(n => n.airport === leg.departure || n.airport === leg.destination) ||
                                   safetyData?.weather?.some(w => w.location === leg.departure || w.location === leg.destination);
            
            const legColors = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
            const polylineColor = hasSafetyIssues ? "#ef4444" : legColors[idx % legColors.length];
            const glowColor = hasSafetyIssues ? "rgba(239, 68, 68, 0.4)" : `${polylineColor}66`;
            
            return (
              <div key={idx}>
                {/* Visual Route with Glow */}
                <Polyline
                  positions={[
                    [leg.departureCoords.lat, leg.departureCoords.lng],
                    [leg.destinationCoords.lat, leg.destinationCoords.lng]
                  ]}
                  color={polylineColor}
                  weight={6}
                  opacity={0.15}
                />
                <Polyline
                  positions={[
                    [leg.departureCoords.lat, leg.departureCoords.lng],
                    [leg.destinationCoords.lat, leg.destinationCoords.lng]
                  ]}
                  color={polylineColor}
                  weight={2}
                  opacity={0.8}
                  className="route-line-main"
                />

                {/* Restricted Areas Visualization */}
                {showRestrictedAreas && leg.restrictedAreas?.map((area, areaIdx) => (
                  area.coordinates && area.coordinates.length > 0 && (
                    <Polygon
                      key={`restricted-${idx}-${areaIdx}`}
                      positions={area.coordinates}
                      pathOptions={{
                        fillColor: area.severity === 'High' ? '#ef4444' : area.severity === 'Medium' ? '#f59e0b' : '#3b82f6',
                        fillOpacity: 0.25,
                        color: area.severity === 'High' ? '#ef4444' : area.severity === 'Medium' ? '#f59e0b' : '#3b82f6',
                        weight: 2,
                        dashArray: area.severity === 'High' ? '1, 10' : '10, 10',
                        lineCap: 'round'
                      }}
                    >
                      <Popup className="dark-popup">
                        <div className="p-2">
                          <h4 className="font-black text-xs uppercase text-red-600 mb-1">Restricted: {area.name}</h4>
                          <p className="text-[10px] font-bold text-gray-700">{area.reason}</p>
                          <div className="mt-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-[8px] font-black uppercase rounded inline-block">
                            {area.severity} Severity
                          </div>
                        </div>
                      </Popup>
                    </Polygon>
                  )
                ))}

                <Marker 
                  position={[leg.departureCoords.lat, leg.departureCoords.lng]}
                  icon={getNumberedIcon(idx + 1, selectedLegIndex === idx || isHovered)}
                  draggable={true}
                  eventHandlers={{
                    drag: (e) => {
                      const position = e.target.getLatLng();
                      handleWaypointDrag(idx, position.lat, position.lng, false);
                    },
                    dragend: (e) => {
                      const position = e.target.getLatLng();
                      handleWaypointDrag(idx, position.lat, position.lng, true);
                    }
                  }}
                >
                  <Popup className="dark-popup">
                    <div className="space-y-2">
                      <AirportPopup code={leg.departure} />
                      <button 
                        onClick={() => handleDeleteWaypoint(idx)}
                        className="w-full flex items-center justify-center gap-2 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        <Trash2 size={12} />
                        <span>Delete Waypoint</span>
                      </button>
                    </div>
                  </Popup>
                </Marker>
                {idx === localLegs!.length - 1 && (
                  <Marker 
                    position={[leg.destinationCoords.lat, leg.destinationCoords.lng]}
                    icon={getNumberedIcon(idx + 2, selectedLegIndex === idx || isHovered)}
                    draggable={true}
                    eventHandlers={{
                      drag: (e) => {
                        const position = e.target.getLatLng();
                        handleWaypointDrag(idx + 1, position.lat, position.lng, false);
                      },
                      dragend: (e) => {
                        const position = e.target.getLatLng();
                        handleWaypointDrag(idx + 1, position.lat, position.lng, true);
                      }
                    }}
                  >
                    <Popup className="dark-popup">
                      <div className="space-y-2">
                        <AirportPopup code={leg.destination} />
                        <button 
                          onClick={() => handleDeleteWaypoint(idx + 1)}
                          className="w-full flex items-center justify-center gap-2 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                        >
                          <Trash2 size={12} />
                          <span>Delete Waypoint</span>
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Midpoint Drag Handle (Add Waypoint) */}
                <Marker
                  position={getMidpoint(leg.departureCoords.lat, leg.departureCoords.lng, leg.destinationCoords.lat, leg.destinationCoords.lng)}
                  icon={L.divIcon({
                    className: 'midpoint-drag-icon',
                    html: `<div class="w-3 h-3 bg-white/80 dark:bg-gray-800/80 border-2 border-indigo-500 rounded-full shadow-sm flex items-center justify-center hover:scale-125 transition-transform">
                             <div class="w-1 h-1 bg-indigo-500 rounded-full"></div>
                           </div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  })}
                  draggable={true}
                  eventHandlers={{
                    drag: (e) => {
                      const position = e.target.getLatLng();
                      handleMidpointDrag(idx, position.lat, position.lng, false);
                    },
                    dragend: (e) => {
                      const position = e.target.getLatLng();
                      handleMidpointDrag(idx, position.lat, position.lng, true);
                    }
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1} className="custom-tooltip">
                    <div className="px-2 py-1 bg-white dark:bg-gray-800 rounded shadow-sm text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                      <Plus size={8} />
                      <span>Drag to add waypoint</span>
                    </div>
                  </Tooltip>
                </Marker>

                {/* Aircraft Icon at Midpoint (Visual only) */}
                <Marker
                  position={getMidpoint(leg.departureCoords.lat, leg.departureCoords.lng, leg.destinationCoords.lat, leg.destinationCoords.lng)}
                  icon={L.divIcon({
                    className: 'aircraft-icon pointer-events-none',
                    html: `<div style="transform: rotate(${getBearing(leg.departureCoords.lat, leg.departureCoords.lng, leg.destinationCoords.lat, leg.destinationCoords.lng)}deg); opacity: 0.5">
                             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                               <path d="M21 16V14.5L13 9.5V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9.5L2 14.5V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z" fill="${hasSafetyIssues ? '#ef4444' : polylineColor}" stroke="white" stroke-width="1"/>
                             </svg>
                           </div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                  })}
                  interactive={false}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={false} className="custom-tooltip">
                    <div className="px-2 py-1 bg-white dark:bg-gray-800 rounded shadow-sm text-[10px] font-bold text-gray-700 dark:text-gray-300 flex flex-col items-center">
                      <span>{leg?.routingDistance || 0} nm</span>
                      {(() => {
                        const duration = calculateDurationFromEtdEta(leg.etd, leg.eta);
                        if (duration) return <span className="text-[8px] text-indigo-500 font-black">{duration.hours}h {duration.minutes}m</span>;
                        if (leg.flightTime) return <span className="text-[8px] text-indigo-500 font-black">{leg.flightTime.toFixed(1)}h</span>;
                        return null;
                      })()}
                    </div>
                  </Tooltip>
                </Marker>
                
                {/* Outer Glow Polyline */}
                <Polyline 
                  positions={[
                    [leg.departureCoords.lat, leg.departureCoords.lng],
                    [leg.destinationCoords.lat, leg.destinationCoords.lng]
                  ]} 
                  color={glowColor}
                  weight={isHovered ? 16 : (hasSafetyIssues ? 12 : 10)}
                  opacity={isHovered ? 0.6 : 0.4}
                  lineCap="round"
                  lineJoin="round"
                />
                
                {/* Main Polyline */}
                <Polyline 
                  positions={[
                    [leg.departureCoords.lat, leg.departureCoords.lng],
                    [leg.destinationCoords.lat, leg.destinationCoords.lng]
                  ]} 
                  color={polylineColor}
                  weight={isHovered ? 8 : (hasSafetyIssues ? 6 : 4)}
                  opacity={isHovered ? 1 : 0.9}
                  lineCap="round"
                  lineJoin="round"
                  className={isHovered ? 'animate-pulse' : ''}
                  eventHandlers={{
                    mouseover: (e) => {
                      const layer = e.target;
                      layer.setStyle({
                        weight: 10,
                        opacity: 1
                      });
                    },
                    mouseout: (e) => {
                      const layer = e.target;
                      layer.setStyle({
                        weight: isHovered ? 8 : (hasSafetyIssues ? 6 : 4),
                        opacity: isHovered ? 1 : 0.9
                      });
                    },
                    click: () => {
                      setSelectedLegIndex(idx);
                    }
                  }}
                >
                  <Popup className="dark-popup">
                    <div className="p-2 min-w-[200px] bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg">
                      <div className="flex items-center justify-between border-b dark:border-gray-700 pb-2 mb-2">
                        <h3 className={`font-black text-sm ${hasRestricted ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                          LEG {idx + 1}
                        </h3>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                          {leg.departure} → {leg.destination}
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400 dark:text-gray-500 font-bold uppercase text-[9px]">Distance</span>
                          <span className="font-black text-gray-700 dark:text-gray-300">{leg?.routingDistance || 0} nm</span>
                        </div>
                        {leg.etd && leg.eta && (
                          <div className="flex justify-between">
                            <span className="text-gray-400 dark:text-gray-500 font-bold uppercase text-[9px]">Schedule</span>
                            <span className="font-black text-gray-700 dark:text-gray-300">{leg.etd} - {leg.eta}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-400 dark:text-gray-500 font-bold uppercase text-[9px]">Flight Time</span>
                          <span className="font-black text-gray-700 dark:text-gray-300">
                            {leg.etd && leg.eta ? (
                              (() => {
                                const duration = calculateDurationFromEtdEta(leg.etd, leg.eta);
                                return duration ? `${duration.hours}h ${duration.minutes}m` : `${leg.flightTime.toFixed(2)} hrs`;
                              })()
                            ) : (
                              `${leg.flightTime.toFixed(2)} hrs`
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 dark:text-gray-500 font-bold uppercase text-[9px]">Fuel Burn</span>
                          <span className="font-black text-gray-700 dark:text-gray-300">{leg.fuelBurn.toFixed(2)} units</span>
                        </div>
                        {leg.altitude && (
                          <div className="flex justify-between">
                            <span className="text-gray-400 dark:text-gray-500 font-bold uppercase text-[9px]">Altitude</span>
                            <span className="font-black text-gray-700 dark:text-gray-300">{leg.altitude?.toLocaleString()} ft</span>
                          </div>
                        )}
                        
                        {hasRestricted && (
                          <div className="mt-3 pt-3 border-t border-red-100 dark:border-red-900/30">
                            <p className="text-red-600 dark:text-red-400 font-black mb-2 uppercase text-[9px] tracking-widest">⚠️ Restricted Airspaces</p>
                            {leg.restrictedAreas!.map((area, aidx) => (
                              <div key={aidx} className="bg-red-50 dark:bg-red-900/20 p-2 rounded-xl mb-1 border border-red-100 dark:border-red-900/50">
                                <p className="font-bold text-red-700 dark:text-red-400 text-[10px]">{area.name}</p>
                                <p className="text-[9px] text-red-600 dark:text-red-500 italic leading-tight mt-0.5">{area.reason}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {leg.firs && leg.firs.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-indigo-600 dark:text-indigo-400 font-black mb-2 uppercase text-[9px] tracking-widest flex items-center gap-1">
                              <Globe size={10} />
                              <span>Flight Information Regions (FIRs)</span>
                            </p>
                            <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                              {leg.firs.map((fir, fidx) => (
                                <div key={fidx} className="bg-gray-50 dark:bg-gray-900/40 p-2 rounded-xl border border-gray-100 dark:border-gray-800">
                                  <div className="flex justify-between items-center">
                                    <p className="font-bold text-gray-900 dark:text-white text-[10px]">{fir.name}</p>
                                    <span className="text-[8px] font-black text-gray-400 uppercase">{fir.country}</span>
                                  </div>
                                  {fir.rules && <p className="text-[8px] text-gray-500 dark:text-gray-400 italic mt-0.5 leading-tight">{fir.rules}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Polyline>
              </div>
            );
          })}
        </>
      ) : (
        <>
          {previewCoords.map((coord, idx) => (
            <Marker 
              key={idx} 
              position={[coord.lat, coord.lng]}
              icon={DefaultIcon}
            >
              <Popup className="dark-popup"><AirportPopup code={coord.code} /></Popup>
            </Marker>
          ))}
          {previewCoords.length > 1 && (
            <Polyline 
              positions={previewCoords.map(c => [c.lat, c.lng])} 
              color="#6366f1"
              weight={2}
              opacity={0.4}
              dashArray="5, 10"
            />
          )}
        </>
      )}
      </MapContainer>

      {/* Coordinates Display Overlay */}
      {mouseCoords && (
        <div className="absolute bottom-4 right-4 z-[1000] bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 pointer-events-none transition-opacity opacity-0 group-hover/map:opacity-100">
          <div className="flex items-center gap-3 text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <span className="text-indigo-500 uppercase">Lat:</span>
              <span>{mouseCoords.lat.toFixed(4)}°</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-indigo-500 uppercase">Lng:</span>
              <span>{mouseCoords.lng.toFixed(4)}°</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
