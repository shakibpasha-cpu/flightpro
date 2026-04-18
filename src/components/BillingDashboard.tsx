import React, { useState } from 'react';
import { CreditCard, Check, Zap, Database, Percent, Shield, Star, ArrowRight, Plane } from 'lucide-react';
import { motion } from 'motion/react';

export default function BillingDashboard() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const operatorPlans = [
    {
      name: 'Operator Basic',
      price: billingCycle === 'monthly' ? 99 : 990,
      description: 'Perfect for small operators looking to list their fleet.',
      features: [
        'List up to 3 aircraft',
        'Basic profile visibility',
        'Standard support',
        'Receive direct quote requests'
      ],
      recommended: false
    },
    {
      name: 'Operator Pro',
      price: billingCycle === 'monthly' ? 299 : 2990,
      description: 'For growing operators needing advanced tools and analytics.',
      features: [
        'List up to 15 aircraft',
        'Priority search ranking',
        'Real-time availability sync',
        'Advanced analytics dashboard',
        '24/7 Priority support'
      ],
      recommended: true
    },
    {
      name: 'Operator Enterprise',
      price: billingCycle === 'monthly' ? 899 : 8990,
      description: 'Full suite for large fleet operators and management companies.',
      features: [
        'Unlimited aircraft listings',
        'API access for fleet sync',
        'Dedicated account manager',
        'White-label quoting',
        'Custom integrations'
      ],
      recommended: false
    }
  ];

  const brokerPlans = [
    {
      name: 'Broker Essential',
      price: billingCycle === 'monthly' ? 149 : 1490,
      description: 'Essential tools for independent charter brokers.',
      features: [
        'Access to global fleet directory',
        'Send up to 50 quote requests/mo',
        'Basic empty leg alerts',
        'Standard routing tools'
      ],
      recommended: false
    },
    {
      name: 'Broker Premium',
      price: billingCycle === 'monthly' ? 499 : 4990,
      description: 'Advanced data and automation for high-volume brokers.',
      features: [
        'Unlimited quote requests',
        'Real-time fleet tracking (ADS-B)',
        'Live empty leg matching',
        'Advanced AI routing & costing',
        'API access for CRM integration'
      ],
      recommended: true
    }
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Business Model & Billing</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your subscriptions, commissions, and premium data access.</p>
        </div>
      </div>

      {/* Commission Model Section */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center justify-between">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-sm font-bold backdrop-blur-sm">
              <Percent size={16} /> Platform Commission
            </div>
            <h2 className="text-3xl font-black">3% – 10% Per Deal</h2>
            <p className="text-indigo-100 text-lg leading-relaxed">
              Our core monetization strategy is a transparent commission model. We charge a percentage on every successful charter or ACMI deal facilitated through the platform. 
              Rates vary based on volume and operator agreements.
            </p>
            <div className="flex gap-4 pt-4">
              <div className="bg-black/20 p-4 rounded-2xl flex-1">
                <p className="text-indigo-200 text-sm font-bold mb-1">Standard Charter</p>
                <p className="text-2xl font-black">5% - 10%</p>
              </div>
              <div className="bg-black/20 p-4 rounded-2xl flex-1">
                <p className="text-indigo-200 text-sm font-bold mb-1">ACMI Leases</p>
                <p className="text-2xl font-black">3% - 5%</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl text-gray-900 w-full md:w-80 shadow-2xl">
            <h3 className="font-black text-lg mb-4">Your Current Rate</h3>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-5xl font-black text-indigo-600">5%</span>
              <span className="text-gray-500 font-bold mb-1">/ deal</span>
            </div>
            <button className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition">
              View Commission History
            </button>
          </div>
        </div>
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center pt-8">
        <div className="bg-gray-200 dark:bg-gray-800 p-1 rounded-xl inline-flex">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
              billingCycle === 'monthly' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
              billingCycle === 'annual' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Annual Billing <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">Save 20%</span>
          </button>
        </div>
      </div>

      {/* SaaS Plans (Operators) */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Plane size={24} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Operator SaaS Plans</h2>
        </div>
        <p className="text-gray-500 dark:text-gray-400">Monthly subscription for operators to list aircraft and manage availability.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {operatorPlans.map((plan, idx) => (
            <motion.div 
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative bg-white dark:bg-gray-800 rounded-3xl p-8 border-2 transition-all ${
                plan.recommended 
                  ? 'border-indigo-600 shadow-xl shadow-indigo-100 dark:shadow-none scale-105 z-10' 
                  : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Star size={12} className="fill-current" /> Most Popular
                </div>
              )}
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{plan.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 h-10">{plan.description}</p>
              
              <div className="my-6 flex items-end gap-1">
                <span className="text-4xl font-black text-gray-900 dark:text-white">${plan.price}</span>
                <span className="text-gray-500 dark:text-gray-400 font-bold mb-1">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
              </div>

              <button className={`w-full py-3 rounded-xl font-bold mb-8 transition-all ${
                plan.recommended
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
                Subscribe Now
              </button>

              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">What's included</p>
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-0.5 rounded-full">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Premium Data Access (Brokers) */}
      <div className="space-y-6 pt-12">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
            <Database size={24} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Premium Data Access (Brokers)</h2>
        </div>
        <p className="text-gray-500 dark:text-gray-400">Subscribe for real-time market data, live fleet tracking, and advanced AI routing.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          {brokerPlans.map((plan, idx) => (
            <motion.div 
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + (idx * 0.1) }}
              className={`relative bg-white dark:bg-gray-800 rounded-3xl p-8 border-2 transition-all ${
                plan.recommended 
                  ? 'border-purple-600 shadow-xl shadow-purple-100 dark:shadow-none' 
                  : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{plan.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 h-10">{plan.description}</p>
              
              <div className="my-6 flex items-end gap-1">
                <span className="text-4xl font-black text-gray-900 dark:text-white">${plan.price}</span>
                <span className="text-gray-500 dark:text-gray-400 font-bold mb-1">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
              </div>

              <button className={`w-full py-3 rounded-xl font-bold mb-8 transition-all ${
                plan.recommended
                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200 dark:shadow-none'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
                Upgrade to {plan.name.split(' ')[1]}
              </button>

              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">What's included</p>
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 p-0.5 rounded-full">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

    </div>
  );
}
