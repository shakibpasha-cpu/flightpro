import React, { useState, useEffect } from 'react';
import { Plane, Plus, Trash2, Edit2, Save, X, Fuel, Zap, MapPin, Weight, Loader2, Search, Calendar, Sparkles, History, Clock, FileText } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { motion, AnimatePresence } from 'motion/react';
import AircraftPerformanceCharts from './AircraftPerformanceCharts';
import AircraftComparisonCharts from './AircraftComparisonCharts';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FlightLog {
  id?: string;
  aircraft_listing_id: string;
  departure: string;
  destination: string;
  date: string;
  duration_hours: number;
  notes?: string;
}

interface Aircraft {
  id?: string;
  registration?: string;
  icao24?: string;
  type: string;
  fuelBurnPerHour: number | '';
  cruiseSpeed: number | '';
  range: number | '';
  maxPayload: number | '';
  maxPassengers: number | '';
  takeoffDistance: number | '';
  landingDistance: number | '';
  hourlyRate: number | '';
  category: string;
  landingFee: number | '';
  handlingFee: number | '';
  parkingFee: number | '';
  maintenanceReserve: number | '';
  crewCostPerHour: number | '';
  image?: string;
  specs?: string;
  flightHistory?: FlightLog[];
  ai_verified?: boolean;
  last_enhanced?: string;
  serviceCeiling?: number;
  mtow?: number;
  // ACMI Specific Fields
  operatorName?: string;
  acmiRate?: number | '';
  availability?: string;
  baseAirport?: string;
  crewIncluded?: boolean;
  maintenanceStatus?: string;
  insuranceCoverage?: string;
  operatorDetails?: string;
  crewInfo?: string;
  monthlyFixedFee?: number | '';
  monthlyGuaranteedHours?: number | '';
  leaseDepositMonths?: number | '';
  minLeaseTermMonths?: number | '';
}

interface Operator {
  id: string;
  name: string;
}

interface AircraftDatabaseProps {
  onViewAvailability?: (aircraftId: string) => void;
}

export default function AircraftDatabase({ onViewAvailability }: AircraftDatabaseProps) {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedForComparison, setSelectedForComparison] = useState<Aircraft[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [flightHistoryCache, setFlightHistoryCache] = useState<Record<string, FlightLog[]>>({});
  const [loggingFlightId, setLoggingFlightId] = useState<string | null>(null);
  const [logFormData, setLogFormData] = useState<Omit<FlightLog, 'id' | 'aircraft_listing_id'>>({
    departure: '',
    destination: '',
    date: new Date().toISOString().split('T')[0],
    duration_hours: 0,
    notes: ''
  });
  const [formData, setFormData] = useState<Aircraft>({
    registration: '',
    icao24: '',
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
    crewCostPerHour: 0,
    operatorName: '',
    acmiRate: 0,
    availability: '',
    baseAirport: '',
    crewIncluded: true,
    maintenanceStatus: '',
    insuranceCoverage: '',
    operatorDetails: '',
    crewInfo: '',
    monthlyFixedFee: 0,
    monthlyGuaranteedHours: 0,
    leaseDepositMonths: 0,
    minLeaseTermMonths: 0
  });

  const fetchAircraft = async () => {
    setLoading(true);
    try {
      const aircraftSnapshot = await getDocs(collection(db, 'aircraft'));
      const aircraftData = aircraftSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aircraft));
      setAircraft(Array.from(new Map(aircraftData.map(item => [item.id, item])).values()));

      const operatorsSnapshot = await getDocs(collection(db, 'operators'));
      const operatorsData = operatorsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as Operator));
      setOperators(operatorsData);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'aircraft');
    } finally {
      setLoading(false);
    }
  };

  const fetchFlightHistory = async (aircraftId: string) => {
    try {
      const q = query(
        collection(db, 'flight_logs'),
        where('aircraft_listing_id', '==', aircraftId),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FlightLog));
      setFlightHistoryCache(prev => ({ ...prev, [aircraftId]: logs }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'flight_logs');
    }
  };

  const handleLogFlight = async (aircraftId: string) => {
    setLoading(true);
    try {
      const newLog = {
        ...logFormData,
        aircraft_listing_id: aircraftId
      };
      await addDoc(collection(db, 'flight_logs'), newLog);
      await fetchFlightHistory(aircraftId);
      setLoggingFlightId(null);
      setLogFormData({
        departure: '',
        destination: '',
        date: new Date().toISOString().split('T')[0],
        duration_hours: 0,
        notes: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'flight_logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expandedId) {
      fetchFlightHistory(expandedId);
    }
  }, [expandedId]);

  const seedData = async () => {
    setLoading(true);
    const sampleAircraft: Aircraft[] = [
      {
        registration: 'A6-EIB',
        icao24: '896131',
        type: 'Airbus A320-200',
        category: 'Heavy Jet',
        fuelBurnPerHour: 2500,
        cruiseSpeed: 450,
        range: 3300,
        maxPayload: 16600,
        maxPassengers: 180,
        takeoffDistance: 6800,
        landingDistance: 4900,
        hourlyRate: 3500,
        landingFee: 800,
        handlingFee: 1500,
        parkingFee: 400,
        maintenanceReserve: 1500,
        crewCostPerHour: 1000,
        operatorName: 'Global Air Leasing',
        acmiRate: 3200,
        availability: 'Immediate',
        baseAirport: 'DXB',
        crewIncluded: true,
        maintenanceStatus: 'C-Check completed Jan 2026',
        insuranceCoverage: 'Full Hull & Liability ($500M)',
        operatorDetails: 'Global Air Leasing is a premier ACMI provider with a fleet of 15 A320 family aircraft.',
        crewInfo: '2 Captains, 2 First Officers, 4 Cabin Crew included.',
        image: 'https://loremflickr.com/800/600/aircraft,jet,plane?lock=1'
      },
      {
        registration: 'G-CLBA',
        icao24: '407865',
        type: 'Boeing 737-800BCF',
        category: 'Cargo',
        fuelBurnPerHour: 2400,
        cruiseSpeed: 440,
        range: 2000,
        maxPayload: 23900,
        maxPassengers: 0,
        takeoffDistance: 7000,
        landingDistance: 5000,
        hourlyRate: 4200,
        landingFee: 1200,
        handlingFee: 2500,
        parkingFee: 600,
        maintenanceReserve: 1800,
        crewCostPerHour: 1200,
        operatorName: 'Atlas Cargo Solutions',
        acmiRate: 3800,
        availability: 'From April 15',
        baseAirport: 'LHR',
        crewIncluded: true,
        maintenanceStatus: 'Fresh from heavy maintenance',
        insuranceCoverage: 'Cargo & Hull Liability ($250M)',
        operatorDetails: 'Specialists in regional cargo ACMI operations across Europe and Middle East.',
        crewInfo: '3 Flight Crew (Captain, FO, Relief) included.',
        image: 'https://loremflickr.com/800/600/aircraft,jet,plane?lock=2'
      },
      {
        registration: 'N777GW',
        icao24: 'aa6789',
        type: 'Boeing 777-200ER',
        category: 'Heavy Jet',
        fuelBurnPerHour: 6500,
        cruiseSpeed: 490,
        range: 7000,
        maxPayload: 50000,
        maxPassengers: 300,
        takeoffDistance: 9000,
        landingDistance: 6000,
        hourlyRate: 12000,
        landingFee: 2500,
        handlingFee: 4000,
        parkingFee: 1000,
        maintenanceReserve: 3000,
        crewCostPerHour: 2500,
        operatorName: 'Global Widebody Ops',
        acmiRate: 10500,
        availability: 'On Request',
        baseAirport: 'JFK',
        crewIncluded: true,
        maintenanceStatus: 'Engines recently overhauled',
        insuranceCoverage: 'Global Widebody Premium ($1B)',
        operatorDetails: 'Specializing in long-haul ACMI and charter operations.',
        crewInfo: 'Full long-haul crew complement included.',
        image: 'https://loremflickr.com/800/600/aircraft,jet,plane?lock=3'
      },
      {
        type: 'Bombardier Global 6000',
        category: 'Heavy Jet',
        fuelBurnPerHour: 1800,
        cruiseSpeed: 510,
        range: 6000,
        maxPayload: 2600,
        maxPassengers: 14,
        takeoffDistance: 6476,
        landingDistance: 2670,
        hourlyRate: 8500,
        landingFee: 1500,
        handlingFee: 3000,
        parkingFee: 800,
        maintenanceReserve: 2500,
        crewCostPerHour: 2000,
        operatorName: 'Elite Executive Jets',
        acmiRate: 7200,
        availability: 'On Request',
        baseAirport: 'VKO',
        crewIncluded: true,
        maintenanceStatus: 'Maintained by Bombardier Authorized Center',
        insuranceCoverage: 'VIP Premium Coverage ($1B)',
        operatorDetails: 'Ultra-long-range VIP ACMI specialist for corporate and government missions.',
        crewInfo: '2 Highly experienced VIP Captains, 1 VIP Flight Attendant.',
        image: 'https://loremflickr.com/800/600/aircraft,jet,plane?lock=4'
      },
      {
        type: 'Embraer Phenom 300',
        category: 'Light Jet',
        fuelBurnPerHour: 800,
        cruiseSpeed: 450,
        range: 1900,
        maxPayload: 1100,
        maxPassengers: 8,
        takeoffDistance: 3138,
        landingDistance: 2621,
        hourlyRate: 3200,
        landingFee: 400,
        handlingFee: 800,
        parkingFee: 200,
        maintenanceReserve: 800,
        crewCostPerHour: 600,
        operatorName: 'SwiftJet Europe',
        acmiRate: 2800,
        availability: 'Immediate',
        baseAirport: 'NCE',
        crewIncluded: true,
        maintenanceStatus: 'Fully compliant with EASA standards',
        insuranceCoverage: 'Standard Business Jet Coverage ($100M)',
        operatorDetails: 'Reliable light jet operator focusing on intra-European business travel.',
        crewInfo: '2 Pilots included.',
        image: 'https://loremflickr.com/800/600/aircraft,jet,plane?lock=5'
      },
      {
        type: 'ATR 72-600',
        category: 'Turboprop',
        fuelBurnPerHour: 600,
        cruiseSpeed: 280,
        range: 800,
        maxPayload: 7500,
        maxPassengers: 72,
        takeoffDistance: 4300,
        landingDistance: 3000,
        hourlyRate: 2200,
        landingFee: 500,
        handlingFee: 1000,
        parkingFee: 300,
        maintenanceReserve: 600,
        crewCostPerHour: 500,
        operatorName: 'Regional Connect',
        acmiRate: 1950,
        availability: 'From May 1',
        baseAirport: 'SIN',
        crewIncluded: true,
        maintenanceStatus: 'Regular line maintenance performed',
        insuranceCoverage: 'Regional Airline Standard ($150M)',
        operatorDetails: 'Leading turboprop ACMI provider in Southeast Asia.',
        crewInfo: '2 Pilots, 2 Cabin Crew included.',
        image: 'https://loremflickr.com/800/600/aircraft,jet,plane?lock=6'
      },
      {
        type: 'Boeing 777-200LR',
        category: 'Heavy Jet',
        fuelBurnPerHour: 7200,
        cruiseSpeed: 488,
        range: 8555,
        maxPayload: 64000,
        maxPassengers: 440,
        takeoffDistance: 10500,
        landingDistance: 5800,
        hourlyRate: 21000,
        landingFee: 1400,
        handlingFee: 2800,
        parkingFee: 900,
        maintenanceReserve: 2800,
        crewCostPerHour: 1700,
        operatorName: 'Ultra Long Haul Leasing',
        acmiRate: 18500,
        availability: 'Immediate',
        baseAirport: 'DXB',
        crewIncluded: true,
        maintenanceStatus: 'A-Check completed March 2026',
        insuranceCoverage: 'Global Comprehensive ($1.5B)',
        operatorDetails: 'Specialists in ultra-long-range ACMI missions with high-density configurations.',
        crewInfo: '4 Pilots (2 Captains, 2 FOs) and 12 Cabin Crew included.',
        image: 'https://loremflickr.com/800/600/aircraft,jet,plane?lock=7'
      },
      {
        type: 'Boeing 777-300',
        category: 'Heavy Jet',
        fuelBurnPerHour: 7500,
        cruiseSpeed: 488,
        range: 6005,
        maxPayload: 65000,
        maxPassengers: 550,
        takeoffDistance: 10200,
        landingDistance: 6100,
        hourlyRate: 22000,
        landingFee: 1500,
        handlingFee: 3000,
        parkingFee: 1000,
        maintenanceReserve: 3000,
        crewCostPerHour: 1800,
        operatorName: 'Pacific Rim Aviation',
        acmiRate: 19800,
        availability: 'From June 2026',
        baseAirport: 'HKG',
        crewIncluded: true,
        maintenanceStatus: 'Scheduled for C-Check May 2026',
        insuranceCoverage: 'Standard Widebody Coverage ($1B)',
        operatorDetails: 'Leading ACMI provider in the Asia-Pacific region with a focus on high-capacity routes.',
        crewInfo: 'Full crew complement for 12+ hour missions included.',
        image: 'https://loremflickr.com/800/600/aircraft,jet,plane?lock=8'
      },
      {
        type: 'Airbus A330-200F',
        category: 'Cargo',
        fuelBurnPerHour: 5800,
        cruiseSpeed: 470,
        range: 4000,
        maxPayload: 65000,
        maxPassengers: 0,
        takeoffDistance: 9100,
        landingDistance: 5500,
        hourlyRate: 9500,
        landingFee: 2000,
        handlingFee: 3500,
        parkingFee: 800,
        maintenanceReserve: 2200,
        crewCostPerHour: 1500,
        operatorName: 'Global Cargo Express',
        acmiRate: 8800,
        availability: 'Immediate',
        baseAirport: 'FRA',
        crewIncluded: true,
        maintenanceStatus: 'Excellent condition, fresh engines',
        insuranceCoverage: 'Cargo Specialist Coverage ($500M)',
        operatorDetails: 'Dedicated cargo ACMI operator with global reach and 24/7 support.',
        crewInfo: '3 Pilots included for long-range cargo missions.',
        image: 'https://loremflickr.com/800/600/aircraft,jet,plane?lock=9'
      },
      {
        type: 'Boeing 777-300ER',
        category: 'Heavy Jet',
        fuelBurnPerHour: 7800,
        cruiseSpeed: 488,
        range: 7370,
        maxPayload: 69000,
        maxPassengers: 550,
        takeoffDistance: 10500,
        landingDistance: 6300,
        hourlyRate: 24000,
        landingFee: 1600,
        handlingFee: 3200,
        parkingFee: 1100,
        maintenanceReserve: 3200,
        crewCostPerHour: 1900
      },
      {
        type: 'Boeing 777-8',
        category: 'Heavy Jet',
        fuelBurnPerHour: 7400,
        cruiseSpeed: 495,
        range: 8730,
        maxPayload: 72000,
        maxPassengers: 384,
        takeoffDistance: 10000,
        landingDistance: 6000,
        hourlyRate: 26000,
        landingFee: 1700,
        handlingFee: 3400,
        parkingFee: 1200,
        maintenanceReserve: 3400,
        crewCostPerHour: 2000
      },
      {
        type: 'Boeing 777-9',
        category: 'Heavy Jet',
        fuelBurnPerHour: 7900,
        cruiseSpeed: 495,
        range: 7285,
        maxPayload: 76000,
        maxPassengers: 426,
        takeoffDistance: 10500,
        landingDistance: 6500,
        hourlyRate: 28000,
        landingFee: 1800,
        handlingFee: 3600,
        parkingFee: 1300,
        maintenanceReserve: 3600,
        crewCostPerHour: 2100
      },
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
        registration: '',
        icao24: '',
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
        crewCostPerHour: 0,
        operatorName: '',
        acmiRate: 0,
        availability: '',
        baseAirport: '',
        crewIncluded: true,
        maintenanceStatus: '',
        insuranceCoverage: '',
        operatorDetails: '',
        crewInfo: '',
        monthlyFixedFee: 0,
        monthlyGuaranteedHours: 0,
        leaseDepositMonths: 0,
        minLeaseTermMonths: 0
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
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Registration</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. N12345"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.registration}
                  onChange={e => setFormData({ ...formData, registration: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ICAO24 (Hex)</label>
                <input
                  type="text"
                  placeholder="e.g. 407865"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.icao24}
                  onChange={e => setFormData({ ...formData, icao24: e.target.value.toLowerCase() })}
                />
              </div>
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
                  onChange={e => setFormData({ ...formData, hourlyRate: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Fuel Burn (L/h)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.fuelBurnPerHour}
                  onChange={e => setFormData({ ...formData, fuelBurnPerHour: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Cruise Speed (kts)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.cruiseSpeed}
                  onChange={e => setFormData({ ...formData, cruiseSpeed: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Range (nm)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.range}
                  onChange={e => setFormData({ ...formData, range: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Max Payload (kg)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.maxPayload}
                  onChange={e => setFormData({ ...formData, maxPayload: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Max Passengers</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.maxPassengers}
                  onChange={e => setFormData({ ...formData, maxPassengers: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Takeoff Dist (ft)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.takeoffDistance}
                  onChange={e => setFormData({ ...formData, takeoffDistance: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Landing Dist (ft)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.landingDistance}
                  onChange={e => setFormData({ ...formData, landingDistance: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Landing Fee (USD)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.landingFee}
                  onChange={e => setFormData({ ...formData, landingFee: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Handling Fee (USD)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.handlingFee}
                  onChange={e => setFormData({ ...formData, handlingFee: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Parking Fee (USD)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.parkingFee}
                  onChange={e => setFormData({ ...formData, parkingFee: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Maint. Reserve (USD/h)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.maintenanceReserve}
                  onChange={e => setFormData({ ...formData, maintenanceReserve: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Crew Cost (USD/h)</label>
                <input
                  required
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.crewCostPerHour}
                  onChange={e => setFormData({ ...formData, crewCostPerHour: e.target.value === '' ? '' : Number(e.target.value) })}
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
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Operator</label>
                <select
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.operatorName}
                  onChange={e => {
                    const selectedOp = operators.find(op => op.name === e.target.value);
                    setFormData({ ...formData, operatorName: e.target.value });
                  }}
                >
                  <option value="">Select Operator</option>
                  {operators.map(op => (
                    <option key={op.id} value={op.name}>{op.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ACMI Rate (USD/h)</label>
                <input
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.acmiRate}
                  onChange={e => setFormData({ ...formData, acmiRate: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Availability</label>
                <input
                  type="text"
                  placeholder="e.g. 10-20 April"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.availability}
                  onChange={e => setFormData({ ...formData, availability: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Base Airport</label>
                <input
                  type="text"
                  placeholder="e.g. DXB"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.baseAirport}
                  onChange={e => setFormData({ ...formData, baseAirport: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Crew Included</label>
                <select
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.crewIncluded ? 'Yes' : 'No'}
                  onChange={e => setFormData({ ...formData, crewIncluded: e.target.value === 'Yes' })}
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Maintenance Status</label>
                <input
                  type="text"
                  placeholder="e.g. Fresh C-Check"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.maintenanceStatus}
                  onChange={e => setFormData({ ...formData, maintenanceStatus: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Insurance Coverage</label>
                <input
                  type="text"
                  placeholder="e.g. Full Liability"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.insuranceCoverage}
                  onChange={e => setFormData({ ...formData, insuranceCoverage: e.target.value })}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Operator Details</label>
                <textarea
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.operatorDetails}
                  onChange={e => setFormData({ ...formData, operatorDetails: e.target.value })}
                />
              </div>
              <div className="space-y-1 md:col-span-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Crew Info</label>
                <textarea
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.crewInfo}
                  onChange={e => setFormData({ ...formData, crewInfo: e.target.value })}
                />
              </div>

              {/* ACMI Lease Specific Fields */}
              <div className="md:col-span-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4">ACMI Lease Terms</h4>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Monthly Fixed Fee (USD)</label>
                <input
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.monthlyFixedFee}
                  onChange={e => setFormData({ ...formData, monthlyFixedFee: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Monthly Guaranteed Hours (MGH)</label>
                <input
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.monthlyGuaranteedHours}
                  onChange={e => setFormData({ ...formData, monthlyGuaranteedHours: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Lease Deposit (Months)</label>
                <input
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.leaseDepositMonths}
                  onChange={e => setFormData({ ...formData, leaseDepositMonths: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Min Lease Term (Months)</label>
                <input
                  type="number"
                  className="w-full p-2 border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                  value={formData.minLeaseTermMonths}
                  onChange={e => setFormData({ ...formData, minLeaseTermMonths: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>

              <div className="md:col-span-3">
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
                    <td className="p-4 font-bold text-gray-900 dark:text-white">Max Payload</td>
                    {selectedForComparison.map(a => <td key={a.id} className="p-4 text-gray-600 dark:text-gray-300">{a.maxPayload} kg</td>)}
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
                    {selectedForComparison.map(a => <td key={a.id} className="p-4 font-bold text-indigo-600 dark:text-indigo-400">${(Number(a.hourlyRate) || 0).toLocaleString()}</td>)}
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
        {filteredAircraft.map((a) => {
          const isSelected = selectedForComparison.some(s => s.id === a.id);
          return (
            <div key={a.id} className={`p-6 rounded-3xl border transition-all group ${
              isSelected 
                ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-500 shadow-lg shadow-indigo-100 dark:shadow-none' 
                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500'
            }`}>
              <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                  <Plane size={24} />
                </div>
                <div>
                  <h3 className="font-black text-gray-800 dark:text-white">{a.registration || 'N/A'}</h3>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{a.type}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-widest">
                      {a.category}
                    </span>
                    {a.ai_verified && (
                      <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-widest flex items-center gap-1">
                        <Sparkles size={10} />
                        AI Verified
                      </span>
                    )}
                    {a.icao24 && (
                      <span className="text-[10px] bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-widest">
                        HEX: {a.icao24}
                      </span>
                    )}
                  </div>
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
              {a.serviceCeiling && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                    <Zap size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Ceiling</span>
                  </div>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{a.serviceCeiling.toLocaleString()} ft</p>
                </div>
              )}
              {a.mtow && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                    <Weight size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">MTOW</span>
                  </div>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{a.mtow.toLocaleString()} kg</p>
                </div>
              )}
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
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">${(Number(a.landingFee) || 0).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Handling</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">${(Number(a.handlingFee) || 0).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Parking</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">${(Number(a.parkingFee) || 0).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Maint. Res.</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">${(Number(a.maintenanceReserve) || 0).toLocaleString()}/h</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Crew Cost</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">${(Number(a.crewCostPerHour) || 0).toLocaleString()}/h</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-widest">Hourly Rate</p>
                <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">${(Number(a.hourlyRate) || 0).toLocaleString()}</p>
              </div>
              <div className="flex gap-4 items-center">
                <button
                  onClick={() => onViewAvailability?.(a.id!)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  <Calendar size={14} />
                  Availability
                </button>
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
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Flight History</h4>
                        <button
                          onClick={() => setLoggingFlightId(a.id!)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                        >
                          <Plus size={14} />
                          Log Flight
                        </button>
                      </div>

                      {loggingFlightId === a.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4"
                        >
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Date</label>
                              <input
                                type="date"
                                className="w-full p-2 text-xs border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                                value={logFormData.date}
                                onChange={e => setLogFormData({ ...logFormData, date: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Dep ICAO</label>
                              <input
                                type="text"
                                placeholder="e.g. DXB"
                                className="w-full p-2 text-xs border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                                value={logFormData.departure}
                                onChange={e => setLogFormData({ ...logFormData, departure: e.target.value.toUpperCase() })}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Arr ICAO</label>
                              <input
                                type="text"
                                placeholder="e.g. LHR"
                                className="w-full p-2 text-xs border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                                value={logFormData.destination}
                                onChange={e => setLogFormData({ ...logFormData, destination: e.target.value.toUpperCase() })}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Duration (h)</label>
                              <input
                                type="number"
                                step="0.1"
                                className="w-full p-2 text-xs border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                                value={logFormData.duration_hours}
                                onChange={e => setLogFormData({ ...logFormData, duration_hours: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Notes</label>
                            <input
                              type="text"
                              placeholder="Flight notes, delay info, etc."
                              className="w-full p-2 text-xs border dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-lg"
                              value={logFormData.notes}
                              onChange={e => setLogFormData({ ...logFormData, notes: e.target.value })}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setLoggingFlightId(null)}
                              className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleLogFlight(a.id!)}
                              disabled={loading || !logFormData.departure || !logFormData.destination}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                              {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                              Save Log
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {flightHistoryCache[a.id!] && flightHistoryCache[a.id!].length > 0 ? (
                        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest">
                              <tr>
                                <th className="p-3 font-black">Date</th>
                                <th className="p-3 font-black">Route</th>
                                <th className="p-3 font-black text-center">Duration</th>
                                <th className="p-3 font-black">Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                              {flightHistoryCache[a.id!].map((log) => (
                                <tr key={log.id} className="text-gray-600 dark:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                  <td className="p-3 font-bold whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <Calendar size={12} className="text-blue-500" />
                                      {log.date}
                                    </div>
                                  </td>
                                  <td className="p-3 font-black">
                                    <div className="flex items-center gap-2">
                                      <MapPin size={12} className="text-red-500" />
                                      {log.departure} 
                                      <span className="text-gray-400">→</span> 
                                      {log.destination}
                                    </div>
                                  </td>
                                  <td className="p-3 font-bold text-center">
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 dark:bg-gray-700/50 rounded-full border border-gray-100 dark:border-gray-600">
                                      <Clock size={10} className="text-indigo-500" />
                                      {log.duration_hours}h
                                    </div>
                                  </td>
                                  <td className="p-3 text-[10px] text-gray-500 dark:text-gray-400 italic">
                                    {log.notes || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                          <History size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No flight history available for this aircraft.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
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
