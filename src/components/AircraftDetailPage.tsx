import React from 'react';
import { Plane, Shield, UserCheck, Settings, Info, ArrowLeft, MapPin, Calendar, DollarSign, Weight, Zap, Gauge, Maximize, Users, Fuel, Loader2, Activity, Sparkles, Building2, Mail, Phone, Globe, FileText, Handshake, Star, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { calculateAvailability, AvailabilityStatus } from '../services/availabilityService';
import { getOperatorDetails } from '../services/aiService';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface OperatorProfile {
  operator_name: string;
  region: string;
  category: string;
  acmi_type: string;
  key_contact_name?: string;
  manual_notes?: string;
  relationship_status?: string;
  priority_score?: number;
  fleet_size?: number;
  ai_estimated_rate?: string;
  contact_email?: string;
  website?: string;
  phone?: string;
  country?: string;
  base_airport?: string;
}
interface Aircraft {
  id?: string;
  registration?: string;
  icao24?: string;
  type: string;
  fuelBurnPerHour: number;
  cruiseSpeed: number;
  range: number;
  maxPayload: number;
  maxPassengers: number;
  hourlyRate: number;
  category: string;
  operatorName?: string;
  operatorEmail?: string;
  operatorWebsite?: string;
  operatorPhone?: string;
  acmiRate?: number;
  availability?: string;
  baseAirport?: string;
  crewIncluded?: boolean;
  maintenanceStatus?: string;
  insuranceCoverage?: string;
  operatorDetails?: string;
  crewInfo?: string;
  image?: string;
  specs?: {
    engines?: string;
    cabinWidth?: string;
    cabinHeight?: string;
    baggageCapacity?: string;
    serviceCeiling?: string;
  };
  photos?: string[];
}

interface AircraftDetailPageProps {
  aircraft: Aircraft;
  onBack: () => void;
  onGenerateQuote?: (aircraft: Aircraft) => void;
  setActiveTab?: (tab: string) => void;
}

export default function AircraftDetailPage({ aircraft, onBack, onGenerateQuote, setActiveTab }: AircraftDetailPageProps) {
  const [availability, setAvailability] = React.useState<{ status: AvailabilityStatus, reason: string } | null>(null);
  const [loadingAvailability, setLoadingAvailability] = React.useState(false);
  const [operatorProfile, setOperatorProfile] = React.useState<OperatorProfile | null>(null);
  const [loadingOperator, setLoadingOperator] = React.useState(false);
  const photos = aircraft.photos || [aircraft.image].filter(Boolean) as string[];

  React.useEffect(() => {
    const checkAvailability = async () => {
      if (aircraft.id && (aircraft.icao24 || aircraft.registration)) {
        setLoadingAvailability(true);
        const result = await calculateAvailability(aircraft.id, aircraft.icao24, aircraft.registration);
        setAvailability({ status: result.status, reason: result.reason });
        setLoadingAvailability(false);
      }
    };

    const fetchOperatorProfile = async () => {
      if (aircraft.operatorName) {
        setLoadingOperator(true);
        try {
          // Fetch from operators_master (Comprehensive data)
          const qMaster = query(
            collection(db, 'operators_master'),
            where('operator_name', '==', aircraft.operatorName),
            limit(1)
          );
          const snapshotMaster = await getDocs(qMaster);
          
          // Fetch from operators (Basic contact data)
          const qBasic = query(
            collection(db, 'operators'),
            where('name', '==', aircraft.operatorName),
            limit(1)
          );
          const snapshotBasic = await getDocs(qBasic);

          let profile: any = {};
          if (!snapshotMaster.empty) {
            profile = { ...profile, ...snapshotMaster.docs[0].data() };
          }
          if (!snapshotBasic.empty) {
            const basicData = snapshotBasic.docs[0].data();
            profile = { 
              ...profile, 
              contact_email: basicData.contact_email,
              country: basicData.country,
              base_airport: basicData.base_airport
            };
          }

          if (Object.keys(profile).length > 0) {
            setOperatorProfile(profile as OperatorProfile);
          } else if (aircraft.operatorName) {
            // If no profile found in DB, try AI enrichment
            const aiDetails = await getOperatorDetails(aircraft.operatorName, aircraft.baseAirport);
            if (aiDetails) {
              setOperatorProfile({
                operator_name: aircraft.operatorName,
                contact_email: aiDetails.email,
                website: aiDetails.website,
                phone: aiDetails.phone,
                manual_notes: aiDetails.summary,
                region: 'Global',
                category: 'Charter',
                acmi_type: 'ACMI',
                country: aircraft.baseAirport || 'Unknown'
              });
            }
          }
        } catch (error) {
          console.error("Error fetching operator profile:", error);
        } finally {
          setLoadingOperator(false);
        }
      }
    };

    checkAvailability();
    fetchOperatorProfile();
  }, [aircraft]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="max-w-7xl mx-auto space-y-8 pb-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest text-xs"
        >
          <ArrowLeft size={16} />
          Back to Marketplace
        </button>
        <div className="flex gap-3">
          <button 
            onClick={() => setActiveTab?.('ai-intelligence')}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 rounded-2xl font-black uppercase tracking-widest text-xs border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm"
          >
            <Sparkles size={16} />
            AI Intelligence
          </button>
          <button 
            onClick={() => onGenerateQuote?.(aircraft)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
          >
            Generate ACMI Quote
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Photos & Specs */}
        <div className="lg:col-span-8 space-y-8">
          {/* Photo Gallery */}
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="aspect-video relative bg-gray-100 dark:bg-gray-900">
              {photos.length > 0 ? (
                <img src={photos[0]} alt={aircraft.type} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Plane size={80} />
                </div>
              )}
              <div className="absolute bottom-6 left-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl">
                {aircraft.category}
              </div>
            </div>
            {photos.length > 1 && (
              <div className="p-4 grid grid-cols-4 gap-4">
                {photos.slice(1, 5).map((photo, i) => (
                  <div key={i} className="aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                    <img src={photo} alt={`${aircraft.type} ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Technical Specifications */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600">
                <Settings size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Technical Specifications</h3>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Performance & Capacity Data</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <SpecItem icon={Gauge} label="Cruise Speed" value={`${aircraft.cruiseSpeed} KTAS`} />
              <SpecItem icon={Zap} label="Range" value={`${aircraft.range.toLocaleString()} NM`} />
              <SpecItem icon={Weight} label="Max Payload" value={`${aircraft.maxPayload.toLocaleString()} KG`} />
              <SpecItem icon={Users} label="Capacity" value={`${aircraft.maxPassengers} PAX`} />
              <SpecItem icon={Fuel} label="Fuel Burn" value={`${aircraft.fuelBurnPerHour} L/Hr`} />
              <SpecItem icon={Maximize} label="Cabin Height" value={aircraft.specs?.cabinHeight || 'N/A'} />
              <SpecItem icon={Maximize} label="Cabin Width" value={aircraft.specs?.cabinWidth || 'N/A'} />
              <SpecItem icon={Weight} label="Baggage" value={aircraft.specs?.baggageCapacity || 'N/A'} />
            </div>
          </div>

          {/* Operator Details */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-600">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Operator Profile</h3>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">{aircraft.operatorName}</p>
                </div>
              </div>
              {operatorProfile?.priority_score && (
                <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-800/50">
                  <Star size={12} className="text-amber-500 fill-amber-500" />
                  <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                    {operatorProfile.priority_score.toFixed(1)} Priority
                  </span>
                </div>
              )}
            </div>

            {loadingOperator ? (
              <div className="flex items-center gap-2 text-gray-400 text-xs py-4">
                <Loader2 size={16} className="animate-spin" />
                Fetching full operator profile...
              </div>
            ) : operatorProfile ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Services & Region</h4>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-indigo-100 dark:border-indigo-800/50">
                          {operatorProfile.category}
                        </span>
                        <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-blue-100 dark:border-blue-800/50">
                          {operatorProfile.acmi_type}
                        </span>
                        <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50">
                          {operatorProfile.region}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Contact Information</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <UserCheck size={14} className="text-gray-400" />
                          <span className="font-bold">Key Contact:</span>
                          <span>{operatorProfile.key_contact_name || 'Not specified'}</span>
                        </div>
                        {operatorProfile.contact_email && (
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <Mail size={14} className="text-gray-400" />
                            <span className="font-bold">Email:</span>
                            <a href={`mailto:${operatorProfile.contact_email}`} className="text-indigo-600 hover:underline">{operatorProfile.contact_email}</a>
                          </div>
                        )}
                        {operatorProfile.website && (
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <Globe size={14} className="text-gray-400" />
                            <span className="font-bold">Website:</span>
                            <a href={operatorProfile.website.startsWith('http') ? operatorProfile.website : `https://${operatorProfile.website}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
                              {operatorProfile.website} <ExternalLink size={10} />
                            </a>
                          </div>
                        )}
                        {operatorProfile.phone && (
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <Phone size={14} className="text-gray-400" />
                            <span className="font-bold">Phone:</span>
                            <span>{operatorProfile.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <Handshake size={14} className="text-gray-400" />
                          <span className="font-bold">Relationship:</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                            operatorProfile.relationship_status === 'Strong' ? 'bg-emerald-100 text-emerald-700' :
                            operatorProfile.relationship_status === 'Warm' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {operatorProfile.relationship_status || 'No Contact'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Business Notes</h4>
                    <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed italic">
                        {operatorProfile.manual_notes || 'No internal business notes available for this operator.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t dark:border-gray-800">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {aircraft.operatorDetails || 'This operator provides premium ACMI services with a focus on reliability and operational excellence.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {aircraft.operatorDetails || 'This operator provides premium ACMI services with a focus on reliability and operational excellence. Full details available upon request.'}
                </p>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                    Detailed profile not found in master database. Displaying aircraft-specific operator information.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Status & Compliance */}
        <div className="lg:col-span-4 space-y-8">
          {/* Pricing Card */}
          <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 dark:shadow-none space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">ACMI Hourly Rate</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black">${aircraft.acmiRate?.toLocaleString()}</span>
                <span className="text-sm opacity-70">/ Block Hour</span>
              </div>
            </div>
            <div className="h-px bg-white/20" />
            
            {/* AI Availability Engine Output */}
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-indigo-200" />
                  <span className="text-[10px] font-black uppercase tracking-widest">AI Availability Engine</span>
                </div>
                {loadingAvailability ? (
                  <Loader2 size={12} className="animate-spin opacity-50" />
                ) : (
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                    availability?.status === 'Confirmed Available' ? 'bg-emerald-500 text-white' :
                    availability?.status === 'Likely Available' ? 'bg-amber-500 text-white' :
                    'bg-white/20 text-white'
                  }`}>
                    {availability?.status || 'On Request'}
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed opacity-80 italic">
                {loadingAvailability ? 'Analyzing live tracking and historical data...' : (availability?.reason || 'Contact operator for current schedule and availability.')}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="opacity-70">Availability</span>
                <span className="font-bold">{aircraft.availability}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="opacity-70">Base Airport</span>
                <span className="font-bold">{aircraft.baseAirport}</span>
              </div>
            </div>
          </div>

          {/* Maintenance Status */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <Settings size={18} />
              <h4 className="font-black uppercase tracking-widest text-[10px]">Maintenance Status</h4>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/50">
              <p className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">
                {aircraft.maintenanceStatus || 'Current & Compliant'}
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
                Last heavy maintenance (C-Check) completed recently. All ADs and SBs are up to date as per EASA/FAA requirements.
              </p>
            </div>
          </div>

          {/* Crew Details */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <UserCheck size={18} />
              <h4 className="font-black uppercase tracking-widest text-[10px]">Crew Details</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</span>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md">Included</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {aircraft.crewInfo || 'Standard ACMI crew complement: 2 Pilots, 2-4 Cabin Crew (depending on configuration). All crew are highly trained and multi-lingual.'}
              </p>
            </div>
          </div>

          {/* Insurance Type */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <Shield size={18} />
              <h4 className="font-black uppercase tracking-widest text-[10px]">Insurance Type</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Coverage</span>
                <span className="text-[10px] font-black text-gray-700 dark:text-gray-200 uppercase tracking-widest">{aircraft.insuranceCoverage || 'Comprehensive'}</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed italic">
                "Full Hull, Passenger, and Third Party Liability insurance included. Certificates of Insurance (COI) provided upon contract execution."
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SpecItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon size={14} />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-black text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
