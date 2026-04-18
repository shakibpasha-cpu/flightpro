import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, Edit2, Save, X, Loader2, Search, Settings, Percent } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { motion, AnimatePresence } from 'motion/react';

interface PricingRule {
  id?: string;
  name: string;
  operatorId?: string;
  aircraftType?: string;
  routeId?: string;
  markupPercentage?: number;
  fixedFee?: number;
  validFrom?: string;
  validTo?: string;
}

export default function PricingRuleDatabase() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<PricingRule>({
    name: '',
    operatorId: '',
    aircraftType: '',
    routeId: '',
    markupPercentage: 0,
    fixedFee: 0,
    validFrom: '',
    validTo: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'pricingRules'));
      setRules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PricingRule)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'pricingRules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'pricingRules', editingId), formData as any);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'pricingRules'), formData);
      }
      setShowAddForm(false);
      setFormData({
        name: '',
        operatorId: '',
        aircraftType: '',
        routeId: '',
        markupPercentage: 0,
        fixedFee: 0,
        validFrom: '',
        validTo: ''
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'pricingRules');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'pricingRules', id));
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'pricingRules');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Pricing Rules</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Define dynamic pricing markups and fees based on operators, aircraft, or routes.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
        >
          {showAddForm ? <X size={20} /> : <Plus size={20} />}
          {showAddForm ? 'Cancel' : 'Add Rule'}
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-indigo-100 dark:border-gray-700 shadow-sm"
          >
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rule Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Summer Peak Markup"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Markup (%)</label>
                <input
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.markupPercentage}
                  onChange={e => setFormData({ ...formData, markupPercentage: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fixed Fee (USD)</label>
                <input
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.fixedFee}
                  onChange={e => setFormData({ ...formData, fixedFee: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valid From</label>
                <input
                  type="date"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.validFrom}
                  onChange={e => setFormData({ ...formData, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valid To</label>
                <input
                  type="date"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.validTo}
                  onChange={e => setFormData({ ...formData, validTo: e.target.value })}
                />
              </div>
              <div className="lg:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {editingId ? 'Update Rule' : 'Save Rule'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rule Name</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Markup</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fixed Fee</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Validity</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
                        <Percent size={16} />
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-bold">+{item.markupPercentage}%</td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-bold">${item.fixedFee?.toLocaleString()}</td>
                  <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                    {item.validFrom ? `${item.validFrom} to ${item.validTo || '∞'}` : 'Always Active'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setFormData(item);
                          setEditingId(item.id!);
                          setShowAddForm(true);
                        }}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id!)}
                        className="p-2 text-gray-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Settings size={48} className="opacity-20" />
                      <p className="text-sm font-medium">No pricing rules found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
