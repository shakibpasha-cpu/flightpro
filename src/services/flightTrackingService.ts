
export interface TrackingData {
  icao24: string;
  callsign?: string;
  latitude: number | null;
  longitude: number | null;
  velocity: number | null;
  baro_altitude: number | null;
  true_track: number | null;
  on_ground: boolean;
  last_contact: number;
}

export async function getLiveTrackingData(icao24: string): Promise<TrackingData | null> {
  try {
    const url = `https://opensky-network.org/api/states/all?icao24=${icao24.toLowerCase()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('OpenSky API rate limit exceeded.');
      }
      throw new Error(`OpenSky API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.states || data.states.length === 0) {
      return null;
    }

    const state = data.states[0];
    
    // OpenSky state vector format:
    // 0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
    // 5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity,
    // 10: true_track, 11: vertical_rate, 12: sensors, 13: geo_altitude, 14: squawk,
    // 15: spi, 16: position_source

    return {
      icao24: state[0],
      callsign: state[1]?.trim() || undefined,
      longitude: state[5],
      latitude: state[6],
      baro_altitude: state[7],
      on_ground: state[8],
      velocity: state[9],
      true_track: state[10],
      last_contact: state[4]
    };
  } catch (error) {
    console.error('Error fetching live tracking data:', error);
    throw error;
  }
}
