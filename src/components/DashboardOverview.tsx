import React, { useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  FileText, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  PlaneTakeoff,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { motion } from 'motion/react';

const revenueData = [
  { name: 'Jan', revenue: 45000, margin: 8500 },
  { name: 'Feb', revenue: 52000, margin: 9200 },
  { name: 'Mar', revenue: 38000, margin: 6100 },
  { name: 'Apr', revenue: 65000, margin: 12000 },
  { name: 'May', revenue: 85000, margin: 15500 },
  { name: 'Jun', revenue: 110000, margin: 21000 },
  { name: 'Jul', revenue: 145000, margin: 28000 },
];

const flightData = [
  { name: 'Mon', flights: 4 },
  { name: 'Tue', flights: 6 },
  { name: 'Wed', flights: 3 },
  { name: 'Thu', flights: 8 },
  { name: 'Fri', flights: 12 },
  { name: 'Sat', flights: 15 },
  { name: 'Sun', flights: 10 },
];

const recentActivity = [
  { id: 1, type: 'quote_accepted', client: 'Al Maktoum Group', route: 'OMDB - EGLL', amount: '$85,000', time: '2 hours ago' },
  { id: 2, type: 'new_lead', client: 'Sarah Jenkins', route: 'KTEB - MYNN', amount: 'Pending', time: '4 hours ago' },
  { id: 3, type: 'flight_departed', client: 'Tech Ventures LLC', route: 'LSZH - LFMN', amount: '$12,500', time: '5 hours ago' },
  { id: 4, type: 'quote_sent', client: 'Royal Holdings', route: 'OEDF - LFPB', amount: '$110,000', time: '1 day ago' },
];

export default function DashboardOverview() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Platform Overview</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back, Admin. Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <select className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm font-medium rounded-xl px-4 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500">
            <option>Last 30 Days</option>
            <option>This Quarter</option>
            <option>This Year</option>
          </select>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-sm shadow-indigo-200 dark:shadow-none">
            Download Report
          </button>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Revenue" 
          value="$540,000" 
          trend="+12.5%" 
          isPositive={true} 
          icon={<DollarSign size={20} className="text-emerald-600 dark:text-emerald-400" />} 
          color="bg-emerald-50 dark:bg-emerald-900/30"
        />
        <MetricCard 
          title="Active Quotes" 
          value="42" 
          trend="+5.2%" 
          isPositive={true} 
          icon={<FileText size={20} className="text-indigo-600 dark:text-indigo-400" />} 
          color="bg-indigo-50 dark:bg-indigo-900/30"
        />
        <MetricCard 
          title="Conversion Rate" 
          value="18.4%" 
          trend="-2.1%" 
          isPositive={false} 
          icon={<TrendingUp size={20} className="text-amber-600 dark:text-amber-400" />} 
          color="bg-amber-50 dark:bg-amber-900/30"
        />
        <MetricCard 
          title="New Leads" 
          value="128" 
          trend="+24.8%" 
          isPositive={true} 
          icon={<Users size={20} className="text-blue-600 dark:text-blue-400" />} 
          color="bg-blue-50 dark:bg-blue-900/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white">Revenue vs Margin</h3>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">YTD 2026</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={(value) => `$${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => [`$${value?.toLocaleString()}`, undefined]}
                />
                <Area type="monotone" dataKey="revenue" name="Total Revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="margin" name="Net Margin" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorMargin)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white">Recent Activity</h3>
            <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition">View All</button>
          </div>
          <div className="space-y-6">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex gap-4">
                <div className="mt-1">
                  {activity.type === 'quote_accepted' && <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={16} /></div>}
                  {activity.type === 'new_lead' && <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400"><Users size={16} /></div>}
                  {activity.type === 'flight_departed' && <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><PlaneTakeoff size={16} /></div>}
                  {activity.type === 'quote_sent' && <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400"><FileText size={16} /></div>}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{activity.client}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{activity.route} • <span className="font-medium text-gray-700 dark:text-gray-300">{activity.amount}</span></p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Flight Volume Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white">Flight Volume (This Week)</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flightData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                <Bar dataKey="flights" name="Flights" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="font-bold text-gray-900 dark:text-white mb-6">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="p-4 border border-gray-100 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-indigo-600 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">New Quote</span>
            </button>
            <button className="p-4 border border-gray-100 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-emerald-600 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition group">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">Add Lead</span>
            </button>
            <button className="p-4 border border-gray-100 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-blue-600 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition group">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <PlaneTakeoff size={24} />
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-blue-700 dark:group-hover:text-blue-400">Schedule Flight</span>
            </button>
            <button className="p-4 border border-gray-100 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-amber-600 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition group">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                <Clock size={24} />
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-amber-700 dark:group-hover:text-amber-400">View Empty Legs</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, trend, isPositive, icon, color }: { title: string, value: string, trend: string, isPositive: boolean, icon: React.ReactNode, color: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`w-10 h-10 rounded-xl ${color} dark:bg-opacity-20 flex items-center justify-center`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </div>
      </div>
      <div>
        <h4 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{title}</h4>
        <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{value}</p>
      </div>
    </motion.div>
  );
}
