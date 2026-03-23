import React, { useState, useEffect } from 'react';
import { Search, Globe, Shield, DollarSign, Loader2, Plus, Trash2, Edit2, Check, X, AlertTriangle, Sparkles, Phone, FileText, Link as LinkIcon, Mail, MapPin } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, query, getDocs, deleteDoc, doc, updateDoc, limit, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { getFIRDetails, fetchSpecificCharge, fetchFIRRules } from '../services/aiService';

interface FIR {
  id?: string;
  code: string;
  name: string;
  country: string;
  overflightCharge: number;
  navigationCharge: number;
  rules: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  sop?: string;
  documentationUrl?: string;
}

export default function FIRDatabase() {
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FIR>({
    code: '',
    name: '',
    country: '',
    overflightCharge: 0,
    navigationCharge: 0,
    rules: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    sop: '',
    documentationUrl: ''
  });

  const fetchFirs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'firs'), limit(50));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FIR));
      setFirs(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'firs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFirs();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let currentData = { ...formData };
    let error = validateForm(currentData);
    
    // Automatically attempt to fetch missing details via AI if contact info is missing
    if (error && error.includes("contact method")) {
      setLoading(true);
      try {
        const details = await getFIRDetails(currentData.code, currentData.name);
        currentData = { ...currentData, ...details };
        error = validateForm(currentData); // Re-validate after AI fetch
      } catch (err) {
        console.error("Auto-enrichment failed:", err);
      }
    }

    if (error) {
      setValidationError(error);
      setLoading(false);
      return;
    }
    
    setValidationError(null);
    setLoading(true);
    try {
      await addDoc(collection(db, 'firs'), {
        ...currentData,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setFormData({ 
        code: '', 
        name: '', 
        country: '', 
        overflightCharge: 0, 
        navigationCharge: 0, 
        rules: '', 
        address: '',
        phone: '', 
        email: '', 
        website: '', 
        sop: '', 
        documentationUrl: '' 
      });
      fetchFirs();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'firs');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    let currentData = { ...formData };
    let error = validateForm(currentData);
    
    // Automatically attempt to fetch missing details via AI if contact info is missing
    if (error && error.includes("contact method")) {
      setLoading(true);
      try {
        const details = await getFIRDetails(currentData.code, currentData.name);
        currentData = { ...currentData, ...details };
        error = validateForm(currentData); // Re-validate after AI fetch
      } catch (err) {
        console.error("Auto-enrichment failed:", err);
      }
    }

    if (error) {
      setValidationError(error);
      setLoading(false);
      return;
    }

    setValidationError(null);
    setLoading(true);
    try {
      const firDoc = doc(db, 'firs', id);
      await updateDoc(firDoc, { ...currentData });
      setEditingId(null);
      fetchFirs();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'firs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this FIR?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'firs', id));
      fetchFirs();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'firs');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (fir: FIR) => {
    setEditingId(fir.id!);
    setFormData(fir);
    setValidationError(null);
  };

  const validateForm = (data: FIR) => {
    if (!data.code.trim()) return "FIR Code is required.";
    if (!data.name.trim()) return "FIR Name is required.";
    if (!data.country.trim()) return "Country is required.";
    if (!data.phone?.trim() && !data.email?.trim() && !data.website?.trim()) {
      return "At least one contact method (Phone, Email, or Website) is required.";
    }
    return null;
  };

  const fetchChargeAI = async (fir: FIR, chargeType: 'overflight' | 'navigation') => {
    setLoading(true);
    setValidationError(null);
    try {
      const charge = await fetchSpecificCharge(fir.code, fir.name, chargeType);
      if (fir.id) {
        const firDoc = doc(db, 'firs', fir.id);
        await updateDoc(firDoc, { [`${chargeType}Charge`]: charge });
        fetchFirs();
      } else {
        setFormData({ ...formData, [`${chargeType}Charge`]: charge });
      }
    } catch (error) {
      console.error(`AI Fetch error for ${chargeType} charge:`, error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRulesAI = async (fir: FIR) => {
    setLoading(true);
    setValidationError(null);
    try {
      const rules = await fetchFIRRules(fir.code, fir.name);
      if (fir.id) {
        const firDoc = doc(db, 'firs', fir.id);
        await updateDoc(firDoc, { rules });
        fetchFirs();
      } else {
        setFormData({ ...formData, rules });
      }
    } catch (error) {
      console.error(`AI Fetch error for rules:`, error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInfo = async (fir: FIR) => {
    setLoading(true);
    setValidationError(null);
    try {
      const details = await getFIRDetails(fir.code, fir.name);
      if (fir.id) {
        const firDoc = doc(db, 'firs', fir.id);
        await updateDoc(firDoc, { ...details });
        fetchFirs();
      } else {
        setFormData({ ...formData, ...details });
      }
    } catch (error) {
      console.error('AI Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const bulkEnrich = async () => {
    if (!confirm('This will use AI to enrich all FIRs missing contact details, SOPs, or charges. This may take some time. Continue?')) return;
    setLoading(true);
    try {
      for (const fir of firs) {
        // Enrich if missing ANY of the key details
        if (!fir.phone || !fir.email || !fir.website || !fir.sop || !fir.overflightCharge || !fir.navigationCharge) {
          const details = await getFIRDetails(fir.code, fir.name);
          const firDoc = doc(db, 'firs', fir.id!);
          await updateDoc(firDoc, { ...details });
        }
      }
      fetchFirs();
    } catch (error) {
      console.error('Bulk enrichment error:', error);
    } finally {
      setLoading(false);
    }
  };

  const seedData = async () => {
    setLoading(true);
    const sampleFirs = [
      { 
        code: 'OPLR', 
        name: 'Lahore FIR', 
        country: 'Pakistan', 
        overflightCharge: 150, 
        navigationCharge: 50, 
        rules: 'Standard ICAO procedures apply. Prior notification required for non-scheduled flights.',
        phone: '+92 21 99071111',
        email: 'info@caapakistan.com.pk',
        website: 'https://www.caapakistan.com.pk/',
        sop: '1. File flight plan 24h in advance.\n2. Maintain contact with Lahore Control on 124.7 MHz.',
        documentationUrl: 'https://www.caapakistan.com.pk/'
      },
      { 
        code: 'OPKR', 
        name: 'Karachi FIR', 
        country: 'Pakistan', 
        overflightCharge: 155, 
        navigationCharge: 55, 
        rules: 'Oceanic procedures in effect for southern sectors.',
        phone: '+92 21 99248761',
        email: 'info@caapakistan.com.pk',
        website: 'https://www.caapakistan.com.pk/',
        sop: 'ADS-C/CPDLC required for oceanic sectors.',
        documentationUrl: 'https://www.caapakistan.com.pk/'
      },
      { code: 'VIDP', name: 'Delhi FIR', country: 'India', overflightCharge: 200, navigationCharge: 80, rules: 'Strict adherence to assigned levels. RVSM airspace.' },
      { code: 'VOMF', name: 'Chennai FIR', country: 'India', overflightCharge: 190, navigationCharge: 75, rules: 'Major oceanic gateway. CPDLC preferred.' },
      { code: 'OEJD', name: 'Jeddah FIR', country: 'Saudi Arabia', overflightCharge: 250, navigationCharge: 100, rules: 'Hajj season restrictions apply. High density traffic.' },
      { code: 'OMAE', name: 'Emirates FIR', country: 'UAE', overflightCharge: 180, navigationCharge: 90, rules: 'Complex airspace structure. Precise navigation required.' },
      { code: 'EGTT', name: 'London FIR', country: 'United Kingdom', overflightCharge: 300, navigationCharge: 150, rules: 'Eurocontrol managed. Strict slot adherence.' },
      { code: 'KZNY', name: 'New York FIR', country: 'USA', overflightCharge: 220, navigationCharge: 110, rules: 'North Atlantic Tracks (NAT) gateway.' }
    ];

    try {
      for (const fir of sampleFirs) {
        const q = query(collection(db, 'firs'), where('code', '==', fir.code));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          await addDoc(collection(db, 'firs'), { ...fir, createdAt: new Date().toISOString() });
        }
      }
      fetchFirs();
    } catch (error) {
      console.error('Seeding error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFirs = firs.filter(fir => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      fir.code.toLowerCase().includes(query) ||
      fir.name.toLowerCase().includes(query) ||
      fir.country.toLowerCase().includes(query);
      
    const matchesCountry = countryFilter === 'All' || fir.country === countryFilter;
    
    return matchesSearch && matchesCountry;
  });

  const uniqueCountries = Array.from(new Set(firs.map(f => f.country))).sort();

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Globe className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h2 className="font-bold text-gray-800 dark:text-white">Airspace & FIR Database</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={bulkEnrich}
              disabled={loading || firs.length === 0}
              className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={14} /> Bulk Enrich via AI
            </button>
            <button
              onClick={seedData}
              disabled={loading}
              className="text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center gap-2"
            >
              <Plus size={14} /> Seed Sample Data
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <Plus size={14} /> Add New FIR
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={20} />
            <input 
              type="text" 
              placeholder="Search by Code, Name, or Country..." 
              className="w-full pl-10 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition dark:text-white font-bold text-sm md:w-64"
          >
            <option value="All">All Countries</option>
            {uniqueCountries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border-2 border-indigo-500/50">
            <div className="md:col-span-3 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white">Add New FIR Entry</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fetchAIInfo(formData)}
                  disabled={loading || !formData.code}
                  className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Sparkles size={12} /> Auto-fill via AI
                </button>
                <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
            </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {validationError && (
              <div className="md:col-span-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold">
                <AlertTriangle size={14} />
                {validationError}
              </div>
            )}
            <input 
              type="text" placeholder="FIR Code (e.g. OPLR)" required
              className="p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white"
              value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
            />
            <input 
              type="text" placeholder="FIR Name" required
              className="p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
            />
            <input 
              type="text" placeholder="Country" required
              className="p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white"
              value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})}
            />
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="relative flex items-end gap-2">
                <div className="flex-1 relative">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Overflight Charge (USD)</p>
                  <DollarSign className="absolute left-2 top-8 text-gray-400" size={16} />
                  <input 
                    type="number" placeholder="0.00" required
                    className="w-full pl-8 p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white"
                    value={formData.overflightCharge} onChange={e => setFormData({...formData, overflightCharge: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchChargeAI(formData, 'overflight')}
                  disabled={loading || !formData.code}
                  className="h-10 text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center justify-center gap-1 disabled:opacity-50"
                  title="Fetch Overflight Charge"
                >
                  <Sparkles size={14} /> AI
                </button>
              </div>
              <div className="relative flex items-end gap-2">
                <div className="flex-1 relative">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Navigation Charge (USD)</p>
                  <DollarSign className="absolute left-2 top-8 text-gray-400" size={16} />
                  <input 
                    type="number" placeholder="0.00" required
                    className="w-full pl-8 p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white"
                    value={formData.navigationCharge} onChange={e => setFormData({...formData, navigationCharge: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchChargeAI(formData, 'navigation')}
                  disabled={loading || !formData.code}
                  className="h-10 text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center justify-center gap-1 disabled:opacity-50"
                  title="Fetch Navigation Charge"
                >
                  <Sparkles size={14} /> AI
                </button>
              </div>
            </div>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" placeholder="Authority Address"
                className="p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white"
                value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}
              />
              <input 
                type="text" placeholder="Authority Phone"
                className="p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white"
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
              />
              <input 
                type="email" placeholder="Authority Email"
                className="p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white"
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
              />
              <input 
                type="url" placeholder="Authority Website"
                className="p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white"
                value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})}
              />
            </div>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <textarea 
                placeholder="Standard Operating Procedures (SOP)" className="p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white min-h-[80px]"
                value={formData.sop} onChange={e => setFormData({...formData, sop: e.target.value})}
              />
              <div className="relative flex items-start gap-2">
                <textarea 
                  placeholder="Operational Rules & Restrictions" className="w-full p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white min-h-[80px]"
                  value={formData.rules} onChange={e => setFormData({...formData, rules: e.target.value})}
                />
                <button
                  type="button"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const rules = await fetchFIRRules(formData.code, formData.name);
                      setFormData({ ...formData, rules });
                    } catch (error) {
                      console.error(error);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !formData.code}
                  className="p-2 mt-1 text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition flex items-center justify-center disabled:opacity-50"
                  title="Fetch Rules via AI"
                >
                  <Sparkles size={16} />
                </button>
              </div>
            </div>
            <input 
              type="url" placeholder="Official Documentation Link (AIP/Charts)"
              className="md:col-span-3 p-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white"
              value={formData.documentationUrl} onChange={e => setFormData({...formData, documentationUrl: e.target.value})}
            />
            <div className="md:col-span-3 flex justify-between items-center">
              <button 
                type="button"
                onClick={() => fetchAIInfo(formData)}
                disabled={!formData.code || loading}
                className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center gap-2 disabled:opacity-50"
              >
                <Sparkles size={14} /> Auto-Populate details via AI
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-500 font-bold">Cancel</button>
                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700">Save FIR</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFirs.map((fir) => (
          <div key={fir.id} className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-500 transition group relative">
            {editingId === fir.id ? (
              <div className="space-y-4">
                {validationError && (
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-[10px] font-bold">
                    <AlertTriangle size={12} />
                    {validationError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" className="p-1.5 text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:text-white"
                    placeholder="Code"
                    value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  />
                  <input 
                    type="text" className="p-1.5 text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:text-white"
                    placeholder="Name"
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative flex items-center gap-1">
                      <div className="flex-1 relative">
                        <DollarSign className="absolute left-1.5 top-2 text-gray-400" size={12} />
                        <input 
                          type="number" className="w-full pl-5 p-1.5 text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:text-white"
                          placeholder="Overflight"
                          value={formData.overflightCharge} onChange={e => setFormData({...formData, overflightCharge: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchChargeAI(formData, 'overflight')}
                        disabled={loading}
                        className="p-1.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-100 transition flex items-center justify-center disabled:opacity-50"
                        title="Fetch Overflight Charge"
                      >
                        <Sparkles size={12} />
                      </button>
                    </div>
                    <div className="relative flex items-center gap-1">
                      <div className="flex-1 relative">
                        <DollarSign className="absolute left-1.5 top-2 text-gray-400" size={12} />
                        <input 
                          type="number" className="w-full pl-5 p-1.5 text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:text-white"
                          placeholder="Navigation"
                          value={formData.navigationCharge} onChange={e => setFormData({...formData, navigationCharge: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchChargeAI(formData, 'navigation')}
                        disabled={loading}
                        className="p-1.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-100 transition flex items-center justify-center disabled:opacity-50"
                        title="Fetch Navigation Charge"
                      >
                        <Sparkles size={12} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="relative flex items-start gap-1">
                  <textarea 
                    className="w-full p-1.5 text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:text-white min-h-[60px]"
                    placeholder="Rules"
                    value={formData.rules} onChange={e => setFormData({...formData, rules: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const rules = await fetchFIRRules(formData.code, formData.name);
                        setFormData({ ...formData, rules });
                      } catch (error) {
                        console.error(error);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="p-1.5 mt-1 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 transition flex items-center justify-center disabled:opacity-50"
                    title="Fetch Rules via AI"
                  >
                    <Sparkles size={12} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" className="p-1.5 text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:text-white"
                    placeholder="Address"
                    value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                  <input 
                    type="text" className="p-1.5 text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:text-white"
                    placeholder="Phone"
                    value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="email" className="p-1.5 text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:text-white"
                    placeholder="Email"
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                  <input 
                    type="url" className="p-1.5 text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:text-white"
                    placeholder="Website"
                    value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})}
                  />
                </div>
                <textarea 
                  className="w-full p-1.5 text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:text-white min-h-[60px]"
                  placeholder="SOP"
                  value={formData.sop} onChange={e => setFormData({...formData, sop: e.target.value})}
                />
                <input 
                  type="url" className="w-full p-1.5 text-xs border rounded bg-gray-50 dark:bg-gray-900 dark:text-white"
                  placeholder="Documentation URL"
                  value={formData.documentationUrl} onChange={e => setFormData({...formData, documentationUrl: e.target.value})}
                />
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fetchAIInfo(formData)}
                      disabled={loading}
                      className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Sparkles size={10} /> Auto-fill AI
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                    <button onClick={() => handleUpdate(fir.id!)} className="p-1.5 text-emerald-600 hover:text-emerald-700"><Check size={16} /></button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 dark:text-white">{fir.name}</h3>
                      <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{fir.code}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mt-1">{fir.country}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => fetchAIInfo(fir)} 
                      disabled={loading}
                      title="Refresh details via AI"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 transition disabled:opacity-50"
                    >
                      <Sparkles size={14} />
                    </button>
                    <button onClick={() => startEdit(fir)} className="p-1.5 text-gray-400 hover:text-indigo-600 transition"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(fir.id!)} className="p-1.5 text-gray-400 hover:text-red-600 transition"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <p className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Overflight</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">${fir.overflightCharge || 0}</p>
                      {(!fir.overflightCharge || fir.overflightCharge === 0) && (
                        <button
                          onClick={() => fetchChargeAI(fir, 'overflight')}
                          disabled={loading}
                          className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition flex items-center gap-1 disabled:opacity-50"
                          title="Fetch Overflight Charge via AI"
                        >
                          <Sparkles size={10} /> Fetch
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <p className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Navigation</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">${fir.navigationCharge || 0}</p>
                      {(!fir.navigationCharge || fir.navigationCharge === 0) && (
                        <button
                          onClick={() => fetchChargeAI(fir, 'navigation')}
                          disabled={loading}
                          className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition flex items-center gap-1 disabled:opacity-50"
                          title="Fetch Navigation Charge via AI"
                        >
                          <Sparkles size={10} /> Fetch
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {fir.rules ? (
                  <div className="flex items-start gap-2 text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed bg-gray-50/50 dark:bg-gray-900/30 p-3 rounded-xl mb-4">
                    <Shield size={12} className="mt-0.5 flex-shrink-0 text-gray-300 dark:text-gray-600" />
                    <p className="line-clamp-2 italic">"{fir.rules}"</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 mt-2 mb-4 bg-gray-50 dark:bg-gray-900/30 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-1.5">
                      <Shield size={12} className="text-gray-400" />
                      <p className="font-bold text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-widest">Missing Rules</p>
                    </div>
                    <div className="flex gap-2">
                      <textarea 
                        id={`rules-input-${fir.id}`}
                        className="flex-1 p-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white min-h-[60px] resize-none focus:ring-1 focus:ring-indigo-500 outline-none"
                        placeholder="Enter regulatory rules manually..."
                      />
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={async () => {
                            const val = (document.getElementById(`rules-input-${fir.id}`) as HTMLTextAreaElement).value;
                            if (val.trim()) {
                              setLoading(true);
                              try {
                                await updateDoc(doc(db, 'firs', fir.id!), { rules: val.trim() });
                                fetchFirs();
                              } catch (error) {
                                console.error(error);
                              } finally {
                                setLoading(false);
                              }
                            }
                          }}
                          className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center justify-center flex-1"
                          title="Save Rules"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => fetchRulesAI(fir)}
                          disabled={loading}
                          className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center justify-center flex-1 disabled:opacity-50"
                          title="Fetch Rules via AI"
                        >
                          <Sparkles size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    {fir.address && (
                      <div className="flex items-start gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                        <MapPin size={12} className="mt-0.5 flex-shrink-0 text-indigo-400" />
                        <span>{fir.address}</span>
                      </div>
                    )}
                    {fir.phone && (
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                        <Phone size={12} className="text-indigo-400" />
                        <span>{fir.phone}</span>
                      </div>
                    )}
                    {fir.email && (
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                        <Mail size={12} className="text-indigo-400" />
                        <span>{fir.email}</span>
                      </div>
                    )}
                    {fir.website && (
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                        <Globe size={12} className="text-indigo-400" />
                        <a href={fir.website} target="_blank" rel="noopener noreferrer" className="hover:underline text-indigo-600 dark:text-indigo-400">{fir.website.replace(/^https?:\/\//, '')}</a>
                      </div>
                    )}
                  </div>

                  {fir.sop ? (
                    <div className="flex items-start gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                      <FileText size={12} className="mt-0.5 flex-shrink-0 text-emerald-400" />
                      <div>
                        <p className="font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">Standard Operating Procedures</p>
                        <p className="whitespace-pre-wrap">{fir.sop}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 mt-2 bg-gray-50 dark:bg-gray-900/30 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-1.5">
                        <FileText size={12} className="text-gray-400" />
                        <p className="font-bold text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-widest">Missing SOPs</p>
                      </div>
                      <div className="flex gap-2">
                        <textarea 
                          id={`sop-input-${fir.id}`}
                          className="flex-1 p-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 dark:text-white min-h-[60px] resize-none focus:ring-1 focus:ring-emerald-500 outline-none"
                          placeholder="Enter SOPs manually..."
                        />
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={async () => {
                              const val = (document.getElementById(`sop-input-${fir.id}`) as HTMLTextAreaElement).value;
                              if (val.trim()) {
                                setLoading(true);
                                try {
                                  await updateDoc(doc(db, 'firs', fir.id!), { sop: val.trim() });
                                  fetchFirs();
                                } catch (error) {
                                  console.error(error);
                                } finally {
                                  setLoading(false);
                                }
                              }
                            }}
                            className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center justify-center flex-1"
                            title="Save SOP"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              setLoading(true);
                              try {
                                const details = await getFIRDetails(fir.code, fir.name);
                                if (details.sop) {
                                  await updateDoc(doc(db, 'firs', fir.id!), { sop: details.sop });
                                  fetchFirs();
                                } else {
                                  const el = document.getElementById(`sop-input-${fir.id}`) as HTMLTextAreaElement;
                                  if (el) el.value = "AI could not find SOPs. Please enter manually.";
                                }
                              } catch (error) {
                                console.error(error);
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={loading}
                            className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center justify-center flex-1 disabled:opacity-50"
                            title="Fetch SOP via AI"
                          >
                            <Sparkles size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {fir.documentationUrl && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <LinkIcon size={12} className="text-indigo-400" />
                      <a 
                        href={fir.documentationUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                      >
                        Official Documentation
                      </a>
                    </div>
                  )}
                  {(!fir.phone || !fir.email || !fir.website || !fir.sop || !fir.overflightCharge || !fir.navigationCharge) && (
                    <button
                      onClick={() => fetchAIInfo(fir)}
                      disabled={loading}
                      className="w-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center justify-center gap-2"
                    >
                      <Sparkles size={12} /> Enrich missing details via AI
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {filteredFirs.length === 0 && !loading && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <AlertTriangle className="mx-auto text-gray-300 dark:text-gray-600 mb-2" size={32} />
          <p className="text-gray-500 dark:text-gray-400 text-sm">No FIRs found. Try seeding sample data or adding a new entry.</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      )}
    </div>
  );
}
