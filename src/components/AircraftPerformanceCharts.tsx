import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
  Label,
  Legend
} from 'recharts';
import { Gauge, Zap, Wind, Weight, Navigation } from 'lucide-react';

interface Aircraft {
  type: string;
  range: number | '';
  maxPayload: number | '';
  maxPassengers: number | '';
  takeoffDistance: number | '';
  landingDistance: number | '';
  cruiseSpeed: number | '';
  fuelBurnPerHour: number | '';
  hourlyRate: number | '';
  maintenanceReserve: number | '';
  crewCostPerHour: number | '';
}

interface Props {
  aircraft: Aircraft;
}

export default function AircraftPerformanceCharts({ aircraft }: Props) {
  const maxPayload = Number(aircraft.maxPayload) || 0;
  const maxRange = Number(aircraft.range) || 0;
  const cruiseSpeed = Number(aircraft.cruiseSpeed) || 0;
  const fuelBurn = Number(aircraft.fuelBurnPerHour) || 0;

  // Generate Range vs Payload data (Breguet Equation logic simplified)
  const rangePayloadData = useMemo(() => {
    const data = [];
    const steps = 12;
    for (let i = steps; i >= 0; i--) {
      const payloadPercent = i / steps;
      const currentPayload = Math.round(maxPayload * payloadPercent);
      
      // Typical payload-range curve: 
      // 1. Max Payload Range (full payload)
      // 2. Ferry Range (zero payload)
      // Usually there's a "knee" where fuel is traded for payload
      let rangeFactor;
      if (payloadPercent > 0.6) {
        // High payload: Range drops significantly
        rangeFactor = 0.6 + (1 - payloadPercent) * 0.4;
      } else {
        // Low payload: Range is limited by tank capacity rather than weight
        rangeFactor = 0.85 + (0.6 - payloadPercent) * 0.25;
      }
      
      const currentRange = Math.round(maxRange * rangeFactor);
      data.push({ payload: currentPayload, range: currentRange });
    }
    return data.sort((a,b) => a.payload - b.payload);
  }, [maxPayload, maxRange]);

  // Generate Climb Rate vs Altitude data
  const climbData = useMemo(() => {
    const data = [];
    const serviceCeiling = aircraft.type.toLowerCase().includes('cargo') ? 35000 : 45000;
    const initialClimbRate = aircraft.type.toLowerCase().includes('cargo') ? 2500 : 4000;
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const altitude = Math.round((serviceCeiling / steps) * i);
      const altitudePercent = altitude / serviceCeiling;
      // Exponential decay of climb rate with altitude
      const climbRate = Math.round(initialClimbRate * Math.pow(1 - altitudePercent, 1.2));
      data.push({ altitude, climbRate });
    }
    return data;
  }, [aircraft.type]);

  // Generate Fuel Burn vs Speed data (Drag is proportional to velocity squared)
  const fuelSpeedData = useMemo(() => {
    const data = [];
    const baseSpeed = Math.round(cruiseSpeed * 0.6); 
    const maxSpeed = Math.round(cruiseSpeed * 1.15);
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const speed = Math.round(baseSpeed + ((maxSpeed - baseSpeed) / steps) * i);
      const speedRatio = speed / cruiseSpeed;
      // Induced drag (decreases with speed) + Parasitic drag (increases with speed squared)
      // Total fuel burn approximated as: C1/v + C2*v^2
      const fuelBurnValue = Math.round(fuelBurn * (0.4 / speedRatio + 0.6 * Math.pow(speedRatio, 2.8)));
      data.push({ speed, fuelBurn: fuelBurnValue });
    }
    return data;
  }, [cruiseSpeed, fuelBurn]);

  const formatAxis = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label, xUnit, yUnit, title }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-indigo-100 dark:border-indigo-900/50 min-w-[160px]">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">{title}</p>
          <div className="space-y-1">
            <div className="flex justify-between items-center gap-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Input</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">{label}<span className="text-[10px] ml-1 opacity-50">{xUnit}</span></span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Perform</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{payload[0].value}<span className="text-[10px] ml-1 opacity-50">{yUnit}</span></span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 py-6">
      {/* Performance Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-3xl border border-indigo-100/50 dark:border-indigo-800/30">
          <div className="flex items-center gap-2 mb-2">
            <Navigation size={14} className="text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900/40 dark:text-indigo-400/40">Ferry Range</span>
          </div>
          <div className="text-2xl font-black text-indigo-900 dark:text-indigo-300">{Math.round(maxRange * 1.1).toLocaleString()} <span className="text-xs opacity-50">nm</span></div>
        </div>
        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-3xl border border-emerald-100/50 dark:border-emerald-800/30">
          <div className="flex items-center gap-2 mb-2">
            <Gauge size={14} className="text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-900/40 dark:text-emerald-400/40">Cruise L/hr</span>
          </div>
          <div className="text-2xl font-black text-emerald-900 dark:text-emerald-300">{fuelBurn.toLocaleString()} <span className="text-xs opacity-50">l/h</span></div>
        </div>
        <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-3xl border border-amber-100/50 dark:border-amber-800/30">
          <div className="flex items-center gap-2 mb-2">
            <Wind size={14} className="text-amber-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900/40 dark:text-amber-400/40">Best Speed</span>
          </div>
          <div className="text-2xl font-black text-amber-900 dark:text-amber-300">{Math.round(cruiseSpeed * 0.92)} <span className="text-xs opacity-50">kts</span></div>
        </div>
        <div className="bg-rose-50/50 dark:bg-rose-900/10 p-4 rounded-3xl border border-rose-100/50 dark:border-rose-800/30">
          <div className="flex items-center gap-2 mb-2">
            <Weight size={14} className="text-rose-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-900/40 dark:text-rose-400/40">Payload Eff.</span>
          </div>
          <div className="text-2xl font-black text-rose-900 dark:text-rose-300">{Math.round(maxRange / (maxPayload || 1) * 100) / 100} <span className="text-xs opacity-50">nm/kg</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Range vs Payload Chart */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Navigation size={120} />
          </div>
          <div className="relative z-10 mb-8">
            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest mb-1">Payload-Range Envelope</h4>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Nautical Miles Capability vs KG Onboard</p>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rangePayloadData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" strokeOpacity={0.5} />
                <XAxis 
                  dataKey="payload" 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <Tooltip content={<CustomTooltip title="Range Profile" xUnit="kg" yUnit="nm" />} />
                <ReferenceLine x={maxPayload} stroke="#f43f5e" strokeDasharray="3 3">
                  <Label value="MTOW" position="top" fill="#f43f5e" fontSize={10} fontWeight="bold" />
                </ReferenceLine>
                <Area 
                  type="monotone" 
                  dataKey="range" 
                  stroke="#6366f1" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#rangeGrad)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Climb Performance Chart */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Wind size={120} />
          </div>
          <div className="relative z-10 mb-8">
            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest mb-1">Climb Performance</h4>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">FPM vertical speed by pressure altitude</p>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={climbData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="climbGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" strokeOpacity={0.5} />
                <XAxis 
                  dataKey="altitude" 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <Tooltip content={<CustomTooltip title="Climb Rate" xUnit="ft" yUnit="fpm" />} />
                <ReferenceLine y={500} stroke="#f43f5e" strokeDasharray="3 3">
                  <Label value="Service Ceiling" position="right" fill="#f43f5e" fontSize={10} fontWeight="bold" />
                </ReferenceLine>
                <Area 
                  type="monotone" 
                  dataKey="climbRate" 
                  stroke="#10b981" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#climbGrad)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fuel Efficiency Chart */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative lg:col-span-2">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Zap size={120} />
          </div>
          <div className="relative z-10 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest mb-1">Fuel Burn vs Airspeed</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Operational cost efficiency by cruise velocity</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Consumption (L/hr)</span>
              </div>
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fuelSpeedData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" strokeOpacity={0.5} />
                <XAxis 
                  dataKey="speed" 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <Tooltip content={<CustomTooltip title="Fuel Economy" xUnit="kts" yUnit="L/hr" />} />
                <ReferenceLine x={cruiseSpeed} stroke="#4f46e5" strokeDasharray="3 3">
                  <Label value="Cruise Design" position="top" fill="#4f46e5" fontSize={10} fontWeight="bold" />
                </ReferenceLine>
                <Line 
                  type="monotone" 
                  dataKey="fuelBurn" 
                  stroke="#f43f5e" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#f43f5e', strokeWidth: 3, stroke: '#fff' }} 
                  activeDot={{ r: 10, strokeWidth: 0 }}
                  animationDuration={2000}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-100 dark:border-white/5 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Max Cruise</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-relaxed">High speed operations result in ~25% higher fuel consumption compared to LRC (Long Range Cruise).</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Optimization</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-relaxed">Best range speed is typically 10-15% below maximum cruise speed for this airframe category.</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Payload Impact</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-relaxed">Full payload reduces service ceiling by approximately 4,000ft and increases initial fuel burn by 12%.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
