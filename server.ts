import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;
import { initializeApp as initializeAdminApp, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
initializeAdminApp({
  projectId: firebaseConfig.projectId
});
const adminDb = getAdminFirestore(firebaseConfig.firestoreDatabaseId);

// Database Pool for PostgreSQL/PostGIS
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const app = express();
const PORT = 3000;

app.use(express.json());

if (!process.env.GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is not set in environment variables.");
}

// Mock Airport Database (for distance calculation)
const AIRPORTS: Record<string, { lat: number; lng: number; city: string }> = {
  'OMDB': { lat: 25.2528, lng: 55.3644, city: 'Dubai' },
  'EGLL': { lat: 51.4700, lng: -0.4543, city: 'London' },
  'KJFK': { lat: 40.6413, lng: -73.7781, city: 'New York' },
  'WSSS': { lat: 1.3644, lng: 103.9915, city: 'Singapore' },
  'OTHH': { lat: 25.2731, lng: 51.6081, city: 'Doha' },
  'EDDF': { lat: 50.0333, lng: 8.5706, city: 'Frankfurt' },
  'VHHH': { lat: 22.3089, lng: 113.9145, city: 'Hong Kong' },
  'LSZH': { lat: 47.4582, lng: 8.5555, city: 'Zurich' },
  'EHAM': { lat: 52.3105, lng: 4.7683, city: 'Amsterdam' },
  'LFPG': { lat: 49.0097, lng: 2.5479, city: 'Paris' },
  'OPLA': { lat: 31.5204, lng: 74.4036, city: 'Lahore' },
  'OPKC': { lat: 24.9065, lng: 67.1608, city: 'Karachi' },
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 0.539957; // Convert to Nautical Miles
}

// Advanced Aircraft Database
const AIRCRAFT_DATA: Record<string, any> = {
  'A320': { rate: 5500, fuelBurn: 2500, speed: 450, seats: 180, payload: 18000, volume: 37, type: 'passenger', category: 'Narrowbody', mtow: 77000, dynamicPricing: true },
  'B737': { rate: 5000, fuelBurn: 2600, speed: 450, seats: 160, payload: 17000, volume: 30, type: 'passenger', category: 'Narrowbody', mtow: 79000, dynamicPricing: true },
  'B737-800F': { rate: 5000, fuelBurn: 2600, speed: 450, seats: 0, payload: 23000, volume: 140, type: 'cargo', category: 'Narrowbody', mtow: 79000, dynamicPricing: true },
  'A321F': { rate: 6000, fuelBurn: 2700, speed: 450, seats: 0, payload: 27000, volume: 160, type: 'cargo', category: 'Narrowbody', mtow: 93500, dynamicPricing: true },
  'B767F': { rate: 10000, fuelBurn: 4500, speed: 460, seats: 0, payload: 52000, volume: 400, type: 'cargo', category: 'Widebody', mtow: 186000, dynamicPricing: true },
  'B777F': { rate: 15000, fuelBurn: 7000, speed: 490, seats: 0, payload: 100000, volume: 650, type: 'cargo', category: 'Widebody', mtow: 347000, dynamicPricing: true },
  'B777': { rate: 15000, fuelBurn: 7000, speed: 490, seats: 350, payload: 60000, volume: 150, type: 'passenger', category: 'Widebody', mtow: 347000, dynamicPricing: true },
  'A330': { rate: 10000, fuelBurn: 5500, speed: 470, seats: 300, payload: 45000, volume: 120, type: 'passenger', category: 'Widebody', mtow: 242000, dynamicPricing: true },
  'ATR72': { rate: 2500, fuelBurn: 1000, speed: 280, seats: 70, payload: 7500, volume: 20, type: 'passenger', category: 'Regional', mtow: 23000, dynamicPricing: true },
  'G650': { rate: 8000, fuelBurn: 1500, speed: 510, seats: 14, payload: 2500, volume: 5, type: 'vip', vip: true, category: 'Business Jet', mtow: 45000, dynamicPricing: true },
};

// Mock Active Fleet for Empty Leg Detection
const ACTIVE_FLEET = [
  { tailNumber: 'A6-VIP', type: 'G650', lastDestination: 'OMDB', nextDeparture: 'EGLL' },
  { tailNumber: 'N777QA', type: 'B777', lastDestination: 'KJFK', nextDeparture: 'EHAM' },
  { tailNumber: '9V-SIA', type: 'A320', lastDestination: 'WSSS', nextDeparture: 'VHHH' },
  { tailNumber: 'G-BAWF', type: 'B737-800F', lastDestination: 'EGLL', nextDeparture: 'OMDB' },
  { tailNumber: 'A7-BFC', type: 'B777F', lastDestination: 'OTHH', nextDeparture: 'EDDF' },
];

// Regulatory & Permits Logic
const COUNTRY_MAP: Record<string, string> = {
  'OM': 'United Arab Emirates',
  'EG': 'United Kingdom',
  'KJ': 'United States',
  'K': 'United States',
  'OP': 'Pakistan',
  'OT': 'Qatar',
  'ED': 'Germany',
  'VH': 'Hong Kong',
  'WS': 'Singapore',
  'EH': 'Netherlands',
  'LF': 'France',
  'LE': 'Spain',
  'LI': 'Italy',
  'LT': 'Turkey',
  'UD': 'Armenia',
  'UG': 'Georgia',
  'UB': 'Azerbaijan',
  'OI': 'Iran',
  'OE': 'Saudi Arabia',
  'OK': 'Kuwait',
  'OB': 'Bahrain',
  'OO': 'Oman',
  'VI': 'India',
  'VT': 'India/Thailand',
  'VC': 'Sri Lanka',
  'VG': 'Bangladesh',
  'VY': 'Myanmar',
  'VL': 'Laos',
  'VV': 'Vietnam',
  'WM': 'Malaysia',
  'WB': 'Malaysia',
  'WI': 'Indonesia',
  'WA': 'Indonesia',
  'RP': 'Philippines',
  'RJ': 'Japan',
  'RO': 'Japan',
  'RK': 'South Korea',
  'Z': 'China',
  'Y': 'Australia',
  'N': 'New Zealand',
  'C': 'Canada',
  'M': 'Central America',
  'S': 'South America',
  'F': 'Africa',
  'H': 'East Africa',
  'D': 'West Africa',
  'G': 'West Africa',
  'U': 'Russia/Former Soviet',
};

function getCountry(icao: string) {
  if (!icao) return 'Unknown';
  if (icao.startsWith('K')) return 'United States';
  if (icao.startsWith('C')) return 'Canada';
  if (icao.startsWith('Y')) return 'Australia';
  if (icao.startsWith('Z')) return 'China';
  const prefix2 = icao.substring(0, 2);
  return COUNTRY_MAP[prefix2] || 'International Waters / Unknown';
}

function generatePermits(from: string, to: string, existingPermits: any[] = []) {
  const permits = [...existingPermits];
  const fromCountry = getCountry(from);
  const toCountry = getCountry(to);

  if (fromCountry !== 'Unknown' && !permits.find(p => p.country === fromCountry && p.type === 'Landing/Departure')) {
    permits.push({ country: fromCountry, type: 'Landing/Departure', leadTime: '24-48 hours', fee: Math.floor(Math.random() * 500) + 200 });
  }
  if (toCountry !== 'Unknown' && toCountry !== fromCountry && !permits.find(p => p.country === toCountry && p.type === 'Landing/Arrival')) {
    permits.push({ country: toCountry, type: 'Landing/Arrival', leadTime: '24-72 hours', fee: Math.floor(Math.random() * 800) + 300 });
  }

  // Mock overflight
  const overflights = ['Turkey', 'Iran', 'Saudi Arabia', 'Egypt', 'India', 'Russia', 'Canada'];
  const numOverflights = Math.floor(Math.random() * 3) + 1; // 1 to 3
  for(let i=0; i<numOverflights; i++) {
     const oc = overflights[Math.floor(Math.random() * overflights.length)];
     if (oc !== fromCountry && oc !== toCountry && !permits.find(p => p.country === oc)) {
        permits.push({ country: oc, type: 'Overflight', leadTime: '12-48 hours', fee: Math.floor(Math.random() * 400) + 100 });
     }
  }
  return permits;
}

// API Endpoints
app.get("/api/empty-legs", (req, res) => {
  res.json(ACTIVE_FLEET);
});

// Live Aircraft Tracking (OpenSky Mock)
app.get("/api/v1/aircraft/track/:icao24", (req, res) => {
  const { icao24 } = req.params;
  // Mock tracking data
  res.json({
    data: {
      icao24,
      latitude: 25.25 + (Math.random() * 2 - 1),
      longitude: 55.36 + (Math.random() * 2 - 1),
      velocity: 450 + (Math.random() * 50),
      baro_altitude: 35000 + (Math.random() * 2000),
      true_track: Math.floor(Math.random() * 360),
      on_ground: Math.random() > 0.8,
      callsign: `FLIGHT${icao24.substring(0, 3).toUpperCase()}`
    }
  });
});

// Aircraft Utilization (Aviationstack Mock)
app.get("/api/v1/aircraft/utilization/:registration", (req, res) => {
  const { registration } = req.params;
  res.json({
    metrics: {
      total_recent_flights: Math.floor(Math.random() * 20) + 5,
      daily_flights: Math.floor(Math.random() * 4) + 1,
      active_missions: Math.floor(Math.random() * 2),
      is_base_consistent: Math.random() > 0.3,
      last_contact: Math.floor(Date.now() / 1000) - (Math.floor(Math.random() * 3600 * 48)),
      history: [
        { departure: { iata: 'DXB' }, arrival: { iata: 'LHR' }, flight_date: new Date().toISOString(), flight_status: 'landed' },
        { departure: { iata: 'LHR' }, arrival: { iata: 'JFK' }, flight_date: new Date(Date.now() - 86400000).toISOString(), flight_status: 'landed' }
      ]
    }
  });
});

// Weather Service (Mock)
app.get("/api/v1/weather/:icao", (req, res) => {
  const { icao } = req.params;
  res.json({
    airport: icao,
    metar: `${icao} ${new Date().getUTCDate()}${new Date().getUTCHours()}00Z 12010KT 9999 FEW030 25/18 Q1013 NOSIG`,
    taf: `${icao} ${new Date().getUTCDate()}${new Date().getUTCHours()}00Z ...`,
    last_updated: new Date().toISOString()
  });
});

// NOTAM Service (Mock)
app.get("/api/v1/safety/notams/:icao", (req, res) => {
  const { icao } = req.params;
  res.json({
    airport: icao,
    notams: [
      { id: 'A1234/26', description: 'RWY 12L/30R CLOSED DUE TO MAINTENANCE', severity: 'High' },
      { id: 'B5678/26', description: 'OBSTACLE CRANE 1NM NORTH OF ARP', severity: 'Medium' }
    ],
    last_updated: new Date().toISOString()
  });
});

// Nearby Airports Search (PostGIS)
app.get("/api/v1/charts/skyvector/:layer/:z/:x/:y", async (req, res) => {
  const { layer, z, x, y } = req.params;
  
  // Map layer name to SkyVector internal ID
  const layerIdMap: Record<string, string> = {
    'vfr': '301',
    'lo': '302',
    'hi': '304'
  };
  
  const skyVectorLayer = layerIdMap[layer] || '301';
  // SkyVector changes cycle approximately every 28 days.
  // Current known cycle for late April 2026 is 2605.
  const cycle = '2605'; 
  
  // Use a more reliable set of host candidates. Primary should be skyvector.com directly.
  const hosts = ['skyvector.com', 'charts.skyvector.com', 'charts2.skyvector.com'];
  
  // We'll try the first host, but we should handle the ENOTFOUND errors better
  const tryFetch = async (attempt: number = 0): Promise<Response> => {
    if (attempt >= hosts.length) throw new Error("All SkyVector hosts failed");
    
    const currentHost = hosts[attempt];
    const url = `https://${currentHost}/tiles/${skyVectorLayer}/${cycle}/${z}/${x}/${y}.jpg`;

    try {
      const response = await fetch(url, {
        headers: {
          'Referer': 'https://skyvector.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!response.ok && response.status !== 404) {
        return tryFetch(attempt + 1);
      }
      return response;
    } catch (e) {
      console.warn(`Host ${currentHost} failed (DNS or Network):`, e instanceof Error ? e.message : String(e));
      return tryFetch(attempt + 1);
    }
  };
  
  // Local cache path
  const cacheDir = path.join(process.cwd(), 'db', 'charts_cache', layer, z, x);
  const cacheFile = path.join(cacheDir, `${y}.jpg`);

  try {
    // Check local storage first
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      // Only use cache if it's less than 30 days old (AIRAC cycles are 28 days)
      if (Date.now() - stats.mtimeMs < 30 * 24 * 60 * 60 * 1000) {
        return res.sendFile(cacheFile);
      }
    }

    const response = await tryFetch();

    if (!response.ok) {
      if (response.status === 404) {
        // Maybe cycle is wrong, but 404 is a valid response from the server at least
        return res.status(404).json({ error: "Tile not found (check cycle/coordinates)" });
      }
      throw new Error(`SkyVector returned ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const data = Buffer.from(buffer);

    // Ensure cache directory exists and store locally
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cacheFile, data);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
    res.send(data);
  } catch (error) {
    console.error(`Error proxying SkyVector tile:`, error);
    res.status(502).json({ error: "Failed to fetch chart tile" });
  }
});

app.get("/api/v1/charts/stats", async (req, res) => {
  const cacheDir = path.join(process.cwd(), 'db', 'charts_cache');
  let count = 0;
  let size = 0;

  function countFiles(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        countFiles(fullPath);
      } else {
        count++;
        size += fs.statSync(fullPath).size;
      }
    }
  }

  try {
    countFiles(cacheDir);
    res.json({ tileCount: count, totalSize: (size / (1024 * 1024)).toFixed(2) + ' MB' });
  } catch (error) {
    res.status(500).json({ error: "Failed to get stats" });
  }
});

app.get("/api/airports/nearby", async (req, res) => {
  try {
    const { lat, lng, radius = 50 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const radiusNm = parseFloat(radius as string);
    
    // Convert Nautical Miles to Meters (1 NM = 1852 meters)
    const radiusMeters = radiusNm * 1852;

    if (!process.env.DATABASE_URL) {
      console.warn("DATABASE_URL not set, returning mock nearby airports");
      // Return some mock data if DB is not connected
      return res.json({
        airports: Object.entries(AIRPORTS)
          .map(([icao, data]) => ({
            icao,
            ...data,
            distance: calculateDistance(latitude, longitude, data.lat, data.lng)
          }))
          .filter(a => a.distance <= radiusNm)
          .sort((a, b) => a.distance - b.distance)
      });
    }

    const query = `
      SELECT 
        icao, iata, name, city, country, 
        lat, lng,
        ST_Distance(
          geom, 
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1852 as distance_nm
      FROM airports
      WHERE ST_DWithin(
        geom, 
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
        $3
      )
      ORDER BY distance_nm ASC
      LIMIT 50;
    `;

    const result = await pool.query(query, [longitude, latitude, radiusMeters]);
    res.json({ airports: result.rows });
  } catch (error) {
    console.error("Nearby airports search error:", error);
    res.status(500).json({ error: "Failed to search nearby airports" });
  }
});

app.post("/api/scrape-authority", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    let content = "";
    let isPdf = url.toLowerCase().endsWith('.pdf');

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html') && !isPdf) {
         // Verify it looks like HTML, and potentially return a clearer error if it's not JSONable
      }
      
      if (isPdf) {
        const buffer = await response.arrayBuffer();
        const pdfModule = await import('pdf-parse');
        const pdfParser = (pdfModule as any).default || pdfModule;
        const data = await pdfParser(Buffer.from(buffer));
        content = data.text;
      } else {
        const html = await response.text();
        content = html
          .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
          .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "")
          .substring(0, 20000);
      }
      res.json({ content, isPdf, url });
    } catch (e) {
      console.error(`Failed to fetch content from ${url}:`, e);
      res.status(500).json({ error: `Failed to fetch/parse content from ${url}. Please ensure this is a valid accessible URL.` });
    }
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "Failed to scrape authority website" });
  }
});

app.post("/api/scrape-fleet", async (req, res) => {
  try {
    const { url, operatorName, airlineName } = req.body;
    const targetName = operatorName || airlineName;
    const targetUrl = url || (targetName ? `https://en.wikipedia.org/wiki/${targetName.replace(/\s+/g, '_')}_fleet` : null);
    
    if (!targetUrl) return res.status(400).json({ error: "URL or Operator Name is required" });

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const html = await response.text();
      const content = html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, "")
        .substring(0, 25000);
      res.json({ content, url: targetUrl, operatorName: targetName });
    } catch (e) {
      console.error(`Failed to fetch fleet content from ${targetUrl}:`, e);
      res.status(500).json({ error: `Failed to fetch fleet content from ${targetUrl}` });
    }
  } catch (error) {
    console.error("Fleet scraping error:", error);
    res.status(500).json({ error: "Failed to scrape fleet information" });
  }
});

app.post("/api/scrape-aircraft-specs", async (req, res) => {
  res.status(410).json({ error: "This endpoint is deprecated. Use frontend Gemini API directly." });
});

app.post("/api/quote-multileg", async (req, res) => {
  try {
    const { 
      type = 'charter', 
      legs, 
      aircraftType, 
      load_kg = 0, 
      volume_cbm = 0, 
      cargo_type = 'General',
      passengers = 0,
      urgency = 'normal',
      isVip = false
    } = req.body;

    if (!legs || !Array.isArray(legs) || legs.length === 0) {
      return res.status(400).json({ error: "Missing or invalid legs array" });
    }

    // Smart Aircraft Selection (Global for the itinerary)
    let selectedType = aircraftType;
    if (!selectedType) {
      if (type === 'cargo') {
        let bestAircraft = null;
        let lowestCostPerKg = Infinity;
        for (const [acType, ac] of Object.entries(AIRCRAFT_DATA)) {
          if (ac.type === 'cargo' && load_kg <= ac.payload && volume_cbm <= ac.volume) {
            bestAircraft = acType; // Simplified selection for multi-leg
            break;
          }
        }
        selectedType = bestAircraft || 'B777F';
      } else if (type === 'charter') {
        if (isVip || passengers < 15) selectedType = 'G650';
        else if (passengers <= 180) selectedType = 'A320';
        else selectedType = 'B777';
      } else {
        selectedType = 'A320';
      }
    }

    const ac = AIRCRAFT_DATA[selectedType] || AIRCRAFT_DATA['A320'];

    // Multipliers & Margin
    let multiplier = 1.0;
    if (urgency === 'high') multiplier += 0.15;
    const month = new Date().getMonth();
    if (month === 11 || month === 6) multiplier += 0.20;

    if (type === 'cargo') {
      if (cargo_type === 'Pharma') multiplier += 0.10;
      if (cargo_type === 'Live animals') multiplier += 0.15;
      if (cargo_type === 'Dangerous Goods') multiplier += 0.25;
    }

    let margin = 0.10;
    if (type === 'cargo' && urgency === 'high') margin = 0.25;
    if (type === 'charter') margin = isVip ? 0.20 : 0.15;

    let totalDistance = 0;
    let totalFlightHours = 0;
    let totalBlockHours = 0;
    let totalCost = 0;
    const legResults = [];
    let permits: any[] = [];

    let currentLoc = legs[0].from;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const depCoord = AIRPORTS[leg.from] || { lat: 0, lng: 0 };
      const destCoord = AIRPORTS[leg.to] || { lat: 0, lng: 0 };
      let distance = calculateDistance(depCoord.lat, depCoord.lng, destCoord.lat, destCoord.lng);
      if (distance === 0) distance = 1500; // Fallback

      const flightHours = distance / ac.speed;
      const blockHours = flightHours + 0.6;
      
      let acmiCost = blockHours * ac.rate * multiplier;
      
      // Positioning cost if aircraft is not at departure
      let positioningCost = 0;
      if (i === 0 && currentLoc !== leg.from) {
        // Simplified positioning logic for multi-leg
        positioningCost = 5000; 
      }

      const fuelCost = flightHours * ac.fuelBurn * 1.15;
      const overflightCharges = distance * 0.18;
      const handling = type === 'cargo' ? 4500 : 2500;
      const crew = 1200 * (blockHours / 8 + 1);
      let catering = type === 'charter' ? passengers * (isVip ? 150 : 20) : 0;

      const baseTotal = acmiCost + fuelCost + overflightCharges + handling + crew + positioningCost + catering;
      const finalPrice = baseTotal * (1 + margin);

      totalDistance += distance;
      totalFlightHours += flightHours;
      totalBlockHours += blockHours;
      totalCost += finalPrice;

      legResults.push({
        legNumber: i + 1,
        from: leg.from,
        to: leg.to,
        date: leg.date,
        distance,
        flightHours,
        cost: finalPrice
      });

      permits = generatePermits(leg.from, leg.to, permits);

      currentLoc = leg.to;
    }

    const prompt = `As an aviation expert, analyze this multi-leg ${type} itinerary:
    Legs: ${legs.map(l => `${l.from} to ${l.to}`).join(', ')}
    Aircraft: ${selectedType}
    Load: ${load_kg}kg, Vol: ${volume_cbm}cbm, Pax: ${passengers}
    Cargo Type: ${cargo_type}
    Total Cost: $${totalCost.toFixed(2)}
    
    Provide:
    1. Market analysis for this specific multi-leg request.
    2. Suggest a "Best Value" alternative aircraft.
    3. Suggest the fastest alternative aircraft.
    4. Provide one strategic tip for the broker to maximize profit or win the deal.
    
    Format as JSON:
    {
      "analysis": "...",
      "cheapestOption": "...",
      "fastestOption": "...",
      "tip": "..."
    }`;

    res.json({
      aircraft: selectedType,
      type,
      totalDistance,
      totalFlightHours,
      totalBlockHours,
      totalCost,
      legs: legResults,
      feasibility: {
        payload: load_kg <= ac.payload,
        volume: volume_cbm <= ac.volume,
        seats: passengers <= ac.seats,
        status: (load_kg <= ac.payload && volume_cbm <= ac.volume && passengers <= ac.seats) ? 'Feasible' : 'Infeasible'
      },
      permits
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/quote-advanced", async (req, res) => {
  try {
    const { 
      type = 'acmi', // acmi, cargo, charter
      from, 
      to, 
      aircraftType, 
      load_kg = 0, 
      volume_cbm = 0, 
      cargo_type = 'General',
      passengers = 0,
      urgency = 'normal',
      isVip = false,
      currentLocation = null // For positioning logic
    } = req.body;

    if (!from || !to) {
      return res.status(400).json({ error: "Missing required fields (from, to)" });
    }

    // 1. Calculate Distance
    const depCoord = AIRPORTS[from] || { lat: 0, lng: 0 };
    const destCoord = AIRPORTS[to] || { lat: 0, lng: 0 };
    let distance = calculateDistance(depCoord.lat, depCoord.lng, destCoord.lat, destCoord.lng);
    if (distance === 0) distance = 2500; 

    // Pre-calculate Multipliers & Margin for optimization
    let multiplier = 1.0;
    if (urgency === 'high') multiplier += 0.15;
    const month = new Date().getMonth();
    if (month === 11 || month === 6) multiplier += 0.20;

    if (type === 'cargo') {
      if (cargo_type === 'Pharma') multiplier += 0.10;
      if (cargo_type === 'Live animals') multiplier += 0.15;
      if (cargo_type === 'Dangerous Goods') multiplier += 0.25;
    }

    let margin = 0.10; // Default 10%
    if (type === 'acmi') margin = 0.08;
    if (type === 'cargo' && urgency === 'high') margin = 0.25;
    if (type === 'charter') margin = isVip ? 0.20 : 0.15;

    // Helper to calculate flight cost for an aircraft
    const calculateFlightCost = (ac: any) => {
      const flightHours = distance / ac.speed;
      const blockHours = flightHours + 0.6; // Taxi/Climb buffer
      let acmiCost = blockHours * ac.rate * multiplier;
      
      let positioningCost = 0;
      if (currentLocation && currentLocation !== from) {
        const locCoord = AIRPORTS[currentLocation] || { lat: 0, lng: 0 };
        const posDist = calculateDistance(locCoord.lat, locCoord.lng, depCoord.lat, depCoord.lng);
        positioningCost = (posDist / ac.speed) * ac.rate * 0.8; // 20% discount for positioning
      }

      const fuelCost = flightHours * ac.fuelBurn * 1.15; // $1.15 per kg
      const overflightCharges = distance * 0.18;
      const handling = type === 'cargo' ? 4500 : 2500;
      const crew = 1200 * (blockHours / 8 + 1);
      let catering = type === 'charter' ? passengers * (isVip ? 150 : 20) : 0;

      const baseTotal = acmiCost + fuelCost + overflightCharges + handling + crew + positioningCost + catering;
      const finalPrice = baseTotal * (1 + margin);
      
      return {
        acmiCost, fuelCost, overflightCharges, handling, crew, positioningCost, catering,
        baseTotal, finalPrice, flightHours, blockHours
      };
    };

    // 2. Smart Aircraft Selection (if not specified)
    let selectedType = aircraftType;
    if (!selectedType) {
      if (type === 'cargo') {
        let bestAircraft = null;
        let lowestCostPerKg = Infinity;

        for (const [acType, ac] of Object.entries(AIRCRAFT_DATA)) {
          if (ac.type === 'cargo' && load_kg <= ac.payload && volume_cbm <= ac.volume) {
            const costs = calculateFlightCost(ac);
            const costPerKg = costs.finalPrice / (load_kg || 1);
            if (costPerKg < lowestCostPerKg) {
              lowestCostPerKg = costPerKg;
              bestAircraft = acType;
            }
          }
        }
        
        // Fallback to largest if nothing fits perfectly
        selectedType = bestAircraft || 'B777F';
      } else if (type === 'charter') {
        let bestAircraft = null;
        let lowestCostPerPax = Infinity;

        for (const [acType, ac] of Object.entries(AIRCRAFT_DATA)) {
          if ((ac.type === 'passenger' || ac.type === 'vip') && passengers <= ac.seats) {
            // Upgrade Logic
            if (isVip && ac.category !== 'Business Jet') continue;
            if (!isVip && distance > 3000 && ac.category !== 'Widebody') continue;
            if (!isVip && distance <= 3000 && passengers > 15 && ac.category !== 'Narrowbody' && ac.category !== 'Widebody') continue;

            const costs = calculateFlightCost(ac);
            const costPerPax = costs.finalPrice / (passengers || 1);
            if (costPerPax < lowestCostPerPax) {
              lowestCostPerPax = costPerPax;
              bestAircraft = acType;
            }
          }
        }
        
        selectedType = bestAircraft || (isVip ? 'G650' : (distance > 3000 ? 'B777' : 'A320'));
      } else {
        selectedType = 'A320';
      }
    }

    const ac = AIRCRAFT_DATA[selectedType] || AIRCRAFT_DATA['A320'];
    
    // 3. Feasibility Check
    const feasibility = {
      payload: load_kg <= ac.payload,
      volume: volume_cbm <= ac.volume,
      seats: passengers <= ac.seats,
      status: (load_kg <= ac.payload && volume_cbm <= ac.volume && passengers <= ac.seats) ? 'Feasible' : 'Infeasible'
    };

    // 4. Calculation Logic
    let { acmiCost, fuelCost, overflightCharges, handling, crew, positioningCost, catering, baseTotal, finalPrice, flightHours, blockHours } = calculateFlightCost(ac);

    // Empty Leg Detection (VERY POWERFUL)
    // Logic: IF aircraft flew A -> B (lastDestination) AND next booking B -> C (nextDeparture)
    // THEN empty leg B -> C is available
    let isEmptyLeg = false;
    let discount = 0;
    let emptyLegDetails = null;

    const emptyLegMatch = ACTIVE_FLEET.find(
      ac => ac.type === selectedType && ac.lastDestination === from && ac.nextDeparture === to
    );

    if (emptyLegMatch) {
      isEmptyLeg = true;
      // Empty Leg Price = 30% - 70% of normal ACMI (which means a 30% to 70% discount)
      discount = 0.30 + (Math.random() * 0.40); 
      emptyLegDetails = `Matched repositioning flight for ${emptyLegMatch.tailNumber}`;
      
      // Apply discount to ACMI and remove positioning cost
      acmiCost *= (1 - discount);
      positioningCost = 0; 
      
      // Recalculate totals
      baseTotal = acmiCost + fuelCost + overflightCharges + handling + crew + positioningCost + catering;
      finalPrice = baseTotal * (1 + margin);
    } else if (Math.random() > 0.85) { 
      // 15% random chance for demo purposes if they don't hit the exact route
      isEmptyLeg = true;
      discount = 0.30 + (Math.random() * 0.40); // 30% to 70% discount
      acmiCost *= (1 - discount);
      baseTotal = acmiCost + fuelCost + overflightCharges + handling + crew + positioningCost + catering;
      finalPrice = baseTotal * (1 + margin);
    }

    // 6. Permits
    const permits = generatePermits(from, to);

    res.json({
      aircraft: selectedType,
      operators: ["Global Jet", "SkyCargo", "Elite Charter"],
      metrics: {
        distance,
        flightHours,
        blockHours,
        costPerKg: type === 'cargo' ? (finalPrice / (load_kg || 1)) : null,
        costPerPax: type === 'charter' ? (finalPrice / (passengers || 1)) : null
      },
      feasibility,
      pricing: {
        acmi: acmiCost,
        fuel: fuelCost,
        overflight: overflightCharges,
        handling,
        crew,
        positioning: positioningCost,
        catering,
        margin: finalPrice - baseTotal,
        total: finalPrice,
        isEmptyLeg,
        discount: isEmptyLeg ? (discount * 100).toFixed(0) + '%' : null,
        emptyLegDetails
      },
      permits,
      recommended_option: "Best Value"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/acmi/calculate", async (req, res) => {
  try {
    const { 
      departure, 
      destination, 
      aircraftType, 
      fuelPrice = 0.95, 
      multipliers = { demand: 1, seasonality: 1, urgency: 1, region: 1 },
      brokerMargin = 0.12,
      riskLevel = 'Normal',
      totalBudget,
      passengers = 0,
      isVip = false
    } = req.body;

    if (!departure || !destination || !aircraftType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Calculate Distance
    const depCoord = AIRPORTS[departure] || { lat: 25.2, lng: 55.3 };
    const destCoord = AIRPORTS[destination] || { lat: 51.5, lng: -0.4 };
    let distance = calculateDistance(depCoord.lat, depCoord.lng, destCoord.lat, destCoord.lng);
    
    if (distance === 0) distance = 1500; 

    // 2. Fetch Aircraft Data
    const aircraftKey = aircraftType.includes('B737-800') ? 'B737' : aircraftType;
    const ac = AIRCRAFT_DATA[aircraftKey] || AIRCRAFT_DATA['A320'];
    
    // 3. Calculation Logic (High-Fidelity)
    const blockHours = (distance / ac.speed) * 1.15 + 0.45;
    const flightHours = distance / ac.speed;
    
    // AI SMART PRICING LOGIC (SECRET SAUCE 🔥)
    let adjustedAcmiRate = ac.rate;
    let intelligenceSignals: string[] = [];

    // A. Competitive Pricing
    if (multipliers.demand < 0.9) {
      const discount = 0.15; // 15% discount for oversupply
      adjustedAcmiRate *= (1 - discount);
      intelligenceSignals.push("COMPETITIVE: Market oversupply detected. Applied 15% rate reduction.");
    }

    // B. Premium Pricing
    if (multipliers.urgency > 2.0 && multipliers.demand > 1.1) {
      const premium = 0.40; // 40% premium for critical urgency + high demand
      adjustedAcmiRate *= (1 + premium);
      intelligenceSignals.push("PREMIUM: Urgent critical requirement + high demand. Applied 40% premium.");
    }

    // Core Flight Cost
    const coreFlightCost = blockHours * adjustedAcmiRate;

    // Operational Add-ons
    // Advanced Fuel Model
    const takeoffFuel = (15 / 60) * ac.fuelBurn * 1.8;
    const cruiseHours = Math.max(0, blockHours - (15 / 60));
    const cruiseFuel = cruiseHours * ac.fuelBurn;
    const reserveFuel = (45 / 60) * ac.fuelBurn;
    const totalFuelKg = takeoffFuel + cruiseFuel + reserveFuel;
    const fuelCost = totalFuelKg * fuelPrice;

    // Eurocontrol-style FIR Charges
    const mtowTonnes = (ac.mtow || (ac.payload * 2.5)) / 1000;
    const weightFactor = Math.sqrt(mtowTonnes / 50);
    const overflightCharges = distance * 0.12 * weightFactor;

    const landingFee = 1500 * (mtowTonnes / 50);
    const handlingFee = 1500;
    const airportTotal = landingFee + handlingFee + 300; 
    const crewCost = blockHours < 10 ? 1200 : (blockHours / 10) * 1200;
    
    // Catering Cost
    let cateringCost = 0;
    if (ac.type === 'passenger' || ac.type === 'vip') {
      const paxCount = passengers || Math.round(ac.seats * 0.8) || 10;
      const cateringPerPax = (isVip || ac.vip) ? 150 : 25;
      cateringCost = paxCount * cateringPerPax;
      intelligenceSignals.push(`CATERING: Included ${isVip || ac.vip ? 'VIP' : 'standard'} catering for ~${paxCount} pax at $${cateringPerPax}/head.`);
    }

    // Positioning Cost (THRESHOLD RULE: 1000km / ~540NM)
    const positioningDistance = distance > 540 ? distance * 0.4 : 0; // Simplified for demo
    const positioningCost = positioningDistance > 0 ? (positioningDistance / ac.speed * ac.rate) + (positioningDistance / ac.speed * ac.fuelBurn * fuelPrice) + 800 : 0;
    if (positioningCost > 0) intelligenceSignals.push(`POSITIONING: Enforced mandatory positioning cost for distance > 1000km.`);

    const operationalSubtotal = coreFlightCost + fuelCost + overflightCharges + airportTotal + crewCost + positioningCost + cateringCost;


    // Risk & Market Adjustments
    const marketMultiplier = (multipliers.demand || 1) * 
                             (multipliers.seasonality || 1) * 
                             (multipliers.urgency || 1) * 
                             (multipliers.region || 1);

    const marketAdjustment = coreFlightCost * (marketMultiplier - 1);
    
    let riskFactor = 1.0;
    if (riskLevel === 'War Zone' || riskLevel === 'Conflict Zone') {
      riskFactor = 1.45;
      intelligenceSignals.push("RISK: Conflict Zone operational premium applied.");
    } else if (riskLevel === 'High Risk' || riskLevel === 'Remote') {
      riskFactor = 1.15;
      intelligenceSignals.push("RISK: Remote/High Risk logistical buffer applied.");
    }

    const riskAdjustment = (operationalSubtotal + marketAdjustment) * (riskFactor - 1);
    const contingency = (operationalSubtotal + marketAdjustment + riskAdjustment) * 0.05;

    const riskAndMarketAdjustments = marketAdjustment + riskAdjustment + contingency;

    // Broker Margin
    const subtotalBeforeMargin = operationalSubtotal + riskAndMarketAdjustments;
    let finalMargin = brokerMargin;

    // C. Price Optimization
    if (totalBudget && subtotalBeforeMargin * (1 + finalMargin) > totalBudget) {
      if (subtotalBeforeMargin < totalBudget) {
        // Can fit by reducing margin
        const requiredMargin = (totalBudget / subtotalBeforeMargin) - 1;
        finalMargin = Math.max(0.02, requiredMargin); // Minimum 2% margin
        intelligenceSignals.push(`OPTIMIZED: Reduced broker margin to ${Math.round(finalMargin * 100)}% to meet client budget.`);
      } else {
        // Still over budget even with 0 margin
        const reductionNeeded = 1 - (totalBudget / subtotalBeforeMargin);
        if (reductionNeeded < 0.15) {
          intelligenceSignals.push(`BUDGET WARNING: Project exceeds budget by ${Math.round(reductionNeeded * 100)}% even at 0% margin.`);
        } else {
          intelligenceSignals.push(`BUDGET CRITICAL: Suggesting down-gauging aircraft. Current selection is ~${Math.round(reductionNeeded * 100)}% over budget.`);
        }
      }
    }

    const brokerProfit = subtotalBeforeMargin * finalMargin;
    const finalTotal = subtotalBeforeMargin + brokerProfit;

    res.json({
      totalCost: finalTotal,
      flightTimeHours: flightHours,
      distanceNm: distance,
      intelligence: intelligenceSignals,
      detailedBreakdown: {
        departure: {
          name: AIRPORTS[departure]?.city || departure,
          icao: departure,
          iata: departure.substring(1),
          handlingAgency: "SkyBridge Aviation",
          navigational: 500,
          terminal: 300,
          parking: 200,
          fuel: Math.round(fuelCost * 0.4)
        },
        arrival: {
          name: AIRPORTS[destination]?.city || destination,
          icao: destination,
          iata: destination.substring(1),
          handlingAgency: "Global Ground Handler",
          navigational: 600,
          terminal: 400,
          parking: 300,
          fuel: Math.round(fuelCost * 0.6)
        },
        route: {
          totalDistanceNm: Math.round(distance),
          firs: [
            { name: "Transit FIR 1", code: departure.substring(0, 2), charge: Math.round(overflightCharges * 0.4) },
            { name: "Transit FIR 2", code: destination.substring(0, 2), charge: Math.round(overflightCharges * 0.6) }
          ]
        }
      },
      breakdown: {
        acmi: Math.round(coreFlightCost),
        fuel: Math.round(fuelCost),
        overflight: Math.round(overflightCharges),
        handling: Math.round(handlingFee),
        landing: Math.round(landingFee),
        crew: Math.round(crewCost),
        positioning: Math.round(positioningCost),
        catering: Math.round(cateringCost),
        marketAdjustment: Math.round(marketAdjustment),
        riskAdjustment: Math.round(riskAdjustment),
        contingency: Math.round(contingency),
        brokerMargin: Math.round(brokerProfit),
        riskAndMarketAdjustments: Math.round(riskAndMarketAdjustments),
        acmiCalculation: `${blockHours.toFixed(1)} hrs @ $${adjustedAcmiRate.toFixed(0)}/hr`,
        fuelCalculation: `${blockHours.toFixed(1)} hrs @ ${ac.fuelBurn}kg/hr @ $${fuelPrice}/kg`,
        timeCalculation: `Distance ${Math.round(distance)}NM / Speed ${ac.speed}kts + 15% buffer`
      },
      metrics: {
        distance,
        flightHours,
        blockHours
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
