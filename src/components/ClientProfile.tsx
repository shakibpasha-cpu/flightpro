import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Tag, FileText, Plane, MessageSquare, Plus } from 'lucide-react';

interface ClientProfileProps {
  lead: any;
  onBack: () => void;
}

export default function ClientProfile({ lead, onBack }: ClientProfileProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition">
        <ArrowLeft size={16} /> Back to Leads
      </button>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white">{lead.name}</h2>
            <p className="text-gray-500 dark:text-gray-400">{lead.company}</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm flex items-center gap-2">
              <Plus size={16} /> Add Note
            </button>
          </div>
        </div>
        
        <div className="mt-6 flex flex-wrap gap-2">
          {['VIP', 'Frequent Flyer', 'Corporate'].map(tag => (
            <span key={tag} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-bold flex items-center gap-1">
              <Tag size={12} /> {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <FileText size={20} className="text-indigo-500" /> Quote History
          </h3>
          <p className="text-sm text-gray-500">No quotes generated yet.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Plane size={20} className="text-indigo-500" /> Flights Booked
          </h3>
          <p className="text-sm text-gray-500">No flights booked yet.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm md:col-span-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <MessageSquare size={20} className="text-indigo-500" /> Communication Logs
          </h3>
          <p className="text-sm text-gray-500">No communication logs available.</p>
        </div>
      </div>
    </motion.div>
  );
}
