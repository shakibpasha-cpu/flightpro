import { MapContainer, TileLayer, Polyline, Marker, Popup, useMapEvents, useMap, ScaleControl, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState, useEffect, useMemo } from 'react';
import { getAirportDetails, searchAirports } from '../services/aiService';

// Helper for bearing calculation
function getBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360;
}

// Helper for midpoint calculation
function getMidpoint(lat1: number, lon1: number, lat2: number, lon2: number) {
  return [(lat1 + lat2) / 2, (lon1 + lon2) / 2] as [number, number];
}

// Use CDN URLs for marker icons
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function AirportPopup({ code }: { code: string }) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAirportDetails(code).then(data => {
      setDetails(data);
      setLoading(false);
    });
  }, [code]);

  return (
    <div className="min-w-[150px]">
      <p className="font-bold text-indigo-600 dark:text-indigo-400 border-b dark:border-gray-700 pb-1 mb-2">Airport: {code}</p>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs">
          <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading details...
        </div>
      ) : (
        <div className="space-y-1 text-xs text-gray-800 dark:text-gray-200">
          <p><strong>Runway:</strong> {details.runwayLength?.toLocaleString()} ft</p>
          <p><strong>Elevation:</strong> {details.elevation?.toLocaleString()} ft</p>
          <p><strong>Fuel:</strong> {details.fuelAvailability}</p>
        </div>
      )}
    </div>
  );
}

interface RestrictedArea {
  name: string;
  reason: string;
  severity: 'Low' | 'Medium' | 'High';
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
}

interface FlightMapProps {
  legs?: Leg[];
  aircraftType?: string;
  previewAirports?: string[];
  onMapClick?: (lat: number, lng: number) => void;
  onRemoveLastCoordinate?: () => void;
  isDarkMode?: boolean;
}

function MapEvents({ onMapClick, onMouseMove }: { onMapClick?: (lat: number, lng: number) => void, onMouseMove?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
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

export default function FlightMap({ legs, aircraftType, previewAirports, onMapClick, onRemoveLastCoordinate, isDarkMode }: FlightMapProps) {
  const [previewCoords, setPreviewCoords] = useState<{ code: string, lat: number, lng: number }[]>([]);
  const [lastClicked, setLastClicked] = useState<{ lat: number, lng: number } | null>(null);
  const [mouseCoords, setMouseCoords] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    if (previewAirports && previewAirports.length > 0) {
      const fetchCoords = async () => {
        const coords = await Promise.all(
          previewAirports.filter(code => code.length >= 3).map(async (code) => {
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

  const hasLegs = legs && legs.length > 0;
  const hasPreview = previewCoords.length > 0;

  const tileLayerUrl = isDarkMode 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  if (!hasLegs && !hasPreview) {
    return (
      <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
        <TileLayer 
          url={tileLayerUrl} 
          className="map-tiles"
        />
        <MapEvents onMapClick={onMapClick} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700">
            Click map to set coordinates or type ICAO codes
          </div>
        </div>
      </MapContainer>
    );
  }

  const allCoords: [number, number][] = useMemo(() => {
    if (hasLegs) {
      return legs!.flatMap(leg => [
        [leg.departureCoords.lat, leg.departureCoords.lng] as [number, number],
        [leg.destinationCoords.lat, leg.destinationCoords.lng] as [number, number]
      ]);
    }
    return previewCoords.map(c => [c.lat, c.lng] as [number, number]);
  }, [hasLegs, legs, previewCoords]);

  const centerLat = allCoords.length > 0 ? allCoords.reduce((acc, coord) => acc + coord[0], 0) / allCoords.length : 20;
  const centerLng = allCoords.length > 0 ? allCoords.reduce((acc, coord) => acc + coord[1], 0) / allCoords.length : 0;
  const center = [centerLat, centerLng] as [number, number];

  return (
    <div className="relative h-full w-full group/map">
      <MapContainer 
        center={center} 
        zoom={3} 
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer 
          url={tileLayerUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          className="map-tiles"
        />
        <MapEvents onMapClick={onMapClick} onMouseMove={(lat, lng) => setMouseCoords({ lat, lng })} />
        <MapController coords={allCoords} />
        <ScaleControl position="bottomleft" />
        
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
        legs!.map((leg, idx) => {
          const hasRestricted = leg.restrictedAreas && leg.restrictedAreas.length > 0;
          const polylineColor = hasRestricted ? "#ef4444" : "#6366f1";
          const glowColor = hasRestricted ? "rgba(239, 68, 68, 0.3)" : "rgba(99, 102, 241, 0.3)";
          
          return (
            <div key={idx}>
              <Marker 
                position={[leg.departureCoords.lat, leg.departureCoords.lng]}
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: `<div class="w-4 h-4 bg-white border-4 border-indigo-600 rounded-full shadow-lg ring-4 ring-indigo-600/20"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}
              >
                <Popup className="dark-popup"><AirportPopup code={leg.departure} /></Popup>
              </Marker>
              {idx === legs!.length - 1 && (
                <Marker 
                  position={[leg.destinationCoords.lat, leg.destinationCoords.lng]}
                  icon={L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div class="w-4 h-4 bg-white border-4 border-indigo-600 rounded-full shadow-lg ring-4 ring-indigo-600/20"></div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                  })}
                >
                  <Popup className="dark-popup"><AirportPopup code={leg.destination} /></Popup>
                </Marker>
              )}

              {/* Aircraft Icon at Midpoint */}
              <Marker
                position={getMidpoint(leg.departureCoords.lat, leg.departureCoords.lng, leg.destinationCoords.lat, leg.destinationCoords.lng)}
                icon={L.divIcon({
                  className: 'aircraft-icon',
                  html: `<div style="transform: rotate(${getBearing(leg.departureCoords.lat, leg.departureCoords.lng, leg.destinationCoords.lat, leg.destinationCoords.lng)}deg)">
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <path d="M21 16V14.5L13 9.5V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9.5L2 14.5V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z" fill="${hasRestricted ? '#ef4444' : '#6366f1'}" stroke="white" stroke-width="1"/>
                           </svg>
                         </div>`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={false} className="custom-tooltip">
                  <div className="px-2 py-1 bg-white dark:bg-gray-800 rounded shadow-sm text-[10px] font-bold text-gray-700 dark:text-gray-300">
                    {leg.routingDistance} nm
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
                weight={hasRestricted ? 12 : 10}
                opacity={0.4}
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
                weight={hasRestricted ? 6 : 4}
                opacity={0.9}
                lineCap="round"
                lineJoin="round"
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
                        <span className="font-black text-gray-700 dark:text-gray-300">{leg.routingDistance} nm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 dark:text-gray-500 font-bold uppercase text-[9px]">Flight Time</span>
                        <span className="font-black text-gray-700 dark:text-gray-300">{leg.flightTime.toFixed(2)} hrs</span>
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
                    </div>
                  </div>
                </Popup>
              </Polyline>
            </div>
          );
        })
      ) : (
        <>
          {previewCoords.map((coord, idx) => (
            <Marker 
              key={idx} 
              position={[coord.lat, coord.lng]}
              icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="w-3 h-3 bg-white border-2 border-indigo-400 rounded-full shadow-sm ring-2 ring-indigo-400/20"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
              })}
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
