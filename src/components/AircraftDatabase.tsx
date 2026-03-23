import React, { useState, useEffect } from 'react';
import { Plane, Plus, Trash2, Edit2, Save, X, Fuel, Zap, MapPin, Weight, Loader2, Search } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { motion, AnimatePresence } from 'motion/react';
import AircraftPerformanceCharts from './AircraftPerformanceCharts';
import AircraftComparisonCharts from './AircraftComparisonCharts';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FlightLog {
  departure: string;
  destination: string;
  date: string;
  duration: string;
}

interface Aircraft {
  id?: string;
  type: string;
  fuelBurnPerHour: number;
  cruiseSpeed: number;
  range: number;
  maxPayload: number;
  maxPassengers: number;
  takeoffDistance: number;
  landingDistance: number;
  hourlyRate: number;
  category: string;
  landingFee: number;
  handlingFee: number;
  parkingFee: number;
  maintenanceReserve: number;
  crewCostPerHour: number;
  image?: string;
  specs?: string;
  flightHistory?: FlightLog[];
}

export default function AircraftDatabase() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedForComparison, setSelectedForComparison] = useState<Aircraft[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [formData, setFormData] = useState<Aircraft>({
    type: '',
    fuelBurnPerHour: 0,
    cruiseSpeed: 0,
    range: 0,
    maxPayload: 0,
    maxPassengers: 0,
    takeoffDistance: 0,
    landingDistance: 0,
    hourlyRate: 0,
    category: 'Light Jet',
    landingFee: 0,
    handlingFee: 0,
    parkingFee: 0,
    maintenanceReserve: 0,
    crewCostPerHour: 0
  });

  const fetchAircraft = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'aircraft'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aircraft));
      setAircraft(Array.from(new Map(data.map(item => [item.id, item])).values()));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'aircraft');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAircraft();
  }, []);

  const seedData = async () => {
    setLoading(true);
    const sampleAircraft: Aircraft[] = [
      {
        type: 'Gulfstream G650',
        category: 'Heavy Jet',
        fuelBurnPerHour: 1800,
        cruiseSpeed: 516,
        range: 7000,
        maxPayload: 2948,
        maxPassengers: 19,
        takeoffDistance: 5858,
        landingDistance: 3182,
        hourlyRate: 8500,
        landingFee: 450,
        handlingFee: 1200,
        parkingFee: 300,
        maintenanceReserve: 1200,
        crewCostPerHour: 800
      },
      {
        type: 'Bombardier Global 7500',
        category: 'Heavy Jet',
        fuelBurnPerHour: 1900,
        cruiseSpeed: 516,
        range: 7700,
        maxPayload: 2631,
        maxPassengers: 19,
        takeoffDistance: 5800,
        landingDistance: 2520,
        hourlyRate: 9200,
        landingFee: 500,
        handlingFee: 1300,
        parkingFee: 350,
        maintenanceReserve: 1300,
        crewCostPerHour: 850
      },
      {
        type: 'Cessna Citation Latitude',
        category: 'Midsize Jet',
        fuelBurnPerHour: 850,
        cruiseSpeed: 446,
        range: 2700,
        maxPayload: 1154,
        maxPassengers: 9,
        takeoffDistance: 3580,
        landingDistance: 2480,
        hourlyRate: 4200,
        landingFee: 250,
        handlingFee: 600,
        parkingFee: 150,
        maintenanceReserve: 600,
        crewCostPerHour: 400
      },
      {
        type: 'Embraer Phenom 300E',
        category: 'Light Jet',
        fuelBurnPerHour: 600,
        cruiseSpeed: 453,
        range: 1971,
        maxPayload: 1096,
        maxPassengers: 10,
        takeoffDistance: 3209,
        landingDistance: 2212,
        hourlyRate: 3100,
        landingFee: 150,
        handlingFee: 400,
        parkingFee: 100,
        maintenanceReserve: 450,
        crewCostPerHour: 300
      },
      {
        type: 'Pilatus PC-12 NGX',
        category: 'Turboprop',
        fuelBurnPerHour: 250,
        cruiseSpeed: 290,
        range: 1803,
        maxPayload: 1014,
        maxPassengers: 9,
        takeoffDistance: 2485,
        landingDistance: 2170,
        hourlyRate: 1800,
        landingFee: 80,
        handlingFee: 250,
        parkingFee: 50,
        maintenanceReserve: 250,
        crewCostPerHour: 200
      }
    ];

    try {
      for (const a of sampleAircraft) {
        await addDoc(collection(db, 'aircraft'), a);
      }
      fetchAircraft();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'aircraft');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'aircraft', editingId), formData as any);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'aircraft'), formData);
      }
      setShowAddForm(false);
      setFormData({
        type: '',
        fuelBurnPerHour: 0,
        cruiseSpeed: 0,
        range: 0,
        maxPayload: 0,
        maxPassengers: 0,
        takeoffDistance: 0,
        landingDistance: 0,
        hourlyRate: 0,
        category: 'Light Jet',
        landingFee: 0,
        handlingFee: 0,
        parkingFee: 0,
        maintenanceReserve: 0,
        crewCostPerHour: 0
      });
      fetchAircraft();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'aircraft');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this aircraft?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'aircraft', id));
      fetchAircraft();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'aircraft');
    } finally {
      setLoading(false);
    }
  };

  const filteredAircraft = aircraft.filter(a => 
    a.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Aircraft Fleet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your private jet and cargo fleet performance data.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={seedData}
            disabled={loading}
            className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition border border-indigo-100 dark:border-indigo-800"
          >
            <Zap size={18} />
            Seed Fleet
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
          >
            {showAddForm ? <X size={20} /> : <Plus size={20} />}
            {showAddForm ? 'Cancel' : 'Add Aircraft'}
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
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Aircraft Type</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Gulfstream G650"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Category</label>
                <select
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option>Light Jet</option>
                  <option>Midsize Jet</option>
                  <option>Heavy Jet</option>
                  <option>Cargo</option>
                  <option>Turboprop</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Hourly Rate (USD)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.hourlyRate}
                  onChange={e => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Fuel Burn (L/h)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.fuelBurnPerHour}
                  onChange={e => setFormData({ ...formData, fuelBurnPerHour: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Cruise Speed (kts)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.cruiseSpeed}
                  onChange={e => setFormData({ ...formData, cruiseSpeed: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Range (nm)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.range}
                  onChange={e => setFormData({ ...formData, range: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Max Payload (kg)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.maxPayload}
                  onChange={e => setFormData({ ...formData, maxPayload: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Max Passengers</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.maxPassengers}
                  onChange={e => setFormData({ ...formData, maxPassengers: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Takeoff Dist (ft)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.takeoffDistance}
                  onChange={e => setFormData({ ...formData, takeoffDistance: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Landing Dist (ft)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.landingDistance}
                  onChange={e => setFormData({ ...formData, landingDistance: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Landing Fee (USD)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.landingFee}
                  onChange={e => setFormData({ ...formData, landingFee: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Handling Fee (USD)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.handlingFee}
                  onChange={e => setFormData({ ...formData, handlingFee: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Parking Fee (USD)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.parkingFee}
                  onChange={e => setFormData({ ...formData, parkingFee: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Maint. Reserve (USD/h)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.maintenanceReserve}
                  onChange={e => setFormData({ ...formData, maintenanceReserve: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Crew Cost (USD/h)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.crewCostPerHour}
                  onChange={e => setFormData({ ...formData, crewCostPerHour: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Aircraft Image</label>
                <input
                  type="file"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  onChange={e => {
                    // Placeholder for actual upload logic
                    console.log('Image uploaded', e.target.files?.[0]);
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Specs Document</label>
                <input
                  type="file"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  onChange={e => {
                    // Placeholder for actual upload logic
                    console.log('Specs uploaded', e.target.files?.[0]);
                  }}
                />
              </div>
              <div className="md:col-span-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                  {editingId ? 'Update Aircraft' : 'Save Aircraft to Database'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
        <input
          type="text"
          placeholder="Search fleet by type or category..."
          className="w-full pl-12 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {showComparison && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Aircraft Comparison</h3>
              <button onClick={() => setShowComparison(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={24} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase font-bold tracking-widest border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="p-4">Metric</th>
                    {selectedForComparison.map(a => <th key={a.id} className="p-4">{a.type}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  <tr>
                    <td className="p-4 font-bold text-gray-900 dark:text-white">Category</td>
                    {selectedForComparison.map(a => <td key={a.id} className="p-4 text-gray-600 dark:text-gray-300">{a.category}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-gray-900 dark:text-white">Range</td>
                    {selectedForComparison.map(a => <td key={a.id} className="p-4 text-gray-600 dark:text-gray-300">{a.range} nm</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-gray-900 dark:text-white">Cruise Speed</td>
                    {selectedForComparison.map(a => <td key={a.id} className="p-4 text-gray-600 dark:text-gray-300">{a.cruiseSpeed} kts</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-gray-900 dark:text-white">Fuel Burn</td>
                    {selectedForComparison.map(a => <td key={a.id} className="p-4 text-gray-600 dark:text-gray-300">{a.fuelBurnPerHour} L/h</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-gray-900 dark:text-white">Max Passengers</td>
                    {selectedForComparison.map(a => <td key={a.id} className="p-4 text-gray-600 dark:text-gray-300">{a.maxPassengers}</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-gray-900 dark:text-white">Takeoff Distance</td>
                    {selectedForComparison.map(a => <td key={a.id} className="p-4 text-gray-600 dark:text-gray-300">{a.takeoffDistance} ft</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-gray-900 dark:text-white">Landing Distance</td>
                    {selectedForComparison.map(a => <td key={a.id} className="p-4 text-gray-600 dark:text-gray-300">{a.landingDistance} ft</td>)}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-gray-900 dark:text-white">Hourly Rate</td>
                    {selectedForComparison.map(a => <td key={a.id} className="p-4 font-bold text-indigo-600 dark:text-indigo-400">${a.hourlyRate?.toLocaleString()}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-8">
              <AircraftComparisonCharts aircrafts={selectedForComparison} />
            </div>
          </motion.div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {selectedForComparison.length > 0 && (
          <div className="md:col-span-2 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
            <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
              {selectedForComparison.length} aircraft selected for comparison
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedForComparison([])}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear
              </button>
              <button 
                onClick={() => setShowComparison(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-indigo-700 transition"
              >
                Compare Selected
              </button>
            </div>
          </div>
        )}
        {filteredAircraft.map((a) => (
          <div key={a.id} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                  <Plane size={24} />
                </div>
                <div>
                  <h3 className="font-black text-gray-800 dark:text-white">{a.type}</h3>
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-widest">
                    {a.category}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setEditingId(a.id!);
                    setFormData(a);
                    setShowAddForm(true);
                  }}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(a.id!)}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <Fuel size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Fuel Burn</span>
                </div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{a.fuelBurnPerHour} L/h</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <Zap size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Cruise Speed</span>
                </div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{a.cruiseSpeed} kts</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <MapPin size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Range</span>
                </div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{a.range} nm</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <Weight size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Max Payload</span>
                </div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{a.maxPayload} kg</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <Plane size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Max Pax</span>
                </div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{a.maxPassengers} seats</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <Zap size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Runway (T/O)</span>
                </div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{a.takeoffDistance} ft</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Landing</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">${a.landingFee?.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Handling</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">${a.handlingFee?.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Parking</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">${a.parkingFee?.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Maint. Res.</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">${a.maintenanceReserve?.toLocaleString()}/h</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Crew Cost</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">${a.crewCostPerHour?.toLocaleString()}/h</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Hourly Rate</p>
                <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">${a.hourlyRate?.toLocaleString()}</p>
              </div>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedForComparison.some(s => s.id === a.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedForComparison([...selectedForComparison, a]);
                      } else {
                        setSelectedForComparison(selectedForComparison.filter(s => s.id !== a.id));
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Compare
                </label>
                <button 
                  onClick={() => setExpandedId(expandedId === a.id ? null : a.id!)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  {expandedId === a.id ? 'Hide Specs' : 'View Specs'}
                  {expandedId === a.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {expandedId === a.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700 space-y-6">
                    <div>
                      <h4 className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-4">Performance Charts</h4>
                      <AircraftPerformanceCharts aircraft={a} />
                    </div>

                    <div>
                      <h4 className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-4">Flight History</h4>
                      {a.flightHistory && a.flightHistory.length > 0 ? (
                        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest">
                              <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Route</th>
                                <th className="p-3">Duration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                              {a.flightHistory.map((log, idx) => (
                                <tr key={idx} className="text-gray-600 dark:text-gray-300">
                                  <td className="p-3">{log.date}</td>
                                  <td className="p-3">{log.departure} → {log.destination}</td>
                                  <td className="p-3">{log.duration}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">No flight history available for this aircraft.</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {filteredAircraft.length === 0 && !loading && (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
          <Plane size={48} className="mx-auto text-gray-200 dark:text-gray-600 mb-4" />
          <p className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-xs">No Aircraft Found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 mb-6">Add your first aircraft to start quoting.</p>
        </div>
      )}
    </div>
  );
}
