import React from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  ShieldAlert, 
  Zap, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Globe, 
  Users, 
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Rocket
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const financialData = [
  { name: 'Year 1', revenue: 840000, costs: 600000, profit: 240000 },
  { name: 'Year 2', revenue: 2800000, costs: 1200000, profit: 1600000 },
  { name: 'Year 3', revenue: 7500000, costs: 2500000, profit: 5000000 },
];

const revenueBreakdown = [
  { name: 'Commissions', value: 75 },
  { name: 'SaaS Subscriptions', value: 20 },
  { name: 'Data Premium', value: 5 },
];

const COLORS = ['#4f46e5', '#10b981', '#f59e0b'];

export default function FeasibilityReport() {
  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden bg-indigo-900 rounded-[3rem] p-12 text-white shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <Globe size={300} />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-widest mb-6">
            <Zap size={14} className="text-amber-400" />
            Investor-Ready Report
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase leading-none">
            ACMI Intelligence <br />
            <span className="text-indigo-400">Feasibility Report</span>
          </h1>
          <p className="max-w-2xl text-lg text-indigo-100 font-medium leading-relaxed">
            A comprehensive strategic analysis of the hybrid ACMI Aircraft Marketplace, AI-powered Quote Engine, and Availability Intelligence platform.
          </p>
        </div>
      </div>

      {/* Market Analysis */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm h-full">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
              <Globe size={24} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-4">Market Analysis</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
              The global ACMI market is projected to grow at a CAGR of 8.5% through 2030, driven by airline fleet optimization and post-pandemic recovery.
            </p>
            <ul className="space-y-4">
              {[
                { title: 'Global Size', desc: '$5.2B+ Annual Market' },
                { title: 'Growth Driver', desc: 'Airline Shortages & Seasonality' },
                { title: 'Key Demand', desc: 'Hajj, Cargo, Peak Summer' }
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-500 shrink-0 mt-1" size={16} />
                  <div>
                    <p className="text-xs font-black text-gray-900 dark:text-white uppercase">{item.title}</p>
                    <p className="text-[10px] text-gray-500">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Competitor Landscape</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
              <h4 className="text-sm font-black text-gray-900 dark:text-white mb-2 uppercase">Avinode / ACMI24</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Established players with large networks but manual verification processes and static pricing models.
              </p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-rose-600 uppercase">
                <AlertTriangle size={12} />
                Weakness: Low Automation
              </div>
            </div>
            <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-800">
              <h4 className="text-sm font-black text-indigo-600 mb-2 uppercase">Our Platform</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Differentiated by AI-powered predictive availability and instant quoting based on real-time flight tracking data.
              </p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase">
                <Zap size={12} />
                Advantage: AI Intelligence
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Business Model & Revenue */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
            <DollarSign size={24} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-4">Business Model</h2>
          <div className="space-y-6">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Commission Model</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">5% – 10% per deal (Avg. 7%)</p>
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">SaaS Subscription</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">$300 – $1000/mo per operator</p>
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Premium Data</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Broker access to live intelligence</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Revenue Stream Breakdown</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {revenueBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 700 }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Financial Projections */}
      <section className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">3-Year Financial Projections</h2>
            <p className="text-sm text-gray-500 mt-1">Projected growth based on deal volume and operator scaling.</p>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-[10px] font-black text-gray-400 uppercase">Avg. Deal Size</p>
              <p className="text-sm font-black text-indigo-600">$150k - $800k</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 700 }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#4f46e5" radius={[8, 8, 0, 0]} name="Total Revenue" />
                  <Bar dataKey="profit" fill="#10b981" radius={[8, 8, 0, 0]} name="Net Profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Year 3 Target</p>
              <p className="text-3xl font-black text-gray-900 dark:text-white">$7.5M</p>
              <p className="text-xs text-emerald-600 font-bold mt-1">+168% Growth from Year 2</p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Break-even Point</p>
              <p className="text-3xl font-black text-indigo-600">Month 8</p>
              <p className="text-xs text-gray-500 font-bold mt-1">Based on 5 deals/month avg.</p>
            </div>
          </div>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Metric</th>
                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Year 1</th>
                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Year 2</th>
                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Year 3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {[
                { label: 'Avg. Deals / Month', y1: '5-10', y2: '15-30', y3: '40-80' },
                { label: 'Active Operators', y1: '15', y2: '50', y3: '150+' },
                { label: 'Total Revenue', y1: '$840k', y2: '$2.8M', y3: '$7.5M' },
                { label: 'Op. Costs', y1: '$600k', y2: '$1.2M', y3: '$2.5M' },
                { label: 'Net Profit', y1: '$240k', y2: '$1.6M', y3: '$5.0M' },
              ].map((row, i) => (
                <tr key={i} className="group hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition">
                  <td className="py-4 text-xs font-black text-gray-900 dark:text-white uppercase">{row.label}</td>
                  <td className="py-4 text-xs font-bold text-gray-500">{row.y1}</td>
                  <td className="py-4 text-xs font-bold text-gray-500">{row.y2}</td>
                  <td className="py-4 text-xs font-black text-indigo-600">{row.y3}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cost Structure & Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-8">Cost Structure</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600">
                <Layers size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase">Fixed Costs</h4>
                <p className="text-xs text-gray-500 mt-1">Development, maintenance, server infrastructure, and core team (Dev, Sales, Ops).</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-amber-600">
                <TrendingUp size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase">Variable Costs</h4>
                <p className="text-xs text-gray-500 mt-1">Marketing, data acquisition, and API costs for real-time flight tracking.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-8">Risk Analysis</h2>
          <div className="space-y-4">
            {[
              { risk: 'Data Availability', impact: 'High', mitigation: 'Redundant scraping + multi-source API integration' },
              { risk: 'Operator Dependency', impact: 'Medium', mitigation: 'Aggressive onboarding + SaaS value proposition' },
              { risk: 'Legal & Compliance', impact: 'Medium', mitigation: 'Strict AOC verification + standard IATA contracts' }
            ].map((item, i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-gray-900 dark:text-white uppercase">{item.risk}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${item.impact === 'High' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                    {item.impact} Impact
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 font-medium">Mitigation: {item.mitigation}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Growth Strategy */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[3rem] p-12 text-white shadow-xl">
        <div className="absolute bottom-0 right-0 p-12 opacity-10">
          <Rocket size={200} />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-8">Growth Strategy</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                <Users size={20} />
              </div>
              <h4 className="text-lg font-black uppercase tracking-tight">Operator Acquisition</h4>
              <p className="text-sm text-indigo-100 leading-relaxed">
                Direct outreach to AOC holders using our automated intelligence engine. Offer free 3-month SaaS trial.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                <Target size={20} />
              </div>
              <h4 className="text-lg font-black uppercase tracking-tight">Broker Attraction</h4>
              <p className="text-sm text-indigo-100 leading-relaxed">
                Marketing the AI Quote Engine as a tool to close deals 10x faster than traditional manual methods.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                <Zap size={20} />
              </div>
              <h4 className="text-lg font-black uppercase tracking-tight">AI Advantage</h4>
              <p className="text-sm text-indigo-100 leading-relaxed">
                Continuous improvement of the Availability Intelligence engine to predict empty legs before they are listed.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
