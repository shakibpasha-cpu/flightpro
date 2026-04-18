import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Filter, MoreVertical, Mail, Phone, Calendar, DollarSign, Zap, Clock, FileText, History, Loader2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

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

interface Quote {
  id: string;
  user_id: string;
  quote_data: any;
  created_at: string;
  type: string;
  status: string;
}

export default function LeadsManagement() {
  const [activeTab, setActiveTab] = useState<'leads' | 'quotes'>('leads');
  const [searchTerm, setSearchTerm] = useState('');
  const [leads] = useState<Lead[]>([
    { id: '1', name: 'James Wilson', company: 'Wilson Global', email: 'james@wilson.com', phone: '+44 20 7123 4567', status: 'Quoted', lastActivity: '2 hours ago', potentialValue: 45000, source: 'Website' },
    { id: '2', name: 'Sarah Chen', company: 'TechVentures', email: 'sarah@techv.com', phone: '+65 6123 4567', status: 'New', lastActivity: '5 hours ago', potentialValue: 28000, source: 'Referral' },
    { id: '3', name: 'Ahmed Al-Sayed', company: 'Oasis Energy', email: 'ahmed@oasis.ae', phone: '+971 4 123 4567', status: 'Negotiating', lastActivity: '1 day ago', potentialValue: 125000, source: 'Direct' },
    { id: '4', name: 'Elena Rossi', company: 'Rossi Fashion', email: 'elena@rossi.it', phone: '+39 02 1234 5678', status: 'Booked', lastActivity: '3 days ago', potentialValue: 18000, source: 'LinkedIn' },
    { id: '5', name: 'Michael Brown', company: 'Brown Logistics', email: 'michael@brown.com', phone: '+1 212 555 0123', status: 'Lost', lastActivity: '1 week ago', potentialValue: 65000, source: 'Website' },
  ]);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  useEffect(() => {
    if (activeTab === 'quotes') {
      fetchQuotes();
    }
  }, [activeTab]);

  const fetchQuotes = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoadingQuotes(true);
    try {
      const q = query(
        collection(db, 'quote_history'),
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const fetchedQuotes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quote[];
      setQuotes(fetchedQuotes);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'quote_history');
    } finally {
      setLoadingQuotes(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Quoted': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Negotiating': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'Booked': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'Lost': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'Saved': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Leads & Quotes</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">Manage your charter pipeline and history</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'leads' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700'
            }`}
          >
            Leads
          </button>
          <button 
            onClick={() => setActiveTab('quotes')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'quotes' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-700'
            }`}
          >
            Quotes History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: leads.length.toString(), icon: Users, color: 'text-blue-600' },
          { label: 'Saved Quotes', value: quotes.length.toString(), icon: History, color: 'text-indigo-600' },
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
              placeholder={activeTab === 'leads' ? "Search leads..." : "Search quotes..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-medium text-gray-900 dark:text-white outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={activeTab === 'quotes' ? fetchQuotes : undefined}
              className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
            >
              <History size={20} className={loadingQuotes ? 'animate-spin' : ''} />
            </button>
            <button className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all uppercase tracking-widest">
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'leads' ? (
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
                {leads.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.company.toLowerCase().includes(searchTerm.toLowerCase())).map((lead) => (
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
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Quote Reference</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Aircraft / Operator</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total Cost</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Date Saved</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loadingQuotes ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="animate-spin mx-auto text-indigo-600 mb-2" size={24} />
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Loading Quote History...</p>
                    </td>
                  </tr>
                ) : quotes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <History size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm font-bold text-gray-400">No saved quotes found.</p>
                    </td>
                  </tr>
                ) : (
                  quotes.filter(q => q.quote_data.id.toLowerCase().includes(searchTerm.toLowerCase()) || q.quote_data.type.toLowerCase().includes(searchTerm.toLowerCase())).map((quote) => (
                    <tr key={quote.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                            <FileText size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900 dark:text-white leading-none">{quote.quote_data.id}</p>
                            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-1">{quote.type} Quote</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{quote.quote_data.type}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{quote.quote_data.operator || 'Market Estimate'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          {quote.quote_data.totalCost || quote.quote_data.costBreakdown?.total || 'TBD'}
                        </p>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${getStatusColor(quote.status)}`}>
                          {quote.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Clock size={14} />
                          <span>{new Date(quote.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="View Details">
                            <ExternalLink size={18} />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Download PDF">
                            <FileText size={18} />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            <MoreVertical size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
