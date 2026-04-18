import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell
} from 'recharts';

interface Aircraft {
  id?: string;
  type: string;
  fuelBurnPerHour: number | '';
  cruiseSpeed: number | '';
  range: number | '';
  maxPayload: number | '';
  maxPassengers: number | '';
  takeoffDistance: number | '';
  landingDistance: number | '';
  hourlyRate: number | '';
  category: string;
  maintenanceReserve: number | '';
  crewCostPerHour: number | '';
}

interface Props {
  aircrafts: Aircraft[];
}

export default function AircraftComparisonCharts({ aircrafts }: Props) {
  const [selectedMetric, setSelectedMetric] = useState<'range' | 'cruiseSpeed' | 'fuelBurnPerHour' | 'maxPayload' | 'hourlyRate'>('range');

  const metrics = [
    { id: 'range', label: 'Range (nm)' },
    { id: 'cruiseSpeed', label: 'Cruise Speed (kts)' },
    { id: 'fuelBurnPerHour', label: 'Fuel Burn (L/h)' },
    { id: 'maxPayload', label: 'Max Payload (kg)' },
    { id: 'hourlyRate', label: 'Hourly Rate ($)' }
  ];

  const barData = aircrafts.map(a => ({
    name: a.type,
    value: Number(a[selectedMetric]) || 0
  }));

  // Generate Range vs Payload data for all aircraft
  const generateRangePayloadData = () => {
    const data = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const payloadPercent = i / steps;
      const entry: any = { payloadPercent };
      aircrafts.forEach(a => {
        const payload = Math.round((Number(a.maxPayload) || 0) * payloadPercent);
        const rangeFactor = 1 - (payloadPercent * 0.3);
        const range = Math.round((Number(a.range) || 0) * rangeFactor);
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Key Metrics Comparison</h4>
          <div className="flex flex-wrap gap-2">
            {metrics.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMetric(m.id as any)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedMetric === m.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {m.label.split(' (')[0]}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 text-xs font-bold">
                        <p className="text-gray-900 dark:text-white mb-1">{payload[0].payload.name}</p>
                        <p className="text-indigo-600 dark:text-indigo-400">
                          {metrics.find(m => m.id === selectedMetric)?.label}: {payload[0].value.toLocaleString()}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

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
