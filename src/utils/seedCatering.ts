import { db } from '../firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';

const SEED_CATERING_PROVIDERS = [
  {
    name: 'LSG Sky Chefs',
    headquarters: 'Neu-Isenburg, Germany',
    airports: ['EDDF', 'EDDM', 'EGLL', 'LFPG', 'KJFK', 'KLAX', 'KLH', 'KORD', 'OMDB', 'WSSS', 'VHHH'],
    capabilities: ['Economy Catering', 'Business Class Catering', 'First Class Catering', 'VIP/Private Catering', 'Halal Meal Prep'],
    certifications: ['ISO 22000', 'HACCP'],
    aircraftTypes: ['A320 FAMILY', 'A330', 'A350', 'A380', 'B737 FAMILY', 'B777', 'B787'],
    contactEmail: 'contact@lsgskychefs.com',
    website: 'https://www.lsgskychefs.com',
    rating: 4.9,
    ai_verified: true,
    last_updated: new Date().toISOString()
  },
  {
    name: 'Gate Gourmet',
    headquarters: 'Zurich, Switzerland',
    airports: ['LSZH', 'EGLL', 'LFPG', 'KJFK', 'KLAX', 'KORD', 'OMDB', 'WSSS', 'VHHH', 'EDDF', 'EDDM'],
    capabilities: ['Airline Catering', 'In-Flight Retail', 'VIP Catering', 'Special Dietary Meals'],
    certifications: ['ISO 22000', 'HACCP'],
    aircraftTypes: ['A320 FAMILY', 'B737 FAMILY', 'A330', 'B777', 'B787', 'A380'],
    contactEmail: 'info@gategroup.com',
    website: 'https://www.gategroup.com',
    rating: 4.8,
    ai_verified: true,
    last_updated: new Date().toISOString()
  },
  {
    name: 'Dnata Catering',
    headquarters: 'Dubai, UAE',
    airports: ['OMDB', 'OMDW', 'OTHH', 'OBBI', 'OKBK', 'EGLL', 'LFPG', 'EDDF', 'KLAX', 'KJFK'],
    capabilities: ['Premium In-flight Catering', 'VIP Service', 'Kosher Catering', 'Halal Catering'],
    certifications: ['ISO 22000', 'HACCP'],
    aircraftTypes: ['A380', 'B777', 'B787', 'A350', 'A320 FAMILY', 'B737 FAMILY'],
    contactEmail: 'catering@dnata.com',
    website: 'https://www.dnata.com/en/catering',
    rating: 5.0,
    ai_verified: true,
    last_updated: new Date().toISOString()
  }
];

export const seedCateringProviders = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'catering_providers'));
    if (snapshot.empty) {
      console.log('Seeding Catering providers...');
      for (const provider of SEED_CATERING_PROVIDERS) {
        await addDoc(collection(db, 'catering_providers'), provider);
      }
      console.log('Catering providers seeded successfully.');
    }
  } catch (error) {
    console.error('Error seeding Catering providers:', error);
  }
};
