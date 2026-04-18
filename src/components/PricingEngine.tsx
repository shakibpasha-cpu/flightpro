import React, { useState, useEffect } from 'react';
import { DollarSign, Fuel, Globe, Landmark, UserCheck, ShieldCheck, Calculator, Loader2, Plane, MapPin, PlusCircle, TrendingUp, AlertTriangle, Sparkles, Calendar, ClipboardList, Users, Phone, Mail, ExternalLink, FileText, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateACMIMission, MissionParams, ACMIEngineResult, suggestCheaperAlternatives, calculateACMILease, LeaseResult } from '../services/acmiEngineService';
import { getFIRDetails } from '../services/aiService';

interface Aircraft {
  id: string;
  type: string;
  acmiRate: number;
  fuelBurnPerHour: number;
  operator: string;
  operatorName?: string;
}

interface PricingEngineProps {
  aircraftList: Aircraft[];
  initialParams?: MissionParams;
  initialAircraftId?: string;
}

export default function PricingEngine({ aircraftList, initialParams, initialAircraftId }: PricingEngineProps) {
  const [loading, setLoading] = useState(false);
  const [departure, setDeparture] = useState(initialParams?.departure || '');
  const [destination, setDestination] = useState(initialParams?.destination || '');
  const [date, setDate] = useState(initialParams?.date || '');
  const [passengers, setPassengers] = useState(initialParams?.passengers || 0);
  const [payload, setPayload] = useState(initialParams?.payload || 0);
  const [hoursParked, setHoursParked] = useState(initialParams?.hoursParked || 4);
  const [crewCount, setCrewCount] = useState(initialParams?.crewCount || 0);
  const [crewDailyRate, setCrewDailyRate] = useState(initialParams?.crewDailyRate || 0);
  const [numberOfDays, setNumberOfDays] = useState(initialParams?.numberOfDays || 0);
  const [hotelsCost, setHotelsCost] = useState(initialParams?.hotelsCost || 0);
  const [transportCost, setTransportCost] = useState(initialParams?.transportCost || 0);
  const [missionType, setMissionType] = useState(initialParams?.missionType || 'Passenger');
  const [riskLevel, setRiskLevel] = useState<'Normal' | 'War Zone' | 'High Risk'>(initialParams?.riskLevel || 'Normal');
  const [aircraftBase, setAircraftBase] = useState(initialParams?.aircraftBase || '');
  const [isEmptyLeg, setIsEmptyLeg] = useState(initialParams?.isEmptyLeg || false);
  const [selectedAircraftId, setSelectedAircraftId] = useState(initialAircraftId || '');
  const [isExporting, setIsExporting] = useState(false);
  
  // Lease States
  const [leaseTermMonths, setLeaseTermMonths] = useState(1);
  const [monthlyGuaranteedHours, setMonthlyGuaranteedHours] = useState(0);
  const [leaseResult, setLeaseResult] = useState<LeaseResult | null>(null);
  
  // Engine Result State
  const [engineResult, setEngineResult] = useState<ACMIEngineResult | null>(null);
  const [alternatives, setAlternatives] = useState<any[]>([]);
  const [isCalculatingAlternatives, setIsCalculatingAlternatives] = useState(false);
  
  // Calculation States (Manual Overrides)
  const [flightHours, setFlightHours] = useState(0);
  const [blockHours, setBlockHours] = useState(0);
  const [acmiRate, setAcmiRate] = useState(0);
  const [fuelCost, setFuelCost] = useState(0);
  const [overflightCharges, setOverflightCharges] = useState(0);
  const [airportFees, setAirportFees] = useState(0);
  const [crewDutyCost, setCrewDutyCost] = useState(0);
  const [positioningCost, setPositioningCost] = useState(0);
  const [insuranceMultiplier, setInsuranceMultiplier] = useState(1);
  const [contingency, setContingency] = useState(0);
  const [contingencyPercent, setContingencyPercent] = useState(5);
  const [brokerMargin, setBrokerMargin] = useState(0);
  const [profitMarginPercent, setProfitMarginPercent] = useState(15);
  const [handlingFees, setHandlingFees] = useState(0);
  const [landingFees, setLandingFees] = useState(0);
  const [parkingFees, setParkingFees] = useState(0);
  
  // Detailed FIR State
  const [detailedFirs, setDetailedFirs] = useState<Record<string, any>>({});
  const [loadingFirs, setLoadingFirs] = useState<Record<string, boolean>>({});
  
  const selectedAircraft = aircraftList.find(a => a.id === selectedAircraftId);

  useEffect(() => {
    setEngineResult(null);
    setLeaseResult(null);
    setAlternatives([]);
  }, [missionType]);

  // Link detailed FIR charges to overflight charges state
  useEffect(() => {
    const firs = Object.values(detailedFirs);
    if (firs.length > 0) {
      const sumOverflight = firs.reduce((acc, f) => acc + (f.overflightCharge || 0), 0);
      const sumNavigation = firs.reduce((acc, f) => acc + (f.navigationCharge || 0), 0);
      
      // Only override if we actually found something significant
      if (sumOverflight > 0 || sumNavigation > 0) {
        setOverflightCharges(sumOverflight + sumNavigation);
      }
    }
  }, [detailedFirs]);

  const handleCalculate = async (aircraftIdOverride?: string, paramsOverride?: MissionParams) => {
    const targetAircraftId = aircraftIdOverride || selectedAircraftId;
    const targetDeparture = paramsOverride?.departure || departure;
    const targetDestination = paramsOverride?.destination || destination;
    const targetDate = paramsOverride?.date || date;
    const targetMissionType = paramsOverride?.missionType || missionType;
    
    if (!targetDeparture || !targetDestination || !targetAircraftId) {
      alert('Please enter route and select an aircraft.');
      return;
    }

    setLoading(true);
    setAlternatives([]);
    setLeaseResult(null);
    setEngineResult(null);

    try {
      if (targetMissionType === 'ACMI Lease') {
        const result = await calculateACMILease({
          aircraftListingId: targetAircraftId,
          leaseTermMonths: paramsOverride?.leaseTermMonths || leaseTermMonths,
          monthlyGuaranteedHours: paramsOverride?.monthlyGuaranteedHours || monthlyGuaranteedHours,
          startDate: targetDate || new Date().toISOString().split('T')[0]
        });
        setLeaseResult(result);
        return;
      }

      const result = await calculateACMIMission({
        departure: targetDeparture,
        destination: targetDestination,
        date: targetDate,
        passengers: paramsOverride?.passengers ?? passengers,
        payload: paramsOverride?.payload ?? payload,
        hoursParked: paramsOverride?.hoursParked ?? hoursParked,
        crewCount: paramsOverride?.crewCount ?? crewCount,
        crewDailyRate: paramsOverride?.crewDailyRate ?? crewDailyRate,
        numberOfDays: paramsOverride?.numberOfDays ?? numberOfDays,
        hotelsCost: paramsOverride?.hotelsCost ?? hotelsCost,
        transportCost: paramsOverride?.transportCost ?? transportCost,
        missionType: targetMissionType,
        riskLevel: paramsOverride?.riskLevel || riskLevel,
        aircraftBase: paramsOverride?.aircraftBase || aircraftBase,
        isEmptyLeg: paramsOverride?.isEmptyLeg ?? isEmptyLeg
      }, targetAircraftId);

      setEngineResult(result);
      
      // Update manual override states with engine results
      setFlightHours(result.flightHours);
      setBlockHours(result.blockHours);
      setAcmiRate(result.finalRate);
      setFuelCost(result.costs.fuel);
      setOverflightCharges(result.costs.overflight);
      setAirportFees(result.costs.airport);
      setLandingFees(result.costs.landingFee);
      setHandlingFees(result.costs.handlingFee);
      setParkingFees(result.costs.parkingFee || 0);
      setCrewDutyCost(result.costs.crew);
      setPositioningCost(result.costs.positioning);
      setInsuranceMultiplier(result.multipliers.insurance);
      setContingency(result.costs.contingency);
      setContingencyPercent(5); // Default to 5%
      setBrokerMargin(result.costs.brokerMargin);
      setProfitMarginPercent(result.brokerMarginRate * 100);

      // Fetch FIR Details automatically for the route
      if (result.routeDetails?.firs?.length > 0) {
        result.routeDetails.firs.forEach((fir: any) => {
          fetchFIRInfo(fir.code || fir.name, fir.name, selectedAircraft?.type);
        });
      }

      // Calculate alternatives in the background
      setIsCalculatingAlternatives(true);
      const suggested = await suggestCheaperAlternatives({
        departure,
        destination,
        date,
        passengers,
        payload,
        hoursParked,
        crewCount,
        crewDailyRate,
        numberOfDays,
        hotelsCost,
        transportCost,
        missionType,
        riskLevel,
        aircraftBase,
        isEmptyLeg
      }, targetAircraftId, aircraftList);
      setAlternatives(suggested);
    } catch (error) {
      console.error('Calculation error:', error);
      alert('Engine Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
      setIsCalculatingAlternatives(false);
    }
  };

  useEffect(() => {
    if (initialParams) {
      setDeparture(initialParams.departure);
      setDestination(initialParams.destination);
      setDate(initialParams.date);
      setPassengers(initialParams.passengers);
      setPayload(initialParams.payload);
      setHoursParked(initialParams.hoursParked || 4);
      setCrewCount(initialParams.crewCount || 0);
      setCrewDailyRate(initialParams.crewDailyRate || 0);
      setNumberOfDays(initialParams.numberOfDays || 0);
      setHotelsCost(initialParams.hotelsCost || 0);
      setTransportCost(initialParams.transportCost || 0);
      setMissionType(initialParams.missionType);
      setRiskLevel(initialParams.riskLevel || 'Normal');
      setAircraftBase(initialParams.aircraftBase || '');
      setIsEmptyLeg(initialParams.isEmptyLeg || false);
    }
    if (initialAircraftId) {
      setSelectedAircraftId(initialAircraftId);
    }
    
    // Auto-calculate if we have enough data
    if (initialParams?.departure && initialParams?.destination && initialAircraftId) {
      handleCalculate(initialAircraftId, initialParams);
    }
  }, [initialParams, initialAircraftId]);

  const fetchFIRInfo = async (code: string, name: string, aircraftType?: string) => {
    if (detailedFirs[code] || loadingFirs[code]) return;
    
    setLoadingFirs(prev => ({ ...prev, [code]: true }));
    try {
      const details = await getFIRDetails(code, name, aircraftType);
      if (details) {
        setDetailedFirs(prev => ({ ...prev, [code]: details }));
      }
    } catch (error) {
      console.error(`Error fetching details for FIR ${code}:`, error);
    } finally {
      setLoadingFirs(prev => ({ ...prev, [code]: false }));
    }
  };

  const handleExportQuote = () => {
    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text('ACMI LEASE QUOTE', 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${timestamp}`, 105, 28, { align: 'center' });
      
      // Aircraft Info
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Aircraft Details', 14, 45);
      
      autoTable(doc, {
        startY: 50,
        head: [['Property', 'Value']],
        body: [
          ['Aircraft Type', selectedAircraft?.type || 'N/A'],
          ['Operator', selectedAircraft?.operatorName || selectedAircraft?.operator || 'N/A'],
          ['Mission Type', missionType],
          ['Route', `${departure} -> ${destination}`],
          ['Date', date || 'N/A'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 15;

      if (missionType === 'ACMI Lease' && leaseResult) {
        doc.setFontSize(14);
        doc.text('Lease Financial Summary', 14, finalY);
        
        autoTable(doc, {
          startY: finalY + 5,
          head: [['Item', 'Amount']],
          body: [
            ['Monthly Fixed Fee', `${leaseResult.monthlyFixedFee.toLocaleString()}`],
            ['Monthly MGH Cost', `${leaseResult.mghCost.toLocaleString()}`],
            ['Total Monthly Cost', `${leaseResult.totalMonthlyCost.toLocaleString()}`],
            ['Lease Term', `${leaseTermMonths} Months`],
            ['Total Lease Value', `${leaseResult.totalLeaseCost.toLocaleString()}`],
            ['Security Deposit', `${leaseResult.depositAmount.toLocaleString()}`],
          ],
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229] }
        });
        
        finalY = (doc as any).lastAutoTable.finalY + 15;
        
        if (leaseResult.aiPrediction) {
          doc.setFontSize(14);
          doc.text('AI Market Analysis', 14, finalY);
          
          autoTable(doc, {
            startY: finalY + 5,
            head: [['Metric', 'Prediction / Value']],
            body: [
              ['Predicted Monthly Fee', `${leaseResult.aiPrediction.predictedMonthlyFixedFee.toLocaleString()}`],
              ['Predicted Hourly Rate', `${leaseResult.aiPrediction.predictedHourlyRate.toLocaleString()}/hr`],
              ['Market Demand', leaseResult.aiPrediction.marketDemand],
              ['Confidence Score', `${leaseResult.aiPrediction.confidenceScore}%`],
              ['AI Reasoning', leaseResult.aiPrediction.reasoning],
            ],
            theme: 'plain',
            headStyles: { fillColor: [79, 70, 229] }
          });
        }
      } else if (engineResult) {
        doc.setFontSize(14);
        doc.text('Mission Cost Breakdown', 14, finalY);
        
        autoTable(doc, {
          startY: finalY + 5,
          head: [['Cost Component', 'Amount']],
          body: [
            ['Operational Base', `${operationalSum.toLocaleString()}`],
            ['Fuel Cost', `${fuelCost.toLocaleString()}`],
            ['Overflight Charges', `${overflightCharges.toLocaleString()}`],
            ['Airport Fees', `${airportFees.toLocaleString()}`],
            ['Crew Duty Cost', `${crewDutyCost.toLocaleString()}`],
            ['Positioning Cost', `${positioningCost.toLocaleString()}`],
            ['Broker Margin', `${brokerMargin.toLocaleString()}`],
            ['Total Estimated Cost', `${totalCost.toLocaleString()}`],
          ],
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229] }
        });
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('CONFIDENTIAL - ACMI Marketplace Quote Engine', 105, 285, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
      }

      doc.save(`ACMI_Quote_${selectedAircraft?.type || 'Aircraft'}_${new Date().getTime()}.pdf`);
      
    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const operationalSum = (blockHours * acmiRate) + fuelCost + overflightCharges + landingFees + handlingFees + parkingFees + crewDutyCost + positioningCost;
  const totalCost = missionType === 'ACMI Lease' 
    ? (leaseResult?.totalLeaseCost || 0)
    : (operationalSum * insuranceMultiplier) + contingency + brokerMargin;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">ACMI Pricing Engine</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Advanced cost calculation based on real-world operational parameters.</p>
        </div>
        <div className="flex items-center gap-4">
          {(engineResult || leaseResult) && (
            <button 
              onClick={handleExportQuote}
              disabled={isExporting}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 rounded-2xl font-black uppercase tracking-widest text-xs border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
              {isExporting ? 'Generating PDF...' : 'Export Detailed Quote'}
            </button>
          )}
          <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
              {engineResult?.priceRange ? 'Estimated Price Range' : 'Total Estimated Cost'}
            </p>
            <p className="text-2xl font-black">
              {engineResult?.priceRange ? (
                `${engineResult.priceRange.min.toLocaleString()} - ${engineResult.priceRange.max.toLocaleString()}`
              ) : (
                `${totalCost.toLocaleString()}`
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Calculator size={20} />
              <h3 className="font-bold uppercase tracking-widest text-xs">Mission Parameters</h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Departure</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="ICAO"
                      value={departure}
                      onChange={(e) => setDeparture(e.target.value.toUpperCase())}
                      className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Destination</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="ICAO"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value.toUpperCase())}
                      className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Aircraft Base (Optional Override)</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="ICAO (e.g. DXB, LHR)"
                    value={aircraftBase}
                    onChange={(e) => setAircraftBase(e.target.value.toUpperCase())}
                    className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                  />
                </div>
                <p className="text-[9px] text-gray-400 ml-1 italic">If empty, uses aircraft's default base.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Mission Type</label>
                  <select 
                    value={missionType}
                    onChange={(e) => setMissionType(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold appearance-none"
                  >
                    <option>Passenger</option>
                    <option>Cargo</option>
                    <option>VIP</option>
                    <option>ACMI Lease</option>
                  </select>
                </div>
              </div>

              {missionType === 'ACMI Lease' ? (
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Lease Terms</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Term (Months)</label>
                      <input 
                        type="number" 
                        value={isNaN(leaseTermMonths) ? '' : leaseTermMonths}
                        onChange={(e) => setLeaseTermMonths(parseInt(e.target.value) || 0)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">MGH (Monthly)</label>
                      <input 
                        type="number" 
                        value={isNaN(monthlyGuaranteedHours) ? '' : monthlyGuaranteedHours}
                        onChange={(e) => setMonthlyGuaranteedHours(parseInt(e.target.value) || 0)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Passengers</label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input 
                      type="number" 
                      value={isNaN(passengers) ? '' : passengers}
                      onChange={(e) => setPassengers(parseInt(e.target.value) || 0)}
                      className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Payload (kg)</label>
                  <div className="relative">
                    <PlusCircle className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input 
                      type="number" 
                      value={isNaN(payload) ? '' : payload}
                      onChange={(e) => setPayload(parseInt(e.target.value) || 0)}
                      className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Hours Parked</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input 
                      type="number" 
                      value={isNaN(hoursParked) ? '' : hoursParked}
                      onChange={(e) => setHoursParked(parseInt(e.target.value) || 0)}
                      className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Risk Level</label>
                  <select 
                    value={riskLevel}
                    onChange={(e) => setRiskLevel(e.target.value as any)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold appearance-none"
                  >
                    <option>Normal</option>
                    <option>War Zone</option>
                    <option>High Risk</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                <div className="flex-1">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Empty Leg Detection</p>
                  <p className="text-[9px] text-indigo-400 font-bold uppercase">Apply 30% - 70% Discount</p>
                </div>
                <button 
                  onClick={() => setIsEmptyLeg(!isEmptyLeg)}
                  className={`w-12 h-6 rounded-full transition-all relative ${isEmptyLeg ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isEmptyLeg ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Crew Details (Optional Override)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Crew Count</label>
                      <input 
                        type="number" 
                        value={isNaN(crewCount) ? '' : crewCount}
                        onChange={(e) => setCrewCount(parseInt(e.target.value) || 0)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Daily Rate</label>
                      <input 
                        type="number" 
                        value={isNaN(crewDailyRate) ? '' : crewDailyRate}
                        onChange={(e) => setCrewDailyRate(parseInt(e.target.value) || 0)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Number of Days</label>
                      <input 
                        type="number" 
                        value={isNaN(numberOfDays) ? '' : numberOfDays}
                        onChange={(e) => setNumberOfDays(parseInt(e.target.value) || 0)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Hotels Cost</label>
                      <input 
                        type="number" 
                        value={isNaN(hotelsCost) ? '' : hotelsCost}
                        onChange={(e) => setHotelsCost(parseInt(e.target.value) || 0)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Transport Cost</label>
                      <input 
                        type="number" 
                        value={isNaN(transportCost) ? '' : transportCost}
                        onChange={(e) => setTransportCost(parseInt(e.target.value) || 0)}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                      />
                    </div>
                  </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Select Aircraft Listing</label>
                <div className="relative">
                  <Plane className="absolute left-3 top-3 text-gray-400" size={16} />
                  <select 
                    value={selectedAircraftId}
                    onChange={(e) => setSelectedAircraftId(e.target.value)}
                    className="w-full pl-10 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold appearance-none"
                  >
                    <option value="">Select an aircraft...</option>
                    {aircraftList.map(a => (
                      <option key={a.id} value={a.id}>{a.type} ({a.operatorName || a.operator})</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => handleCalculate()}
                disabled={loading}
                className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Calculator size={18} />}
                {loading ? 'Calculating...' : 'Run Pricing Engine'}
              </button>
            </>
          )}
            </div>
          </div>

          {/* Manual Overrides */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Calculator size={20} />
              <h3 className="font-bold uppercase tracking-widest text-xs">Manual Overrides</h3>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Flight Hours</label>
                  <input 
                    type="number" 
                    value={isNaN(flightHours) ? '' : flightHours}
                    onChange={(e) => setFlightHours(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">ACMI Rate/Hr</label>
                  <input 
                    type="number" 
                    value={isNaN(acmiRate) ? '' : acmiRate}
                    onChange={(e) => setAcmiRate(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-8 space-y-6">
          {engineResult && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Availability Score</p>
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${engineResult.intelligence?.availabilityScore! > 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {engineResult.intelligence?.availabilityScore}%
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${engineResult.intelligence?.availabilityScore}%` }}
                    className={`h-full ${engineResult.intelligence?.availabilityScore! > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                </div>
                <p className="text-[9px] text-gray-400 font-bold uppercase mt-3">Idle Time + Traffic - Pressure</p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Smart Rate Prediction</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-black text-indigo-600">${Math.round(engineResult.intelligence?.marketRatePrediction!).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Market Avg</p>
                </div>
                <p className="text-[9px] text-gray-400 font-bold uppercase mt-2">Predicted Rate: Avg ± 10-25%</p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Empty Leg Status</p>
                {engineResult.intelligence?.isEmptyLeg ? (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Sparkles size={16} />
                    <p className="text-sm font-black uppercase">-{Math.round(engineResult.intelligence.discountApplied * 100)}% Discount Applied</p>
                  </div>
                ) : (
                  <p className="text-sm font-black text-gray-300 uppercase">No Empty Leg Discount</p>
                )}
              </div>
            </div>
          )}

          {missionType === 'ACMI Lease' && leaseResult ? (
            <div className="space-y-6">
              <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                  <Landmark size={200} />
                </div>
                
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-8 opacity-70">ACMI Lease Financial Summary</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                  <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Monthly Fixed Fee</p>
                    <p className="text-2xl font-black">${leaseResult.monthlyFixedFee.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Monthly MGH Cost</p>
                    <p className="text-2xl font-black">${leaseResult.mghCost.toLocaleString()}</p>
                    <p className="text-[10px] opacity-50 font-medium mt-1">{monthlyGuaranteedHours} hrs × ${leaseResult.hourlyRateAboveMGH.toLocaleString()}/hr</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Total Monthly</p>
                    <p className="text-2xl font-black">${leaseResult.totalMonthlyCost.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between bg-white text-indigo-600 p-8 rounded-[2rem] shadow-2xl">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1">Total Lease Value ({leaseTermMonths} Months)</p>
                    <p className="text-4xl font-black">${leaseResult.totalLeaseCost.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1">Security Deposit</p>
                    <p className="text-2xl font-black text-gray-900">${leaseResult.depositAmount.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {leaseResult.aiPrediction && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-4">
                    <Sparkles size={20} />
                    <h4 className="font-black uppercase tracking-widest text-xs">AI Market Prediction</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Predicted Monthly Fee</p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">${leaseResult.aiPrediction.predictedMonthlyFixedFee.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Predicted Hourly Rate</p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">${leaseResult.aiPrediction.predictedHourlyRate.toLocaleString()}/hr</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Market Demand</p>
                      <div className={`inline-block px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                        leaseResult.aiPrediction.marketDemand === 'High' ? 'bg-rose-100 text-rose-700' :
                        leaseResult.aiPrediction.marketDemand === 'Normal' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {leaseResult.aiPrediction.marketDemand}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Availability Score</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${leaseResult.aiPrediction.availabilityScore > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${leaseResult.aiPrediction.availabilityScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{leaseResult.aiPrediction.availabilityScore}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Confidence Score</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500" 
                            style={{ width: `${leaseResult.aiPrediction.confidenceScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{leaseResult.aiPrediction.confidenceScore}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white/60 dark:bg-gray-900/60 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">AI Reasoning</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{leaseResult.aiPrediction.reasoning}"</p>
                  </div>
                </div>
              )}

              {leaseResult.availabilityConflict && (
                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-6 rounded-3xl flex items-center gap-4 text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={24} />
                  <div>
                    <p className="font-black uppercase tracking-widest text-xs">Availability Conflict Detected</p>
                    <p className="text-sm font-medium opacity-80">This aircraft has existing bookings during your requested lease period. Please check availability calendar.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Lease Terms & Conditions</h4>
                  <ul className="space-y-3">
                    {[
                      { label: 'Minimum Term', value: `${leaseResult.listingData.min_lease_term_months || 1} Months` },
                      { label: 'Hourly Rate (Above MGH)', value: `$${leaseResult.hourlyRateAboveMGH.toLocaleString()}/hr` },
                      { label: 'Crew Included', value: leaseResult.listingData.crew_included ? 'Yes' : 'No' },
                      { label: 'Maintenance Included', value: leaseResult.listingData.maintenance_included ? 'Yes' : 'No' },
                      { label: 'Insurance Included', value: leaseResult.listingData.insurance_included ? 'Yes' : 'No' },
                    ].map((item, i) => (
                      <li key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">{item.label}</span>
                        <span className="font-black text-gray-900 dark:text-white">{item.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Aircraft Specifications</h4>
                  <ul className="space-y-3">
                    {[
                      { label: 'Aircraft Type', value: leaseResult.masterData.aircraft_type || 'Unknown' },
                      { label: 'Configuration', value: leaseResult.listingData.configuration || 'Standard' },
                      { label: 'Year of Manufacture', value: leaseResult.listingData.year_of_manufacture || 'N/A' },
                      { label: 'Base Airport', value: leaseResult.listingData.base_airport || 'N/A' },
                    ].map((item, i) => (
                      <li key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">{item.label}</span>
                        <span className="font-black text-gray-900 dark:text-white">{item.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Formula Visualization */}
          <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <Calculator size={200} />
            </div>
            
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-8 opacity-70">FINAL MASTER EQUATION</h4>
            
            <div className="flex flex-wrap items-center gap-y-8 gap-x-4 relative z-10">
              <div className="text-4xl font-light opacity-30">[</div>
              
              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Base ACMI</p>
                  <p className="text-xl font-black">${(blockHours * acmiRate).toLocaleString()}</p>
                  <p className="text-[10px] opacity-50 font-medium mt-1">{blockHours.toFixed(1)} blk hrs × ${acmiRate.toLocaleString()}/hr</p>
                </div>
                <div className="text-2xl font-black opacity-30">+</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Fuel</p>
                  <p className="text-xl font-black">${fuelCost.toLocaleString()}</p>
                  {engineResult && (
                    <p className="text-[10px] opacity-50 font-medium mt-1">
                      {engineResult.fuelBurnRate.toLocaleString()} kg/hr × ${engineResult.fuelPrice.toFixed(2)}/kg
                    </p>
                  )}
                </div>
                <div className="text-2xl font-black opacity-30">+</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Overflight</p>
                  <p className="text-xl font-black">${overflightCharges.toLocaleString()}</p>
                </div>
                <div className="text-2xl font-black opacity-30">+</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Airport</p>
                  <p className="text-xl font-black">${(landingFees + handlingFees + parkingFees).toLocaleString()}</p>
                  <div className="text-[9px] opacity-50 font-medium mt-1 space-y-0.5">
                    <p>Lnd: ${landingFees.toLocaleString()}</p>
                    <p>Hnd: ${handlingFees.toLocaleString()}</p>
                    <p>Prk: ${parkingFees.toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-2xl font-black opacity-30">+</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Crew</p>
                  <p className="text-xl font-black">${crewDutyCost.toLocaleString()}</p>
                </div>
                <div className="text-2xl font-black opacity-30">+</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Pos.</p>
                  <p className="text-xl font-black">${positioningCost.toLocaleString()}</p>
                </div>
              </div>

              <div className="text-4xl font-light opacity-30">]</div>
              <div className="text-2xl font-black opacity-30">×</div>

              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Insurance Multiplier</p>
                  <p className="text-xl font-black">
                    x{insuranceMultiplier.toFixed(2)}
                  </p>
                  <p className="text-[10px] opacity-50 font-medium mt-1">+${(operationalSum * (insuranceMultiplier - 1)).toLocaleString()}</p>
                </div>
                <div className="text-2xl font-black opacity-30">+</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Contingency</p>
                  <p className="text-xl font-black">${contingency.toLocaleString()}</p>
                </div>
                {brokerMargin > 0 && <div className="text-2xl font-black opacity-30">+</div>}
              </div>

              {brokerMargin > 0 && (
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Margin</p>
                    <p className="text-xl font-black">${brokerMargin.toLocaleString()}</p>
                  </div>
                </div>
              )}

              <div className="text-2xl font-black opacity-50">=</div>

              <div className="bg-white text-indigo-600 p-6 rounded-3xl shadow-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest mb-1">Total Cost</p>
                <p className="text-3xl font-black">${totalCost.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Detailed Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <CostItem 
              icon={DollarSign} 
              label="ACMI Hourly Rate" 
              value={acmiRate} 
              onChange={setAcmiRate}
              color="text-indigo-600"
              bg="bg-indigo-50 dark:bg-indigo-900/20"
            />
            <CostItem 
              icon={Fuel} 
              label="Fuel Consumption" 
              value={fuelCost} 
              onChange={setFuelCost}
              color="text-amber-600"
              bg="bg-amber-50 dark:bg-amber-900/20"
            />
            <CostItem 
              icon={Globe} 
              label="Overflight Charges" 
              value={overflightCharges} 
              onChange={setOverflightCharges}
              color="text-blue-600"
              bg="bg-blue-50 dark:bg-blue-900/20"
            />
            <CostItem 
              icon={Landmark} 
              label="Landing Fees" 
              value={landingFees} 
              onChange={setLandingFees}
              color="text-emerald-600"
              bg="bg-emerald-50 dark:bg-emerald-900/20"
            />
            <CostItem 
              icon={Users} 
              label="Ground Handling" 
              value={handlingFees} 
              onChange={setHandlingFees}
              color="text-teal-600"
              bg="bg-teal-50 dark:bg-teal-900/20"
            />
            <CostItem 
              icon={Calendar} 
              label="Parking Fees" 
              value={parkingFees} 
              onChange={setParkingFees}
              color="text-amber-700"
              bg="bg-amber-50 dark:bg-amber-900/20"
            />
            <CostItem 
              icon={UserCheck} 
              label="Crew Duty Cost" 
              value={crewDutyCost} 
              onChange={setCrewDutyCost}
              color="text-rose-600"
              bg="bg-rose-50 dark:bg-rose-900/20"
            />
            <CostItem 
              icon={MapPin} 
              label="Positioning Cost" 
              value={positioningCost} 
              onChange={setPositioningCost}
              color="text-indigo-600"
              bg="bg-indigo-50 dark:bg-indigo-900/20"
            />
            <div className={`p-6 rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm col-span-1 md:col-span-2 lg:col-span-1`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 rounded-xl flex items-center justify-center`}>
                    <ShieldCheck size={20} />
                  </div>
                  <p className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-widest">Insurance Risk Layer</p>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 font-bold">x</span>
                <input 
                  type="number" 
                  step="0.01"
                  value={isNaN(insuranceMultiplier) ? '' : insuranceMultiplier}
                  onChange={(e) => setInsuranceMultiplier(parseFloat(e.target.value) || 1)}
                  className="w-full pl-8 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-lg font-black"
                />
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-2">
                  Multiplied Impact: +${(operationalSum * (insuranceMultiplier - 1)).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="p-6 rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-xl flex items-center justify-center">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-widest">Contingency Buffer ({contingencyPercent}%)</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 font-bold">$</span>
                  <input 
                    type="number" 
                    value={isNaN(contingency) ? '' : contingency}
                    onChange={(e) => setContingency(parseInt(e.target.value) || 0)}
                    className="w-full pl-8 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-lg font-black"
                  />
                </div>
                <div className="space-y-1">
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    step="0.5"
                    value={contingencyPercent}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value);
                      setContingencyPercent(p);
                      const subtotal = operationalSum * insuranceMultiplier;
                      const pDecimal = p / 100;
                      setContingency(Math.round((subtotal + brokerMargin) * pDecimal));
                    }}
                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-600"
                  />
                  <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase">
                    <span>1%</span>
                    <span>5%</span>
                    <span>10%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp size={60} />
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/20 text-violet-600 rounded-xl flex items-center justify-center">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-widest">Profit Margin ({profitMarginPercent.toFixed(1)}%)</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 font-bold">$</span>
                  <input 
                    type="number" 
                    value={isNaN(brokerMargin) ? '' : brokerMargin}
                    onChange={(e) => setBrokerMargin(parseInt(e.target.value) || 0)}
                    className="w-full pl-8 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-lg font-black"
                  />
                </div>
                <div className="space-y-1">
                  <input 
                    type="range" 
                    min="5" 
                    max="30" 
                    step="0.5"
                    value={profitMarginPercent}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value);
                      setProfitMarginPercent(p);
                      const currentBase = (operationalSum * insuranceMultiplier) + contingency;
                      setBrokerMargin(Math.round(currentBase * (p / (100 - p))));
                    }}
                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-600"
                  />
                  <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase">
                    <span>5%</span>
                    <span>15%</span>
                    <span>30%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {engineResult && (
            <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-indigo-600" size={20} />
                  <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-widest text-xs">AI Market Analysis & Multipliers</h3>
                </div>
                {isCalculatingAlternatives && (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase animate-pulse">
                    <Loader2 size={12} className="animate-spin" />
                    Analyzing Alternatives...
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Demand</p>
                    <p className="text-lg font-black text-indigo-600">x{engineResult.multipliers.demand.toFixed(2)}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Urgency</p>
                    <p className="text-lg font-black text-amber-600">x{engineResult.multipliers.urgency.toFixed(2)}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Season</p>
                    <p className="text-lg font-black text-emerald-600">x{engineResult.multipliers.season.toFixed(2)}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Region</p>
                    <p className="text-lg font-black text-rose-600">x{engineResult.multipliers.region.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed italic bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl">
                {engineResult.aiAnalysis ? `"${engineResult.aiAnalysis}"` : `The engine has applied these multipliers based on historical demand patterns for ${departure} and the ${Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} day lead time.`}
              </div>

              {alternatives.length > 0 && (
                <div className="pt-4 border-t border-indigo-100 dark:border-indigo-800/50">
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <TrendingUp size={12} />
                    Broker Insight: Cheaper Alternatives Found
                  </h4>
                  <div className="space-y-2">
                    {alternatives.map((alt, idx) => (
                      <div 
                        key={idx} 
                        className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between group hover:border-indigo-300 transition-all cursor-pointer" 
                        onClick={() => {
                          setSelectedAircraftId(alt.listingId);
                          handleCalculate(alt.listingId);
                        }}
                      >
                        <div>
                          <p className="text-xs font-black text-gray-900 dark:text-white uppercase">{alt.aircraftType}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{alt.operatorName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-emerald-600">Save ${alt.savings.toLocaleString()}</p>
                          <div className="flex gap-1 justify-end mt-1">
                            {alt.reasons?.map((reason: string, rIdx: number) => (
                              <span key={rIdx} className="text-[8px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-black uppercase">{reason}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Operational Briefing Section */}
              {engineResult.routeDetails?.operationalSummaryNote && (
                <div className="bg-gray-900 border border-gray-800 p-8 rounded-[2rem] text-gray-300">
                  <div className="flex items-center gap-2 mb-6 text-indigo-400">
                    <ClipboardList size={20} />
                    <h3 className="font-black uppercase tracking-widest text-xs tracking-[0.2em]">Mission Operational Specification</h3>
                  </div>
                  <div className="prose prose-invert max-w-none">
                    <div className="p-6 bg-gray-800/30 rounded-2xl border border-gray-700/50 font-mono text-xs leading-relaxed whitespace-pre-wrap text-indigo-100/80">
                      {engineResult.routeDetails?.operationalSummaryNote}
                    </div>
                  </div>

                  {/* Route Legs & Airspace Segments */}
                  {engineResult.routeDetails?.legs && engineResult.routeDetails.legs.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <Plane size={14} className="rotate-45" />
                        Automated Route Segment Analysis
                      </h4>
                      <div className="relative border-l-2 border-emerald-500/20 ml-2 space-y-6">
                        {engineResult.routeDetails.legs.map((leg: any, idx: number) => (
                          <div key={idx} className="relative pl-8">
                            <div className="absolute left-[-9px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-gray-900 shadow-sm" />
                            <div className="bg-gray-800/30 border border-gray-700/50 p-4 rounded-2xl hover:bg-gray-800/50 transition-all group">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <p className="text-xs font-black text-white group-hover:text-emerald-400 mb-1">{leg.segment}</p>
                                  <div className="flex gap-4">
                                    <div className="flex items-center gap-1.5">
                                      <Globe size={10} className="text-gray-500" />
                                      <span className="text-[10px] text-gray-400 font-bold uppercase">{leg.fir || 'Unknown FIR'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <TrendingUp size={10} className="text-gray-500" />
                                      <span className="text-[10px] text-gray-400 font-bold uppercase">{leg.altitude || 'Optimum FL'}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-6">
                                  <div className="text-right">
                                    <p className="text-xs font-black text-indigo-400">{leg.distance} NM</p>
                                    <p className="text-[9px] text-gray-500 font-black uppercase">Distance</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs font-black text-indigo-400">{leg.estimatedTime}</p>
                                    <p className="text-[9px] text-gray-500 font-black uppercase">EET</p>
                                  </div>
                                </div>
                              </div>
                              {leg.restrictedAirspaceNotes && (
                                <div className="mt-3 flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                  <AlertTriangle size={12} className="text-amber-500 mt-0.5" />
                                  <p className="text-[10px] text-amber-200/80 italic font-medium">{leg.restrictedAirspaceNotes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* FIR Details Section */}
                  {engineResult.routeDetails?.firs && engineResult.routeDetails.firs.length > 0 && (
                    <div className="mt-8 space-y-4">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Globe size={14} />
                        FIR NAVIGATIONAL DATA & CHARGES
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        {engineResult.routeDetails.firs.map((fir: any, idx: number) => (
                          <div key={idx} className="bg-gray-800/40 border border-gray-700/50 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all">
                            <div className="p-4 flex items-center justify-between border-b border-gray-700/50">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center font-black text-xs">
                                  {fir.code || fir.name.substring(0, 4)}
                                </div>
                                <div>
                                  <p className="text-xs font-black text-white">{fir.name}</p>
                                  <p className="text-[10px] text-gray-500 font-bold uppercase">{fir.country || 'International Waters'}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-indigo-400">${(fir.overflightCharge || 0).toLocaleString()}</p>
                                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Est. Charge</p>
                              </div>
                            </div>
                            
                            {loadingFirs[fir.code || fir.name] ? (
                              <div className="p-4 flex items-center justify-center gap-2 text-[10px] font-bold text-gray-500 uppercase animate-pulse">
                                <Loader2 size={12} className="animate-spin" />
                                Analyzing FIR rules and charges...
                              </div>
                            ) : detailedFirs[fir.code || fir.name] ? (
                              <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                      <Phone size={10} /> Authority Contact
                                    </p>
                                    <p className="text-[10px] text-gray-300 font-medium">{detailedFirs[fir.code || fir.name].phone || 'N/A'}</p>
                                    <p className="text-[10px] text-gray-400 font-medium text-xs break-all">{detailedFirs[fir.code || fir.name].email || 'N/A'}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                      <Info size={10} /> Operational Info
                                    </p>
                                    <p className="text-[10px] text-gray-300 font-medium truncate">{detailedFirs[fir.code || fir.name].address || 'N/A'}</p>
                                    {detailedFirs[fir.code || fir.name].website && (
                                      <a href={detailedFirs[fir.code || fir.name].website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 mt-0.5">
                                        <ExternalLink size={10} /> Civil Aviation Portal
                                      </a>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                      <DollarSign size={10} /> Precise Charges ({selectedAircraft?.type})
                                    </p>
                                    <div className="space-y-1 pt-1">
                                      <div className="flex justify-between items-center text-[10px] text-gray-300">
                                        <span>Nav Charge:</span>
                                        <span className="font-black text-white">${detailedFirs[fir.code || fir.name].navigationCharge || 0}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-[10px] text-gray-300">
                                        <span>Overflight:</span>
                                        <span className="font-black text-white">${detailedFirs[fir.code || fir.name].overflightCharge || 0}</span>
                                      </div>
                                    </div>
                                    {detailedFirs[fir.code || fir.name].documentationUrl && (
                                      <a href={detailedFirs[fir.code || fir.name].documentationUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 mt-0.5">
                                        <FileText size={10} /> Official Cost Scale
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-1 pt-3 border-t border-gray-700/30">
                                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                                    <ShieldCheck size={10} /> Operational SOPs & Rules
                                  </p>
                                  <p className="text-[10px] text-gray-400 leading-relaxed italic">
                                    {detailedFirs[fir.code || fir.name].sop || 'Standard ICAO overflight rules apply.'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4">
                                <button 
                                  onClick={() => fetchFIRInfo(fir.code || fir.name, fir.name, selectedAircraft?.type)}
                                  className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-2 hover:text-indigo-400 transition-colors"
                                >
                                  <AlertCircle size={12} />
                                  Details unavailable. Click to retry analysis.
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800/20 p-4 rounded-xl border border-gray-700/50">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Distance</p>
                      <p className="text-sm font-black text-white">{(engineResult.routeDetails?.routingDistance || engineResult.routeDetails?.gcDistance || 0).toLocaleString()} NM</p>
                    </div>
                    <div className="bg-gray-800/20 p-4 rounded-xl border border-gray-700/50">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">FIRs Involved</p>
                      <p className="text-sm font-black text-white">{engineResult.routeDetails?.firs?.length || 0}</p>
                    </div>
                    <div className="bg-gray-800/20 p-4 rounded-xl border border-gray-700/50">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Estimated Permits</p>
                      <p className="text-sm font-black text-white">{engineResult.routeDetails?.permits?.length || 0}</p>
                    </div>
                    <div className="bg-gray-800/20 p-4 rounded-xl border border-gray-700/50">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Risk Factors</p>
                      <p className="text-sm font-black text-amber-500">{engineResult.routeDetails?.restrictedAreas?.length || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
        </div>
      </div>
    </div>
  );
}

function CostItem({ icon: Icon, label, value, onChange, color, bg }: any) {
  return (
    <div className={`p-6 rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${bg} ${color} rounded-xl flex items-center justify-center`}>
            <Icon size={20} />
          </div>
          <p className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-widest">{label}</p>
        </div>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-gray-400 font-bold">$</span>
        <input 
          type="number" 
          value={isNaN(value) ? '' : value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="w-full pl-8 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-lg font-black"
        />
      </div>
    </div>
  );
}
