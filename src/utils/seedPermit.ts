import { db } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

const PERMIT_PROVIDER_SEEDS = [
  {
    name: "HADID International Services",
    headquarters: "Dubai, UAE",
    regions: ["Middle East", "Africa", "Global"],
    serviceType: "Full-Service Handling (Trip Support)",
    services: ["Overfly Permits", "Landing Permits", "Ground Handling", "Fuel Coordination"],
    contactEmail: "ops@hadid.aero",
    phone: "+971 4 205 2500",
    website: "www.hadid.aero",
    rating: 5,
    ai_verified: true
  },
  {
    name: "UAS International Trip Support",
    headquarters: "Dubai, UAE",
    regions: ["Middle East", "Asia-Pacific", "Global"],
    serviceType: "Full-Service Handling (Trip Support)",
    services: ["Permits", "Executive Travel", "Fuel", "Logistics"],
    contactEmail: "ops@uas.aero",
    phone: "+971 4 299 6633",
    website: "www.uas.aero",
    rating: 4.9,
    ai_verified: true
  },
  {
    name: "Jetex",
    headquarters: "Dubai, UAE",
    regions: ["Africa", "Europe", "Middle East", "Global"],
    serviceType: "Full-Service Handling (Trip Support)",
    services: ["Permits", "FBO", "Catering", "Fuel"],
    contactEmail: "ops@jetex.com",
    phone: "+971 4 212 4000",
    website: "www.jetex.com",
    rating: 4.9,
    ai_verified: true
  },
  {
    name: "Universal Weather and Aviation",
    headquarters: "Houston, TX",
    regions: ["North America", "South America", "Global"],
    serviceType: "Full-Service Handling (Trip Support)",
    services: ["Overfly Permits", "Flight Planning", "Weather Services"],
    contactEmail: "worldwide@univ-wea.com",
    phone: "+1 713 944 1440",
    website: "www.universalweather.com",
    rating: 5,
    ai_verified: true
  },
  {
    name: "Air Partner",
    headquarters: "Gatwick, UK",
    regions: ["Europe", "North America"],
    serviceType: "Full-Service Handling (Trip Support)",
    services: ["Permits", "Charter", "Emergency Planning"],
    contactEmail: "support@airpartner.com",
    phone: "+44 1293 844 800",
    website: "www.airpartner.com",
    rating: 4.7,
    ai_verified: true
  },
  {
    name: "GSS (Global Support Services)",
    headquarters: "Addis Ababa, Ethiopia",
    regions: ["Africa"],
    serviceType: "Permit Specialist",
    services: ["Overfly Permits", "Landing Permits", "Ground Handling"],
    contactEmail: "info@gssaviation.com",
    phone: "+251 11 661 0000",
    website: "www.gssaviation.com",
    rating: 4.5,
    ai_verified: true
  }
];

export async function seedPermitProviders() {
  const providersCol = collection(db, 'permit_providers');
  const snapshot = await getDocs(providersCol);
  
  if (snapshot.size > 0) {
    console.log('Permit providers already seeded.');
    return;
  }

  console.log('Seeding permit providers...');
  for (const provider of PERMIT_PROVIDER_SEEDS) {
    try {
      await addDoc(providersCol, {
        ...provider,
        last_updated: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error seeding ${provider.name}:`, error);
    }
  }
  console.log('Permit provider seeding complete.');
}
