import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbsProps {
  activeTab: string;
  subPath?: string;
  onNavigate: (tab: string) => void;
}

const tabLabels: Record<string, string> = {
  'dashboard': 'Dashboard',
  'booking-flow': 'Booking Wizard',
  'ai-intelligence': 'AI Intelligence',
  'optimizer': 'Route Optimizer',
  'quotes': 'Charter Quotes',
  'acmi': 'ACMI Marketplace',
  'database': 'ACMI Database',
  'tracking': 'Live Fleet Tracking',
  'automation': 'Native Automation',
  'scraper': 'Market Scraper',
  'intelligence': 'Market Intelligence',
  'planner': 'AI Planner',
  'manual': 'Manual Quote',
  'emptylegs': 'Empty Legs',
  'leads': 'Leads & CRM',
  'billing': 'Billing & Plans',
  'operators': 'Operator Network',
  'aircraft': 'Aircraft Fleet',
  'availability': 'Availability',
  'airports': 'Airports',
  'firs': 'FIR Database',
  'routes': 'Routes',
  'schedules': 'Schedules',
  'handling': 'Handling Agents',
  'reports': 'Analytics',
  'pricing': 'Pricing Engine',
  'pricing-rules': 'Pricing Rules',
  'history': 'History',
  'settings': 'Settings'
};

export default function Breadcrumbs({ activeTab, subPath, onNavigate }: BreadcrumbsProps) {
  const currentLabel = tabLabels[activeTab] || activeTab;

  return (
    <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-8">
      <button 
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group"
      >
        <div className="w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-all">
          <Home size={12} />
        </div>
        <span>Home</span>
      </button>
      
      {activeTab !== 'dashboard' && (
        <>
          <ChevronRight size={12} className="text-gray-300 dark:text-gray-700 mx-1" />
          <button 
            onClick={() => onNavigate(activeTab)}
            className={`transition-all px-2 py-1 rounded-lg ${subPath ? 'hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400' : 'text-gray-900 dark:text-white bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50'}`}
          >
            {currentLabel}
          </button>
        </>
      )}

      {subPath && (
        <>
          <ChevronRight size={12} className="text-gray-300 dark:text-gray-700 mx-1" />
          <span className="text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700">
            {subPath}
          </span>
        </>
      )}
    </nav>
  );
}
