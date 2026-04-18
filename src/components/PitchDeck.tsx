import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plane, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Zap, 
  Activity, 
  Calculator, 
  Globe, 
  TrendingUp, 
  Users, 
  CreditCard, 
  Rocket, 
  Cpu, 
  BarChart3, 
  Target, 
  ShieldCheck, 
  DollarSign 
} from 'lucide-react';

export default function PitchDeck() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Title Slide",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-200"
          >
            <Plane size={48} />
          </motion.div>
          <div className="space-y-4">
            <h1 className="text-6xl font-black text-gray-900 tracking-tight">AeroBroker AI</h1>
            <p className="text-2xl font-medium text-indigo-600">AI-Powered ACMI Aircraft Marketplace & Quote Engine</p>
          </div>
          <div className="pt-12 text-gray-400 font-bold uppercase tracking-[0.3em] text-sm">
            Presented by: Shakib Pasha • April 14, 2026
          </div>
        </div>
      )
    },
    {
      title: "Problem",
      content: (
        <div className="grid grid-cols-2 gap-12 h-full items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full text-sm font-bold uppercase tracking-wider">
              <AlertCircle size={16} />
              Industry Challenges
            </div>
            <h2 className="text-5xl font-black text-gray-900 leading-tight">The ACMI Market is Broken</h2>
            <ul className="space-y-4">
              {[
                "No centralized ACMI aircraft availability system",
                "Manual quoting takes hours to days",
                "Operators don’t share real-time data",
                "Brokers rely on emails, WhatsApp, and relationships",
                "Pricing is inconsistent and non-transparent"
              ].map((item, i) => (
                <motion.li 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="flex items-start gap-3 text-xl text-gray-600"
                >
                  <span className="text-red-500 mt-1">✕</span>
                  {item}
                </motion.li>
              ))}
            </ul>
          </div>
          <div className="bg-red-50 rounded-[2.5rem] p-12 flex flex-col justify-center border border-red-100">
            <div className="text-red-600 font-black text-2xl mb-4">The Result:</div>
            <div className="text-4xl font-black text-gray-900 leading-tight">
              Lost deals, delays, and operational inefficiency.
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Solution",
      content: (
        <div className="grid grid-cols-2 gap-12 h-full items-center">
          <div className="bg-indigo-600 rounded-[2.5rem] p-12 text-white shadow-2xl shadow-indigo-200">
            <div className="text-indigo-200 font-bold uppercase tracking-widest text-sm mb-6">Our Platform</div>
            <h2 className="text-5xl font-black leading-tight mb-8">The AI-Powered ACMI Ecosystem</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Search, label: "Instant aircraft search" },
                { icon: Zap, label: "AI-generated ACMI quotes" },
                { icon: Activity, label: "Availability prediction" },
                { icon: Globe, label: "Operator marketplace" }
              ].map((item, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                  <item.icon className="mb-3 text-indigo-300" size={24} />
                  <div className="font-bold text-sm">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-full text-sm font-bold uppercase tracking-wider">
              <CheckCircle2 size={16} />
              Our Platform
            </div>
            <div className="space-y-6">
              <p className="text-3xl font-bold text-gray-900 leading-relaxed">
                An AI-powered ACMI ecosystem that provides instant search, automated quoting, and predictive availability.
              </p>
              <div className="p-8 bg-gray-50 rounded-3xl border border-gray-100">
                <p className="text-xl text-gray-500 italic">
                  "Think: <span className="text-indigo-600 font-black not-italic">Airbnb + Bloomberg</span> for aircraft leasing."
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Product Overview",
      content: (
        <div className="space-y-12 h-full flex flex-col justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-5xl font-black text-gray-900">Key Features</h2>
            <p className="text-xl text-gray-500">Built for speed, accuracy, and global scale.</p>
          </div>
          <div className="grid grid-cols-3 gap-8">
            {[
              { icon: Search, title: "Aircraft Search Engine", desc: "Real-time global database of available ACMI aircraft." },
              { icon: Sparkles, title: "AI Quote Generator", desc: "Instant, accurate quotes based on live market data." },
              { icon: Activity, title: "Availability Intelligence", desc: "(flight tracking + AI) Predictive availability." },
              { icon: Calculator, title: "Dynamic ACMI Pricing Engine", desc: "Automated pricing adjustments based on demand." },
              { icon: Globe, title: "Global Operator Network", desc: "Direct access to verified aircraft operators worldwide." }
            ].map((feature, i) => (
              <motion.div 
                whileHover={{ y: -5 }}
                key={i} 
                className={`p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all ${i === 3 ? 'col-start-1 lg:col-start-auto' : ''}`}
              >
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon size={24} />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )
    },
    {
      title: "Market Opportunity",
      content: (
        <div className="grid grid-cols-2 gap-12 h-full items-center">
          <div className="space-y-12">
            <div className="space-y-4">
              <h2 className="text-5xl font-black text-gray-900">Global Market Size</h2>
              <div className="flex items-baseline gap-4">
                <span className="text-7xl font-black text-indigo-600">$25B+</span>
                <span className="text-xl font-bold text-gray-400 uppercase tracking-widest">ACMI & Charter</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="text-3xl font-black text-indigo-600 mb-1">6–8%</div>
                <div className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Annual Growth</div>
              </div>
              <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="text-3xl font-black text-indigo-600 mb-1">Cargo</div>
                <div className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Surge post-COVID</div>
              </div>
              <div className="col-span-2 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="text-xl font-black text-indigo-600 mb-1">Seasonal Spikes</div>
                <div className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Hajj, tourism, airline shortages</div>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-[2.5rem] p-12 text-white">
            <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
              <Target className="text-indigo-400" />
              Target Customers
            </h3>
            <div className="space-y-4">
              {[
                { label: "Airlines", desc: "Short-term capacity needs" },
                { label: "Cargo Operators", desc: "E-commerce & logistics surge" },
                { label: "Brokers", desc: "Efficiency & speed tools" },
                { label: "Governments", desc: "Emergency & strategic airlift" }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <span className="font-bold text-lg">{item.label}</span>
                  <span className="text-gray-500 text-sm">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Business Model",
      content: (
        <div className="space-y-12 h-full flex flex-col justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-5xl font-black text-gray-900">Revenue Streams</h2>
            <p className="text-xl text-gray-500">Multiple scalable layers of monetization.</p>
          </div>
          <div className="grid grid-cols-3 gap-8">
            {[
              { 
                icon: DollarSign, 
                title: "Broker Commission", 
                value: "5%–10%", 
                desc: "Per successful deal closed through the platform." 
              },
              { 
                icon: CreditCard, 
                title: "SaaS Subscription", 
                value: "$300–$1000", 
                desc: "Monthly fee for operators to list and manage fleet." 
              },
              { 
                icon: BarChart3, 
                title: "Premium Data Access", 
                value: "Tiered Pricing", 
                desc: "Brokers pay for advanced market insights and predictions." 
              }
            ].map((item, i) => (
              <div key={i} className="p-10 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-200">
                  <item.icon size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 mb-1">{item.title}</h3>
                  <div className="text-3xl font-black text-indigo-600">{item.value}</div>
                </div>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      title: "Traction / MVP Plan",
      content: (
        <div className="space-y-12 h-full flex flex-col justify-center">
          <h2 className="text-5xl font-black text-gray-900 text-center">Roadmap to Scale</h2>
          <div className="relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-100 -translate-y-1/2 hidden md:block" />
            <div className="grid grid-cols-3 gap-12">
              {[
                { 
                  phase: "Phase 1", 
                  time: "0–6 Months", 
                  items: ["10–20 operators onboard", "Manual + AI-assisted quotes", "MVP platform launch"] 
                },
                { 
                  phase: "Phase 2", 
                  time: "6–12 Months", 
                  items: ["50+ aircraft listings", "Automated availability system", "First revenue deals"] 
                },
                { 
                  phase: "Phase 3", 
                  time: "Year 2", 
                  items: ["Global expansion", "Full AI automation", "Strategic partnerships"] 
                }
              ].map((step, i) => (
                <div key={i} className="relative bg-white p-8 rounded-3xl border border-gray-100 shadow-lg z-10">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black mb-6 shadow-lg shadow-indigo-200">
                    {i + 1}
                  </div>
                  <div className="space-y-2 mb-6">
                    <h3 className="text-2xl font-black text-gray-900">{step.phase}</h3>
                    <p className="text-indigo-600 font-bold uppercase tracking-widest text-xs">{step.time}</p>
                  </div>
                  <ul className="space-y-3">
                    {step.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-gray-500 text-sm">
                        <Rocket size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Technology (Your Edge)",
      content: (
        <div className="grid grid-cols-2 gap-12 h-full items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-sm font-bold uppercase tracking-wider">
              <Cpu size={16} />
              The Tech Stack
            </div>
            <h2 className="text-5xl font-black text-gray-900 leading-tight">Our Proprietary AI Engine</h2>
            <div className="space-y-4">
              {[
                "Real-time Flight Tracking APIs integration",
                "Automated Web Scraping for market data",
                "AI Prediction Engine for availability",
                "Dynamic Pricing Model based on demand"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                  <span className="text-lg font-bold text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-indigo-600 rounded-[2.5rem] p-12 text-white flex flex-col justify-center">
            <div className="text-4xl font-black leading-tight mb-8">
              "Significant competitive advantage over legacy platforms like Avinode."
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Zap size={24} />
              </div>
              <div className="font-bold text-indigo-100">Real-time Data vs. Static Listings</div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Financial Projections",
      content: (
        <div className="space-y-12 h-full flex flex-col justify-center">
          <h2 className="text-5xl font-black text-gray-900 text-center">3-Year Growth Forecast</h2>
          <div className="overflow-hidden rounded-[2.5rem] border border-gray-100 shadow-2xl">
            <table className="w-full text-left">
              <thead className="bg-gray-900 text-white">
                <tr>
                  <th className="p-8 text-xl font-black">Year</th>
                  <th className="p-8 text-xl font-black">Deals / Month</th>
                  <th className="p-8 text-xl font-black">Revenue</th>
                  <th className="p-8 text-xl font-black">Profit</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {[
                  { year: "Year 1", deals: "5–10", rev: "$300K – $700K", profit: "$100K" },
                  { year: "Year 2", deals: "20–30", rev: "$1.5M – $3M", profit: "$700K" },
                  { year: "Year 3", deals: "50–80", rev: "$5M – $10M", profit: "$2M+" }
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="p-8 font-black text-gray-900 text-xl">{row.year}</td>
                    <td className="p-8 font-bold text-gray-600 text-lg">{row.deals}</td>
                    <td className="p-8 font-black text-indigo-600 text-2xl">{row.rev}</td>
                    <td className="p-8 font-black text-green-600 text-2xl">{row.profit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    },
    {
      title: "Go-To-Market Strategy",
      content: (
        <div className="grid grid-cols-2 gap-12 h-full items-center">
          <div className="bg-indigo-50 rounded-[2.5rem] p-12 space-y-8">
            <h3 className="text-3xl font-black text-gray-900">Acquisition Plan</h3>
            <div className="space-y-4">
              {[
                "Direct outreach to global airlines",
                "Strategic broker partnerships",
                "LinkedIn + targeted email campaigns",
                "WhatsApp automation for rapid response"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs font-black">
                    {i + 1}
                  </div>
                  <span className="font-bold text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-12">
            <div className="space-y-4">
              <h2 className="text-5xl font-black text-gray-900">Focus Regions</h2>
              <p className="text-xl text-gray-500">High-growth aviation hubs.</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {["Middle East", "Asia", "Africa"].map((region, i) => (
                <div key={i} className="flex items-center justify-between p-6 bg-gray-900 text-white rounded-[2rem]">
                  <span className="text-2xl font-black">{region}</span>
                  <Globe className="text-indigo-400" size={32} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Competitive Advantage",
      content: (
        <div className="space-y-12 h-full flex flex-col justify-center">
          <h2 className="text-5xl font-black text-gray-900 text-center">Why We Win</h2>
          <div className="grid grid-cols-3 gap-8">
            <div className="p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 flex flex-col justify-center text-center space-y-4">
              <div className="text-gray-400 font-black text-xl uppercase tracking-widest">Feature</div>
              <div className="h-px bg-gray-200 w-full" />
              <div className="text-2xl font-black text-gray-900 py-4">Quotes</div>
              <div className="text-2xl font-black text-gray-900 py-4">Availability</div>
              <div className="text-2xl font-black text-gray-900 py-4">Speed</div>
              <div className="text-2xl font-black text-gray-900 py-4">Pricing</div>
            </div>
            <div className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col justify-center text-center space-y-4">
              <div className="text-red-500 font-black text-xl uppercase tracking-widest">Traditional</div>
              <div className="h-px bg-gray-200 w-full" />
              <div className="text-2xl font-bold text-gray-400 py-4">Manual</div>
              <div className="text-2xl font-bold text-gray-400 py-4">Unknown</div>
              <div className="text-2xl font-bold text-gray-400 py-4">Slow</div>
              <div className="text-2xl font-bold text-gray-400 py-4">Hidden</div>
            </div>
            <div className="p-8 bg-indigo-600 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 flex flex-col justify-center text-center space-y-4">
              <div className="text-indigo-200 font-black text-xl uppercase tracking-widest">Our Platform</div>
              <div className="h-px bg-white/20 w-full" />
              <div className="text-2xl font-black py-4">Instant AI</div>
              <div className="text-2xl font-black py-4">AI Predicted</div>
              <div className="text-2xl font-black py-4">Real-time</div>
              <div className="text-2xl font-black py-4">Dynamic</div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Funding Ask",
      content: (
        <div className="grid grid-cols-2 gap-12 h-full items-center">
          <div className="space-y-12">
            <div className="space-y-4">
              <h2 className="text-5xl font-black text-gray-900">Investment Required</h2>
              <div className="text-7xl font-black text-indigo-600">$500,000</div>
              <p className="text-xl text-gray-500">Seed Round for 18 months runway.</p>
            </div>
            <div className="bg-indigo-600 rounded-[2.5rem] p-12 text-white">
              <h3 className="text-3xl font-black mb-4">Our Goal</h3>
              <p className="text-xl leading-relaxed text-indigo-100">
                Become the #1 global ACMI marketplace, digitizing a legacy $25B industry.
              </p>
            </div>
          </div>
          <div className="space-y-8">
            <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
              <DollarSign className="text-indigo-600" />
              Use of Funds
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: "Product Development", value: "40%" },
                { label: "Data Acquisition", value: "20%" },
                { label: "Sales & Marketing", value: "25%" },
                { label: "Team Expansion", value: "15%" }
              ].map((item, i) => (
                <div key={i} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <span className="font-bold text-lg text-gray-700">{item.label}</span>
                  <span className="text-2xl font-black text-indigo-600">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
  ];

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-[calc(100vh-12rem)] bg-gray-50 rounded-[3rem] p-8 flex flex-col relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-indigo-100/30 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-indigo-100/30 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Plane size={20} />
          </div>
          <span className="font-black text-gray-900 uppercase tracking-widest text-sm">AeroBroker Pitch Deck</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-white rounded-full border border-gray-100 shadow-sm text-sm font-bold text-gray-500">
            Slide {currentSlide + 1} of {slides.length}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={prevSlide}
              className="w-10 h-10 bg-white rounded-full border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-100 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={nextSlide}
              className="w-10 h-10 bg-indigo-600 rounded-full shadow-lg shadow-indigo-200 flex items-center justify-center text-white hover:bg-indigo-700 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Slide Content */}
      <div className="flex-grow relative z-10 bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-gray-100 p-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full"
          >
            {slides[currentSlide].content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress Bar */}
      <div className="mt-8 h-1.5 bg-gray-200 rounded-full overflow-hidden relative z-10">
        <motion.div 
          initial={false}
          animate={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
          className="h-full bg-indigo-600"
        />
      </div>

      {/* Keyboard Hint */}
      <div className="mt-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
        Use arrows to navigate • Press F for fullscreen
      </div>
    </div>
  );
}
