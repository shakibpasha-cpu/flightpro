import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { Building2, Plus, Search, Globe, MapPin, Star, Trash2, Edit2, X, Loader2, Sparkles, Mail, CheckCircle2, XCircle, ShieldCheck, Phone, Link, Hash, Info, Calendar, Briefcase, Filter, ExternalLink, Plane, RefreshCw } from 'lucide-react';
import { operatorService, Operator } from '../services/operatorService';
import { safeStringify } from '../utils/safeJson';
import { getOperatorDetails } from '../services/aiService';

export default function OperatorDatabase() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [expandedFleetId, setExpandedFleetId] = useState<string | null>(null);
  const [operatorFleet, setOperatorFleet] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);

  const [formData, setFormData] = useState<Omit<Operator, 'id'>>({
    operator_name: '',
    country: '',
    base_airport: '',
    contact_email: '',
    acmi_available: true,
    rating: 50,
    icao_code: '',
    iata_code: '',
    callsign: '',
    aoc_number: '',
    operation_type: 'Charter',
    status: 'Active',
    website: '',
    phone: '',
    founded_year: new Date().getFullYear(),
    fleet_size: 0,
    fleet_quantity: 0,
    avg_fleet_age: 0,
    aircraft_types_operated: [],
    lastContacted: '',
    manual_notes: ''
  });

  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterType, setFilterType] = useState<string>('All');
  const [isEnriching, setIsEnriching] = useState(false);
  const [isBulkEnriching, setIsBulkEnriching] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState({ total: 0, current: 0 });

  useEffect(() => {
    setLoading(true);
    const unsubscribe = operatorService.subscribeToOperators((data) => {
      setOperators(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAIEnrich = async () => {
    if (!formData.operator_name) return;
    setIsEnriching(true);
    try {
      const details = await getOperatorDetails(formData.operator_name, formData.country);
      if (details) {
        setFormData(prev => ({
          ...prev,
          website: details.website || prev.website,
          contact_email: details.email || prev.contact_email,
          phone: details.phone || prev.phone,
          icao_code: details.icao_code || prev.icao_code,
          iata_code: details.iata_code || prev.iata_code,
          manual_notes: details.summary || prev.manual_notes,
          fleet_quantity: details.fleet_quantity || prev.fleet_quantity,
          avg_fleet_age: details.avg_fleet_age || prev.avg_fleet_age,
          aircraft_types_operated: details.aircraft_types_operated || prev.aircraft_types_operated
        }));
      }
    } catch (error) {
      console.error("AI Enrichment failed:", error);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleBulkEnrich = async () => {
    const targets = operators.filter(op => !op.website || !op.contact_email);
    if (targets.length === 0) {
      alert("No operators with missing website/email found.");
      return;
    }

    if (!window.confirm(`Found ${targets.length} operators with missing data. Start AI enrichment? This may take a while.`)) return;

    setIsBulkEnriching(true);
    setEnrichStatus({ total: targets.length, current: 0 });

    for (const op of targets) {
      if (!op.id) continue;
      try {
        const details = await getOperatorDetails(op.operator_name, op.country);
        if (details) {
          await operatorService.updateOperator(op.id, {
            website: op.website || details.website || '',
            contact_email: op.contact_email || details.email || '',
            phone: op.phone || details.phone || '',
            icao_code: op.icao_code || details.icao_code || '',
            iata_code: op.iata_code || details.iata_code || '',
            general_notes: details.summary || op.general_notes || '',
            fleet_quantity: op.fleet_quantity || details.fleet_quantity || 0,
            avg_fleet_age: op.avg_fleet_age || details.avg_fleet_age || 0,
            aircraft_types_operated: op.aircraft_types_operated || details.aircraft_types_operated || [],
            last_enriched: new Date().toISOString()
          });
        }
        setEnrichStatus(prev => ({ ...prev, current: prev.current + 1 }));
        // Small delay to avoid hammering the AI/Network
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to enrich ${op.operator_name}:`, error);
      }
    }

    setIsBulkEnriching(false);
    alert("Bulk enrichment complete!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingOperator?.id) {
        await operatorService.updateOperator(editingOperator.id, formData);
      } else {
        await operatorService.addOperator(formData);
      }
      setIsModalOpen(false);
      setEditingOperator(null);
      setFormData({
        operator_name: '',
        country: '',
        base_airport: '',
        contact_email: '',
        acmi_available: true,
        rating: 50,
        icao_code: '',
        iata_code: '',
        callsign: '',
        aoc_number: '',
        operation_type: 'Charter',
        status: 'Active',
        website: '',
        phone: '',
        founded_year: new Date().getFullYear(),
        fleet_size: 0,
        fleet_quantity: 0,
        avg_fleet_age: 0,
        aircraft_types_operated: [],
        lastContacted: '',
        manual_notes: ''
      });
    } catch (error) {
      console.error("Error saving operator:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this operator?')) return;
    setLoading(true);
    try {
      await operatorService.deleteOperator(id);
    } catch (error) {
      console.error("Error deleting operator:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeFleet = async (airlineName: string, id: string, website?: string) => {
    let targetUrl = website;
    if (!targetUrl) {
      const input = window.prompt(`Enter website URL for ${airlineName} (leave blank for Wikipedia):`);
      if (input === null) return; // Cancelled
      targetUrl = input || undefined;
    }

    setScrapingId(id);
    try {
      const { fleetSeederService } = await import('../services/fleetSeederService');
      await fleetSeederService.scrapeAndSeedFleet(airlineName, targetUrl);
      alert(`Fleet data for ${airlineName} updated successfully!`);
    } catch (error) {
      console.error("Error scraping fleet:", error);
      alert(`Failed to scrape fleet for ${airlineName}`);
    } finally {
      setScrapingId(null);
    }
  };

  const handleEnrichOperator = async (airlineName: string, id: string, country?: string) => {
    setScrapingId(id);
    try {
      const response = await fetch('/api/enrich-operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({ operatorName: airlineName, country })
      });

      if (response.ok) {
        const enrichedData = await response.json();
        const { doc, updateDoc } = await import('firebase/firestore');
        const opDocRef = doc(db, 'operators', id);
        await updateDoc(opDocRef, {
          website: enrichedData.website || '',
          contact_email: enrichedData.contact_email || '',
          phone: enrichedData.phone || '',
          address: enrichedData.address || '',
          general_notes: enrichedData.general_notes || '',
          last_enriched: new Date().toISOString()
        });
        alert(`Contact info for ${airlineName} updated successfully!`);
      } else {
        alert(`Failed to enrich ${airlineName}`);
      }
    } catch (error) {
      console.error("Error enriching operator:", error);
      alert(`Failed to enrich ${airlineName}`);
    } finally {
      setScrapingId(null);
    }
  };

  const handleViewFleet = async (id: string) => {
    if (expandedFleetId === id) {
      setExpandedFleetId(null);
      return;
    }
    
    try {
      const { query, collection, where, getDocs } = await import('firebase/firestore');
      const fleetQuery = query(collection(db, 'aircraft_fleet'), where('operator_id', '==', id));
      const snapshot = await getDocs(fleetQuery);
      setOperatorFleet(snapshot.docs.map(doc => doc.data()));
      setExpandedFleetId(id);
    } catch (error) {
      console.error("Error fetching fleet:", error);
    }
  };

  const filteredOperators = operators.filter(op => {
    const matchesSearch = op.operator_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.base_airport.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.icao_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.iata_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'All' || op.status === filterStatus;
    const matchesType = filterType === 'All' || op.operation_type === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Operator Database</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage global ACMI operators and their core contact details.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleBulkEnrich}
            disabled={isBulkEnriching}
            className="bg-amber-100 text-amber-700 px-6 py-3 rounded-2xl font-bold hover:bg-amber-200 transition flex items-center gap-2 border border-amber-200 disabled:opacity-50"
          >
            {isBulkEnriching ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
            {isBulkEnriching ? `Enriching (${enrichStatus.current}/${enrichStatus.total})` : 'Bulk AI Enrich'}
          </button>
          <button 
            onClick={() => {
            setEditingOperator(null);
            setFormData({
              operator_name: '',
              country: '',
              base_airport: '',
              contact_email: '',
              acmi_available: true,
              rating: 50
            });
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <Plus size={20} />
          Add Operator
        </button>
      </div>
    </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, country, ICAO, or IATA..."
            className="w-full pl-12 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="pl-9 pr-4 py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-sm font-bold appearance-none min-w-[140px]"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="pl-9 pr-4 py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-sm font-bold appearance-none min-w-[140px]"
            >
              <option value="All">All Types</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Charter">Charter</option>
              <option value="Cargo">Cargo</option>
              <option value="Helicopter">Helicopter</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && operators.length === 0 ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
          </div>
        ) : filteredOperators.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-gray-800 p-12 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 text-center">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Operators Found</h3>
            <p className="text-sm text-gray-500">The database is currently empty or no results match your search.</p>
          </div>
        ) : (
          filteredOperators.map((op) => (
            <div key={op.id} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition">{op.operator_name}</h3>
                    <div className="flex items-center gap-2">
                      <Globe size={12} className="text-gray-400" />
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{op.country}</span>
                      {op.icao_code && (
                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-black text-gray-600 dark:text-gray-400">{op.icao_code}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setEditingOperator(op);
                        setFormData({
                          operator_name: op.operator_name,
                          country: op.country,
                          base_airport: op.base_airport,
                          contact_email: op.contact_email,
                          acmi_available: op.acmi_available,
                          rating: op.rating || 50,
                          icao_code: op.icao_code || '',
                          iata_code: op.iata_code || '',
                          callsign: op.callsign || '',
                          aoc_number: op.aoc_number || '',
                          operation_type: op.operation_type || 'Charter',
                          status: op.status || 'Active',
                          website: op.website || '',
                          phone: op.phone || '',
                          founded_year: op.founded_year || new Date().getFullYear(),
                          fleet_size: op.fleet_size || 0,
                          fleet_quantity: op.fleet_quantity || 0,
                          avg_fleet_age: op.avg_fleet_age || 0,
                          aircraft_types_operated: op.aircraft_types_operated || [],
                          lastContacted: op.lastContacted || '',
                          manual_notes: op.manual_notes || ''
                        });
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => op.id && handleDelete(op.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      onClick={() => op.id && handleScrapeFleet(op.operator_name, op.id, op.website)}
                      disabled={scrapingId === op.id}
                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition disabled:opacity-50"
                      title="Scrape Fleet Data"
                    >
                      {scrapingId === op.id ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    </button>
                    <button 
                      onClick={() => op.id && handleEnrichOperator(op.operator_name, op.id, op.country)}
                      disabled={scrapingId === op.id}
                      className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition disabled:opacity-50"
                      title="Enrich Contact Info"
                    >
                      {scrapingId === op.id ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                    op.status === 'Active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                    op.status === 'Suspended' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' :
                    'bg-amber-50 text-amber-600 dark:bg-amber-900/20'
                  }`}>
                    {op.status || 'Active'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Base Airport</p>
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-indigo-500" />
                    <span className="text-xs font-black text-gray-900 dark:text-white">{op.base_airport}</span>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Fleet Summary</p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Plane size={12} className="text-blue-500" />
                      <span className="text-xs font-black text-gray-900 dark:text-white">{op.fleet_size || 0} AC</span>
                      {op.avg_fleet_age > 0 && (
                        <span className="text-[10px] text-gray-500 font-bold ml-1">ø {op.avg_fleet_age}y</span>
                      )}
                    </div>
                    {op.aircraft_types_operated && op.aircraft_types_operated.length > 0 && (
                      <p className="text-[9px] text-gray-400 font-bold uppercase truncate max-w-[120px]">
                        {op.aircraft_types_operated.join(', ')}
                      </p>
                    )}
                  </div>
                  {op.last_fleet_update && (
                    <span className="text-[8px] text-gray-400 font-bold uppercase mt-1 block">Updated {new Date(op.last_fleet_update).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 font-bold uppercase">Operation</span>
                  <span className="text-gray-900 dark:text-white font-black">{op.operation_type || 'Charter'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 font-bold uppercase">Callsign</span>
                  <span className="text-gray-900 dark:text-white font-black italic">"{op.callsign || 'N/A'}"</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 font-bold uppercase">AOC #</span>
                  <span className="text-gray-900 dark:text-white font-black">{op.aoc_number || 'N/A'}</span>
                </div>
                {op.founded_year && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500 font-bold uppercase">Founded</span>
                    <span className="text-gray-900 dark:text-white font-black">{op.founded_year}</span>
                  </div>
                )}
                {op.lastContacted && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500 font-bold uppercase">Last Contact</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-black">{op.lastContacted}</span>
                  </div>
                )}
                {op.manual_notes && (
                  <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center gap-1 mb-1">
                      <Info size={10} className="text-amber-600" />
                      <span className="text-[9px] font-black text-amber-600 uppercase">Internal Notes</span>
                    </div>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 line-clamp-2 italic">{op.manual_notes}</p>
                  </div>
                )}
                {op.general_notes && (
                  <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center gap-1 mb-1">
                      <Sparkles size={10} className="text-indigo-600" />
                      <span className="text-[9px] font-black text-indigo-600 uppercase">AI Intelligence</span>
                    </div>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 line-clamp-3 italic">{op.general_notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
                <div className="flex items-center gap-3">
                  <a href={`mailto:${op.contact_email}`} className="flex-1 flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group/link">
                    <Mail size={14} className="text-gray-400 group-hover/link:text-indigo-500" />
                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 truncate">{op.contact_email}</span>
                  </a>
                  {op.website && (
                    <a href={op.website.startsWith('http') ? op.website : `https://${op.website}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-gray-400 hover:text-indigo-500">
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {op.phone && (
                    <a href={`tel:${op.phone}`} className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-gray-400 hover:text-indigo-500">
                      <Phone size={14} />
                    </a>
                  )}
                </div>

                {expandedFleetId === op.id && (
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fleet Breakdown</h4>
                      <button onClick={() => setExpandedFleetId(null)} className="text-[10px] font-bold text-indigo-600 uppercase">Close</button>
                    </div>
                    {operatorFleet.length === 0 ? (
                      <p className="text-[10px] text-gray-500 italic">No detailed fleet data available. Try scraping.</p>
                    ) : (
                      <div className="space-y-2">
                        {operatorFleet.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div>
                              <p className="font-black text-gray-900 dark:text-white">{item.aircraft_type}</p>
                              <p className="text-[9px] text-gray-500 font-bold uppercase">Age: {item.avg_age || 'N/A'}y</p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-indigo-600">{item.quantity} AC</p>
                              {item.orders > 0 && <p className="text-[9px] text-emerald-600 font-bold uppercase">+{item.orders} Orders</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Star size={14} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-black text-gray-900 dark:text-white">{op.rating || 0}%</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">Rating</span>
                  </div>
                  <button 
                    onClick={() => op.id && handleViewFleet(op.id)}
                    className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                  >
                    {expandedFleetId === op.id ? 'Hide Fleet' : 'View Fleet'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    {editingOperator ? 'Edit Operator' : 'Add New Operator'}
                  </h3>
                  <p className="text-sm text-gray-500">Enter the core details for the ACMI operator.</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Operator Name</label>
                      <button
                        type="button"
                        onClick={handleAIEnrich}
                        disabled={isEnriching || !formData.operator_name}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-all"
                      >
                        {isEnriching ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                        AI Enrich
                      </button>
                    </div>
                    <input
                      required
                      type="text"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      value={formData.operator_name}
                      onChange={e => setFormData({ ...formData, operator_name: e.target.value })}
                      placeholder="e.g. Emirates"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Status</label>
                    <select
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold"
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">ICAO</label>
                    <input
                      type="text"
                      maxLength={3}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white uppercase"
                      value={formData.icao_code}
                      onChange={e => setFormData({ ...formData, icao_code: e.target.value.toUpperCase() })}
                      placeholder="UAE"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">IATA</label>
                    <input
                      type="text"
                      maxLength={2}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white uppercase"
                      value={formData.iata_code}
                      onChange={e => setFormData({ ...formData, iata_code: e.target.value.toUpperCase() })}
                      placeholder="EK"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Callsign</label>
                    <input
                      type="text"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white uppercase"
                      value={formData.callsign}
                      onChange={e => setFormData({ ...formData, callsign: e.target.value.toUpperCase() })}
                      placeholder="EMIRATES"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Country</label>
                    <input
                      required
                      type="text"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      value={formData.country}
                      onChange={e => setFormData({ ...formData, country: e.target.value })}
                      placeholder="e.g. UAE"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Base Airport (ICAO)</label>
                    <input
                      required
                      type="text"
                      maxLength={4}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white uppercase"
                      value={formData.base_airport}
                      onChange={e => setFormData({ ...formData, base_airport: e.target.value.toUpperCase() })}
                      placeholder="e.g. OMDB"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Operation Type</label>
                    <select
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold"
                      value={formData.operation_type}
                      onChange={e => setFormData({ ...formData, operation_type: e.target.value as any })}
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Charter">Charter</option>
                      <option value="Cargo">Cargo</option>
                      <option value="Helicopter">Helicopter</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">AOC Number</label>
                    <input
                      type="text"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      value={formData.aoc_number}
                      onChange={e => setFormData({ ...formData, aoc_number: e.target.value })}
                      placeholder="AOC-12345"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Contact Email</label>
                    <input
                      required
                      type="email"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      value={formData.contact_email}
                      onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                      placeholder="ops@operator.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Phone</label>
                    <input
                      type="tel"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+971 4 123 4567"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Website</label>
                    <input
                      type="text"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      value={formData.website}
                      onChange={e => setFormData({ ...formData, website: e.target.value })}
                      placeholder="www.emirates.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Fleet Quantity</label>
                    <input
                      type="number"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      value={formData.fleet_quantity}
                      onChange={e => setFormData({ ...formData, fleet_quantity: parseInt(e.target.value) || 0, fleet_size: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Avg. Fleet Age (Y)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      value={formData.avg_fleet_age}
                      onChange={e => setFormData({ ...formData, avg_fleet_age: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Aircraft Types Operated (Comma Separated)</label>
                  <input
                    type="text"
                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                    value={formData.aircraft_types_operated?.join(', ')}
                    onChange={e => setFormData({ ...formData, aircraft_types_operated: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') })}
                    placeholder="e.g. A320, B737, A350"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Last Contacted</label>
                    <input
                      type="date"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                      value={formData.lastContacted}
                      onChange={e => setFormData({ ...formData, lastContacted: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Manual Notes</label>
                  <textarea
                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white min-h-[80px]"
                    value={formData.manual_notes}
                    onChange={e => setFormData({ ...formData, manual_notes: e.target.value })}
                    placeholder="Internal notes about the operator..."
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">ACMI Availability</p>
                      <p className="text-[10px] text-gray-500 font-medium">Is this operator currently offering ACMI?</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, acmi_available: !formData.acmi_available })}
                    className={`w-14 h-8 rounded-full transition-colors relative ${formData.acmi_available ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${formData.acmi_available ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Operator Rating</label>
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{formData.rating}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    value={formData.rating}
                    onChange={e => setFormData({ ...formData, rating: parseInt(e.target.value) })}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={18} className="animate-spin" />}
                    {editingOperator ? 'Update Operator' : 'Create Operator'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
