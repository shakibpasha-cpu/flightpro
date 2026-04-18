import { operatorService, Operator } from '../services/operatorService';
import { db } from '../firebase';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';

const SEED_OPERATORS: Omit<Operator, 'id'>[] = [
  {
    operator_name: 'Emirates',
    country: 'UAE',
    base_airport: 'OMDB',
    contact_email: 'aoc@emirates.com',
    acmi_available: true,
    rating: 95
  },
  {
    operator_name: 'Qatar Airways',
    country: 'Qatar',
    base_airport: 'OTHH',
    contact_email: 'ops@qatarairways.com.qa',
    acmi_available: true,
    rating: 94
  },
  {
    operator_name: 'VistaJet',
    country: 'Malta',
    base_airport: 'LMML',
    contact_email: 'charter@vistajet.com',
    acmi_available: true,
    rating: 92
  },
  {
    operator_name: 'Pakistan International Airlines',
    country: 'Pakistan',
    base_airport: 'OPKC',
    contact_email: 'info@piac.aero',
    acmi_available: false,
    rating: 65
  },
  {
    operator_name: 'Lufthansa',
    country: 'Germany',
    base_airport: 'EDDF',
    contact_email: 'ops@lufthansa.com',
    acmi_available: true,
    rating: 90
  },
  {
    operator_name: 'British Airways',
    country: 'UK',
    base_airport: 'EGLL',
    contact_email: 'ops@ba.com',
    acmi_available: true,
    rating: 88
  },
  {
    operator_name: 'Air Canada',
    country: 'Canada',
    base_airport: 'CYYZ',
    contact_email: 'ops@aircanada.ca',
    acmi_available: true,
    rating: 85
  },
  {
    operator_name: 'Singapore Airlines',
    country: 'Singapore',
    base_airport: 'WSSS',
    contact_email: 'ops@singaporeair.com.sg',
    acmi_available: true,
    rating: 96
  },
  {
    operator_name: 'Cargolux',
    country: 'Luxembourg',
    base_airport: 'ELLX',
    contact_email: 'ops@cargolux.com',
    acmi_available: true,
    rating: 93
  },
  {
    operator_name: 'NetJets Europe',
    country: 'Portugal',
    base_airport: 'LPPT',
    contact_email: 'ops@netjets.com',
    acmi_available: true,
    rating: 91
  }
];

const SEED_AIRCRAFT_RATES = [
  { aircraft_type: 'A320', min_rate: 4500, max_rate: 6500, fuel_burn: 2500, cruise_speed: 450, category: 'Narrowbody', payload_kg: 18000, cargo_volume_cbm: 37, cargo_type: 'General' },
  { aircraft_type: 'B737', min_rate: 4000, max_rate: 6000, fuel_burn: 2600, cruise_speed: 450, category: 'Narrowbody', payload_kg: 17000, cargo_volume_cbm: 30, cargo_type: 'General' },
  { aircraft_type: 'B737-800F', min_rate: 5000, max_rate: 7000, fuel_burn: 2600, cruise_speed: 450, category: 'Cargo', payload_kg: 23000, cargo_volume_cbm: 140, cargo_type: 'General' },
  { aircraft_type: 'A321F', min_rate: 6000, max_rate: 8000, fuel_burn: 2700, cruise_speed: 450, category: 'Cargo', payload_kg: 27000, cargo_volume_cbm: 160, cargo_type: 'General' },
  { aircraft_type: 'B767F', min_rate: 10000, max_rate: 14000, fuel_burn: 4500, cruise_speed: 460, category: 'Cargo', payload_kg: 52000, cargo_volume_cbm: 400, cargo_type: 'Pharma' },
  { aircraft_type: 'B777F', min_rate: 15000, max_rate: 22000, fuel_burn: 7000, cruise_speed: 490, category: 'Cargo', payload_kg: 100000, cargo_volume_cbm: 650, cargo_type: 'Live animals' },
  { aircraft_type: 'A330', min_rate: 8000, max_rate: 12000, fuel_burn: 5500, cruise_speed: 470, category: 'Widebody', payload_kg: 36000, cargo_volume_cbm: 130, cargo_type: 'General' },
  { aircraft_type: 'B777', min_rate: 12000, max_rate: 18000, fuel_burn: 7000, cruise_speed: 490, category: 'Widebody', payload_kg: 45000, cargo_volume_cbm: 160, cargo_type: 'General' },
  { aircraft_type: 'ATR72', min_rate: 2000, max_rate: 3000, fuel_burn: 1000, cruise_speed: 280, category: 'Regional', payload_kg: 7500, cargo_volume_cbm: 15, cargo_type: 'General' },
  { aircraft_type: 'G650', min_rate: 8000, max_rate: 12000, fuel_burn: 1500, cruise_speed: 510, category: 'Private Jet', payload_kg: 2500, cargo_volume_cbm: 5, cargo_type: 'General' },
];

export const seedOperators = async () => {
  console.log('Starting data seeding...');
  
  // 1. Seed Operators
  const existingOps = await operatorService.getAllOperators();
  if (existingOps.length === 0) {
    for (const op of SEED_OPERATORS) {
      const docRef = await addDoc(collection(db, 'operators_master'), op);
      // Also add to operators for compatibility
      await addDoc(collection(db, 'operators'), { ...op, id: docRef.id });
      
      // Add random fleet for each operator
      const randomAircraft = SEED_AIRCRAFT_RATES[Math.floor(Math.random() * SEED_AIRCRAFT_RATES.length)];
      await addDoc(collection(db, 'aircraft_fleet'), {
        operator_id: docRef.id,
        aircraft_type: randomAircraft.aircraft_type,
        quantity: Math.floor(Math.random() * 10) + 1,
        avg_age: Math.floor(Math.random() * 15) + 5
      });
    }
  }

  // 2. Seed Aircraft Rates
  const ratesSnap = await getDocs(collection(db, 'aircraft_rates'));
  if (ratesSnap.empty) {
    for (const rate of SEED_AIRCRAFT_RATES) {
      await addDoc(collection(db, 'aircraft_rates'), rate);
    }
  }

  console.log('Seeding completed successfully.');
};
