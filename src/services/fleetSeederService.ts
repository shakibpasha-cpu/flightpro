import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getAI, handleAiError } from './aiService';
import { safeStringify } from '../utils/safeJson';

export const fleetSeederService = {
  async seedTop10Airlines() {
    const operators = [
      { name: 'Emirates', country: 'United Arab Emirates', icao: 'UAE', iata: 'EK', fleet: [
        { type: 'A380-800', quantity: 116, age: 9.2, family: 'Widebody' },
        { type: 'B777-300ER', quantity: 123, age: 10.5, family: 'Widebody' }
      ]},
      { name: 'Qatar Airways', country: 'Qatar', icao: 'QTR', iata: 'QR', fleet: [
        { type: 'A350-900', quantity: 34, age: 6.1, family: 'Widebody' },
        { type: 'A350-1000', quantity: 24, age: 4.2, family: 'Widebody' },
        { type: 'B777-300ER', quantity: 57, age: 10.8, family: 'Widebody' }
      ]},
      { name: 'Singapore Airlines', country: 'Singapore', icao: 'SIA', iata: 'SQ', fleet: [
        { type: 'A350-900', quantity: 63, age: 5.4, family: 'Widebody' },
        { type: 'B787-10', quantity: 22, age: 4.1, family: 'Widebody' },
        { type: 'A380-800', quantity: 12, age: 10.2, family: 'Widebody' }
      ]},
      { name: 'Lufthansa', country: 'Germany', icao: 'DLH', iata: 'LH', fleet: [
        { type: 'A320-200', quantity: 50, age: 15.3, family: 'Narrowbody' },
        { type: 'A350-900', quantity: 21, age: 5.1, family: 'Widebody' },
        { type: 'B747-8I', quantity: 19, age: 10.4, family: 'Widebody' }
      ]},
      { name: 'Delta Air Lines', country: 'United States', icao: 'DAL', iata: 'DL', fleet: [
        { type: 'A321-200', quantity: 127, age: 5.2, family: 'Narrowbody' },
        { type: 'B737-900ER', quantity: 160, age: 8.4, family: 'Narrowbody' },
        { type: 'A350-900', quantity: 28, age: 5.5, family: 'Widebody' }
      ]},
      { name: 'American Airlines', country: 'United States', icao: 'AAL', iata: 'AA', fleet: [
        { type: 'A321-200', quantity: 218, age: 10.1, family: 'Narrowbody' },
        { type: 'B737-800', quantity: 303, age: 14.2, family: 'Narrowbody' },
        { type: 'B787-8', quantity: 37, age: 6.4, family: 'Widebody' }
      ]},
      { name: 'United Airlines', country: 'United States', icao: 'UAL', iata: 'UA', fleet: [
        { type: 'B737-900ER', quantity: 136, age: 10.2, family: 'Narrowbody' },
        { type: 'B777-200ER', quantity: 55, age: 23.1, family: 'Widebody' },
        { type: 'B787-9', quantity: 38, age: 7.4, family: 'Widebody' }
      ]},
      { name: 'Air France', country: 'France', icao: 'AFR', iata: 'AF', fleet: [
        { type: 'A320-200', quantity: 37, age: 13.5, family: 'Narrowbody' },
        { type: 'A350-900', quantity: 20, age: 3.2, family: 'Widebody' },
        { type: 'B777-300ER', quantity: 43, age: 15.1, family: 'Widebody' }
      ]},
      { name: 'Turkish Airlines', country: 'Turkey', icao: 'THY', iata: 'TK', fleet: [
        { type: 'A321-200', quantity: 65, age: 10.4, family: 'Narrowbody' },
        { type: 'B777-300ER', quantity: 33, age: 10.2, family: 'Widebody' },
        { type: 'A330-300', quantity: 36, age: 10.1, family: 'Widebody' }
      ]},
      { name: 'British Airways', country: 'United Kingdom', icao: 'BAW', iata: 'BA', fleet: [
        { type: 'A320-200', quantity: 70, age: 14.2, family: 'Narrowbody' },
        { type: 'B777-200ER', quantity: 43, age: 24.1, family: 'Widebody' },
        { type: 'B787-9', quantity: 18, age: 7.2, family: 'Widebody' }
      ]},
      { name: 'Aviacore', country: 'UAE', icao: 'VCR', iata: 'VC', fleet: [], base_airport: 'OMDB', contact_email: 'ops@aviacore.ae', rating: 4.2 }
    ];

    for (const op of operators) {
      // 0. Seed Aircraft Master with technical data if missing
      for (const aircraft of op.fleet) {
        const masterQuery = query(collection(db, 'aircraft_master'), where('aircraft_type', '==', aircraft.type));
        const masterSnap = await getDocs(masterQuery);
        if (masterSnap.empty) {
          await addDoc(collection(db, 'aircraft_master'), {
            aircraft_type: aircraft.type,
            category: aircraft.family,
            manufacturer: aircraft.type.startsWith('A') ? 'Airbus' : 'Boeing',
            max_range_km: aircraft.family === 'Widebody' ? 12000 : 5000,
            max_payload_kg: aircraft.family === 'Widebody' ? 50000 : 20000,
            passenger_capacity: aircraft.family === 'Narrowbody' ? (aircraft.type.includes('321') || aircraft.type.includes('900') ? 220 : 180) :
                               aircraft.family === 'Widebody' ? (aircraft.type.includes('380') ? 550 : (aircraft.type.includes('777') || aircraft.type.includes('350') ? 350 : 280)) :
                               aircraft.family === 'Private' || aircraft.type.toLowerCase().includes('global') || aircraft.type.toLowerCase().includes('g650') ? 16 : 8,
            seats: aircraft.family === 'Narrowbody' ? (aircraft.type.includes('321') || aircraft.type.includes('900') ? 220 : 180) :
                   aircraft.family === 'Widebody' ? (aircraft.type.includes('380') ? 550 : (aircraft.type.includes('777') || aircraft.type.includes('350') ? 350 : 280)) :
                   aircraft.family === 'Private' || aircraft.type.toLowerCase().includes('global') || aircraft.type.toLowerCase().includes('g650') ? 16 : 8,
            cruise_speed_kts: 480,
            fuel_burn_kg_per_hr: aircraft.family === 'Widebody' ? 7000 : 2500
          });
        }
      }

      // 1. Check if operator exists
      const opQuery = query(collection(db, 'operators'), where('operator_name', '==', op.name));
      const opSnap = await getDocs(opQuery);
      let opId = '';

      if (opSnap.empty) {
        const newOp = await addDoc(collection(db, 'operators'), {
          operator_name: op.name,
          country: op.country,
          icao_code: op.icao,
          iata_code: op.iata,
          status: 'Active',
          contact_email: op.contact_email || `fleet@${op.name.toLowerCase().replace(/\s+/g, '')}.com`,
          base_airport: op.base_airport || '',
          acmi_available: true,
          rating: op.rating || 4.5
        });
        opId = newOp.id;
      } else {
        opId = opSnap.docs[0].id;
      }

      // 2. Add fleet data
      for (const aircraft of op.fleet) {
        // Check if fleet entry exists
        const fleetQuery = query(
          collection(db, 'aircraft_fleet'), 
          where('operator_id', '==', opId),
          where('aircraft_type', '==', aircraft.type)
        );
        const fleetSnap = await getDocs(fleetQuery);

        if (fleetSnap.empty) {
          await addDoc(collection(db, 'aircraft_fleet'), {
            operator_id: opId,
            aircraft_type: aircraft.type,
            quantity: aircraft.quantity,
            avg_age: aircraft.age,
            aircraft_family: aircraft.family,
            manufacturer: aircraft.type.startsWith('A') ? 'Airbus' : 'Boeing'
          });
        }
      }
    }
    console.log('Fleet seeding completed successfully');
  },

  async scrapeAndSeedFleet(airlineName: string, url?: string) {
    try {
      // 1. Get operator ID from either collection
      let opId = '';
      let collectionName = 'operators';
      
      const opQuery = query(collection(db, 'operators'), where('operator_name', '==', airlineName));
      const opSnap = await getDocs(opQuery);
      
      if (!opSnap.empty) {
        opId = opSnap.docs[0].id;
      } else {
        const masterOpQuery = query(collection(db, 'operators_master'), where('operator_name', '==', airlineName));
        const masterOpSnap = await getDocs(masterOpQuery);
        
        if (!masterOpSnap.empty) {
          opId = masterOpSnap.docs[0].id;
          collectionName = 'operators_master';
        } else {
          // Create in operators if not found anywhere
          const newOp = await addDoc(collection(db, 'operators'), {
            operator_name: airlineName,
            status: 'Active',
            acmi_available: true,
            rating: 50,
            lastContacted: new Date().toISOString()
          });
          opId = newOp.id;
        }
      }

      const response = await fetch('/api/scrape-fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({ airlineName, url })
      });

      if (!response.ok) throw new Error(`Failed to scrape ${airlineName}`);
      const scrapeResult = await response.json();
      const content = scrapeResult.content;

      const prompt = `You are an aviation fleet analyst. Analyze this content and extract detailed fleet information for the operator "${airlineName}".
      URL: ${scrapeResult.url}
      Content: ${content}
      
      Extract:
      1. Full List of Aircraft in Fleet. For each aircraft type, provide:
         - Aircraft Type (e.g., Boeing 737-800, Airbus A320neo)
         - Quantity (Number of aircraft currently in service)
         - Average Age (if mentioned, otherwise "Unknown")
         - On Order (Number of aircraft currently on order/not yet delivered)
      
      Return JSON format:
      {
        "operator_name": "...",
        "fleet": [
          { "aircraft_type": "...", "quantity": 0, "average_age": "...", "orders": 0 }
        ],
        "total_fleet_size": 0
      }`;

      const ai = getAI();
      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      if (!aiResponse.text) throw new Error("No response from AI for fleet analysis");
      const data = JSON.parse(aiResponse.text);

      // 2. Process Fleet
      let totalFleetSize = 0;
      for (const item of data.fleet) {
        totalFleetSize += item.quantity || 0;
        // Ensure Aircraft Master has technical data
        const masterQuery = query(collection(db, 'aircraft_master'), where('aircraft_type', '==', item.aircraft_type));
        const masterSnap = await getDocs(masterQuery);
        
        if (masterSnap.empty) {
          await addDoc(collection(db, 'aircraft_master'), {
            aircraft_type: item.aircraft_type,
            manufacturer: item.aircraft_type.toLowerCase().includes('airbus') ? 'Airbus' : 
                         item.aircraft_type.toLowerCase().includes('boeing') ? 'Boeing' : 'Other',
            category: item.aircraft_type.toLowerCase().includes('320') || item.aircraft_type.toLowerCase().includes('737') ? 'Narrowbody' : 'Widebody',
            passenger_capacity: item.aircraft_type.toLowerCase().includes('320') || item.aircraft_type.toLowerCase().includes('737') ? 180 : 300,
            seats: item.aircraft_type.toLowerCase().includes('320') || item.aircraft_type.toLowerCase().includes('737') ? 180 : 300,
            max_range_km: 8000,
            max_payload_kg: 30000,
            cruise_speed_kts: 450,
            fuel_burn_kg_per_hr: 3000
          });
        }

        // Add to Aircraft Fleet
        const fleetQuery = query(
          collection(db, 'aircraft_fleet'),
          where('operator_id', '==', opId),
          where('aircraft_type', '==', item.aircraft_type)
        );
        const fleetSnap = await getDocs(fleetQuery);

        if (fleetSnap.empty) {
          await addDoc(collection(db, 'aircraft_fleet'), {
            operator_id: opId,
            aircraft_type: item.aircraft_type,
            quantity: item.quantity,
            avg_age: item.average_age || 0,
            orders: item.orders || 0,
            last_updated: new Date().toISOString()
          });
        } else {
          // Update existing fleet record
          const fleetDocRef = doc(db, 'aircraft_fleet', fleetSnap.docs[0].id);
          await updateDoc(fleetDocRef, {
            quantity: item.quantity,
            avg_age: item.average_age || 0,
            orders: item.orders || 0,
            last_updated: new Date().toISOString()
          });
        }
      }

      // 3. Update Operator fleet size in the correct collection
      const opDocRef = doc(db, collectionName, opId);
      await updateDoc(opDocRef, { 
        fleet_size: totalFleetSize,
        last_fleet_update: new Date().toISOString()
      });

      return data;
    } catch (error) {
      handleAiError(error, 'scrapeAndSeedFleet');
      return null;
    }
  },

  async enhanceAircraftMasterData() {
    try {
      const collectionsToEnhance = ['aircraft_master', 'aircraft'];
      const allResults = [];

      for (const colName of collectionsToEnhance) {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);
        
        console.log(`Enhancing collection: ${colName} (${snapshot.size} docs)`);
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const aircraftType = data.aircraft_type || data.type;
          
          if (!aircraftType) continue;

          console.log(`Enhancing data for: ${aircraftType} in ${colName}`);
          
          try {
            const response = await fetch('/api/scrape-aircraft-specs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: safeStringify({ aircraftType })
            });
            
            // The endpoint is deprecated, so we'll just use the aircraftType directly in a prompt
            const prompt = `You are an aviation technical expert. Provide the official technical specifications for the aircraft type: ${aircraftType}.
            
            Extract:
            1. Manufacturer (e.g., Airbus, Boeing, Embraer, Gulfstream)
            2. Category (Narrowbody, Widebody, Regional, Business Jet, Turboprop)
            3. Max Range (in km)
            4. Max Payload (in kg)
            5. Cruise Speed (in knots)
            6. Fuel Burn (average kg per hour)
            7. Standard Passenger Capacity (typical 2-class or 1-class config)
            8. Maximum Takeoff Weight (MTOW in kg)
            9. Service Ceiling (in feet)
            
            Return JSON format:
            {
              "aircraft_type": "${aircraftType}",
              "manufacturer": "...",
              "category": "...",
              "max_range_km": 0,
              "max_payload_kg": 0,
              "cruise_speed_kts": 0,
              "fuel_burn_kg_per_hr": 0,
              "passenger_capacity": 0,
              "mtow_kg": 0,
              "service_ceiling_ft": 0
            }`;

            const ai = getAI();
            const aiResponse = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: prompt,
              config: { responseMimeType: "application/json" }
            });
            
            if (aiResponse.text) {
              const specs = JSON.parse(aiResponse.text);
              
              // Map specs to match the collection's field names
              const updateData: any = {
                last_enhanced: new Date().toISOString(),
                ai_verified: true
              };

              if (colName === 'aircraft_master') {
                Object.assign(updateData, specs);
              } else {
                // For 'aircraft' collection, map fields
                if (specs.fuel_burn_kg_per_hr) updateData.fuelBurnPerHour = specs.fuel_burn_kg_per_hr;
                if (specs.cruise_speed_kts) updateData.cruiseSpeed = specs.cruise_speed_kts;
                if (specs.max_range_km) updateData.range = Math.round(specs.max_range_km * 0.539957); // km to nm
                if (specs.max_payload_kg) updateData.maxPayload = specs.max_payload_kg;
                if (specs.passenger_capacity) updateData.maxPassengers = specs.passenger_capacity;
                if (specs.service_ceiling_ft) updateData.serviceCeiling = specs.service_ceiling_ft;
                if (specs.mtow_kg) updateData.mtow = specs.mtow_kg;
              }
              
              const { doc, updateDoc } = await import('firebase/firestore');
              const aircraftDocRef = doc(db, colName, docSnap.id);
              await updateDoc(aircraftDocRef, updateData);
              
              allResults.push({ aircraftType, collection: colName, status: 'Success' });
            } else {
              allResults.push({ aircraftType, collection: colName, status: 'Failed', error: response.statusText });
            }
          } catch (e) {
            console.error(`Failed to enhance ${aircraftType}:`, e);
            allResults.push({ aircraftType, collection: colName, status: 'Error', error: String(e) });
          }
          
          // Small delay to avoid hitting rate limits too hard
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      return allResults;
    } catch (error) {
      handleAiError(error, 'enhanceAircraftMasterData');
      return [];
    }
  },

  async scrapeAllOperatorsFleet() {
    try {
      const collectionsToProcess = ['operators', 'operators_master'];
      const results = [];

      for (const colName of collectionsToProcess) {
        const opRef = collection(db, colName);
        const snapshot = await getDocs(opRef);
        
        console.log(`Starting fleet scraping for ${snapshot.size} operators in ${colName}`);

        for (const docSnap of snapshot.docs) {
          const opData = docSnap.data();
          const airlineName = opData.operator_name;
          
          if (!airlineName) continue;

          console.log(`Scraping fleet for: ${airlineName} (${colName})`);
          
          try {
            const fleetData = await this.scrapeAndSeedFleet(airlineName);
            results.push({ 
              airlineName, 
              collection: colName,
              status: 'Success', 
              aircraftCount: fleetData.fleet?.length || 0 
            });
          } catch (e) {
            console.error(`Failed to scrape fleet for ${airlineName}:`, e);
            results.push({ 
              airlineName, 
              collection: colName,
              status: 'Error', 
              error: String(e) 
            });
          }

          // Delay to avoid overwhelming the scraper/API
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      return results;
    } catch (error) {
      handleAiError(error, 'scrapeAllOperatorsFleet');
      return [];
    }
  },

  async enrichAllOperatorsData() {
    try {
      const collectionsToProcess = ['operators', 'operators_master'];
      const results = [];

      for (const colName of collectionsToProcess) {
        const opRef = collection(db, colName);
        const snapshot = await getDocs(opRef);
        
        const operators = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
        
        // Sort by number of missing fields (descending)
        operators.sort((a: any, b: any) => {
          const missingA = [!a.contact_email, !a.website, !a.general_notes].filter(Boolean).length;
          const missingB = [!b.contact_email, !b.website, !b.general_notes].filter(Boolean).length;
          return missingB - missingA;
        });

        console.log(`Starting data enrichment for ${operators.length} operators in ${colName}`);

        for (const opData of operators) {
          const airlineName = opData.operator_name;
          
          // Only process if missing fields
          const hasMissingInfo = !opData.contact_email || !opData.website || !opData.general_notes;
          
          if (!airlineName || !hasMissingInfo) continue;

          console.log(`Enriching data for: ${airlineName} (${colName}) - Missing info detected`);
          
          try {
            const prompt = `You are an aviation business analyst. Find the official contact details and general information for the airline/operator: "${airlineName}" ${opData.country ? `based in ${opData.country}` : ""}.
            
            Extract:
            1. Official Website URL
            2. General Contact Email (e.g., info@, sales@, ops@)
            3. Primary Phone Number
            4. Head Office Address
            5. Brief General Notes (2-3 sentences about their history, fleet focus, or market position)
            
            Return JSON format:
            {
              "website": "...",
              "contact_email": "...",
              "phone": "...",
              "address": "...",
              "general_notes": "..."
            }`;

            const ai = getAI();
            const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: prompt,
              config: { responseMimeType: "application/json" }
            });

            if (response.text) {
              const enrichedData = JSON.parse(response.text);
              
              const opDocRef = doc(db, colName, opData.id);
              await updateDoc(opDocRef, {
                website: enrichedData.website || opData.website || '',
                contact_email: enrichedData.contact_email || opData.contact_email || '',
                phone: enrichedData.phone || opData.phone || '',
                address: enrichedData.address || opData.address || '',
                general_notes: enrichedData.general_notes || opData.general_notes || '',
                last_enriched: new Date().toISOString()
              });

              results.push({ airlineName, status: 'Success' });
            } else {
              results.push({ airlineName, status: 'Failed', error: 'No response from AI' });
            }
          } catch (e) {
            console.error(`Failed to enrich ${airlineName}:`, e);
            results.push({ airlineName, status: 'Error', error: String(e) });
          }

          // Delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      return results;
    } catch (error) {
      handleAiError(error, 'enrichAllOperatorsData');
      return [];
    }
  }
};
