import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const FUEL_HUB_SEEDS = [
  {
    name: "Shell Aviation (Dubai)",
    airports: ["OMDB", "DWC"],
    fuelTypes: ["Jet A-1", "Avgas 100LL", "SAF"],
    services: ["Into-plane fueling", "Bulk storage", "Fuel farm management"],
    headquarters: "Dubai, UAE",
    contactEmail: "aviation.uae@shell.com",
    phone: "+971 4 402 9111",
    website: "www.shell.com/aviation",
    rating: 5,
    ai_verified: true,
    providerType: "Fuel Company"
  },
  {
    name: "Air BP (London Heathrow)",
    airports: ["EGLL", "EGKK", "EGLC"],
    fuelTypes: ["Jet A-1", "SAF", "Avgas"],
    services: ["Technical services", "Into-plane fueling"],
    headquarters: "London, UK",
    contactEmail: "airbpinfo@bp.com",
    phone: "+44 20 7496 4000",
    website: "www.airbp.com",
    rating: 5,
    ai_verified: true,
    providerType: "Fuel Company"
  },
  {
    name: "World Fuel Services (Singapore)",
    airports: ["WSSS", "WSSL"],
    fuelTypes: ["Jet A-1", "Avgas"],
    services: ["Global logistics", "Contract fueling"],
    headquarters: "Singapore",
    contactEmail: "sg.ops@wfscorp.com",
    phone: "+65 6333 1188",
    website: "www.wfscorp.com",
    rating: 5,
    ai_verified: true,
    providerType: "Fuel Company"
  },
  {
    name: "Signature Flight Support (KJFK)",
    airports: ["KJFK", "KTEB", "KLGA"],
    fuelTypes: ["Jet A", "Avgas 100LL"],
    services: ["FBO Services", "Into-plane fueling", "Hangarage"],
    headquarters: "Orlando, FL",
    contactEmail: "jfk@signatureflight.com",
    phone: "+1 718 244 3500",
    website: "www.signatureflight.com",
    rating: 4.8,
    ai_verified: true,
    providerType: "FBO"
  },
  {
    name: "HNA Aviation (Hong Kong)",
    airports: ["VHHH"],
    fuelTypes: ["Jet A-1"],
    services: ["Refueling", "Logistics"],
    headquarters: "Hong Kong",
    contactEmail: "ops@hkhnab.com",
    phone: "+852 2767 9888",
    website: "www.hkhnab.com",
    rating: 4.5,
    ai_verified: true,
    providerType: "Fuel Company"
  },
  {
    name: "TotalEnergies Aviation (Paris)",
    airports: ["LFPG", "LFPO", "LFPB"],
    fuelTypes: ["Jet A-1", "SAF", "Avgas"],
    services: ["Production", "Logistics", "Refueling"],
    headquarters: "Paris, France",
    contactEmail: "aviation.france@totalenergies.com",
    phone: "+33 1 47 44 45 46",
    website: "www.aviation.totalenergies.com",
    rating: 4.9,
    ai_verified: true,
    providerType: "Fuel Company"
  },
  {
    name: "Lufthansa LEOS (Frankfurt)",
    airports: ["EDDF", "EDDM"],
    fuelTypes: ["Jet A-1"],
    services: ["Ground services", "Refueling support"],
    headquarters: "Frankfurt, Germany",
    contactEmail: "leos@dlh.de",
    phone: "+49 69 6960",
    website: "www.lufthansa-leos.com",
    rating: 4.7,
    ai_verified: true,
    providerType: "Airport Authority"
  },
  {
    name: "ENEOS (Tokyo Haneda)",
    airports: ["RJTT", "RJAA"],
    fuelTypes: ["Jet A-1"],
    services: ["Petrochemicals", "Aviation fueling"],
    headquarters: "Tokyo, Japan",
    contactEmail: "aviation@eneos.jp",
    phone: "+81 3 6257 7111",
    website: "www.eneos.jp",
    rating: 4.6,
    ai_verified: true,
    providerType: "Fuel Company"
  },
  {
    name: "Qatar Jet Fuel (QJET)",
    airports: ["OTHH", "OTBD"],
    fuelTypes: ["Jet A-1"],
    services: ["Into-plane fueling", "Storage"],
    headquarters: "Doha, Qatar",
    contactEmail: "ops@qjet.com.qa",
    phone: "+974 4462 2662",
    website: "www.qjet.com.qa",
    rating: 5,
    ai_verified: true,
    providerType: "Fuel Company"
  },
  {
    name: "Atlantic Aviation (KLAX)",
    airports: ["KLAX", "KVNY"],
    fuelTypes: ["Jet A", "Avgas 100LL"],
    services: ["FBO Services", "Refueling", "Maintenance"],
    headquarters: "Plano, TX",
    contactEmail: "lax@atlanticaviation.com",
    phone: "+1 310 258 9822",
    website: "www.atlanticaviation.com",
    rating: 4.7,
    ai_verified: true,
    providerType: "FBO"
  }
];

export async function seedFuelProviders() {
  const providersCol = collection(db, 'fuel_providers');
  const snapshot = await getDocs(providersCol);
  
  if (snapshot.size > 0) {
    console.log('Fuel providers database already seeded.');
    return;
  }

  console.log('Seeding fuel providers...');
  for (const provider of FUEL_HUB_SEEDS) {
    try {
      await addDoc(providersCol, {
        ...provider,
        last_updated: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error seeding ${provider.name}:`, error);
    }
  }
  console.log('Fuel provider seeding complete.');
}
