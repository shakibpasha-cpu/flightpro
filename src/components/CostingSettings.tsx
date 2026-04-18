import React, { useState, useEffect } from 'react';
import { DollarSign, Fuel, Landmark, UserCheck, Percent, Save, Loader2, Info, Database, Zap } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { motion } from 'motion/react';
import { REAL_WORLD_ACMI_RATES } from '../constants/aircraftData';

interface PricingSettings {
  fuelRatePerLitre: number | '';
  globalLandingFeeMultiplier: number | '';
  globalHandlingFeeMultiplier: number | '';
  globalMarginPercent: number | '';
  defaultBrokerMargin: number | '';
  defaultOperatorMargin: number | '';
}

export default function CostingSettings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PricingSettings>({
    fuelRatePerLitre: 1.25,
    globalLandingFeeMultiplier: 1.0,
    globalHandlingFeeMultiplier: 1.0,
    globalMarginPercent: 15,
    defaultBrokerMargin: 10,
    defaultOperatorMargin: 5
  });

  const [seeding, setSeeding] = useState(false);
  const [importingJson, setImportingJson] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000));
        const docRef = doc(db, 'settings', 'pricing');
        
        const docSnap = await Promise.race([
          getDoc(docRef),
          timeoutPromise
        ]) as any;

        if (docSnap && docSnap.exists()) {
          setSettings(docSnap.data() as PricingSettings);
        }
      } catch (error) {
        console.warn("Database offline or timed out, using default settings.");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSeedDatabase = async () => {
    if (!window.confirm('This will seed the database with real-world aircraft data. Existing master data for these types will be skipped. Continue?')) return;
    
    setSeeding(true);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
      
      const seedProcess = async () => {
        let count = 0;
        for (const aircraft of REAL_WORLD_ACMI_RATES) {
          // Check if aircraft type already exists in master
          const qMaster = query(collection(db, 'aircraft_master'), where('aircraft_type', '==', aircraft.type));
          const snapshotMaster = await getDocs(qMaster);
          
          if (snapshotMaster.empty) {
            await addDoc(collection(db, 'aircraft_master'), {
              aircraft_type: aircraft.type,
              category: aircraft.category,
              manufacturer: aircraft.manufacturer,
              fuel_burn_kg_per_hr: aircraft.fuelBurnPerHour,
              range_nm: Math.round(aircraft.rangeKm / 1.852), // Convert km to nm
              passenger_capacity: aircraft.seats.max,
              payload_kg: aircraft.payloadKg || 0,
              cruise_speed_kts: 450, // Default
              mtow_kg: 77000, // Default
              image_url: `https://loremflickr.com/800/600/aircraft,jet,plane?lock=${aircraft.type?.length || 1}`
            });
            count++;
          }

          // Seed aircraft_rates collection
          const qRates = query(collection(db, 'aircraft_rates'), where('aircraft_type', '==', aircraft.type));
          const snapshotRates = await getDocs(qRates);

          if (snapshotRates.empty) {
            await addDoc(collection(db, 'aircraft_rates'), {
              aircraft_type: aircraft.type,
              category: aircraft.category,
              min_rate: aircraft.acmiRateRange.min,
              max_rate: aircraft.acmiRateRange.max,
              avg_rate: (aircraft.acmiRateRange.min + aircraft.acmiRateRange.max) / 2,
              fuel_burn: aircraft.fuelBurnPerHour,
              payload: aircraft.payloadKg || null,
              seats: aircraft.seats.max
            });
          }

          // Seed multiple listings per aircraft to demonstrate "Same aircraft = different rates"
          const qListings = query(collection(db, 'aircraft_listings'), where('aircraft_id', '==', aircraft.type));
          const snapshotListings = await getDocs(qListings);

          if (snapshotListings.empty) {
            // Operator A (Lower end of market)
            await addDoc(collection(db, 'aircraft_listings'), {
              aircraft_id: aircraft.type,
              operator_id: 'OP_ALPHA',
              operator_name: 'Alpha Aviation',
              acmi_rate_per_hr: Math.round(aircraft.acmiRateRange.min + (aircraft.acmiRateRange.max - aircraft.acmiRateRange.min) * 0.2),
              crew_included: true,
              status: 'Active'
            });
            
            // Operator B (Higher end of market)
            await addDoc(collection(db, 'aircraft_listings'), {
              aircraft_id: aircraft.type,
              operator_id: 'OP_BETA',
              operator_name: 'Beta Airways',
              acmi_rate_per_hr: Math.round(aircraft.acmiRateRange.min + (aircraft.acmiRateRange.max - aircraft.acmiRateRange.min) * 0.8),
              crew_included: true,
              status: 'Active'
            });
          }
        }
        return count;
      };

      const count = await Promise.race([seedProcess(), timeoutPromise]);
      alert(`Successfully seeded ${count} new aircraft types, market rates, and multiple operator listings.`);
    } catch (error) {
      console.warn("Database offline or timed out, skipping seed.");
      alert("Database offline. Could not seed aircraft data.");
    } finally {
      setSeeding(false);
    }
  };

  const handleImportJson = async () => {
    if (!jsonInput.trim()) {
      alert('Please paste valid JSON data first.');
      return;
    }

    try {
      const data = JSON.parse(jsonInput);
      if (!Array.isArray(data)) {
        throw new Error('Data must be a JSON array.');
      }

      setImportingJson(true);
      let count = 0;

      for (const item of data) {
        if (!item.aircraft || !item.category || !item.min_rate || !item.max_rate) {
          console.warn('Skipping invalid item:', item);
          continue;
        }

        // Seed aircraft_rates collection
        const qRates = query(collection(db, 'aircraft_rates'), where('aircraft_type', '==', item.aircraft));
        const snapshotRates = await getDocs(qRates);

        if (snapshotRates.empty) {
          await addDoc(collection(db, 'aircraft_rates'), {
            aircraft_type: item.aircraft,
            category: item.category,
            min_rate: item.min_rate,
            max_rate: item.max_rate,
            avg_rate: item.avg_rate || (item.min_rate + item.max_rate) / 2,
            fuel_burn: item.fuel_burn || 0,
            payload: item.payload || null,
            seats: item.seats || 0
          });
          count++;
        } else {
           // Update existing
           const docRef = snapshotRates.docs[0].ref;
           await setDoc(docRef, {
            aircraft_type: item.aircraft,
            category: item.category,
            min_rate: item.min_rate,
            max_rate: item.max_rate,
            avg_rate: item.avg_rate || (item.min_rate + item.max_rate) / 2,
            fuel_burn: item.fuel_burn || 0,
            payload: item.payload || null,
            seats: item.seats || 0
           }, { merge: true });
           count++;
        }
      }
      
      alert(`Successfully imported/updated ${count} aircraft rates from JSON.`);
      setJsonInput('');
    } catch (error: any) {
      alert(`Invalid JSON format: ${error.message}`);
    } finally {
      setImportingJson(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1500));
      await Promise.race([
        setDoc(doc(db, 'settings', 'pricing'), settings),
        timeoutPromise
      ]);
      alert('Pricing settings saved successfully!');
    } catch (error) {
      console.warn("Database offline or timed out, settings saved to local session only.");
      alert('Database offline. Pricing settings saved to local session only.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Costing & Pricing Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Configure global rates, fees, and margin controls for the quoting engine.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rates & Fees */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Landmark size={20} />
              <h3 className="font-bold uppercase tracking-widest text-xs">Global Rates & Fees</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  <Fuel size={12} /> Fuel Rate (USD/Litre)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                  value={settings.fuelRatePerLitre}
                  onChange={e => setSettings({ ...settings, fuelRatePerLitre: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  <Landmark size={12} /> Landing Fee Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                  value={settings.globalLandingFeeMultiplier}
                  onChange={e => setSettings({ ...settings, globalLandingFeeMultiplier: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                />
                <p className="text-[10px] text-gray-400 italic">Adjusts all airport landing fees globally.</p>
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  <UserCheck size={12} /> Handling Fee Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                  value={settings.globalHandlingFeeMultiplier}
                  onChange={e => setSettings({ ...settings, globalHandlingFeeMultiplier: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* Margin Control */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Percent size={20} />
              <h3 className="font-bold uppercase tracking-widest text-xs">Margin Control</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Global Margin (%)
                </label>
                <input
                  type="number"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                  value={settings.globalMarginPercent}
                  onChange={e => setSettings({ ...settings, globalMarginPercent: e.target.value === '' ? '' : Number(e.target.value) })}
                />
                <p className="text-[10px] text-gray-400 italic">Applied to the final calculated cost.</p>
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Default Broker Margin (%)
                </label>
                <input
                  type="number"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                  value={settings.defaultBrokerMargin}
                  onChange={e => setSettings({ ...settings, defaultBrokerMargin: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Default Operator Margin (%)
                </label>
                <input
                  type="number"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                  value={settings.defaultOperatorMargin}
                  onChange={e => setSettings({ ...settings, defaultOperatorMargin: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex items-start gap-3">
          <Info size={18} className="text-indigo-600 dark:text-indigo-400 mt-0.5" />
          <p className="text-xs text-indigo-900 dark:text-indigo-200">
            These settings affect the <strong>Charter Quote Engine</strong> and <strong>Manual Quote</strong> calculations. 
            Per-quote margins can still be adjusted individually during the quoting process.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Database size={20} />
            <h3 className="font-bold uppercase tracking-widest text-xs">Database Maintenance</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Populate the system with real-world aviation datasets for more accurate AI predictions and pricing.
          </p>
          <button
            type="button"
            onClick={handleSeedDatabase}
            disabled={seeding}
            className="w-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 p-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-800"
          >
            {seeding ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
            {seeding ? 'Seeding Database...' : 'Seed Real-World Aircraft Data'}
          </button>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Import Custom JSON Dataset (Aircraft Rates)
            </label>
            <textarea
              className="w-full h-32 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-mono text-xs"
              placeholder='[ { "aircraft": "A320", "category": "Narrowbody", "min_rate": 2800, "max_rate": 4200 } ]'
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            <button
              type="button"
              onClick={handleImportJson}
              disabled={importingJson || !jsonInput.trim()}
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 p-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {importingJson ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />}
              {importingJson ? 'Importing...' : 'Import JSON Data'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          {saving ? 'Saving Settings...' : 'Save Pricing Configuration'}
        </button>
      </form>
    </div>
  );
}
