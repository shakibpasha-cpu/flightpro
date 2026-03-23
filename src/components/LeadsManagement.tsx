import React, { useState } from 'react';
import { Users, Search, Plus, Filter, MoreVertical, Mail, Phone, Calendar, DollarSign, Zap, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: 'New' | 'Quoted' | 'Negotiating' | 'Booked' | 'Lost';
  lastActivity: string;
  potentialValue: number;
  source: string;
}

export default function LeadsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [leads] = useState<Lead[]>([
    { id: '1', name: 'James Wilson', company: 'Wilson Global', email: 'james@wilson.com', phone: '+44 20 7123 4567', status: 'Quoted', lastActivity: '2 hours ago', potentialValue: 45000, source: 'Website' },
    { id: '2', name: 'Sarah Chen', company: 'TechVentures', email: 'sarah@techv.com', phone: '+65 6123 4567', status: 'New', lastActivity: '5 hours ago', potentialValue: 28000, source: 'Referral' },
    { id: '3', name: 'Ahmed Al-Sayed', company: 'Oasis Energy', email: 'ahmed@oasis.ae', phone: '+971 4 123 4567', status: 'Negotiating', lastActivity: '1 day ago', potentialValue: 125000, source: 'Direct' },
    { id: '4', name: 'Elena Rossi', company: 'Rossi Fashion', email: 'elena@rossi.it', phone: '+39 02 1234 5678', status: 'Booked', lastActivity: '3 days ago', potentialValue: 18000, source: 'LinkedIn' },
    { id: '5', name: 'Michael Brown', company: 'Brown Logistics', email: 'michael@brown.com', phone: '+1 212 555 0123', status: 'Lost', lastActivity: '1 week ago', potentialValue: 65000, source: 'Website' },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Quoted': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Negotiating': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'Booked': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'Lost': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Leads & CRM</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Manage your charter pipeline</p>
        </div>
        <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none">
          <Plus size={18} /> Add New Lead
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: '124', icon: Users, color: 'text-blue-600' },
          { label: 'Active Quotes', value: '18', icon: Zap, color: 'text-amber-600' },
          { label: 'Pipeline Value', value: '$1.2M', icon: DollarSign, color: 'text-emerald-600' },
          { label: 'Conversion Rate', value: '24%', icon: Clock, color: 'text-indigo-600' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search leads by name, company, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-medium text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all">
              <Filter size={20} />
            </button>
            <button className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all uppercase tracking-widest">
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Lead Details</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Value</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Activity</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center font-bold">
                        {lead.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-900 dark:text-white leading-none">{lead.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{lead.company}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">${lead.potentialValue?.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">{lead.source}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar size={14} />
                      <span>{lead.lastActivity}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        <Mail size={18} />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        <Phone size={18} />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
