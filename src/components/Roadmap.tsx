import React from 'react';
import { Map, Target, Zap, Database, BrainCircuit } from 'lucide-react';

const phases = [
  {
    title: 'Phase 1: Foundation',
    subtitle: 'Manual Data & Core Workflow',
    description: 'Establish the core platform with manual data entry for 10–20 operators. Build the essential search and quoting engine to validate the user experience.',
    icon: Database,
    color: 'bg-blue-500',
    items: ['Manual operator onboarding', 'Basic search functionality', 'Manual quote generation', 'User feedback loop']
  },
  {
    title: 'Phase 2: Automation',
    subtitle: 'Scraping & API Integration',
    description: 'Scale the platform by automating data acquisition. Integrate web scrapers and third-party APIs to populate availability and pricing in real-time.',
    icon: Zap,
    color: 'bg-indigo-500',
    items: ['Automated web scrapers', 'Third-party API integrations', 'Real-time availability sync', 'Automated data normalization']
  },
  {
    title: 'Phase 3: Intelligence',
    subtitle: 'AI-Driven Prediction',
    description: 'Leverage the aggregated data to provide predictive insights. Implement AI models for route optimization, pricing predictions, and smart alternative suggestions.',
    icon: BrainCircuit,
    color: 'bg-violet-500',
    items: ['Predictive pricing models', 'AI-driven route optimization', 'Smart alternative suggestions', 'Automated negotiation strategy']
  }
];

export default function Roadmap() {
  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Platform Roadmap</h2>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          Our strategic approach to building the definitive ACMI marketplace, starting simple and scaling with intelligence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {phases.map((phase, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
            <div className={`w-16 h-16 ${phase.color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg`}>
              <phase.icon size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">{phase.title}</h3>
            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">{phase.subtitle}</p>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-8 flex-grow">
              {phase.description}
            </p>
            <ul className="space-y-3">
              {phase.items.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
