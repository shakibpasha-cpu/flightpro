/**
 * Availability Engine Service
 * Calculates aircraft availability based on live tracking, historical patterns, and schedules.
 */

import { db } from '../firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { predictAvailability } from './aiService';
import { handleApiError } from './errorService';

export type AvailabilityStatus = 'Confirmed Available' | 'Likely Available' | 'On Request';

interface AvailabilityResult {
  status: AvailabilityStatus;
  reason: string;
  lastTracked?: any;
  utilization?: any;
  intelligence?: {
    isIdle: boolean;
    isHighUtilization: boolean;
    isAtBase: boolean;
    hasConsistentPattern: boolean;
  };
}

export async function calculateAvailability(aircraftId: string, icao24?: string, registration?: string): Promise<AvailabilityResult> {
  try {
    let liveData = null;
    let utilizationData = null;

    // 0. Check Firestore Availability Collection for Manual Blocks
    const now = new Date();
    const availabilityRef = collection(db, 'availability');
    const snapshot = await getDocs(availabilityRef);
    
    if (!snapshot.empty) {
      const block = snapshot.docs.find(doc => {
        const data = doc.data();
        const id = data.aircraftId || data.aircraft_listing_id;
        const start = new Date(data.startTime || data.start_date);
        const end = new Date(data.endTime || data.end_date);
        const status = data.status || data.availability_status;

        if (id !== aircraftId) return false;
        if (now < start || now > end) return false;
        
        return status === 'booked' || status === 'Booked' || 
               status === 'maintenance' || status === 'Maintenance' || 
               status === 'blocked' || status === 'Blocked';
      });

      if (block) {
        const data = block.data();
        const status = data.status || data.availability_status;
        return {
          status: 'On Request',
          reason: `Aircraft is currently ${status} (Notes: ${data.notes || 'N/A'}).`,
        };
      }
    }

    // 1. Fetch Live Tracking (OpenSky)
    if (icao24) {
      const fetchWithRetry = async (url: string, retries = 2): Promise<Response> => {
        try {
          // Use absolute URL to be sure
          const absoluteUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : `http://localhost:3000${url}`;
          const res = await fetch(absoluteUrl);
          if (!res.ok && retries > 0) throw new Error(`Status ${res.status}`);
          return res;
        } catch (e) {
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRetry(url, retries - 1);
          }
          throw e;
        }
      };

      try {
        const endpoint = `/api/v1/aircraft/track/${encodeURIComponent(icao24.trim())}`;
        const response = await fetchWithRetry(endpoint);
        if (response.ok) {
          const result = await response.json();
          liveData = result.data;
        } else {
          throw new Error(`OpenSky API failed (Status: ${response.status})`);
        }
      } catch (e) {
        handleApiError(e, 'OpenSky API', `/api/v1/aircraft/track/${icao24}`);
      }
    }

    // 2. Fetch Historical Patterns (Aviationstack)
    if (registration) {
      const fetchWithRetry = async (url: string, retries = 2): Promise<Response> => {
        try {
          // Use absolute URL to be sure
          const absoluteUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : `http://localhost:3000${url}`;
          const res = await fetch(absoluteUrl);
          if (!res.ok && retries > 0) throw new Error(`Status ${res.status}`);
          return res;
        } catch (e) {
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRetry(url, retries - 1);
          }
          throw e;
        }
      };

      try {
        const endpoint = `/api/v1/aircraft/utilization/${encodeURIComponent(registration.trim())}`;
        const response = await fetchWithRetry(endpoint);
        if (response.ok) {
          const result = await response.json();
          utilizationData = result.metrics;
        } else {
          throw new Error(`Aviationstack API failed (Status: ${response.status})`);
        }
      } catch (e) {
        handleApiError(e, 'Aviationstack API', `/api/v1/aircraft/utilization/${registration}`);
      }
    }

    // 3. AI-Powered Availability Prediction
    const aiPrediction = await predictAvailability(aircraftId, liveData, utilizationData, {
      departureIcao: icao24, // Use icao24 as a proxy for departure if not provided
      registration
    });
    
    if (aiPrediction) {
      return {
        status: aiPrediction.status,
        reason: aiPrediction.reason,
        lastTracked: liveData,
        utilization: utilizationData,
        intelligence: aiPrediction.intelligence
      };
    }

    // Fallback Logic (if AI fails) - Implementing the 4 Core Rules
    
    // RULE 1: Idle Aircraft
    // If Last Flight > 24-48 hrs ago -> Likely Available
    if (liveData && liveData.last_contact) {
      const lastContact = new Date(liveData.last_contact * 1000);
      const hoursSinceLastContact = (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastContact > 24) {
        return {
          status: 'Likely Available',
          reason: `Aircraft has been idle for ${Math.round(hoursSinceLastContact)} hours.`,
          lastTracked: liveData,
          utilization: utilizationData,
          intelligence: {
            isIdle: true,
            isHighUtilization: false,
            isAtBase: false,
            hasConsistentPattern: false
          }
        };
      }
    }

    // RULE 2: High Utilization
    // If 5-6 flights/day -> NOT Available
    if (utilizationData && utilizationData.daily_flights >= 5) {
      return {
        status: 'On Request',
        reason: `High utilization detected (${utilizationData.daily_flights} flights today). Availability is unlikely.`,
        lastTracked: liveData,
        utilization: utilizationData,
        intelligence: {
          isIdle: false,
          isHighUtilization: true,
          isAtBase: false,
          hasConsistentPattern: false
        }
      };
    }

    // RULE 3: Base Airport Matching
    // If Aircraft already near departure -> HIGH availability probability
    // (This requires knowing the mission departure, which we'll assume is passed or inferred)

    // RULE 4: Night Parking Pattern
    // Same airport every night -> Likely base aircraft -> easier ACMI
    if (utilizationData && utilizationData.is_base_consistent) {
       return {
          status: 'Confirmed Available',
          reason: 'Aircraft follows a consistent night parking pattern at its base, suggesting high ACMI availability.',
          lastTracked: liveData,
          utilization: utilizationData,
          intelligence: {
            isIdle: false,
            isHighUtilization: false,
            isAtBase: true,
            hasConsistentPattern: true
          }
        };
    }

    // Fallback: If no live data but we have utilization
    if (utilizationData) {
      if (utilizationData.active_missions === 0 && utilizationData.total_recent_flights < 5) {
        return {
          status: 'Likely Available',
          reason: 'No live tracking, but historical patterns suggest availability.',
          utilization: utilizationData,
          intelligence: {
            isIdle: true,
            isHighUtilization: false,
            isAtBase: false,
            hasConsistentPattern: false
          }
        };
      }
    }

    // Default
    return {
      status: 'On Request',
      reason: 'Insufficient live data to confirm availability. Contact operator for schedule.'
    };

  } catch (error) {
    console.error('Availability Engine Error:', error);
    return {
      status: 'On Request',
      reason: 'Error calculating availability. Please try again later.'
    };
  }
}
