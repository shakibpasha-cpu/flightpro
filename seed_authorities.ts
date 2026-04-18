import { db } from './src/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

const authorities = [
  {
    authority_name: 'UK Civil Aviation Authority',
    country: 'United Kingdom',
    website: 'https://www.caa.co.uk/commercial-industry/aircraft/operations/airline-licensing/list-of-uk-aoc-holders/',
    scraping_type: 'PDF',
    last_scraped: new Date(0).toISOString(),
    aoc_data: []
  },
  {
    authority_name: 'Maldives Civil Aviation Authority',
    country: 'Maldives',
    website: 'https://www.caa.gov.mv/operators',
    scraping_type: 'HTML',
    last_scraped: new Date(0).toISOString(),
    aoc_data: []
  },
  {
    authority_name: 'Pakistan Civil Aviation Authority',
    country: 'Pakistan',
    website: 'https://caapakistan.com.pk/AT/AT-AOC.aspx',
    scraping_type: 'PDF',
    last_scraped: new Date(0).toISOString(),
    aoc_data: []
  },
  {
    authority_name: 'Directorate General of Civil Aviation',
    country: 'India',
    website: 'https://www.dgca.gov.in/digigov-portal/?page=jsp/dgca/common/operatorList.jsp',
    scraping_type: 'HTML',
    last_scraped: new Date(0).toISOString(),
    aoc_data: []
  },
  {
    authority_name: 'Civil Aviation Authority of Singapore',
    country: 'Singapore',
    website: 'https://www.caas.gov.sg/operations-safety/aircraft-operations/air-operator-certificates',
    scraping_type: 'PDF',
    last_scraped: new Date(0).toISOString(),
    aoc_data: []
  }
];

async function seed() {
  for (const auth of authorities) {
    const q = query(collection(db, 'aviation_authorities'), where('authority_name', '==', auth.authority_name));
    const snap = await getDocs(q);
    if (snap.empty) {
      await addDoc(collection(db, 'aviation_authorities'), auth);
      console.log(`Added ${auth.authority_name}`);
    } else {
      console.log(`${auth.authority_name} already exists`);
    }
  }
  process.exit(0);
}

seed();
