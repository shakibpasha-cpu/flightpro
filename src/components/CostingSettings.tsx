import React, { useState, useEffect } from 'react';
import { DollarSign, Fuel, Landmark, UserCheck, Percent, Save, Loader2, Info } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { motion } from 'motion/react';

interface PricingSettings {
  fuelRatePerLitre: number;
  globalLandingFeeMultiplier: number;
  globalHandlingFeeMultiplier: number;
  globalMarginPercent: number;
  defaultBrokerMargin: number;
  defaultOperatorMargin: number;
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

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'settings', 'pricing');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as PricingSettings);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/pricing');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'pricing'), settings);
      alert('Pricing settings saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/pricing');
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
                  onChange={e => setSettings({ ...settings, fuelRatePerLitre: parseFloat(e.target.value) })}
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
                  onChange={e => setSettings({ ...settings, globalLandingFeeMultiplier: parseFloat(e.target.value) })}
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
                  onChange={e => setSettings({ ...settings, globalHandlingFeeMultiplier: parseFloat(e.target.value) })}
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
                  onChange={e => setSettings({ ...settings, globalMarginPercent: parseInt(e.target.value) })}
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
                  onChange={e => setSettings({ ...settings, defaultBrokerMargin: parseInt(e.target.value) })}
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
                  onChange={e => setSettings({ ...settings, defaultOperatorMargin: parseInt(e.target.value) })}
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
