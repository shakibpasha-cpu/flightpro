import { db } from '../firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';

const SEED_MRO_PROVIDERS = [
  {
    name: 'Lufthansa Technik',
    headquarters: 'Hamburg, Germany',
    airports: ['EDDF', 'EDDM', 'EDDL', 'EGLL', 'LFPG', 'UUEE', 'OMDB', 'WSSS', 'VHHH', 'RKSI', 'RJAA', 'KLAX', 'KJFK', 'KORD'],
    capabilities: ['Line Maintenance', 'Base Maintenance', 'A-Check', 'B-Check', 'C-Check', 'D-Check', 'Engine Overhaul', 'Avionics Refurbishment', 'Interior Retrofit', 'Composite Repair', 'NDT Testing', 'Painting', 'Component Repair'],
    certifications: ['EASA Part 145', 'FAA Part 145', 'CAAC'],
    aircraftTypes: ['A320 FAMILY', 'A330', 'A340', 'A350', 'A380', 'B737 FAMILY', 'B747', 'B777', 'B787', 'MD-11'],
    contactEmail: 'contact@lufthansa-technik.com',
    website: 'https://www.lufthansa-technik.com',
    rating: 5,
    ai_verified: true,
    last_updated: new Date().toISOString()
  },
  {
    name: 'ST Engineering Aerospace',
    headquarters: 'Singapore',
    airports: ['WSSS', 'WMKK', 'VTBS', 'VHHH', 'RKSI', 'RJAA', 'KLAX', 'KJFK', 'EFHK', 'EGLL'],
    capabilities: ['Airframe Maintenance', 'Component Repair', 'Engine Overhaul', 'PTF Conversions'],
    certifications: ['EASA Part 145', 'FAA Part 145', 'SAR 145'],
    aircraftTypes: ['A320 FAMILY', 'B737 FAMILY', 'A330', 'B777', 'B767'],
    contactEmail: 'aerospace@stengg.com',
    website: 'https://www.stengg.com/en/aerospace',
    rating: 5,
    ai_verified: true,
    last_updated: new Date().toISOString()
  },
  {
    name: 'AAR Corp',
    headquarters: 'Wood Dale, Illinois, USA',
    airports: ['KORD', 'KLAX', 'KJFK', 'KMIA', 'KDFW', 'EGLL', 'LFPG', 'EDDF'],
    capabilities: ['Airframe MRO', 'Component Repair', 'Inventory Management', 'Engineering Services'],
    certifications: ['FAA Part 145', 'EASA Part 145'],
    aircraftTypes: ['B737 FAMILY', 'A320 FAMILY', 'B757', 'B767', 'CRJ FAMILY', 'ERJ FAMILY'],
    contactEmail: 'info@aarcorp.com',
    website: 'https://www.aarcorp.com',
    rating: 4.8,
    ai_verified: true,
    last_updated: new Date().toISOString()
  },
  {
    name: 'Turkish Technic',
    headquarters: 'Istanbul, Turkey',
    airports: ['LTFM', 'LTFJ', 'LTAI', 'LTAC', 'ORBI', 'EGLL', 'LFPG', 'EDDF', 'OMDB', 'OTHH'],
    capabilities: ['Line Maintenance', 'Base Maintenance', 'C-Check', 'Engine MRO', 'APU Maintenance'],
    certifications: ['SHY-145', 'EASA Part 145', 'FAA Part 145'],
    aircraftTypes: ['A320 FAMILY', 'A330', 'A353', 'B737 FAMILY', 'B777', 'B787'],
    contactEmail: 'info@turkishtechnic.com',
    website: 'https://www.turkishtechnic.com',
    rating: 4.9,
    ai_verified: true,
    last_updated: new Date().toISOString()
  },
  {
    name: 'Emirates Engineering',
    headquarters: 'Dubai, UAE',
    airports: ['OMDB', 'OMDW', 'OTHH', 'OBBI', 'OKBK', 'EGLL', 'LFPG', 'EDDF'],
    capabilities: ['Line Maintenance', 'Base Maintenance', 'Engine Testing', 'Painting', 'Interior Workshop'],
    certifications: ['GCAA CAR 145', 'EASA Part 145', 'FAA Part 145'],
    aircraftTypes: ['B777 FAMILY', 'A380 FAMILY', 'B787'],
    contactEmail: 'engineering@emirates.com',
    website: 'https://www.emiratesengineering.com',
    rating: 5,
    ai_verified: true,
    last_updated: new Date().toISOString()
  },
  {
    name: 'HAECO',
    headquarters: 'Hong Kong',
    airports: ['VHHH', 'ZSAM', 'ZSSS', 'ZBAA', 'RKSI', 'RJAA'],
    capabilities: ['Airframe Maintenance', 'Line Maintenance', 'Component Repair', 'Engine Overhaul'],
    certifications: ['HKAR-145', 'EASA Part 145', 'FAA Part 145'],
    aircraftTypes: ['A320', 'A330', 'A350', 'B737', 'B747', 'B777', 'B787'],
    contactEmail: 'info@haeco.com',
    website: 'https://www.haeco.com',
    rating: 4.7,
    ai_verified: true,
    last_updated: new Date().toISOString()
  },
  {
    name: 'SR Technics',
    headquarters: 'Zurich, Switzerland',
    airports: ['LSZH', 'LSGG', 'EDDF', 'EGLL', 'LFPG', 'EBBR', 'OMDB'],
    capabilities: ['Engine Services', 'Line Maintenance', 'Training', 'Engineering'],
    certifications: ['EASA Part 145', 'FAA Part 145'],
    aircraftTypes: ['A320', 'A330', 'A340', 'B737', 'B777'],
    contactEmail: 'info@srtechnics.com',
    website: 'https://www.srtechnics.com',
    rating: 4.8,
    ai_verified: true,
    last_updated: new Date().toISOString()
  }
];

export const seedMROProviders = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'mro_providers'));
    if (snapshot.empty) {
      console.log('Seeding MRO providers...');
      for (const provider of SEED_MRO_PROVIDERS) {
        await addDoc(collection(db, 'mro_providers'), provider);
      }
      console.log('MRO providers seeded successfully.');
    }
  } catch (error) {
    console.error('Error seeding MRO providers:', error);
  }
};
