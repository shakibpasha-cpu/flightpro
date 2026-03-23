import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Plane, 
  Users, 
  Settings, 
  BarChart3, 
  ShieldCheck, 
  Zap, 
  History, 
  MapPin, 
  Calendar, 
  Building2, 
  Sparkles, 
  PlusCircle,
  Wind,
  ChevronLeft,
  ChevronRight,
  Globe
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'quotes', label: 'Charter Quotes', icon: Zap },
    { id: 'planner', label: 'AI Planner', icon: Sparkles },
    { id: 'manual', label: 'Manual Quote', icon: PlusCircle },
    { id: 'emptylegs', label: 'Empty Legs', icon: Wind },
    { id: 'leads', label: 'Leads & CRM', icon: Users },
    { id: 'aircraft', label: 'Aircraft Fleet', icon: Plane },
    { id: 'airports', label: 'Airports', icon: MapPin },
    { id: 'firs', label: 'FIR Database', icon: Globe },
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'handling', label: 'Handling Agents', icon: Building2 },
    { id: 'reports', label: 'Analytics', icon: BarChart3 },
    { id: 'pricing', label: 'Pricing Engine', icon: Settings },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col h-screen sticky top-0 z-20 transition-all duration-300 group`}>
      <div className={`p-6 border-b border-gray-100 dark:border-gray-800 relative flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="min-w-[40px] w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none shrink-0">
            <Plane size={24} />
          </div>
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="whitespace-nowrap"
            >
              <h1 className="text-lg font-black text-gray-900 dark:text-white leading-none">AeroBroker</h1>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">Pricing Engine</p>
            </motion.div>
          )}
        </div>
        
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm z-30 transition-all ${isCollapsed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav className="flex-grow p-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            title={isCollapsed ? item.label : ''}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === item.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
            } ${isCollapsed ? 'justify-center px-0' : ''}`}
          >
            <item.icon size={18} className="shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100 dark:border-gray-800">
        {!isCollapsed ? (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
              <ShieldCheck size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">SaaS Pro Plan</span>
            </div>
            <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed">
              You have 12 active quotes today. Upgrade for unlimited AI planning.
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ShieldCheck size={20} />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
