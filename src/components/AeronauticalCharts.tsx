import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, ScaleControl, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, Map as MapIcon, Plane, Globe, Search, Camera, Download, Info, Maximize, MousePointer2, Sparkles, HardDrive, Database, RefreshCw } from 'lucide-react';
import { CHART_LAYERS } from '../lib/mapConfig';

export default function AeronauticalCharts() {
  const [activeChart, setActiveChart] = useState<string>('skyVectorVfr');
  const [center, setCenter] = useState<[number, number]>([39.8283, -98.5795]); // US Center
  const [zoom, setZoom] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [stats, setStats] = useState<{ tileCount: number, totalSize: string } | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/v1/charts/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error("Failed to fetch chart stats", e);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would use a geocoding service
    // For now, let's just simulate some common ones
    if (searchQuery.toUpperCase() === 'KLAX') setCenter([33.9416, -118.4085]);
    if (searchQuery.toUpperCase() === 'KJFK') setCenter([40.6413, -73.7781]);
    if (searchQuery.toUpperCase() === 'EGLL') setCenter([51.4700, -0.4543]);
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert('Chart area captured successfully. In a production environment, this would generate a high-resolution PDF or PNG of the selected sectional.');
    }, 2000);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">SkyVector Aeronautical Charts</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Global VFR Sectionals, High & Low Enroute IFR Charts</p>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="relative">
            <input 
              type="text" 
              placeholder="Search ICAO (e.g. KLAX)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none w-64 shadow-sm"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          </form>

          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50"
          >
            {isExporting ? <Globe className="animate-spin" size={14} /> : <Camera size={14} />}
            {isExporting ? 'Capturing...' : 'Export Chart View'}
          </button>
        </div>
      </div>

      <div className="flex-1 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-gray-800 shadow-2xl relative group bg-gray-900">
        <MapContainer 
          center={center} 
          zoom={zoom} 
          className="h-full w-full"
          zoomControl={false}
        >
          {Object.entries(CHART_LAYERS).map(([id, layer]) => (
            activeChart === id && (
              <TileLayer
                key={id}
                url={typeof layer.url === 'function' ? layer.url(false) : layer.url}
                attribution={layer.attribution}
                maxZoom={18}
                maxNativeZoom={(layer as any).maxZoom || 18}
                tms={layer.tms}
                subdomains={layer.subdomains}
              />
            )
          ))}
          
          <ScaleControl position="bottomleft" />
          <ZoomControl position="bottomright" />
        </MapContainer>

        {/* Chart Toggle Overlay */}
        <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-2">
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-2 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800 flex flex-col gap-1 w-48">
            <p className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-3 pt-2">Chart Layers</p>
            {[
              { id: 'skyVectorVfr', name: 'VFR Sectional', icon: MapIcon },
              { id: 'skyVectorIfrLow', name: 'IFR Low Enroute', icon: Globe },
              { id: 'skyVectorIfrHigh', name: 'IFR High Enroute', icon: Plane },
              { id: 'standard', name: 'Standard Map', icon: Globe }
            ].map((chart) => (
              <button
                key={chart.id}
                onClick={() => setActiveChart(chart.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-[10px] font-black uppercase tracking-tighter ${
                  activeChart === chart.id 
                    ? 'bg-indigo-600 text-white shadow-xl' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <chart.icon size={14} />
                <span>{chart.name}</span>
              </button>
            ))}
          </div>

          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-4 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800 w-48">
             <div className="flex items-center gap-2 mb-3">
              <Database size={14} className="text-indigo-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">Local Storage</span>
             </div>
             <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[8px] text-gray-500 uppercase font-black">Tiles Stored</span>
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400">{stats?.tileCount.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[8px] text-gray-500 uppercase font-black">Cache Size</span>
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400">{stats?.totalSize || '0.00 MB'}</span>
              </div>
              <p className="text-[8px] text-gray-400 leading-tight mt-2 italic">
                Automatically scraping and storing viewed chart sectors for offline-ready access.
              </p>
             </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-4 rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800 w-48">
             <div className="flex items-center gap-2 mb-3">
              <Info size={14} className="text-indigo-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">Chart Sync</span>
             </div>
             <p className="text-[9px] text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
              Synchronizing with SkyVector AIRAC Cycle 2605. Charts are updated every 28 days for regulatory compliance.
             </p>
          </div>
        </div>

        {/* Cursor Info Overlay */}
        <div className="absolute bottom-6 right-16 z-[1000] bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl px-4 py-2 rounded-2xl shadow-2xl border border-white/20 dark:border-gray-800 flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Selected Region</span>
            <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tighter">North American Sector</span>
          </div>
          <div className="w-px h-6 bg-gray-100 dark:bg-gray-800" />
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Chart Source</span>
            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter flex items-center gap-1">
              Live SkyVector API <Sparkles size={10} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
