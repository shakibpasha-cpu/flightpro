import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Database, 
  Plane, 
  Building2, 
  Calendar, 
  Fuel, 
  Map, 
  Users, 
  Shield, 
  TrendingUp, 
  Plus, 
  Search,
  ChevronRight,
  Info
} from 'lucide-react';
import { collection, getDocs, query, limit, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

const TABLES = [
  { id: 'aircraft_master', name: 'Aircraft Master', icon: Plane, color: 'text-blue-500' },
  { id: 'operators', name: 'Operators', icon: Building2, color: 'text-indigo-500' },
  { id: 'aircraft_listings', name: 'Aircraft Listings', icon: Database, color: 'text-emerald-500' },
  { id: 'availability', name: 'Availability', icon: Calendar, color: 'text-amber-500' },
  { id: 'fuel_prices', name: 'Fuel Prices', icon: Fuel, color: 'text-orange-500' },
  { id: 'fir_charges', name: 'FIR Charges', icon: Map, color: 'text-purple-500' },
  { id: 'crew_costs', name: 'Crew Costs', icon: Users, color: 'text-pink-500' },
  { id: 'insurance_rules', name: 'Insurance Rules', icon: Shield, color: 'text-red-500' },
  { id: 'ai_predictions', name: 'AI Predictions', icon: TrendingUp, color: 'text-cyan-500' },
  { id: 'empty_legs', name: 'Empty Legs', icon: Plane, color: 'text-orange-600' },
];

export const ACMIDatabase: React.FC = () => {
  const [activeTable, setActiveTable] = useState(TABLES[0].id);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTable]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, activeTable), limit(50));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(docs);
    } catch (error) {
      console.error(`Error fetching ${activeTable}:`, error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const seedTable = async (tableId: string) => {
    if (tableId === 'aircraft_master') {
      const samples = [
        { aircraft_type: 'A320-200', category: 'Narrowbody', manufacturer: 'Airbus', max_range_km: 6100, max_payload_kg: 19000, cruise_speed_kts: 450, fuel_burn_kg_per_hr: 2500, mtow_kg: 77000, runway_required_m: 1800, passenger_capacity: 180 },
        { aircraft_type: 'B737-800', category: 'Narrowbody', manufacturer: 'Boeing', max_range_km: 5765, max_payload_kg: 20500, cruise_speed_kts: 450, fuel_burn_kg_per_hr: 2400, mtow_kg: 79000, runway_required_m: 2000, passenger_capacity: 189 },
        { aircraft_type: 'A330-300', category: 'Widebody', manufacturer: 'Airbus', max_range_km: 11750, max_payload_kg: 45000, cruise_speed_kts: 470, fuel_burn_kg_per_hr: 5500, mtow_kg: 242000, runway_required_m: 2500, passenger_capacity: 300 },
        { aircraft_type: 'B777-300ER', category: 'Widebody', manufacturer: 'Boeing', max_range_km: 13650, max_payload_kg: 69000, cruise_speed_kts: 490, fuel_burn_kg_per_hr: 7500, mtow_kg: 351500, runway_required_m: 3000, passenger_capacity: 396 },
        { aircraft_type: 'Global 6000', category: 'Ultra Long Range', manufacturer: 'Bombardier', max_range_km: 11112, max_payload_kg: 2617, cruise_speed_kts: 488, fuel_burn_kg_per_hr: 1500, mtow_kg: 45132, runway_required_m: 1974, passenger_capacity: 14 },
        { aircraft_type: 'Gulfstream G650', category: 'Ultra Long Range', manufacturer: 'Gulfstream', max_range_km: 12964, max_payload_kg: 2948, cruise_speed_kts: 516, fuel_burn_kg_per_hr: 1600, mtow_kg: 45178, runway_required_m: 1786, passenger_capacity: 19 },
        { aircraft_type: 'A321neo', category: 'Narrowbody', manufacturer: 'Airbus', max_range_km: 7400, max_payload_kg: 25500, cruise_speed_kts: 450, fuel_burn_kg_per_hr: 2300, mtow_kg: 97000, runway_required_m: 1988, passenger_capacity: 220 },
        { aircraft_type: 'B787-9', category: 'Widebody', manufacturer: 'Boeing', max_range_km: 14140, max_payload_kg: 52000, cruise_speed_kts: 488, fuel_burn_kg_per_hr: 5400, mtow_kg: 254000, runway_required_m: 2800, passenger_capacity: 290 },
        { aircraft_type: 'A350-900', category: 'Widebody', manufacturer: 'Airbus', max_range_km: 15000, max_payload_kg: 53000, cruise_speed_kts: 488, fuel_burn_kg_per_hr: 5800, mtow_kg: 280000, runway_required_m: 2600, passenger_capacity: 325 },
        { aircraft_type: 'B747-8F', category: 'Freighter', manufacturer: 'Boeing', max_range_km: 8130, max_payload_kg: 137700, cruise_speed_kts: 490, fuel_burn_kg_per_hr: 10500, mtow_kg: 447700, runway_required_m: 3100, passenger_capacity: 0 },
        { aircraft_type: 'MD-11F', category: 'Freighter', manufacturer: 'McDonnell Douglas', max_range_km: 7320, max_payload_kg: 91670, cruise_speed_kts: 473, fuel_burn_kg_per_hr: 8200, mtow_kg: 285990, runway_required_m: 2900, passenger_capacity: 0 },
        { aircraft_type: 'ATR 72-600', category: 'Regional', manufacturer: 'ATR', max_range_km: 1528, max_payload_kg: 7500, cruise_speed_kts: 275, fuel_burn_kg_per_hr: 600, mtow_kg: 23000, runway_required_m: 1315, passenger_capacity: 72 },
        { aircraft_type: 'Dash 8 Q400', category: 'Regional', manufacturer: 'De Havilland', max_range_km: 2040, max_payload_kg: 8670, cruise_speed_kts: 360, fuel_burn_kg_per_hr: 1100, mtow_kg: 29257, runway_required_m: 1425, passenger_capacity: 78 },
        { aircraft_type: 'Embraer E195', category: 'Regional', manufacturer: 'Embraer', max_range_km: 4260, max_payload_kg: 13950, cruise_speed_kts: 447, fuel_burn_kg_per_hr: 1800, mtow_kg: 52290, runway_required_m: 2100, passenger_capacity: 118 },
        { aircraft_type: 'CRJ900', category: 'Regional', manufacturer: 'Bombardier', max_range_km: 2876, max_payload_kg: 10250, cruise_speed_kts: 447, fuel_burn_kg_per_hr: 1600, mtow_kg: 38330, runway_required_m: 1900, passenger_capacity: 90 },
        { aircraft_type: 'Falcon 8X', category: 'Large Cabin', manufacturer: 'Dassault', max_range_km: 11945, max_payload_kg: 2218, cruise_speed_kts: 488, fuel_burn_kg_per_hr: 1300, mtow_kg: 33113, runway_required_m: 1792, passenger_capacity: 14 },
        { aircraft_type: 'Challenger 350', category: 'Super Midsize', manufacturer: 'Bombardier', max_range_km: 5926, max_payload_kg: 1542, cruise_speed_kts: 459, fuel_burn_kg_per_hr: 900, mtow_kg: 18416, runway_required_m: 1474, passenger_capacity: 10 },
        { aircraft_type: 'Citation Latitude', category: 'Midsize', manufacturer: 'Cessna', max_range_km: 5000, max_payload_kg: 1134, cruise_speed_kts: 446, fuel_burn_kg_per_hr: 750, mtow_kg: 13971, runway_required_m: 1091, passenger_capacity: 9 },
        { aircraft_type: 'Phenom 300E', category: 'Light Jet', manufacturer: 'Embraer', max_range_km: 3650, max_payload_kg: 1105, cruise_speed_kts: 453, fuel_burn_kg_per_hr: 600, mtow_kg: 8150, runway_required_m: 978, passenger_capacity: 8 },
        { aircraft_type: 'King Air 350i', category: 'Turboprop', manufacturer: 'Beechcraft', max_range_km: 3345, max_payload_kg: 1154, cruise_speed_kts: 312, fuel_burn_kg_per_hr: 350, mtow_kg: 6804, runway_required_m: 1006, passenger_capacity: 9 }
      ];
      for (const s of samples) await addDoc(collection(db, 'aircraft_master'), s);
    } else if (tableId === 'operators') {
      const samples = [
        { operator_name: 'Avia Solutions Group', country: 'Lithuania', base_airport: 'EYVI', contact_email: 'info@aviasg.com', acmi_available: true, rating: 5.0 },
        { operator_name: 'ASL Aviation Holdings', country: 'Ireland', base_airport: 'EIDW', contact_email: 'cargo@aslaviation.com', acmi_available: true, rating: 4.9 },
        { operator_name: 'XYZ Air', country: 'UAE', base_airport: 'OMDB', contact_email: 'ops@xyz.com', acmi_available: true, rating: 4.8 },
        { operator_name: 'Global Charter', country: 'UK', base_airport: 'EGLL', contact_email: 'charter@global.com', acmi_available: true, rating: 4.5 },
        { operator_name: 'EuroWings ACMI', country: 'Germany', base_airport: 'EDDF', contact_email: 'acmi@eurowings.de', acmi_available: true, rating: 4.2 },
        { operator_name: 'Pacific Cargo', country: 'USA', base_airport: 'KLAX', contact_email: 'cargo@pacific.com', acmi_available: true, rating: 4.6 },
        { operator_name: 'Asian Sky', country: 'Singapore', base_airport: 'WSSS', contact_email: 'ops@asiansky.sg', acmi_available: true, rating: 4.9 }
      ];
      for (const s of samples) await addDoc(collection(db, 'operators'), s);
    } else if (tableId === 'aircraft_listings') {
      const aircraftSnap = await getDocs(query(collection(db, 'aircraft_master'), limit(20)));
      const operatorSnap = await getDocs(query(collection(db, 'operators'), limit(5)));
      
      if (aircraftSnap.empty || operatorSnap.empty) {
        throw new Error("Please seed Aircraft Master and Operators first!");
      }

      const aircraftDocs = aircraftSnap.docs;
      const operatorDocs = operatorSnap.docs;

      const samples = aircraftDocs.map((doc, index) => {
        const operator = operatorDocs[index % operatorDocs.length];
        const baseRate = 2000 + (Math.random() * 8000);
        return { 
          aircraft_id: doc.id, 
          operator_id: operator.id, 
          tail_number: `REG-${Math.random().toString(36).substring(2, 7).toUpperCase()}`, 
          year_of_manufacture: 2010 + Math.floor(Math.random() * 14), 
          configuration: 'Standard', 
          acmi_rate_per_hr: Math.round(baseRate), 
          currency: 'USD', 
          crew_included: true, 
          maintenance_included: true, 
          insurance_included: true, 
          status: 'Active' 
        };
      });
      for (const s of samples) await addDoc(collection(db, 'aircraft_listings'), s);
    } else if (tableId === 'availability') {
      const listingSnap = await getDocs(query(collection(db, 'aircraft_listings'), limit(2)));
      if (listingSnap.empty) throw new Error("Please seed Aircraft Listings first!");
      const listingIds = listingSnap.docs.map(d => d.id);
      const samples = [
        { aircraft_listing_id: listingIds[0], start_date: '2026-04-01', end_date: '2026-04-10', availability_status: 'Available', location_airport: 'OMDB' },
        { aircraft_listing_id: listingIds[1] || listingIds[0], start_date: '2026-05-15', end_date: '2026-06-15', availability_status: 'Booked', location_airport: 'EGLL' },
      ];
      for (const s of samples) await addDoc(collection(db, 'availability'), s);
    } else if (tableId === 'pricing_adjustments') {
      const listingSnap = await getDocs(query(collection(db, 'aircraft_listings'), limit(2)));
      const listingIds = listingSnap.docs.map(d => d.id);
      const samples = [
        { aircraft_listing_id: listingIds[0] || 'global', season: 'High', demand_multiplier: 1.2, urgency_multiplier: 1.3, region: 'Middle East' },
        { aircraft_listing_id: 'global', season: 'Peak', demand_multiplier: 1.5, urgency_multiplier: 1.1, region: 'Europe' },
        { aircraft_listing_id: listingIds[1] || 'global', season: 'Low', demand_multiplier: 0.9, urgency_multiplier: 1.0, region: 'Asia' }
      ];
      for (const s of samples) await addDoc(collection(db, 'pricing_adjustments'), s);
    } else if (tableId === 'fuel_prices') {
      const samples = [
        { airport: 'OMDB', fuel_price_per_kg: 0.85, last_updated: new Date().toISOString() },
        { airport: 'EGLL', fuel_price_per_kg: 0.92, last_updated: new Date().toISOString() },
        { airport: 'KJFK', fuel_price_per_kg: 0.88, last_updated: new Date().toISOString() }
      ];
      for (const s of samples) await addDoc(collection(db, 'fuel_prices'), s);
    } else if (tableId === 'fir_charges') {
      const samples = [
        { country: 'Pakistan', charge_per_km: 0.12, weight_factor: 1.1 },
        { country: 'India', charge_per_km: 0.15, weight_factor: 1.2 }
      ];
      for (const s of samples) await addDoc(collection(db, 'fir_charges'), s);
    } else if (tableId === 'airport_charges') {
      const samples = [
        { airport: 'OPLA', landing_fee: 2500, handling_fee: 1500, parking_fee_per_hr: 200 },
        { airport: 'OMDB', landing_fee: 3500, handling_fee: 2000, parking_fee_per_hr: 350 }
      ];
      for (const s of samples) await addDoc(collection(db, 'airport_charges'), s);
    } else if (tableId === 'crew_costs') {
      const samples = [
        { aircraft_type: 'A320', crew_per_day_cost: 600, hotel_cost: 300, transport_cost: 150 },
        { aircraft_type: 'B737-800', crew_per_day_cost: 550, hotel_cost: 250, transport_cost: 120 }
      ];
      for (const s of samples) await addDoc(collection(db, 'crew_costs'), s);
    } else if (tableId === 'insurance_rules') {
      const samples = [
        { region: 'Middle East', base_included: true, war_risk_multiplier: 1.25 },
        { region: 'Europe', base_included: true, war_risk_multiplier: 1.0 }
      ];
      for (const s of samples) await addDoc(collection(db, 'insurance_rules'), s);
    } else if (tableId === 'ai_predictions') {
      const listingSnap = await getDocs(query(collection(db, 'aircraft_listings'), limit(3)));
      if (listingSnap.empty) throw new Error("Please seed Aircraft Listings first!");
      const listingIds = listingSnap.docs.map(d => d.id);
      const samples = [
        { aircraft_listing_id: listingIds[0], predicted_availability: 'Likely Available', confidence_score: 0.78, predicted_rate: 3700 },
        { aircraft_listing_id: listingIds[1] || listingIds[0], predicted_availability: 'High Demand', confidence_score: 0.85, predicted_rate: 4200 }
      ];
      for (const s of samples) await addDoc(collection(db, 'ai_predictions'), s);
    } else if (tableId === 'empty_legs') {
      const listingSnap = await getDocs(query(collection(db, 'aircraft_listings'), limit(3)));
      if (listingSnap.empty) throw new Error("Please seed Aircraft Listings first!");
      const listingIds = listingSnap.docs.map(d => d.id);
      const samples = [
        { route: 'OMDB - EGLL', aircraft_listing_id: listingIds[0], discount_percentage: 40, date: '2026-04-05' },
        { route: 'KJFK - OMDB', aircraft_listing_id: listingIds[1] || listingIds[0], discount_percentage: 55, date: '2026-04-12' },
        { route: 'EGLL - KJFK', aircraft_listing_id: listingIds[2] || listingIds[0], discount_percentage: 30, date: '2026-04-18' }
      ];
      for (const s of samples) await addDoc(collection(db, 'empty_legs'), s);
    }
  };

  const seedSampleData = async () => {
    setLoading(true);
    try {
      await seedTable(activeTable);
      await fetchData();
    } catch (error) {
      console.error("Error seeding data:", error);
      alert(error instanceof Error ? error.message : "Failed to seed data.");
    } finally {
      setLoading(false);
    }
  };

  const seedAllData = async () => {
    setLoading(true);
    try {
      // Correct Relation Flow: Master -> Operators -> Listings -> Dependents
      await seedTable('aircraft_master');
      await seedTable('operators');
      await seedTable('aircraft_listings');
      await seedTable('availability');
      await seedTable('pricing_adjustments');
      await seedTable('ai_predictions');
      await seedTable('empty_legs');
      // Independent tables
      await seedTable('fuel_prices');
      await seedTable('fir_charges');
      await seedTable('airport_charges');
      await seedTable('crew_costs');
      await seedTable('insurance_rules');
      
      await fetchData();
      alert("Database successfully seeded with full relation flow!");
    } catch (error) {
      console.error("Error seeding all data:", error);
      alert(error instanceof Error ? error.message : "Failed to seed all data.");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(item => 
    JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <div className="p-8 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">ACMI Production Database</h1>
            <p className="text-sm text-gray-500 font-medium">Manage master tables, listings, and pricing factors</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search database..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all w-64"
              />
            </div>
            <button 
              onClick={seedAllData}
              disabled={loading}
              className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
            >
              <Database size={16} />
              Seed All
            </button>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
              <Plus size={16} />
              Add Record
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TABLES.map((table) => (
            <button
              key={table.id}
              onClick={() => setActiveTable(table.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTable === table.id
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <table.icon size={14} className={activeTable === table.id ? '' : table.color} />
              {table.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-grow overflow-auto p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Loading {activeTable}...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                  {Object.keys(filteredData[0]).filter(k => k !== 'id').map((key) => (
                    <th key={key} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    {Object.entries(row).filter(([k]) => k !== 'id').map(([key, value]: [string, any], j) => (
                      <td key={j} className="px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {typeof value === 'boolean' ? (
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${value ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {value ? 'Yes' : 'No'}
                          </span>
                        ) : typeof value === 'object' ? (
                          <span className="text-gray-400 italic">Object</span>
                        ) : (
                          value?.toString() || '-'
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-right">
                      <button className="text-indigo-600 hover:text-indigo-700 font-bold text-xs uppercase tracking-widest">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Info size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">No Data Found</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">This table is currently empty. Start by adding your first record.</p>
            <button 
              onClick={seedSampleData}
              className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              <Plus size={16} />
              Seed Sample Data
            </button>
          </div>
        )}
      </div>

      <div className="p-6 bg-indigo-600 text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-2xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <h4 className="font-black uppercase tracking-tighter">AI Data Strategy</h4>
            <p className="text-xs opacity-80 font-medium">Currently using manual data. AI Scraper & Estimator will begin populating this database as you scale.</p>
          </div>
          <button className="ml-auto bg-white text-indigo-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all">
            Enable AI Scraping
          </button>
        </div>
      </div>
    </div>
  );
};
