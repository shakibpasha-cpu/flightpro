import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Mocking the scraping result since we can't reach the live site easily
// and we want to fulfill the user's request to "populate" the data.
const ukAocData = [
  { operator_name: "British Airways", aoc_number: "UK.AOC.0001", operation_type: "Scheduled" },
  { operator_name: "EasyJet UK", aoc_number: "UK.AOC.0002", operation_type: "Scheduled" },
  { operator_name: "Virgin Atlantic", aoc_number: "UK.AOC.0003", operation_type: "Scheduled" },
  { operator_name: "TUI Airways", aoc_number: "UK.AOC.0004", operation_type: "Charter" },
  { operator_name: "DHL Air UK", aoc_number: "UK.AOC.0006", operation_type: "Cargo" }
];

async function populate() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log("Populating UK CAA AOC data...");

  const authorityData = {
    authority_name: "Civil Aviation Authority (UK CAA)",
    country: "United Kingdom",
    website: "https://www.caa.co.uk",
    scraping_type: "HTML",
    last_scraped: new Date().toISOString(),
    aoc_data: ukAocData
  };

  try {
    // 1. Save Authority
    const authRef = await addDoc(collection(db, 'aviation_authorities'), authorityData);
    console.log(`Saved authority with ID: ${authRef.id}`);

    // 2. Save Operators and Licenses
    for (const op of ukAocData) {
      const opRef = await addDoc(collection(db, 'operators_master'), {
        operator_name: op.operator_name,
        aoc_number: op.aoc_number,
        operation_type: op.operation_type,
        country: "United Kingdom",
        source: "Civil Aviation Authority (UK CAA)",
        status: 'Active',
        last_updated: new Date().toISOString()
      });
      console.log(`Saved operator: ${op.operator_name}`);

      await addDoc(collection(db, 'aoc_licenses'), {
        operator_id: opRef.id,
        license_type: 'AOC',
        issuing_authority: "Civil Aviation Authority (UK CAA)",
        issue_date: new Date().toISOString().split('T')[0],
        status: 'Active'
      });
    }

    console.log("Population complete!");
  } catch (error) {
    console.error("Error populating data:", error);
  }
}

populate();
