import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Edit2, Save, X, Loader2, Search, Globe, Clock } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { motion, AnimatePresence } from 'motion/react';

interface Route {
  id?: string;
  departure: string;
  destination: string;
  distance: number;
  averageFlightTime: number;
  typicalFirs?: string[];
}

export default function RouteDatabase() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Route>({
    departure: '',
    destination: '',
    distance: 0,
    averageFlightTime: 0,
    typicalFirs: []
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'routes'));
      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'routes');
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
        await updateDoc(doc(db, 'routes', editingId), formData as any);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'routes'), formData);
      }
      setShowAddForm(false);
      setFormData({
        departure: '',
        destination: '',
        distance: 0,
        averageFlightTime: 0,
        typicalFirs: []
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'routes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'routes', id));
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'routes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Route Database</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pre-calculated common flight paths and mission parameters.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
        >
          {showAddForm ? <X size={20} /> : <Plus size={20} />}
          {showAddForm ? 'Cancel' : 'Add Route'}
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
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Departure (ICAO)</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. EGLL"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.departure}
                  onChange={e => setFormData({ ...formData, departure: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Destination (ICAO)</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. KJFK"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.destination}
                  onChange={e => setFormData({ ...formData, destination: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Distance (nm)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.distance}
                  onChange={e => setFormData({ ...formData, distance: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg Flight Time (min)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.averageFlightTime}
                  onChange={e => setFormData({ ...formData, averageFlightTime: Number(e.target.value) })}
                />
              </div>
              <div className="lg:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {editingId ? 'Update Route' : 'Save Route'}
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
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Route</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Distance</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Flight Time</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
                        <Globe size={16} />
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{item.departure} → {item.destination}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-bold">{item.distance.toLocaleString()} nm</td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-bold">{item.averageFlightTime} min</td>
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
              {routes.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <MapPin size={48} className="opacity-20" />
                      <p className="text-sm font-medium">No routes found.</p>
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
