import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Clock, Calendar, Shield, Mail, Phone, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc, orderBy, Timestamp } from 'firebase/firestore';

export interface CrewMember {
  id: string;
  name: string;
  role: 'Captain' | 'First Officer' | 'Flight Engineer' | 'Cabin Crew' | 'Loadmaster';
  status: 'Active' | 'On Leave' | 'Training' | 'Sick';
  totalHours: number;
  lastDutyEnd?: string;
  contactEmail: string;
  contactPhone: string;
}

export interface DutyLog {
  id: string;
  crewMemberId: string;
  startTime: string;
  endTime: string;
  type: 'Flight' | 'Standby' | 'Training' | 'Positioning';
  notes: string;
}

export default function CrewManagement() {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null);
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [dutyLogs, setDutyLogs] = useState<DutyLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    role: 'Captain' as CrewMember['role'],
    status: 'Active' as CrewMember['status'],
    contactEmail: '',
    contactPhone: '',
    totalHours: 0
  });

  const [dutyData, setDutyData] = useState({
    startTime: '',
    endTime: '',
    type: 'Flight' as DutyLog['type'],
    notes: ''
  });

  useEffect(() => {
    fetchCrew();
  }, []);

  const fetchCrew = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'crew_members'), orderBy('name'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CrewMember));
      setCrew(data);
    } catch (error) {
      console.error('Error fetching crew:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDutyLogs = async (crewId: string) => {
    setLoadingLogs(true);
    try {
      const q = query(
        collection(db, 'duty_logs'), 
        where('crewMemberId', '==', crewId),
        orderBy('startTime', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DutyLog));
      setDutyLogs(data);
    } catch (error) {
      console.error('Error fetching duty logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleAddCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedCrew) {
        await updateDoc(doc(db, 'crew_members', selectedCrew.id), formData);
      } else {
        await addDoc(collection(db, 'crew_members'), formData);
      }
      setShowAddModal(false);
      setSelectedCrew(null);
      setFormData({ name: '', role: 'Captain', status: 'Active', contactEmail: '', contactPhone: '', totalHours: 0 });
      fetchCrew();
    } catch (error) {
      console.error('Error saving crew member:', error);
    }
  };

  const handleAddDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCrew) return;

    try {
      await addDoc(collection(db, 'duty_logs'), {
        ...dutyData,
        crewMemberId: selectedCrew.id
      });
      
      // Update last duty end for the crew member
      await updateDoc(doc(db, 'crew_members', selectedCrew.id), {
        lastDutyEnd: dutyData.endTime
      });

      setShowDutyModal(false);
      setDutyData({ startTime: '', endTime: '', type: 'Flight', notes: '' });
      fetchCrew();
      fetchDutyLogs(selectedCrew.id);
    } catch (error) {
      console.error('Error saving duty log:', error);
    }
  };

  const handleDeleteCrew = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this crew member?')) return;
    try {
      await deleteDoc(doc(db, 'crew_members', id));
      fetchCrew();
    } catch (error) {
      console.error('Error deleting crew member:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Users className="text-indigo-600 dark:text-indigo-400" size={24} />
          <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Crew Management</h2>
        </div>
        <button
          onClick={() => {
            setSelectedCrew(null);
            setFormData({ name: '', role: 'Captain', status: 'Active', contactEmail: '', contactPhone: '', totalHours: 0 });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <UserPlus size={18} />
          Add Crew Member
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {crew.map((member) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                  <Shield size={24} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setSelectedCrew(member);
                      setFormData({
                        name: member.name,
                        role: member.role,
                        status: member.status,
                        contactEmail: member.contactEmail,
                        contactPhone: member.contactPhone,
                        totalHours: member.totalHours
                      });
                      setShowAddModal(true);
                    }}
                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteCrew(member.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{member.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                    {member.role}
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    member.status === 'Active' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                    'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  }`}>
                    {member.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <Mail size={14} />
                  <span className="text-xs font-medium">{member.contactEmail}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <Phone size={14} />
                  <span className="text-xs font-medium">{member.contactPhone}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <Clock size={14} />
                  <span className="text-xs font-bold uppercase tracking-widest">Total Hours: {member.totalHours}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedCrew(member);
                    setShowDutyModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                >
                  <Plus size={14} />
                  Log Duty
                </button>
                <button
                  onClick={() => {
                    setSelectedCrew(member);
                    fetchDutyLogs(member.id);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                >
                  <History size={14} />
                  History
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Crew Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-6">
                {selectedCrew ? 'Edit Crew Member' : 'Add Crew Member'}
              </h3>
              <form onSubmit={handleAddCrew} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="Captain">Captain</option>
                      <option value="First Officer">First Officer</option>
                      <option value="Flight Engineer">Flight Engineer</option>
                      <option value="Cabin Crew">Cabin Crew</option>
                      <option value="Loadmaster">Loadmaster</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Training">Training</option>
                      <option value="Sick">Sick</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Phone</label>
                  <input
                    type="tel"
                    required
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                  >
                    {selectedCrew ? 'Update' : 'Add'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log Duty Modal */}
      <AnimatePresence>
        {showDutyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-6">
                Log Duty Time: {selectedCrew?.name}
              </h3>
              <form onSubmit={handleAddDuty} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Start Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={dutyData.startTime}
                      onChange={(e) => setDutyData({ ...dutyData, startTime: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">End Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={dutyData.endTime}
                      onChange={(e) => setDutyData({ ...dutyData, endTime: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Duty Type</label>
                  <select
                    value={dutyData.type}
                    onChange={(e) => setDutyData({ ...dutyData, type: e.target.value as any })}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="Flight">Flight</option>
                    <option value="Standby">Standby</option>
                    <option value="Training">Training</option>
                    <option value="Positioning">Positioning</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Notes</label>
                  <textarea
                    value={dutyData.notes}
                    onChange={(e) => setDutyData({ ...dutyData, notes: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all h-24 resize-none"
                    placeholder="Enter duty details..."
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowDutyModal(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                  >
                    Log Duty
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Duty History Panel */}
      {selectedCrew && !showDutyModal && dutyLogs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-8 border border-gray-100 dark:border-gray-800"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Duty History: {selectedCrew.name}</h3>
            <button
              onClick={() => setDutyLogs([])}
              className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest"
            >
              Close History
            </button>
          </div>
          <div className="space-y-4">
            {dutyLogs.map((log) => (
              <div key={log.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl ${
                    log.type === 'Flight' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' :
                    'bg-gray-50 dark:bg-gray-700/50 text-gray-500'
                  }`}>
                    {log.type === 'Flight' ? <Plane size={18} /> : <Clock size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{log.type}</p>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {new Date(log.startTime).toLocaleString()} - {new Date(log.endTime).toLocaleString()}
                    </p>
                  </div>
                </div>
                {log.notes && (
                  <p className="text-xs text-gray-500 italic max-w-xs truncate">"{log.notes}"</p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

const Plane = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
  </svg>
);
