import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, MapPin, Calendar, Tag, Search, Filter, Loader2, ArrowRight, Sparkles, TrendingDown } from 'lucide-react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface EmptyLeg {
  id: string;
  route: string;
  aircraft_listing_id: string;
  discount_percentage: number;
  date: string;
  aircraft_type?: string;
  operator_name?: string;
  base_rate?: number;
}

const EmptyLegs: React.FC = () => {
  const [emptyLegs, setEmptyLegs] = useState<EmptyLeg[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmptyLegs();
  }, []);

  const fetchEmptyLegs = async () => {
    setLoading(true);
    try {
      // 1. Fetch Empty Legs
      const emptyLegsSnapshot = await getDocs(collection(db, 'empty_legs'));
      const legs = emptyLegsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      // 2. Enrich with Aircraft & Operator Data
      const listingSnapshot = await getDocs(collection(db, 'aircraft_listings'));
      const listings = new Map(listingSnapshot.docs.map(doc => [doc.id, doc.data()]));

      const masterSnapshot = await getDocs(collection(db, 'aircraft_master'));
      const masters = new Map(masterSnapshot.docs.map(doc => [doc.id, doc.data()]));

      const operatorSnapshot = await getDocs(collection(db, 'operators'));
      const operators = new Map(operatorSnapshot.docs.map(doc => [doc.id, doc.data()]));

      const enrichedLegs = legs.map(leg => {
        const listing = listings.get(leg.aircraft_listing_id) || {};
        const master = masters.get(listing.aircraft_id) || {};
        const operator = operators.get(listing.operator_id) || {};

        return {
          ...leg,
          aircraft_type: master.aircraft_type || 'Unknown',
          operator_name: operator.operator_name || 'Unknown Operator',
          base_rate: listing.acmi_rate_per_hr || 0
        };
      });

      setEmptyLegs(enrichedLegs);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'empty_legs');
    } finally {
      setLoading(false);
    }
  };

  const filteredLegs = emptyLegs.filter(leg => 
    leg.route.toLowerCase().includes(searchTerm.toLowerCase()) ||
    leg.aircraft_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    leg.operator_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      <div className="p-8 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <TrendingDown className="text-orange-600" size={20} />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-orange-600">Exclusive Opportunities</span>
            </div>
            <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Empty Leg Marketplace</h1>
            <p className="text-gray-500 font-medium max-w-2xl">
              High-discount positioning flights. Perfect for last-minute ACMI needs or crew training missions.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search routes or aircraft..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 transition-all w-full md:w-80"
              />
            </div>
            <button className="p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
              <Filter size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-auto p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="w-12 h-12 text-orange-600 animate-spin" />
            <p className="text-sm font-black text-gray-500 uppercase tracking-widest">Scanning Global Empty Legs...</p>
          </div>
        ) : filteredLegs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredLegs.map((leg) => (
                <motion.div
                  key={leg.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-500"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors duration-500">
                          <Plane size={24} />
                        </div>
                        <div>
                          <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none mb-1">{leg.aircraft_type}</h3>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{leg.operator_name}</p>
                        </div>
                      </div>
                      <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                        -{leg.discount_percentage}% OFF
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl mb-6">
                      <div className="text-center flex-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">From</p>
                        <p className="font-black text-gray-900 dark:text-white text-xl tracking-tighter">{(leg.route || '??? - ???').split(' - ')[0]}</p>
                      </div>
                      <div className="px-4 text-orange-600">
                        <ArrowRight size={20} />
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">To</p>
                        <p className="font-black text-gray-900 dark:text-white text-xl tracking-tighter">{(leg.route || '??? - ???').split(' - ')[1]}</p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                        <Calendar size={16} className="text-orange-600" />
                        <span>{new Date(leg.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                        <Tag size={16} className="text-orange-600" />
                        <span>Estimated Rate: <span className="text-gray-900 dark:text-white font-black">${Math.round(leg.base_rate! * (1 - leg.discount_percentage / 100)).toLocaleString()}/hr</span></span>
                      </div>
                    </div>

                    <button className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-lg">
                      Request Empty Leg
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-gray-900 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-800">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
              <Plane size={40} className="text-gray-300" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-2">No Empty Legs Found</h2>
            <p className="text-gray-500 font-medium mb-8">Try adjusting your search or check back later for new opportunities.</p>
            <button 
              onClick={fetchEmptyLegs}
              className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all"
            >
              Refresh Marketplace
            </button>
          </div>
        )}
      </div>

      <div className="p-6 bg-orange-600 text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-2xl">
            <Sparkles size={24} />
          </div>
          <div>
            <h4 className="font-black uppercase tracking-tighter">Smart Alerts</h4>
            <p className="text-xs opacity-80 font-medium">Get notified when an empty leg matches your frequent routes.</p>
          </div>
          <button className="ml-auto bg-white text-orange-600 px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 transition-all">
            Set Alert
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmptyLegs;
