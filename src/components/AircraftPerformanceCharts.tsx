import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface Aircraft {
  type: string;
  range: number;
  maxPayload: number;
  maxPassengers: number;
  takeoffDistance: number;
  landingDistance: number;
  cruiseSpeed: number;
  fuelBurnPerHour: number;
  hourlyRate: number;
  maintenanceReserve: number;
  crewCostPerHour: number;
}

interface Props {
  aircraft: Aircraft;
}

export default function AircraftPerformanceCharts({ aircraft }: Props) {
  // Generate Range vs Payload data
  const generateRangePayloadData = () => {
    const data = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const payloadPercent = i / steps;
      const payload = Math.round(aircraft.maxPayload * payloadPercent);
      const rangeFactor = 1 - (payloadPercent * 0.3);
      const range = Math.round(aircraft.range * rangeFactor);
      data.push({ payload, range });
    }
    return data;
  };

  // Generate Climb Rate vs Altitude data
  const generateClimbData = () => {
    const data = [];
    const serviceCeiling = aircraft.type.toLowerCase().includes('cargo') ? 35000 : 45000;
    const initialClimbRate = aircraft.type.toLowerCase().includes('cargo') ? 2500 : 4000;
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const altitude = Math.round((serviceCeiling / steps) * i);
      const altitudePercent = altitude / serviceCeiling;
      const climbRate = Math.round(initialClimbRate * (1 - altitudePercent));
      data.push({ altitude, climbRate });
    }
    return data;
  };

  // Generate Takeoff Distance vs Weight data
  const generateTakeoffData = () => {
    const data = [];
    const baseTakeoffDist = aircraft.type.toLowerCase().includes('cargo') ? 8000 : 5000;
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const weightPercent = 0.5 + (i / steps) * 0.5;
      const weight = Math.round(aircraft.maxPayload * 2 * weightPercent);
      const distance = Math.round(baseTakeoffDist * Math.pow(weightPercent, 2));
      data.push({ weight, distance });
    }
    return data;
  };

  // Generate Fuel Burn vs Speed data
  const generateFuelSpeedData = () => {
    const data = [];
    const baseSpeed = aircraft.cruiseSpeed * 0.7; // Start at 70% cruise speed
    const maxSpeed = aircraft.cruiseSpeed * 1.05; // Up to 105% (max cruise)
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const speed = Math.round(baseSpeed + ((maxSpeed - baseSpeed) / steps) * i);
      // Fuel burn increases exponentially with speed
      const speedRatio = speed / aircraft.cruiseSpeed;
      const fuelBurn = Math.round(aircraft.fuelBurnPerHour * Math.pow(speedRatio, 2.5));
      data.push({ speed, fuelBurn });
    }
    return data;
  };

  const rangePayloadData = generateRangePayloadData();
  const climbData = generateClimbData();
  const takeoffData = generateTakeoffData();
  const fuelSpeedData = generateFuelSpeedData();

  const formatAxis = (tickItem: number) => {
    if (tickItem >= 1000) {
      return (tickItem / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return tickItem.toString();
  };

  const CustomTooltip = ({ active, payload, label, xUnit, yUnit }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 text-xs font-bold">
          <p className="text-gray-500 dark:text-gray-400 mb-1">{`${label} ${xUnit}`}</p>
          <p className="text-indigo-600 dark:text-indigo-400">{`${payload[0].value} ${yUnit}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Range vs Payload Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
          <div className="mb-6">
            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Range vs Payload</h4>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Nautical Miles vs Kilograms</p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rangePayloadData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
                <XAxis 
                  dataKey="payload" 
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <Tooltip content={<CustomTooltip xUnit="kg Payload" yUnit="nm Range" />} />
                <Area type="monotone" dataKey="range" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRange)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Climb Rate vs Altitude Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
          <div className="mb-6">
            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Climb Rate vs Altitude</h4>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">FPM vs Altitude (ft)</p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={climbData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
                <XAxis 
                  dataKey="altitude" 
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <Tooltip content={<CustomTooltip xUnit="ft Altitude" yUnit="fpm Climb Rate" />} />
                <Line type="monotone" dataKey="climbRate" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Takeoff Distance vs Weight Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-amber-200 dark:hover:border-amber-800 transition-colors">
          <div className="mb-6">
            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Takeoff Distance</h4>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Feet vs Weight (kg)</p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={takeoffData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTakeoff" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
                <XAxis 
                  dataKey="weight" 
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <Tooltip content={<CustomTooltip xUnit="kg Weight" yUnit="ft Distance" />} />
                <Area type="monotone" dataKey="distance" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorTakeoff)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fuel Burn vs Speed Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-rose-200 dark:hover:border-rose-800 transition-colors">
          <div className="mb-6">
            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Fuel Burn vs Speed</h4>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Liters/hr vs Knots</p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fuelSpeedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
                <XAxis 
                  dataKey="speed" 
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxis}
                />
                <Tooltip content={<CustomTooltip xUnit="kts Speed" yUnit="L/hr Fuel Burn" />} />
                <Line type="monotone" dataKey="fuelBurn" stroke="#e11d48" strokeWidth={3} dot={{ r: 4, fill: '#e11d48', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
