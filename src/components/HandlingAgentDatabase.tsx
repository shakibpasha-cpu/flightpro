import React, { useState, useEffect } from 'react';
import { Globe, Phone, Mail, DollarSign, Plus, Trash2, Edit2, Save, Loader2, Search, Building2, ExternalLink, Sparkles, X } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/errorService';
import { searchHandlingAgents, getAirportDetails } from '../services/aiService';
import { motion, AnimatePresence } from 'motion/react';

interface HandlingAgent {
  id?: string;
  icao: string;
  companyName: string;
  email: string;
  phone?: string;
  website?: string;
  baseFee: number;
  preferred?: boolean;
  additionalServices?: string;
  aircraftRates?: { aircraftType: string; fee: number }[];
}

export default function HandlingAgentDatabase() {
  const [agents, setAgents] = useState<HandlingAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [suggestedAgents, setSuggestedAgents] = useState<HandlingAgent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<HandlingAgent>({
    icao: '',
    companyName: '',
    email: '',
    phone: '',
    website: '',
    baseFee: 0,
    preferred: false,
    additionalServices: ''
  });

  const seedData = async () => {
    setLoading(true);
    const sampleAgents: HandlingAgent[] = [
      {
        icao: 'EGLL',
        companyName: 'Signature Flight Support LHR',
        email: 'lhr@signatureflight.com',
        phone: '+44 20 8759 7002',
        website: 'https://www.signatureflight.com',
        baseFee: 850,
        additionalServices: 'VIP Lounge, Fueling, Customs, Catering, Ground Transport'
      },
      {
        icao: 'KJFK',
        companyName: 'Sheltair JFK',
        email: 'jfk@sheltairaviation.com',
        phone: '+1 718-244-8800',
        website: 'https://www.sheltairaviation.com',
        baseFee: 950,
        additionalServices: 'Executive Terminal, Fueling, Hangarage, Catering'
      },
      {
        icao: 'OMDB',
        companyName: 'Jetex Dubai',
        email: 'fbo-dxb@jetex.com',
        phone: '+971 4 212 4900',
        website: 'https://www.jetex.com',
        baseFee: 1200,
        additionalServices: 'Luxury FBO, Concierge, Fueling, Ground Handling'
      },
      {
        icao: 'WSSS',
        companyName: 'Jet Aviation Singapore',
        email: 'sin@jetaviation.com',
        phone: '+65 6481 5311',
        website: 'https://www.jetaviation.com',
        baseFee: 900,
        additionalServices: 'Maintenance, FBO, Fueling, Catering'
      },
      {
        icao: 'LFPG',
        companyName: 'Universal Aviation Paris',
        email: 'france@universalaviation.aero',
        phone: '+33 1 48 35 96 38',
        website: 'https://www.universalaviation.aero',
        baseFee: 800,
        additionalServices: 'Ground Support, VIP Handling, Fueling'
      },
      {
        icao: 'VHHH',
        companyName: 'Hong Kong Business Aviation Centre',
        email: 'ops@hkbac.com',
        phone: '+852 2949 9000',
        website: 'https://www.hkbac.com',
        baseFee: 1500,
        additionalServices: 'VIP Terminal, Customs, Fueling, Hangarage'
      },
      {
        icao: 'LSZH',
        companyName: 'ExecuJet Zurich',
        email: 'fbo.lszh@execujet.eu',
        phone: '+41 44 876 5656',
        website: 'https://www.execujet.com',
        baseFee: 1100,
        additionalServices: 'FBO, Maintenance, Fueling, Catering'
      },
      {
        icao: 'KLAX',
        companyName: 'Atlantic Aviation LAX',
        email: 'lax@atlanticaviation.com',
        phone: '+1 310-258-9884',
        website: 'https://www.atlanticaviation.com',
        baseFee: 1000,
        additionalServices: 'Executive Terminal, Fueling, Ground Handling'
      },
      {
        icao: 'UUEE',
        companyName: 'A-Group Sheremetyevo',
        email: 'fbo@a-group.aero',
        phone: '+7 495 578 43 07',
        website: 'http://www.a-group.aero',
        baseFee: 1300,
        additionalServices: 'VIP Terminal, Customs, Fueling, Catering'
      },
      {
        icao: 'FACT',
        companyName: 'Signature Flight Support Cape Town',
        email: 'cpt@signatureflight.com',
        phone: '+27 21 934 0350',
        website: 'https://www.signatureflight.com',
        baseFee: 750,
        additionalServices: 'VIP Lounge, Fueling, Customs, Ground Transport'
      }
    ];

    try {
      for (const agent of sampleAgents) {
        await addDoc(collection(db, 'handling_agents'), agent);
      }
      fetchAgents();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'handling_agents');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'handling_agents'), orderBy('icao'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HandlingAgent));
      setAgents(Array.from(new Map(data.map(item => [item.id, item])).values()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'handling_agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'handling_agents', editingId), formData as any);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'handling_agents'), formData);
      }
      setFormData({ icao: '', companyName: '', email: '', phone: '', website: '', baseFee: 0, additionalServices: '', aircraftRates: [] });
      fetchAgents();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'handling_agents');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (agent: HandlingAgent) => {
    setEditingId(agent.id || null);
    setFormData({ ...agent, aircraftRates: agent.aircraftRates || [] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAISuggest = async () => {
    if (!formData.icao || formData.icao.length < 3) {
      alert('Please enter a valid ICAO code first.');
      return;
    }
    setSuggesting(true);
    setSuggestedAgents([]);
    try {
      // 1. Fetch airport details first to get name and city for better context
      const aptDetails = await getAirportDetails(formData.icao);
      
      // 2. Pass this context to the agent search
      const result = await searchHandlingAgents(
        formData.icao, 
        aptDetails?.name, 
        aptDetails?.city, 
        undefined, 
        true
      );
      
      if (result.agents && result.agents.length > 0) {
        setSuggestedAgents(result.agents.map((a: any) => ({ ...a, icao: formData.icao })));
      } else {
        alert('No handling agents found for this airport.');
      }
    } catch (error) {
      console.error('AI Suggestion Error:', error);
      alert('Failed to fetch AI suggestions.');
    } finally {
      setSuggesting(false);
    }
  };

  const handleEnrich = async (agent: HandlingAgent) => {
    if (!agent.id) return;
    setEnrichingId(agent.id);
    try {
      const { enrichHandlingAgent } = await import('../services/aiService');
      const enriched = await enrichHandlingAgent(agent);
      
      // Update in Firestore
      await updateDoc(doc(db, 'handling_agents', agent.id), enriched);
      
      // Update local state
      setAgents(agents.map(a => a.id === agent.id ? { ...enriched, id: agent.id } : a));
      
      alert(`Successfully enriched info for ${agent.companyName}!`);
    } catch (error) {
      console.error('Enrichment error:', error);
      alert('Failed to enrich agent information.');
    } finally {
      setEnrichingId(null);
    }
  };

  const handleTogglePreferred = async (agent: HandlingAgent) => {
    if (!agent.id) return;
    try {
      const newValue = !agent.preferred;
      await updateDoc(doc(db, 'handling_agents', agent.id), { preferred: newValue });
      setAgents(agents.map(a => a.id === agent.id ? { ...a, preferred: newValue } : a));
    } catch (error) {
      console.error('Toggle preferred error:', error);
    }
  };

  const handleSelectSuggested = (agent: HandlingAgent) => {
    setFormData({
      ...formData,
      companyName: agent.companyName,
      email: agent.email,
      phone: agent.phone || '',
      website: agent.website || '',
      baseFee: agent.baseFee,
      preferred: agent.preferred || false,
      additionalServices: agent.additionalServices,
      aircraftRates: agent.aircraftRates || []
    });
    setSuggestedAgents([]);
  };

  const handleAddAircraftRate = () => {
    setFormData({
      ...formData,
      aircraftRates: [...(formData.aircraftRates || []), { aircraftType: '', fee: 0 }]
    });
  };

  const handleRemoveAircraftRate = (index: number) => {
    const newRates = [...(formData.aircraftRates || [])];
    newRates.splice(index, 1);
    setFormData({ ...formData, aircraftRates: newRates });
  };

  const handleUpdateAircraftRate = (index: number, field: 'aircraftType' | 'fee', value: string | number) => {
    const newRates = [...(formData.aircraftRates || [])];
    newRates[index] = { ...newRates[index], [field]: value };
    setFormData({ ...formData, aircraftRates: newRates });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this handling agent?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'handling_agents', id));
      setAgents(agents.filter(a => a.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'handling_agents');
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(a => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (a.icao && a.icao.toLowerCase().includes(query)) ||
      (a.companyName && a.companyName.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={seedData}
            disabled={loading}
            className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition border border-indigo-100 dark:border-indigo-800 text-xs shadow-sm"
          >
            <Sparkles size={16} />
            Seed List
          </button>
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Handling Agents</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-tight">Manage ground handling providers and service costs per airport.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none md:w-64 group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 group-focus-within:scale-110 transition-transform">
              <Sparkles size={18} />
            </div>
            <input 
              type="text"
              placeholder="BULK FETCH BY ICAO (ENTER)"
              maxLength={4}
              disabled={bulkLoading}
              className="w-full pl-10 pr-24 py-3 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-900/30 rounded-2xl outline-none focus:border-indigo-500 transition-all font-black uppercase text-sm tracking-widest placeholder:text-gray-400 dark:text-white shadow-lg shadow-indigo-100/50 dark:shadow-none disabled:opacity-50"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                  if (val.length < 3) return;
                  
                  setBulkLoading(true);
                  try {
                    // 1. Get airport details first
                    const aptDetails = await getAirportDetails(val);
                    
                    // 2. Deep search
                    const result = await searchHandlingAgents(
                      val, 
                      aptDetails?.name, 
                      aptDetails?.city, 
                      undefined, 
                      true
                    );

                    if (result.agents && result.agents.length > 0) {
                      for (const agent of result.agents) {
                        const existingQuery = query(
                          collection(db, 'handling_agents'), 
                          where('icao', '==', val),
                          where('companyName', '==', agent.companyName)
                        );
                        const existingSnap = await getDocs(existingQuery);
                        
                        if (existingSnap.empty) {
                          await addDoc(collection(db, 'handling_agents'), {
                            icao: val,
                            companyName: agent.companyName,
                            email: agent.email || '',
                            phone: agent.phone || '',
                            website: agent.website || '',
                            baseFee: agent.baseFee || 0,
                            additionalServices: agent.additionalServices || '',
                            aircraftRates: agent.aircraftRates || []
                          });
                        }
                      }
                      await fetchAgents();
                      (e.target as HTMLInputElement).value = '';
                      alert(`Successfully imported ${result.agents.length} agent(s) for ${val}!`);
                    } else {
                      alert(`No agents found for ${val}.`);
                    }
                  } catch (err) {
                    console.error(err);
                    alert('Fetch failed. Please try again.');
                  } finally {
                    setBulkLoading(false);
                  }
                }
              }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {bulkLoading ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase">
                  <Loader2 className="animate-spin" size={10} />
                  Scraping...
                </div>
              ) : (
                <div className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm group-hover:scale-105 transition-transform">
                  Enter
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm sticky top-8">
            <h3 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
              <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" />
              {editingId ? 'Edit Agent' : 'Add New Agent'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Airport ICAO</label>
                  <button 
                    type="button"
                    onClick={handleAISuggest}
                    disabled={suggesting || !formData.icao}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50"
                  >
                    {suggesting ? <Loader2 className="animate-spin" size={10} /> : <Sparkles size={10} />}
                    AI Suggest
                  </button>
                </div>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. EGLL"
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm uppercase font-bold dark:text-white"
                  value={formData.icao || ''}
                  onChange={(e) => setFormData({ ...formData, icao: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Company Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Signature Flight Support"
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold dark:text-white"
                  value={formData.companyName || ''}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Email</label>
                  <input 
                    type="email" 
                    required
                    placeholder="ops@company.com"
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm dark:text-white"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Phone</label>
                  <input 
                    type="tel" 
                    placeholder="+44..."
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm dark:text-white"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Website</label>
                <input 
                  type="url" 
                  placeholder="https://..."
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm dark:text-white"
                  value={formData.website || ''}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Base Handling Fee (USD)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={16} />
                  <input 
                    type="number" 
                    required
                    className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold dark:text-white"
                    value={formData.baseFee ?? ''}
                    onChange={(e) => setFormData({ ...formData, baseFee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl">
                <input 
                  type="checkbox"
                  id="preferred"
                  className="w-4 h-4 text-indigo-600 rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                  checked={formData.preferred || false}
                  onChange={(e) => setFormData({ ...formData, preferred: e.target.checked })}
                />
                <label htmlFor="preferred" className="text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-2">
                  <Sparkles size={14} className={formData.preferred ? "text-amber-500" : "text-gray-400"} />
                  Preferred Handling Partner
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Additional Services/Notes</label>
                <textarea 
                  placeholder="VIP Lounge, Fueling, Catering..."
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm h-24 resize-none dark:text-white"
                  value={formData.additionalServices || ''}
                  onChange={(e) => setFormData({ ...formData, additionalServices: e.target.value })}
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Aircraft Specific Rates</label>
                  <button
                    type="button"
                    onClick={handleAddAircraftRate}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-bold flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Rate
                  </button>
                </div>
                
                {formData.aircraftRates?.map((rate, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="e.g. A320"
                      value={rate.aircraftType || ''}
                      onChange={(e) => handleUpdateAircraftRate(idx, 'aircraftType', e.target.value)}
                      className="flex-1 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                    />
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input
                        type="number"
                        placeholder="Fee"
                        value={rate.fee || ''}
                        onChange={(e) => handleUpdateAircraftRate(idx, 'fee', parseFloat(e.target.value) || 0)}
                        className="w-full pl-8 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAircraftRate(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                {editingId && (
                  <button 
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ icao: '', companyName: '', email: '', phone: '', website: '', baseFee: 0, additionalServices: '', aircraftRates: [] });
                    }}
                    className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
                  >
                    Cancel
                  </button>
                )}
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-100 dark:shadow-none text-sm"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : (editingId ? <Save size={18} /> : <Plus size={18} />)}
                  {editingId ? 'Update Agent' : 'Add Agent'}
                </button>
              </div>
            </form>

            {/* AI Suggested Agents */}
            <AnimatePresence>
              {suggestedAgents.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles size={12} />
                      AI Suggestions
                    </h4>
                    <button 
                      onClick={() => setSuggestedAgents([])}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {suggestedAgents.map((agent, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSuggested(agent)}
                        className="w-full text-left p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">{agent.companyName}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">${agent.baseFee} Base Fee</p>
                          </div>
                          <Plus size={14} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative mb-6">
            <Search className="absolute left-4 top-3.5 text-gray-400 dark:text-gray-500" size={20} />
            <input 
              type="text" 
              placeholder="Search by ICAO or Company Name..."
              className="w-full pl-12 pr-12 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl shadow-sm text-sm font-medium focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-3.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Clear search"
              >
                <X size={20} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredAgents.map((agent) => (
                <motion.div 
                  key={agent.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-100 dark:hover:border-indigo-500 transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xs relative">
                        {agent.icao}
                        {agent.preferred && (
                          <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white p-0.5 rounded-full shadow-sm">
                            <Sparkles size={10} fill="currentColor" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900 dark:text-white leading-tight">{agent.companyName}</h4>
                          {agent.preferred && <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-tighter bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">Preferred</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            ${agent.baseFee?.toLocaleString()} Base
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEnrich(agent)}
                        disabled={enrichingId === agent.id}
                        title="AI Enrich operational data"
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition"
                      >
                        {enrichingId === agent.id ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                      </button>
                      <button 
                        onClick={() => handleTogglePreferred(agent)}
                        title={agent.preferred ? "Remove preferred status" : "Mark as preferred partner"}
                        className={`p-2 rounded-lg transition ${agent.preferred ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'text-gray-400 dark:text-gray-500 hover:text-amber-500 hover:bg-amber-50'}`}
                      >
                        <Save size={16} />
                      </button>
                      <button 
                        onClick={() => handleEdit(agent)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => agent.id && handleDelete(agent.id)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Mail size={14} className="text-gray-400 dark:text-gray-500" />
                      <a href={`mailto:${agent.email}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">{agent.email}</a>
                    </div>
                    {agent.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Phone size={14} className="text-gray-400 dark:text-gray-500" />
                        <a href={`tel:${agent.phone}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">{agent.phone}</a>
                      </div>
                    )}
                    {agent.website && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Globe size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                        <a href={agent.website} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center gap-1 truncate">
                          {agent.website.replace(/^https?:\/\//, '')} <ExternalLink size={10} className="shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>

                  {agent.additionalServices && (
                    <div className="pt-4 border-t border-gray-50 dark:border-gray-700">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Services & Notes</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 italic leading-relaxed">
                        "{agent.additionalServices}"
                      </p>
                    </div>
                  )}

                  {agent.aircraftRates && agent.aircraftRates.length > 0 && (
                    <div className="pt-4 border-t border-gray-50 dark:border-gray-700">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Aircraft Rates</p>
                      <div className="grid grid-cols-2 gap-2">
                        {agent.aircraftRates.map((rate, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{rate.aircraftType}</span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">${rate.fee.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filteredAgents.length === 0 && !loading && (
            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
              <Building2 size={48} className="mx-auto text-gray-200 dark:text-gray-600 mb-4" />
              <p className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-xs">No handling agents found locally</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-2 mb-6">Try adjusting your search or add a new agent.</p>
              
              {searchQuery.trim().length >= 3 && searchQuery.trim().length <= 4 && (
                <button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      // 1. Get airport details first
                      const aptDetails = await getAirportDetails(searchQuery.trim().toUpperCase());
                      
                      // 2. Attempt a deep search (forceRefresh = true to bypass stale global contacts)
                      const result = await searchHandlingAgents(
                        searchQuery.trim().toUpperCase(), 
                        aptDetails?.name, 
                        aptDetails?.city, 
                        undefined, 
                        true
                      );
                      if (result.agents && result.agents.length > 0) {
                        // Persist these to the database
                        for (const agent of result.agents) {
                          await addDoc(collection(db, 'handling_agents'), {
                            icao: searchQuery.trim().toUpperCase(),
                            companyName: agent.companyName,
                            email: agent.email || '',
                            phone: agent.phone || '',
                            website: agent.website || '',
                            baseFee: agent.baseFee || 0,
                            additionalServices: agent.additionalServices || '',
                            aircraftRates: agent.aircraftRates || []
                          });
                        }
                        // Refresh the list
                        await fetchAgents();
                        setSearchQuery(''); 
                        alert(`Successfully added ${result.agents.length} handling agent(s) for ${searchQuery.trim().toUpperCase()}!`);
                      } else {
                        alert('No handling agents could be found using AI for this airport.');
                      }
                    } catch (error) {
                      console.error(error);
                      alert('An error occurred while exploring handling agents with AI.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="mx-auto bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-6 py-3 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition border border-indigo-100 dark:border-indigo-800/50 text-sm shadow-sm"
                >
                  <Sparkles size={16} />
                  Deep Search AI for "{searchQuery.trim().toUpperCase()}"
                </button>
              )}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
