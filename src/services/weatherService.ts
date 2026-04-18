import { handleApiError } from './errorService';

export interface MetarData {
  airport: string;
  metar: string;
  taf: string;
  last_updated: string;
}

export interface NotamData {
  airport: string;
  notams: {
    id: string;
    description: string;
    severity: 'Low' | 'Medium' | 'High';
  }[];
  last_updated: string;
}

export async function getLiveWeather(icao: string): Promise<MetarData> {
  try {
    const response = await fetch(`/api/v1/weather/${icao}`);
    if (!response.ok) throw new Error(`Failed to fetch live weather (Status: ${response.status})`);
    return await response.json();
  } catch (error) {
    handleApiError(error, 'Weather Service', `/api/v1/weather/${icao}`);
    throw error; // handleApiError already throws, but for TS
  }
}

export async function getLiveNotams(icao: string, filters?: { keyword?: string; severity?: string }): Promise<NotamData> {
  const params = new URLSearchParams();
  if (filters?.keyword) params.append('keyword', filters.keyword);
  if (filters?.severity) params.append('severity', filters.severity);
  
  const queryString = params.toString();
  const url = `/api/v1/safety/notams/${icao}${queryString ? `?${queryString}` : ''}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch live NOTAMs (Status: ${response.status})`);
    return await response.json();
  } catch (error) {
    handleApiError(error, 'NOTAM Service', url);
    throw error;
  }
}
