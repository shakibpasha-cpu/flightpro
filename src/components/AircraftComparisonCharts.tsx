import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface Aircraft {
  id?: string;
  type: string;
  fuelBurnPerHour: number;
  cruiseSpeed: number;
  range: number;
  maxPayload: number;
  maxPassengers: number;
  takeoffDistance: number;
  landingDistance: number;
  hourlyRate: number;
  category: string;
  maintenanceReserve: number;
  crewCostPerHour: number;
}

interface Props {
  aircrafts: Aircraft[];
}

export default function AircraftComparisonCharts({ aircrafts }: Props) {
  // Generate Range vs Payload data for all aircraft
  const generateRangePayloadData = () => {
    const data = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const payloadPercent = i / steps;
      const entry: any = { payloadPercent };
      aircrafts.forEach(a => {
        const payload = Math.round(a.maxPayload * payloadPercent);
        const rangeFactor = 1 - (payloadPercent * 0.3);
        const range = Math.round(a.range * rangeFactor);
        entry[a.type] = range;
      });
      data.push(entry);
    }
    return data;
  };

  const generateClimbRateData = () => {
    const data = [];
    const altitudes = [0, 10000, 20000, 30000, 40000];
    altitudes.forEach(alt => {
      const entry: any = { altitude: alt };
      aircrafts.forEach(a => {
        // Simulate climb rate decrease with altitude
        const baseClimbRate = a.category === 'Heavy Jet' ? 2500 : a.category === 'Midsize Jet' ? 3000 : 3500;
        const climbRate = Math.max(500, Math.round(baseClimbRate * (1 - alt / 50000)));
        entry[a.type] = climbRate;
      });
      data.push(entry);
    });
    return data;
  };

  const rangePayloadData = generateRangePayloadData();
  const climbRateData = generateClimbRateData();
  const colors = ['#4f46e5', '#10b981', '#f59e0b', '#e11d48', '#8b5cf6'];

  const CustomTooltip = ({ active, payload, label, isClimb }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 text-xs font-bold">
          <p className="text-gray-500 dark:text-gray-400 mb-1">
            {isClimb ? `Altitude: ${label} ft` : `Payload: ${Math.round(label * 100)}%`}
          </p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{ color: p.color }}>{p.name}: {p.value} {isClimb ? 'fpm' : 'nm'}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 py-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6">Range vs Payload Comparison</h4>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rangePayloadData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
              <XAxis 
                dataKey="payloadPercent" 
                tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `${Math.round(val * 100)}%`}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip isClimb={false} />} />
              <Legend />
              {aircrafts.map((a, i) => (
                <Line 
                  key={a.id} 
                  type="monotone" 
                  dataKey={a.type} 
                  stroke={colors[i % colors.length]} 
                  strokeWidth={3} 
                  dot={{ r: 4 }} 
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6">Climb Rate vs Altitude Comparison</h4>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={climbRateData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
              <XAxis 
                dataKey="altitude" 
                tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip isClimb={true} />} />
              <Legend />
              {aircrafts.map((a, i) => (
                <Line 
                  key={a.id} 
                  type="monotone" 
                  dataKey={a.type} 
                  stroke={colors[i % colors.length]} 
                  strokeWidth={3} 
                  dot={{ r: 4 }} 
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
