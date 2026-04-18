import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plane, Plus, Trash2, AlertCircle, CheckCircle2, Save, Loader2, ChevronRight, ChevronLeft, Copy, History, Edit2, Zap, Sparkles, Building2, Mail, Phone, DollarSign, X, Globe } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { motion, AnimatePresence } from 'motion/react';
import { optimizeFlightSchedule, getAirportCoords, searchHandlingAgents, getAirportDetails } from '../services/aiService';

interface Flight {
  departure: string;
  destination: string;
  etd: string; // HH:mm
  eta: string; // HH:mm
  flightTimeMinutes: number; // minutes
  flightDurationHours: number; // hours
  turnaroundTime: number; // minutes
  altitude: number; // feet
  departureCoords?: { lat: number; lng: number };
  destinationCoords?: { lat: number; lng: number };
  departureDetails?: {
    runwayLength?: number;
    elevation?: number;
    fuelTypes?: string[];
    handlingAvailable?: boolean;
  };
  destinationDetails?: {
    runwayLength?: number;
    elevation?: number;
    fuelTypes?: string[];
    handlingAvailable?: boolean;
  };
  handlingAgent?: {
    companyName: string;
    email: string;
    phone?: string;
    baseFee: number;
  };
  crewIds?: string[];
  passengers?: number;
  cargoWeight?: number;
  error?: string;
}

interface Crew {
  id: string;
  name: string;
  role: 'Captain' | 'First Officer' | 'Cabin Crew';
  base: string;
  status: 'Available' | 'On Duty' | 'Resting';
}

interface Schedule {
  id?: string;
  aircraftId: string;
  aircraftType: string;
  date: string; // YYYY-MM-DD
  flights: Flight[];
  crewIds: string[];
  totalDutyTime: number; // hours
  status: 'draft' | 'published' | 'completed';
}

interface Aircraft {
  id: string;
  type: string;
}

import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

export default function ScheduleBuilder() {
  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);
  const [crewList, setCrewList] = useState<Crew[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'builder' | 'calendar'>('builder');
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [isLeftColumnCollapsed, setIsLeftColumnCollapsed] = useState(false);
  const [selectingAgentFor, setSelectingAgentFor] = useState<{ index: number; icao: string } | null>(null);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [fetchingAgents, setFetchingAgents] = useState(false);
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});

  const DUTY_LIMIT_HOURS = 14;
  const MIN_TURNAROUND_MINUTES = 45;

  const calculateCrewDutyTime = (crewId: string, currentFlights: Flight[]) => {
    const assignedFlights = currentFlights.filter(f => f.crewIds?.includes(crewId));
    if (assignedFlights.length === 0) return 0;
    
    // Sort assigned flights by ETD to find first and last
    const sorted = [...assignedFlights].sort((a, b) => {
      if (!a.etd || !b.etd) return 0;
      return a.etd.localeCompare(b.etd);
    });
    
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    if (!first.etd || !last.eta) return 0;

    const [sH, sM] = first.etd.split(':').map(Number);
    const [eH, eM] = last.eta.split(':').map(Number);
    
    let startMinutes = sH * 60 + sM - 60; // 1h before first flight
    let endMinutes = eH * 60 + eM + 30; // 30m after last flight
    
    if (endMinutes < startMinutes) endMinutes += 24 * 60; // Handle overnight
    
    return (endMinutes - startMinutes) / 60;
  };

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const ensureTurnaroundTimes = (flights: Flight[]): Flight[] => {
    return flights.map((flight, idx) => {
      if (idx === 0) return { ...flight, turnaroundTime: 0 };
      const prevFlight = flights[idx - 1];
      if (prevFlight.eta && flight.etd) {
        const [pHE, pME] = prevFlight.eta.split(':').map(Number);
        const [cHS, cMS] = flight.etd.split(':').map(Number);
        let diff = (cHS * 60 + cMS) - (pHE * 60 + pME);
        if (diff < 0) diff += 24 * 60;
        return { ...flight, turnaroundTime: diff };
      }
      return flight;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aircraftSnap, crewSnap, schedulesSnap] = await Promise.all([
          getDocs(collection(db, 'aircraft')),
          getDocs(collection(db, 'crew')),
          getDocs(collection(db, 'schedules'))
        ]);
        
        const aircraftData = aircraftSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aircraft));
        setAircraftList(Array.from(new Map(aircraftData.map(item => [item.id, item])).values()));
        
        const crewData = crewSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Crew));
        setCrewList(Array.from(new Map(crewData.map(item => [item.id, item])).values()));

        const schedulesData = schedulesSnap.docs.map(doc => {
          const data = doc.data() as Schedule;
          const flightsWithTurnaround = ensureTurnaroundTimes(data.flights.map(f => ({
            ...f,
            altitude: f.altitude || 35000,
            crewIds: f.crewIds || []
          })));
          
          return {
            ...data,
            id: doc.id,
            flights: flightsWithTurnaround
          } as Schedule;
        });
        setAllSchedules(Array.from(new Map(schedulesData.map(item => [item.id, item])).values()));
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedAircraft) {
      setSchedules([]);
      return;
    }
    setSchedules(allSchedules.filter(s => s.aircraftId === selectedAircraft));
  }, [selectedAircraft, allSchedules]);

  const addFlight = () => {
    const lastFlight = flights[flights.length - 1];
    let defaultEtd = '08:00';
    
    if (lastFlight?.eta) {
      const [h, m] = lastFlight.eta.split(':').map(Number);
      const totalMinutes = h * 60 + m + MIN_TURNAROUND_MINUTES;
      const newH = Math.floor(totalMinutes / 60) % 24;
      const newM = totalMinutes % 60;
      defaultEtd = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    }

    const newFlight: Flight = {
      departure: lastFlight?.destination || '',
      destination: '',
      etd: defaultEtd,
      eta: '',
      flightTimeMinutes: 0,
      flightDurationHours: 0,
      turnaroundTime: MIN_TURNAROUND_MINUTES,
      altitude: 35000,
      departureCoords: lastFlight?.destinationCoords,
      handlingAgent: undefined,
      crewIds: [],
      passengers: 0,
      cargoWeight: 0
    };
    setFlights([...flights, newFlight]);
  };

  const removeFlight = (index: number) => {
    const newFlights = flights.filter((_, i) => i !== index);
    setFlights(newFlights);
    const allCrewIds = Array.from(new Set(newFlights.flatMap(f => f.crewIds || [])));
    setSelectedCrew(allCrewIds);
  };

  const updateFlight = (index: number, updates: Partial<Flight>) => {
    const newFlights = [...flights];
    let currentFlight = { ...newFlights[index], ...updates };
    currentFlight.error = undefined;

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    // Validate format if ETD or ETA is updated
    if (updates.etd && !timeRegex.test(updates.etd)) {
      currentFlight.error = 'Invalid ETD format (HH:mm)';
    } else if (updates.eta && !timeRegex.test(updates.eta)) {
      currentFlight.error = 'Invalid ETA format (HH:mm)';
    }

    // Handle ETD/ETA/FlightTime interactions
    if (!currentFlight.error && (updates.etd || updates.eta)) {
      if (currentFlight.etd && currentFlight.eta) {
        const startParts = currentFlight.etd.split(':').map(Number);
        const endParts = currentFlight.eta.split(':').map(Number);
        
        if (startParts.length === 2 && endParts.length === 2 && 
            !isNaN(startParts[0]) && !isNaN(startParts[1]) && 
            !isNaN(endParts[0]) && !isNaN(endParts[1])) {
          
          const [sH, sM] = startParts;
          const [eH, eM] = endParts;
          let diff = (eH * 60 + eM) - (sH * 60 + sM);
          
          if (diff === 0) {
            currentFlight.error = 'ETA cannot be the same as ETD';
          } else if (diff < 0) {
            // Logic: If ETA is before ETD, it's an overnight flight.
            diff += 24 * 60; // Handle overnight
          }
          
          if (!currentFlight.error) {
            currentFlight.flightDurationHours = Number((diff / 60).toFixed(2));
            currentFlight.flightTimeMinutes = diff;
          }
        }
      }
    } else if (!currentFlight.error && updates.flightTimeMinutes !== undefined) {
      if (currentFlight.etd) {
        const startParts = currentFlight.etd.split(':').map(Number);
        if (startParts.length === 2 && !isNaN(startParts[0]) && !isNaN(startParts[1])) {
          const [sH, sM] = startParts;
          const totalMinutes = sH * 60 + sM + updates.flightTimeMinutes;
          const eH = Math.floor(totalMinutes / 60) % 24;
          const eM = totalMinutes % 60;
          currentFlight.eta = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
          currentFlight.flightDurationHours = Number((updates.flightTimeMinutes / 60).toFixed(2));
        }
      }
    }

    newFlights[index] = currentFlight;

    // Fetch details if departure/destination changes
    if (updates.departure !== undefined) {
      if ((updates.departure.length === 4 || updates.departure.length === 3) && updates.departure !== flights[index].departure) {
        getAirportDetails(updates.departure).then(details => {
          setFlights(prev => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = { 
                ...updated[index], 
                departureCoords: { lat: details.lat, lng: details.lng },
                departureDetails: {
                  runwayLength: details.runwayLength,
                  elevation: details.elevation,
                  fuelTypes: details.fuelTypes,
                  handlingAvailable: details.handlingAvailable
                }
              };
            }
            return updated;
          });
        }).catch(console.error);
      } else if (updates.departure.length < 3) {
        currentFlight.departureCoords = undefined;
        currentFlight.departureDetails = undefined;
      }
    }
    if (updates.destination !== undefined) {
      if ((updates.destination.length === 4 || updates.destination.length === 3) && updates.destination !== flights[index].destination) {
        // Clear handling agent if destination changes
        currentFlight.handlingAgent = undefined;

        getAirportDetails(updates.destination).then(details => {
          setFlights(prev => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = { 
                ...updated[index], 
                destinationCoords: { lat: details.lat, lng: details.lng },
                destinationDetails: {
                  runwayLength: details.runwayLength,
                  elevation: details.elevation,
                  fuelTypes: details.fuelTypes,
                  handlingAvailable: details.handlingAvailable
                }
              };
            }
            return updated;
          });
        }).catch(console.error);

        // Fetch agent count for this airport
        const agentsQuery = query(collection(db, 'handlingAgents'), where('icao', '==', updates.destination));
        getDocs(agentsQuery).then(snap => {
          setAgentCounts(prev => ({ ...prev, [updates.destination]: snap.size }));
        }).catch(console.error);
      } else if (updates.destination.length < 4) {
        currentFlight.destinationCoords = undefined;
      }
    }

    // Update current flight's turnaround (based on previous)
    if (index > 0) {
      const prevFlight = newFlights[index - 1];
      if (prevFlight.eta && currentFlight.etd) {
        const [pHE, pME] = prevFlight.eta.split(':').map(Number);
        const [cHS, cMS] = currentFlight.etd.split(':').map(Number);
        let diff = (cHS * 60 + cMS) - (pHE * 60 + pME);
        if (diff < 0) diff += 24 * 60;
        newFlights[index].turnaroundTime = diff;
      }
    }

    // Update next flight's turnaround (based on current)
    if (index < newFlights.length - 1) {
      const nextFlight = newFlights[index + 1];
      if (currentFlight.eta && nextFlight.etd) {
        const [cHE, cME] = currentFlight.eta.split(':').map(Number);
        const [nHS, nMS] = nextFlight.etd.split(':').map(Number);
        let diff = (nHS * 60 + nMS) - (cHE * 60 + cME);
        if (diff < 0) diff += 24 * 60;
        newFlights[index + 1].turnaroundTime = diff;
      }
    }

    setFlights(newFlights);
  };

  const updateHandlingAgent = (index: number, updates: Partial<NonNullable<Flight['handlingAgent']>>) => {
    const newFlights = [...flights];
    const currentFlight = { ...newFlights[index] };
    if (currentFlight.handlingAgent) {
      currentFlight.handlingAgent = { ...currentFlight.handlingAgent, ...updates };
      newFlights[index] = currentFlight;
      setFlights(newFlights);
    }
  };

  const toggleCrewForLeg = (legIdx: number, crewId: string) => {
    const newFlights = [...flights];
    const leg = { ...newFlights[legIdx] };
    const currentCrew = leg.crewIds || [];
    
    if (currentCrew.includes(crewId)) {
      leg.crewIds = currentCrew.filter(id => id !== crewId);
    } else {
      // Check duty time limit before adding
      const tempFlights = [...flights];
      tempFlights[legIdx] = { ...leg, crewIds: [...currentCrew, crewId] };
      const dutyTime = calculateCrewDutyTime(crewId, tempFlights);
      
      if (dutyTime > DUTY_LIMIT_HOURS) {
        alert(`Cannot assign crew member. Total duty time would exceed ${DUTY_LIMIT_HOURS} hours.`);
        return;
      }
      
      leg.crewIds = [...currentCrew, crewId];
    }
    
    newFlights[legIdx] = leg;
    setFlights(newFlights);
    
    // Also update global selectedCrew to be the union of all leg crew
    const allCrewIds = Array.from(new Set(newFlights.flatMap(f => f.crewIds || [])));
    setSelectedCrew(allCrewIds);
  };

  const handleOpenAgentSelector = async (index: number, icao: string) => {
    if (!icao || icao.length < 3) {
      alert('Please enter a valid ICAO code first.');
      return;
    }
    setSelectingAgentFor({ index, icao });
    setFetchingAgents(true);
    try {
      // First try to fetch from database
      const q = query(collection(db, 'handlingAgents'), where('icao', '==', icao));
      const snap = await getDocs(q);
      let agents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // If no agents in database, fetch from AI
      if (agents.length === 0) {
        const aiResults = await searchHandlingAgents(icao);
        if (aiResults && aiResults.agents) {
          agents = aiResults.agents.map((a: any, idx: number) => ({
            id: `ai-${idx}`,
            ...a,
            isAiSuggestion: true
          }));
        }
      }
      
      setAvailableAgents(agents);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setFetchingAgents(false);
    }
  };

  const fetchAiAgents = async () => {
    if (!selectingAgentFor) return;
    setFetchingAgents(true);
    try {
      const aiResults = await searchHandlingAgents(selectingAgentFor.icao);
      if (aiResults && aiResults.agents) {
        const aiAgents = aiResults.agents.map((a: any, idx: number) => ({
          id: `ai-${idx}-${Date.now()}`,
          ...a,
          isAiSuggestion: true
        }));
        // Merge with existing agents, avoiding duplicates by company name
        setAvailableAgents(prev => {
          const existingNames = new Set(prev.map(a => a.companyName.toLowerCase()));
          const newAiAgents = aiAgents.filter((a: any) => !existingNames.has(a.companyName.toLowerCase()));
          return [...prev, ...newAiAgents];
        });
      }
    } catch (error) {
      console.error('Error fetching AI agents:', error);
    } finally {
      setFetchingAgents(false);
    }
  };

  const selectAgent = (agent: any) => {
    if (selectingAgentFor) {
      updateFlight(selectingAgentFor.index, {
        handlingAgent: {
          companyName: agent.companyName,
          email: agent.email,
          phone: agent.phone || '',
          baseFee: agent.baseFee
        }
      });
      setSelectingAgentFor(null);
    }
  };

  const calculateTotalDuty = () => {
    if (flights.length === 0) return 0;
    
    const sorted = [...flights].sort((a, b) => {
      if (!a.etd || !b.etd) return 0;
      return a.etd.localeCompare(b.etd);
    });
    
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    if (!first.etd || !last.eta) {
      // Fallback if ETD/ETA are missing
      const totalFlightMinutes = flights.reduce((sum, f) => sum + (f.flightTimeMinutes || 0), 0);
      const totalTurnaroundMinutes = flights.slice(1).reduce((sum, f) => sum + (f.turnaroundTime || 0), 0);
      const totalMinutes = totalFlightMinutes + totalTurnaroundMinutes + 90;
      return totalMinutes / 60;
    }

    const [sH, sM] = first.etd.split(':').map(Number);
    const [eH, eM] = last.eta.split(':').map(Number);
    
    let startMinutes = sH * 60 + sM - 60; // 1h before first flight
    let endMinutes = eH * 60 + eM + 30; // 30m after last flight
    
    if (endMinutes < startMinutes) endMinutes += 24 * 60; // Handle overnight
    
    return (endMinutes - startMinutes) / 60;
  };

  const totalDuty = calculateTotalDuty();
  
  // Check if any assigned crew member exceeds the limit
  const maxCrewDuty = selectedCrew.length > 0 
    ? Math.max(...selectedCrew.map(id => calculateCrewDutyTime(id, flights)))
    : totalDuty;
    
  const isOverLimit = maxCrewDuty > DUTY_LIMIT_HOURS;
  const hasErrors = flights.some(f => f.error);

  const handleSave = async () => {
    if (!selectedAircraft || flights.length === 0) return;
    
    // Check for aircraft availability (overlap on same date)
    const existingOnDate = allSchedules.find(s => s.aircraftId === selectedAircraft && s.date === selectedDate && s.id !== editingId);
    if (existingOnDate) {
      alert(`Aircraft is already scheduled for ${selectedDate}. Please edit the existing schedule or choose another date.`);
      return;
    }

    // Check for crew availability and duty limits
    for (const crewId of selectedCrew) {
      const crewBusy = allSchedules.find(s => s.date === selectedDate && s.crewIds.includes(crewId) && s.id !== editingId);
      if (crewBusy) {
        const crewMember = crewList.find(c => c.id === crewId);
        alert(`${crewMember?.name} is already assigned to another flight on ${selectedDate}.`);
        return;
      }

      const dutyTime = calculateCrewDutyTime(crewId, flights);
      if (dutyTime > DUTY_LIMIT_HOURS) {
        const crewMember = crewList.find(c => c.id === crewId);
        alert(`${crewMember?.name}'s total duty time (${dutyTime.toFixed(1)}h) exceeds the limit of ${DUTY_LIMIT_HOURS}h.`);
        return;
      }
    }

    setLoading(true);
    try {
      const aircraft = aircraftList.find(a => a.id === selectedAircraft);
      const scheduleData: Omit<Schedule, 'id'> = {
        aircraftId: selectedAircraft,
        aircraftType: aircraft?.type || '',
        date: selectedDate,
        flights,
        crewIds: selectedCrew,
        totalDutyTime: totalDuty,
        status: 'published'
      };

      if (editingId) {
        await updateDoc(doc(db, 'schedules', editingId), scheduleData);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'schedules'), scheduleData);
      }

      setFlights([]);
      setSelectedCrew([]);
      
      // Refresh all schedules
      const snapshot = await getDocs(collection(db, 'schedules'));
      const schedulesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule));
      setAllSchedules(Array.from(new Map(schedulesData.map(item => [item.id, item])).values()));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async () => {
    if (flights.length === 0) return;
    setOptimizing(true);
    try {
      const aircraft = aircraftList.find(a => a.id === selectedAircraft);
      const schedule = {
        aircraft,
        date: selectedDate,
        flights
      };
      const result = await optimizeFlightSchedule(schedule);
      setOptimizationResult(result);
    } catch (error) {
      console.error('Optimization error:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const handleCloneRotation = async (schedule: Schedule) => {
    setLoading(true);
    try {
      const baseDate = new Date(schedule.date);
      for (let i = 1; i <= 7; i++) {
        const nextDate = new Date(baseDate);
        nextDate.setDate(baseDate.getDate() + i);
        const newSchedule: Omit<Schedule, 'id'> = {
          aircraftId: schedule.aircraftId,
          aircraftType: schedule.aircraftType,
          date: nextDate.toISOString().split('T')[0],
          flights: schedule.flights,
          crewIds: schedule.crewIds || [],
          totalDutyTime: schedule.totalDutyTime,
          status: 'published'
        };
        await addDoc(collection(db, 'schedules'), newSchedule);
      }
      // Refresh
      const q = query(
        collection(db, 'schedules'),
        where('aircraftId', '==', selectedAircraft),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingId(schedule.id || null);
    setSelectedDate(schedule.date);
    setFlights(schedule.flights.map(f => ({ ...f, crewIds: f.crewIds || [] })));
    setSelectedCrew(schedule.crewIds || []);
    setViewMode('builder');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'schedules', id));
      setAllSchedules(allSchedules.filter(s => s.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'schedules');
    } finally {
      setLoading(false);
    }
  };

  const calendarEvents = allSchedules.map(s => {
    const firstFlight = s.flights[0];
    const lastFlight = s.flights[s.flights.length - 1];
    
    if (!firstFlight || !lastFlight) return null;

    const start = new Date(`${s.date}T${firstFlight.etd || '00:00'}`);
    const end = new Date(`${s.date}T${lastFlight.eta || '23:59'}`);

    return {
      id: s.id,
      title: `${s.aircraftType}: ${firstFlight.departure || '???'} → ${lastFlight.destination || '???'}`,
      start,
      end,
      resource: s
    };
  }).filter((e): e is any => e !== null);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Schedule & Operations</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Plan aircraft rotations, assign crew, and monitor availability.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('builder')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'builder' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-400'}`}
            >
              Builder
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-400'}`}
            >
              Calendar
            </button>
          </div>
          <select 
            className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm font-bold dark:text-white"
            value={selectedAircraft}
            onChange={(e) => setSelectedAircraft(e.target.value)}
          >
            <option value="">All Aircraft</option>
            {aircraftList.map(a => (
              <option key={a.id} value={a.id}>{a.type}</option>
            ))}
          </select>
          <input 
            type="date" 
            className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm font-bold dark:text-white"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm h-[700px]">
          <BigCalendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            onSelectEvent={(event) => handleEdit(event.resource)}
            views={['month', 'week', 'day']}
            className="dark:text-white"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
          {/* Builder Area */}
          <div className={`${isLeftColumnCollapsed ? 'hidden' : 'lg:col-span-8'} space-y-6 transition-all duration-300`}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-600 dark:text-indigo-400" />
                  {editingId ? 'Edit Schedule' : 'Daily Schedule'}: {selectedDate}
                </h3>
                <div className="flex gap-4">
                  {editingId && (
                    <button 
                      onClick={() => {
                        setEditingId(null);
                        setFlights([]);
                        setSelectedCrew([]);
                      }}
                      className="text-xs font-bold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button 
                    onClick={addFlight}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                  >
                    <Plus size={14} /> Add Flight Leg
                  </button>
                  <button 
                    onClick={handleOptimize}
                    disabled={optimizing || flights.length === 0 || hasErrors}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline disabled:opacity-50"
                  >
                    {optimizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Optimize Schedule
                  </button>
                </div>
              </div>

              {optimizationResult && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <Zap size={18} className="text-emerald-600 dark:text-emerald-400" />
                      <h4 className="font-bold text-emerald-800 dark:text-emerald-300">AI Optimization Suggestions</h4>
                    </div>
                    <button 
                      onClick={() => setOptimizationResult(null)}
                      className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-500">Est. Time Savings</p>
                      <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{optimizationResult.estimatedSavings.timeMinutes} mins</p>
                    </div>
                    <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-500">Est. Fuel Savings</p>
                      <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{optimizationResult.estimatedSavings.fuelUnits} units</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {optimizationResult.suggestions.map((s: any, i: number) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="mt-1 w-4 h-4 bg-emerald-200 dark:bg-emerald-800 rounded-full flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">{s.suggestion}</p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 italic">{s.impact}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {optimizationResult.generalNotes && (
                    <p className="mt-4 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium border-t border-emerald-100 dark:border-emerald-900/30 pt-3">
                      {optimizationResult.generalNotes}
                    </p>
                  )}

                  {optimizationResult.revisedSchedule && (
                    <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-emerald-900/30 flex justify-end">
                      <button 
                        onClick={() => {
                          setFlights(ensureTurnaroundTimes(optimizationResult.revisedSchedule));
                          setOptimizationResult(null);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        <CheckCircle2 size={14} />
                        Apply Optimized Schedule
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              <div className="space-y-4">
                {flights.map((flight, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && (
                      <div className="flex items-center justify-center -my-2 relative z-10">
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2 group/turnaround">
                          <Clock size={12} className={flight.turnaroundTime < MIN_TURNAROUND_MINUTES ? 'text-amber-500' : 'text-indigo-500'} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${flight.turnaroundTime < MIN_TURNAROUND_MINUTES ? 'text-amber-600 dark:text-amber-500' : 'text-gray-500 dark:text-gray-400'}`}>
                            Turnaround: {formatMinutes(flight.turnaroundTime || 0)}
                            {flight.turnaroundTime < MIN_TURNAROUND_MINUTES && ' (Below Minimum)'}
                          </span>
                        </div>
                      </div>
                    )}
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 relative group"
                  >
                    <button 
                      onClick={() => removeFlight(idx)}
                      className="absolute -right-2 -top-2 w-6 h-6 bg-white dark:bg-gray-700 border border-red-100 dark:border-red-900/50 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm"
                    >
                      <Trash2 size={12} />
                    </button>

                    <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Departure</label>
                          {flight.departureCoords && (
                            <div className="flex items-center gap-1 group/coords relative">
                              <span className="text-[8px] text-emerald-500 font-bold cursor-help">LOCATED</span>
                              <div className="absolute bottom-full left-0 mb-2 hidden group-hover/coords:block bg-gray-900 dark:bg-gray-800 text-white p-3 rounded-xl shadow-2xl border border-gray-700 z-[60] min-w-[200px]">
                                <p className="text-[10px] font-black text-indigo-400 uppercase mb-2 border-b border-gray-700 pb-1">Airport Details</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                  <div>
                                    <p className="text-[8px] text-gray-500 uppercase font-bold">Coords</p>
                                    <p className="text-[9px] font-mono">{flight.departureCoords.lat.toFixed(4)}, {flight.departureCoords.lng.toFixed(4)}</p>
                                  </div>
                                  {flight.departureDetails?.elevation !== undefined && (
                                    <div>
                                      <p className="text-[8px] text-gray-500 uppercase font-bold">Elevation</p>
                                      <p className="text-[9px]">{flight.departureDetails.elevation} ft</p>
                                    </div>
                                  )}
                                  {flight.departureDetails?.runwayLength !== undefined && (
                                    <div>
                                      <p className="text-[8px] text-gray-500 uppercase font-bold">Runway</p>
                                      <p className="text-[9px]">{flight.departureDetails.runwayLength} ft</p>
                                    </div>
                                  )}
                                  {flight.departureDetails?.fuelTypes && (
                                    <div className="col-span-2">
                                      <p className="text-[8px] text-gray-500 uppercase font-bold">Fuel</p>
                                      <p className="text-[9px]">{flight.departureDetails.fuelTypes.join(', ')}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <input 
                          type="text" 
                          placeholder="ICAO"
                          className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm uppercase dark:text-white"
                          value={flight.departure}
                          onChange={(e) => updateFlight(idx, { departure: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Destination</label>
                          {flight.destinationCoords && (
                            <div className="flex items-center gap-1 group/coords relative">
                              <span className="text-[8px] text-emerald-500 font-bold cursor-help">LOCATED</span>
                              <div className="absolute bottom-full left-0 mb-2 hidden group-hover/coords:block bg-gray-900 dark:bg-gray-800 text-white p-3 rounded-xl shadow-2xl border border-gray-700 z-[60] min-w-[200px]">
                                <p className="text-[10px] font-black text-indigo-400 uppercase mb-2 border-b border-gray-700 pb-1">Airport Details</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                  <div>
                                    <p className="text-[8px] text-gray-500 uppercase font-bold">Coords</p>
                                    <p className="text-[9px] font-mono">{flight.destinationCoords.lat.toFixed(4)}, {flight.destinationCoords.lng.toFixed(4)}</p>
                                  </div>
                                  {flight.destinationDetails?.elevation !== undefined && (
                                    <div>
                                      <p className="text-[8px] text-gray-500 uppercase font-bold">Elevation</p>
                                      <p className="text-[9px]">{flight.destinationDetails.elevation} ft</p>
                                    </div>
                                  )}
                                  {flight.destinationDetails?.runwayLength !== undefined && (
                                    <div>
                                      <p className="text-[8px] text-gray-500 uppercase font-bold">Runway</p>
                                      <p className="text-[9px]">{flight.destinationDetails.runwayLength} ft</p>
                                    </div>
                                  )}
                                  {flight.destinationDetails?.fuelTypes && (
                                    <div className="col-span-2">
                                      <p className="text-[8px] text-gray-500 uppercase font-bold">Fuel</p>
                                      <p className="text-[9px]">{flight.destinationDetails.fuelTypes.join(', ')}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <input 
                          type="text" 
                          placeholder="ICAO"
                          className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm uppercase dark:text-white"
                          value={flight.destination}
                          onChange={(e) => updateFlight(idx, { destination: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ETD (UTC)</label>
                        <input 
                          type="time" 
                          className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                          value={flight.etd}
                          onChange={(e) => updateFlight(idx, { etd: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ETA (UTC)</label>
                        <input 
                          type="time" 
                          className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                          value={flight.eta}
                          onChange={(e) => updateFlight(idx, { eta: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Flight Time (min)</label>
                        <input 
                          type="number" 
                          className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                          value={flight.flightTimeMinutes}
                          onChange={(e) => updateFlight(idx, { flightTimeMinutes: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Duration (h)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          readOnly
                          className="w-full p-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white cursor-not-allowed"
                          value={flight.flightDurationHours}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Altitude (ft)</label>
                        <input 
                          type="number" 
                          step="1000"
                          className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                          value={flight.altitude}
                          onChange={(e) => updateFlight(idx, { altitude: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Passengers</label>
                        <input 
                          type="number" 
                          className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                          value={flight.passengers || 0}
                          onChange={(e) => updateFlight(idx, { passengers: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Cargo (kg)</label>
                        <input 
                          type="number" 
                          className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                          value={flight.cargoWeight || 0}
                          onChange={(e) => updateFlight(idx, { cargoWeight: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    {/* Handling Agent Section */}
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                            <Building2 size={14} className="text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Ground Handling</span>
                        </div>
                        <button
                          onClick={() => handleOpenAgentSelector(idx, flight.destination)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition shadow-sm relative"
                        >
                          <Sparkles size={12} className="text-amber-500" />
                          {flight.handlingAgent ? 'Change Agent' : 'Select Handling Agent'}
                          {agentCounts[flight.destination] > 0 && !flight.handlingAgent && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[8px] flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800">
                              {agentCounts[flight.destination]}
                            </span>
                          )}
                        </button>
                      </div>
                      
                      {flight.handlingAgent ? (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-indigo-50 dark:border-indigo-900/30 shadow-sm relative group/agent"
                        >
                          <button 
                            onClick={() => updateFlight(idx, { handlingAgent: undefined })}
                            className="absolute -right-2 -top-2 w-5 h-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/agent:opacity-100 transition shadow-sm z-10"
                            title="Clear Agent"
                          >
                            <X size={10} />
                          </button>

                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Company</label>
                            <input 
                              type="text"
                              className="w-full p-1 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-500 outline-none text-xs font-black text-gray-900 dark:text-white transition-all"
                              value={flight.handlingAgent.companyName}
                              onChange={(e) => updateHandlingAgent(idx, { companyName: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Email</label>
                            <div className="flex items-center gap-1">
                              <Mail size={10} className="text-indigo-400 shrink-0" />
                              <input 
                                type="email"
                                className="w-full p-1 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-500 outline-none text-[10px] text-gray-500 dark:text-gray-400 transition-all"
                                value={flight.handlingAgent.email}
                                onChange={(e) => updateHandlingAgent(idx, { email: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Phone</label>
                            <div className="flex items-center gap-1">
                              <Phone size={10} className="text-indigo-400 shrink-0" />
                              <input 
                                type="tel"
                                className="w-full p-1 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-500 outline-none text-[10px] text-gray-500 dark:text-gray-400 transition-all"
                                value={flight.handlingAgent.phone || ''}
                                onChange={(e) => updateHandlingAgent(idx, { phone: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="space-y-1 text-right">
                            <label className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Base Fee</label>
                            <div className="flex items-center justify-end gap-1">
                              <DollarSign size={12} className="text-emerald-500" />
                              <input 
                                type="number"
                                className="w-20 p-1 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-500 outline-none text-sm font-black text-emerald-600 dark:text-emerald-400 text-right transition-all"
                                value={flight.handlingAgent.baseFee}
                                onChange={(e) => updateHandlingAgent(idx, { baseFee: parseFloat(e.target.value) || 0 })}
                              />
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                          <AlertCircle size={12} className="text-gray-400" />
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">No agent assigned for {flight.destination || 'destination'}</p>
                        </div>
                      )}
                    </div>

                    {/* Crew Assignment Section */}
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                            <Plus size={14} className="text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Leg Crew</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {crewList.map(crew => {
                          const isAssigned = flight.crewIds?.includes(crew.id);
                          const dutyTime = calculateCrewDutyTime(crew.id, flights);
                          const wouldExceed = !isAssigned && calculateCrewDutyTime(crew.id, flights.map((f, i) => i === idx ? { ...f, crewIds: [...(f.crewIds || []), crew.id] } : f)) > DUTY_LIMIT_HOURS;

                          return (
                            <button
                              key={crew.id}
                              onClick={() => toggleCrewForLeg(idx, crew.id)}
                              disabled={wouldExceed}
                              className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all flex items-center gap-2 ${
                                isAssigned
                                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                                  : wouldExceed
                                    ? 'border-gray-100 dark:border-gray-700 opacity-30 cursor-not-allowed'
                                    : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 text-gray-500 dark:text-gray-400'
                              }`}
                              title={wouldExceed ? `Assignment would exceed ${DUTY_LIMIT_HOURS}h duty limit` : ''}
                            >
                              {crew.name.split(' ').pop()}
                              {isAssigned && <span className="text-[8px] opacity-60">({dutyTime.toFixed(1)}h)</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {flight.error && (
                      <div className="mt-3 flex items-center gap-2 text-red-500 dark:text-red-400">
                        <AlertCircle size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{flight.error}</span>
                      </div>
                    )}

                  </motion.div>
                </React.Fragment>
              ))}

                {flights.length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-3xl">
                    <Plane size={32} className="mx-auto text-gray-200 dark:text-gray-600 mb-2" />
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">No flights added</p>
                    <button 
                      onClick={addFlight}
                      className="mt-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
                    >
                      Start Building Schedule
                    </button>
                  </div>
                )}
              </div>

              {/* Crew Assignment */}
              {flights.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Crew Assignment Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {crewList.map(crew => {
                      const isAssigned = selectedCrew.includes(crew.id);
                      const dutyTime = calculateCrewDutyTime(crew.id, flights);
                      const isOver = dutyTime > DUTY_LIMIT_HOURS;

                      return (
                        <div
                          key={crew.id}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            isAssigned
                              ? isOver 
                                ? 'border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                : 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                              : 'border-gray-100 dark:border-gray-700 opacity-50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-sm font-bold">{crew.name}</p>
                            <div className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${
                                crew.status === 'Available' ? 'bg-emerald-500' :
                                crew.status === 'On Duty' ? 'bg-amber-500' :
                                'bg-blue-500'
                              }`} />
                              <span className="text-[9px] font-bold uppercase tracking-tighter opacity-70">{crew.status}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-end">
                            <p className="text-[10px] opacity-60 font-bold uppercase">{crew.role}</p>
                            {isAssigned && (
                              <div className="text-right">
                                <p className={`text-[10px] font-black ${isOver ? 'text-red-600' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                  Duty: {dutyTime.toFixed(1)}h
                                </p>
                                {isOver && <p className="text-[8px] font-bold text-red-500 uppercase">Over Limit!</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {flights.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                  <div className="flex gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                        {selectedCrew.length > 0 ? 'Max Crew Duty' : 'Total Duty'}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className={`text-lg font-black ${isOverLimit ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-white'}`}>
                          {selectedCrew.length > 0 ? maxCrewDuty.toFixed(1) : totalDuty.toFixed(1)}h
                        </p>
                        {isOverLimit && <AlertCircle size={16} className="text-red-500 dark:text-red-400" />}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Duty Limit</p>
                      <p className="text-lg font-black text-gray-400 dark:text-gray-500">{DUTY_LIMIT_HOURS}h</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleSave}
                    disabled={loading || isOverLimit || hasErrors || !selectedAircraft}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-100 dark:shadow-none"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    {editingId ? 'Update Schedule' : 'Publish Schedule'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Recent Schedules & Rotations */}
          <div className={`${isLeftColumnCollapsed ? 'lg:col-span-12' : 'lg:col-span-4'} space-y-6 transition-all duration-300 relative`}>
            {/* Toggle Button */}
            <button 
              onClick={() => setIsLeftColumnCollapsed(!isLeftColumnCollapsed)}
              className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-md z-10 transition-all"
              title={isLeftColumnCollapsed ? "Show Builder" : "Hide Builder"}
            >
              {isLeftColumnCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                <History size={18} className="text-indigo-600 dark:text-indigo-400" />
                Recent Schedules
              </h3>
              
              <div className="space-y-4">
                {schedules.map((s) => (
                  <div key={s.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 group">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-white">{s.date}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{s.aircraftType}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEdit(s)}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => s.id && handleDelete(s.id)}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{s.status}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
                      {s.flights.map((f, i) => (
                        <React.Fragment key={i}>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-800 dark:text-white">{f.departure}</span>
                            <span className="text-[8px] text-gray-400 font-medium">{f.etd}</span>
                          </div>
                          
                          <div className="flex flex-col items-center px-1">
                            <ChevronRight size={10} className="text-gray-300 dark:text-gray-600" />
                            {i < s.flights.length - 1 && s.flights[i+1].turnaroundTime && (
                              <span className="text-[7px] font-black text-indigo-500/70">{formatMinutes(s.flights[i+1].turnaroundTime || 0)}</span>
                            )}
                          </div>

                          {i === s.flights.length - 1 && (
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-gray-800 dark:text-white">{f.destination}</span>
                              <span className="text-[8px] text-gray-400 font-medium">{f.eta}</span>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {s.crewIds?.map(cid => {
                        const crew = crewList.find(c => c.id === cid);
                        if (!crew?.name) return null;
                        return (
                          <span key={cid} className="text-[9px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                            {crew.name.split(' ').pop()}
                          </span>
                        );
                      })}
                    </div>

                    <button 
                      onClick={() => handleCloneRotation(s)}
                      className="w-full py-2 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition flex items-center justify-center gap-2"
                    >
                      <Copy size={12} />
                      Clone Weekly Rotation
                    </button>
                  </div>
                ))}

                {schedules.length === 0 && !loading && (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium italic">No schedules found for this aircraft.</p>
                  </div>
                )}

                {loading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Agent Selection Modal */}
      <AnimatePresence>
        {selectingAgentFor && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">Select Handling Agent</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Available agents at {selectingAgentFor.icao}</p>
                </div>
                <button onClick={() => setSelectingAgentFor(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 max-h-[400px] overflow-y-auto space-y-3">
                {availableAgents.length > 0 && (
                  <div className="flex justify-end mb-2">
                    <button 
                      onClick={fetchAiAgents}
                      disabled={fetchingAgents}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline disabled:opacity-50"
                    >
                      {fetchingAgents ? <Loader2 className="animate-spin" size={10} /> : <Sparkles size={10} />}
                      Find More via AI
                    </button>
                  </div>
                )}

                {fetchingAgents && availableAgents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                    <p className="text-xs text-gray-500 dark:text-gray-400">Searching database...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {flights[selectingAgentFor.index]?.handlingAgent && (
                      <button
                        onClick={() => {
                          const newFlights = [...flights];
                          newFlights[selectingAgentFor.index] = {
                            ...newFlights[selectingAgentFor.index],
                            handlingAgent: undefined
                          };
                          setFlights(newFlights);
                          setSelectingAgentFor(null);
                        }}
                        className="w-full p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/40 transition flex items-center justify-center gap-2 mb-4"
                      >
                        <Trash2 size={14} />
                        Remove Selected Agent
                      </button>
                    )}
                    
                    {availableAgents.length > 0 ? (
                      availableAgents.map(agent => (
                        <button
                          key={agent.id}
                          onClick={() => selectAgent(agent)}
                          className="w-full text-left p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl hover:border-indigo-500 dark:hover:border-indigo-500 transition group"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                              <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition">{agent.companyName}</h4>
                              {agent.isAiSuggestion && (
                                <span className="text-[8px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-tighter flex items-center gap-0.5">
                                  <Sparkles size={8} /> AI Suggestion
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                              ${agent.baseFee}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-1">
                              <Mail size={12} />
                              <span>{agent.email}</span>
                            </div>
                            {agent.phone && (
                              <div className="flex items-center gap-1">
                                <Phone size={12} />
                                <a href={`tel:${agent.phone}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition" onClick={(e) => e.stopPropagation()}>{agent.phone}</a>
                              </div>
                            )}
                            {agent.website && (
                              <div className="flex items-center gap-1">
                                <Globe size={12} />
                                <a href={agent.website} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition truncate max-w-[150px]" onClick={(e) => e.stopPropagation()}>{agent.website.replace(/^https?:\/\//, '')}</a>
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <Building2 size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No agents found for {selectingAgentFor.icao}</p>
                        <button 
                          onClick={fetchAiAgents}
                          disabled={fetchingAgents}
                          className="mt-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center gap-2 mx-auto"
                        >
                          {fetchingAgents ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                          Search via AI
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
