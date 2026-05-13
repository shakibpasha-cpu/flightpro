import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Edit2, Save, X, Loader2, Search, Clock, Plane } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/errorService';
import { motion, AnimatePresence } from 'motion/react';

interface Availability {
  id?: string;
  aircraftId: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'maintenance' | 'blocked';
  notes?: string;
}

interface Aircraft {
  id: string;
  registration: string;
  type: string;
  category?: string;
}

interface AvailabilityDatabaseProps {
  initialAircraftId?: string;
  onClearFilter?: () => void;
}

export default function AvailabilityDatabase({ initialAircraftId, onClearFilter }: AvailabilityDatabaseProps) {
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Availability>({
    aircraftId: initialAircraftId || '',
    startTime: '',
    endTime: '',
    status: 'available',
    notes: ''
  });

  useEffect(() => {
    if (initialAircraftId) {
      setFormData(prev => ({ ...prev, aircraftId: initialAircraftId }));
    }
  }, [initialAircraftId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const availabilitySnapshot = await getDocs(collection(db, 'availability'));
      setAvailability(availabilitySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Availability)));

      const aircraftSnapshot = await getDocs(collection(db, 'aircraft'));
      setAircraft(aircraftSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        registration: doc.data().registration, 
        type: doc.data().type,
        category: doc.data().category
      } as Aircraft)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'availability');
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
        await updateDoc(doc(db, 'availability', editingId), formData as any);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'availability'), formData);
      }
      setShowAddForm(false);
      setFormData({
        aircraftId: '',
        startTime: '',
        endTime: '',
        status: 'available',
        notes: ''
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'availability');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this availability record?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'availability', id));
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'availability');
    } finally {
      setLoading(false);
    }
  };

  const getAircraft = (id: string) => {
    return aircraft.find(item => item.id === id);
  };

  const getAircraftLabel = (id: string) => {
    const a = getAircraft(id);
    return a ? `${a.registration} (${a.type})` : 'Unknown Aircraft';
  };

  const filteredAvailability = availability.filter(item => {
    if (initialAircraftId && item.aircraftId !== initialAircraftId) return false;
    if (searchTerm) {
      const label = getAircraftLabel(item.aircraftId).toLowerCase();
      return label.includes(searchTerm.toLowerCase()) || item.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Aircraft Availability</h2>
          {initialAircraftId ? (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-indigo-600 dark:text-indigo-400 font-bold">
                Filtering for: {getAircraftLabel(initialAircraftId)}
              </p>
              <button 
                onClick={onClearFilter}
                className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
              >
                Clear Filter
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage manual availability blocks, maintenance, and bookings.</p>
          )}
        </div>
        <div className="flex gap-3">
          {initialAircraftId && (
            <button
              onClick={() => {
                onClearFilter?.();
                // We can't easily switch back to aircraft tab from here without passing setActiveTab
                // But at least we can clear the filter
              }}
              className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Back to All
            </button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search aircraft or notes..."
              className="pl-10 pr-4 py-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
          >
            {showAddForm ? <X size={20} /> : <Plus size={20} />}
            {showAddForm ? 'Cancel' : 'Add Block'}
          </button>
        </div>
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
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aircraft</label>
                <select
                  required
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.aircraftId}
                  onChange={e => setFormData({ ...formData, aircraftId: e.target.value })}
                >
                  <option value="">Select Aircraft...</option>
                  {aircraft.map(a => (
                    <option key={a.id} value={a.id}>{a.registration} ({a.type})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Start Time</label>
                <input
                  required
                  type="datetime-local"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">End Time</label>
                <input
                  required
                  type="datetime-local"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</label>
                <select
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="available">Available</option>
                  <option value="booked">Booked</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notes</label>
                <input
                  type="text"
                  placeholder="Reason for block..."
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="lg:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {editingId ? 'Update Record' : 'Save Record'}
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
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Aircraft</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Start</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">End</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Notes</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAvailability.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
                        <Plane size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{getAircraftLabel(item.aircraftId)}</p>
                        {getAircraft(item.aircraftId) && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest">
                            {getAircraft(item.aircraftId)?.category}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-medium">{new Date(item.startTime).toLocaleString()}</td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-medium">{new Date(item.endTime).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                      item.status === 'available' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      item.status === 'booked' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      item.status === 'maintenance' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500 dark:text-gray-400 italic">{item.notes || '-'}</td>
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
              {filteredAvailability.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Calendar size={48} className="opacity-20" />
                      <p className="text-sm font-medium">No availability records found.</p>
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
