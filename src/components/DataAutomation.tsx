import React, { useState, useEffect } from 'react';
import { Play, Pause, Plus, Trash2, Webhook, Database, Cpu, Globe, Plane, ArrowRight, Zap, Calculator, AlertCircle, Calendar, X, Clock, Sparkles, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { db } from '../firebase';
import { automationService, AutomationTask } from '../services/automationService';
import { fleetSeederService } from '../services/fleetSeederService';
import { motion, AnimatePresence } from 'motion/react';

export default function DataAutomation() {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementResults, setEnhancementResults] = useState<any[] | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingResults, setScrapingResults] = useState<any[] | null>(null);
  const [isAOCScraping, setIsAOCScraping] = useState(false);
  const [aocScrapingResults, setAOCScrapingResults] = useState<any[] | null>(null);
  const [newTask, setNewTask] = useState<Partial<AutomationTask>>({
    name: '',
    type: 'scraper',
    schedule: 'Every 24 hours',
    status: 'active',
    dueDate: '',
    config: {}
  });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await automationService.getTasks();
      setTasks(data);
    } catch (err: any) {
      console.error('Error loading automation tasks:', err);
      setError(err.message || 'Failed to load automation tasks');
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (task: AutomationTask) => {
    try {
      const newStatus = task.status === 'active' ? 'paused' : 'active';
      await automationService.updateTaskStatus(task.id!, newStatus);
      loadTasks();
    } catch (err: any) {
      setError(err.message || 'Failed to update task status');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.name) return;
    
    setIsSubmitting(true);
    try {
      await automationService.addTask(newTask as AutomationTask);
      setIsModalOpen(false);
      setNewTask({
        name: '',
        type: 'scraper',
        schedule: 'Every 24 hours',
        status: 'active',
        dueDate: '',
        config: {}
      });
      loadTasks();
    } catch (err: any) {
      setError(err.message || 'Failed to add task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await automationService.deleteTask(taskId);
      loadTasks();
    } catch (err: any) {
      setError(err.message || 'Failed to delete task');
    }
  };

  const handleRunEnhancement = async () => {
    if (!window.confirm('This will use AI to scrape technical specifications for all aircraft types in your master database. This may take a few minutes. Continue?')) return;
    
    setIsEnhancing(true);
    setError(null);
    try {
      const results = await fleetSeederService.enhanceAircraftMasterData();
      setEnhancementResults(results);
    } catch (err: any) {
      console.error('Enhancement error:', err);
      setError(err.message || 'Failed to enhance aircraft data');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleRunScraping = async () => {
    if (!window.confirm('This will trigger a deep web search for all operators in your database to extract their current fleet details. This may take several minutes. Continue?')) return;
    
    setIsScraping(true);
    setError(null);
    try {
      const results = await fleetSeederService.scrapeAllOperatorsFleet();
      setScrapingResults(results);
    } catch (err: any) {
      console.error('Scraping error:', err);
      setError(err.message || 'Failed to scrape fleet data');
    } finally {
      setIsScraping(false);
    }
  };

  const handleRunAOCScraping = async () => {
    if (!window.confirm('This will trigger an AI-powered search across all monitored Aviation Authorities to extract the latest AOC holder lists. Continue?')) return;
    
    setIsAOCScraping(true);
    setError(null);
    try {
      const results = await automationService.scrapeAllAuthoritiesAOC();
      setAOCScrapingResults(results);
    } catch (err: any) {
      console.error('AOC Scraping error:', err);
      setError(err.message || 'Failed to scrape AOC data');
    } finally {
      setIsAOCScraping(false);
    }
  };

  const handleSeedAuthorities = async () => {
    const defaults = [
      {
        authority_name: 'UK Civil Aviation Authority',
        country: 'United Kingdom',
        website: 'https://www.caa.co.uk/commercial-industry/aircraft/operations/airline-licensing/list-of-uk-aoc-holders/',
        scraping_type: 'PDF',
        last_scraped: new Date(0).toISOString(),
        aoc_data: []
      },
      {
        authority_name: 'Maldives Civil Aviation Authority',
        country: 'Maldives',
        website: 'https://www.caa.gov.mv/operators',
        scraping_type: 'HTML',
        last_scraped: new Date(0).toISOString(),
        aoc_data: []
      },
      {
        authority_name: 'Pakistan Civil Aviation Authority',
        country: 'Pakistan',
        website: 'https://caapakistan.com.pk/AT/AT-AOC.aspx',
        scraping_type: 'PDF',
        last_scraped: new Date(0).toISOString(),
        aoc_data: []
      },
      {
        authority_name: 'Directorate General of Civil Aviation',
        country: 'India',
        website: 'https://www.dgca.gov.in/digigov-portal/?page=jsp/dgca/common/operatorList.jsp',
        scraping_type: 'HTML',
        last_scraped: new Date(0).toISOString(),
        aoc_data: []
      },
      {
        authority_name: 'Civil Aviation Authority of Singapore',
        country: 'Singapore',
        website: 'https://www.caas.gov.sg/operations-safety/aircraft-operations/air-operator-certificates',
        scraping_type: 'PDF',
        last_scraped: new Date(0).toISOString(),
        aoc_data: []
      }
    ];

    try {
      const { collection, addDoc, query, where, getDocs } = await import('firebase/firestore');
      for (const auth of defaults) {
        const q = query(collection(db, 'aviation_authorities'), where('authority_name', '==', auth.authority_name));
        const snap = await getDocs(q);
        if (snap.empty) {
          await addDoc(collection(db, 'aviation_authorities'), auth);
        }
      }
      alert('Default authorities seeded successfully!');
    } catch (err: any) {
      setError('Failed to seed authorities: ' + err.message);
    }
  };

  const handleBulkEnrich = async () => {
    if (!window.confirm('This will use AI to find missing contact info for all operators with incomplete profiles. This may take a while. Continue?')) return;
    setLoading(true);
    setError(null);
    try {
      const results = await fleetSeederService.enrichAllOperatorsData();
      const successCount = results.filter((r: any) => r.status === 'Success').length;
      alert(`Enrichment complete! Successfully processed ${successCount} operators.`);
      loadTasks();
    } catch (err: any) {
      console.error('Enrichment failed:', err);
      setError('Enrichment failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
            <Webhook className="text-indigo-600" size={32} />
            System Architecture & Data Flow
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your external data collection, n8n processing pipelines, and AI prediction engine.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBulkEnrich}
            disabled={loading}
            className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition flex items-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-none disabled:opacity-50"
          >
            <Sparkles size={18} />
            Bulk Enrich Operators
          </button>
          <button 
            onClick={handleSeedAuthorities}
            className="bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-6 py-3 rounded-2xl font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-2 border border-gray-100 dark:border-gray-700"
          >
            <Database size={18} />
            Seed Authorities
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            <Plus size={20} />
            New Automation
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-900 dark:text-white">New Automation Task</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleAddTask} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Task Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Daily Fleet Scraper"
                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newTask.name}
                    onChange={(e) => setNewTask({...newTask, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Type</label>
                    <select 
                      className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                      value={newTask.type}
                      onChange={(e) => setNewTask({...newTask, type: e.target.value as any})}
                    >
                      <option value="scraper">Scraper</option>
                      <option value="api-sync">API Sync</option>
                      <option value="email-parser">Email Parser</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Schedule</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Every 12h"
                      className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newTask.schedule}
                      onChange={(e) => setNewTask({...newTask, schedule: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Due Date (Optional)</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="date" 
                      className="w-full pl-10 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Automation'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* High-Level Architecture Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
          <h2 className="text-lg font-black text-gray-900 dark:text-white mb-8 flex items-center gap-2">
            <Zap className="text-amber-500" size={20} />
            Live Data Pipeline
          </h2>
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden lg:block absolute top-1/2 left-0 w-full h-1 bg-gray-100 dark:bg-gray-700 -z-10 -translate-y-1/2"></div>
            
            {/* Step 1: External Data */}
            <div className="flex flex-col gap-3 w-full lg:w-48 relative z-10">
              <div className="bg-white dark:bg-gray-800 border-2 border-blue-100 dark:border-blue-900/50 p-4 rounded-2xl shadow-sm flex flex-col items-center text-center gap-2">
                <Globe className="text-blue-500" size={24} />
                <span className="font-bold text-sm text-gray-900 dark:text-white">Web Scraping</span>
                <span className="text-[10px] text-gray-500">Charter Boards, Avinode</span>
              </div>
              <div className="bg-white dark:bg-gray-800 border-2 border-sky-100 dark:border-sky-900/50 p-4 rounded-2xl shadow-sm flex flex-col items-center text-center gap-2">
                <Plane className="text-sky-500" size={24} />
                <span className="font-bold text-sm text-gray-900 dark:text-white">Flight Tracking</span>
                <span className="text-[10px] text-gray-500">ADS-B, FlightRadar24</span>
              </div>
            </div>

            <ArrowRight className="text-gray-300 dark:text-gray-600 rotate-90 lg:rotate-0 shrink-0" size={24} />

            {/* Step 2: n8n Processing */}
            <div className="bg-white dark:bg-gray-800 border-2 border-orange-100 dark:border-orange-900/50 p-6 rounded-3xl shadow-sm flex flex-col items-center text-center gap-3 w-full lg:w-48 relative z-10">
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center">
                <Webhook className="text-orange-500" size={24} />
              </div>
              <div>
                <span className="font-black text-base text-gray-900 dark:text-white block">Data Processing</span>
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400">n8n Workflows</span>
              </div>
            </div>

            <ArrowRight className="text-gray-300 dark:text-gray-600 rotate-90 lg:rotate-0 shrink-0" size={24} />

            {/* Step 3: AI Prediction */}
            <div className="bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-900/50 p-6 rounded-3xl shadow-sm flex flex-col items-center text-center gap-3 w-full lg:w-48 relative z-10">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                <Cpu className="text-indigo-600" size={24} />
              </div>
              <div>
                <span className="font-black text-base text-gray-900 dark:text-white block">AI Prediction</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Availability Engine</span>
              </div>
            </div>

            <ArrowRight className="text-gray-300 dark:text-gray-600 rotate-90 lg:rotate-0 shrink-0" size={24} />

            {/* Step 4: Database */}
            <div className="bg-white dark:bg-gray-800 border-2 border-emerald-100 dark:border-emerald-900/50 p-6 rounded-3xl shadow-sm flex flex-col items-center text-center gap-3 w-full lg:w-48 relative z-10">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
                <Database className="text-emerald-600" size={24} />
              </div>
              <div>
                <span className="font-black text-base text-gray-900 dark:text-white block">Your Database</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Firestore</span>
              </div>
            </div>

            <ArrowRight className="text-gray-300 dark:text-gray-600 rotate-90 lg:rotate-0 shrink-0" size={24} />

            {/* Step 5: Quote Engine */}
            <div className="bg-gray-900 dark:bg-black border-2 border-gray-800 p-6 rounded-3xl shadow-xl flex flex-col items-center text-center gap-3 w-full lg:w-48 relative z-10">
              <div className="w-12 h-12 bg-gray-800 rounded-2xl flex items-center justify-center">
                <Calculator className="text-white" size={24} />
              </div>
              <div>
                <span className="font-black text-base text-white block">Quote Engine</span>
                <span className="text-xs font-bold text-gray-400">Client Facing</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Enrichment Card */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <Sparkles size={100} />
          </div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                <Cpu size={20} />
              </div>
              <h3 className="text-lg font-black tracking-tight">AI Technical Enrichment</h3>
            </div>
            <p className="text-xs text-indigo-100 mb-6 leading-relaxed">
              Automatically populate your aircraft database with technical specifications using Gemini AI.
            </p>
            
            <div className="mt-auto space-y-4">
              {isEnhancing ? (
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center gap-3">
                  <Loader2 className="animate-spin text-white" size={20} />
                  <span className="text-sm font-bold">Scraping Specs...</span>
                </div>
              ) : enhancementResults ? (
                <div className="bg-emerald-500/20 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-400" size={20} />
                    <span className="text-sm font-bold">{enhancementResults.filter(r => r.status === 'Success').length} Enhanced</span>
                  </div>
                  <button 
                    onClick={() => setEnhancementResults(null)}
                    className="text-[10px] font-black uppercase tracking-widest text-emerald-200 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleRunEnhancement}
                  className="w-full bg-white text-indigo-600 py-3 rounded-2xl font-black hover:bg-indigo-50 transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                >
                  <Sparkles size={16} />
                  Run AI Enrichment
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fleet Scraper Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl shadow-emerald-200 dark:shadow-none relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <Globe size={100} />
          </div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                <Globe size={20} />
              </div>
              <h3 className="text-lg font-black tracking-tight">Fleet Intelligence</h3>
            </div>
            <p className="text-xs text-emerald-100 mb-6 leading-relaxed">
              Deep web scraping to extract real-time fleet details, quantities, and aircraft ages.
            </p>
            
            <div className="mt-auto space-y-4">
              {isScraping ? (
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center gap-3">
                  <Loader2 className="animate-spin text-white" size={20} />
                  <span className="text-sm font-bold">Scraping Fleet...</span>
                </div>
              ) : scrapingResults ? (
                <div className="bg-emerald-500/20 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-400" size={20} />
                    <span className="text-sm font-bold">{scrapingResults.filter(r => r.status === 'Success').length} Scraped</span>
                  </div>
                  <button 
                    onClick={() => setScrapingResults(null)}
                    className="text-[10px] font-black uppercase tracking-widest text-emerald-200 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleRunScraping}
                  className="w-full bg-white text-emerald-600 py-3 rounded-2xl font-black hover:bg-emerald-50 transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                >
                  <Globe size={16} />
                  Run Fleet Scraper
                </button>
              )}
            </div>
          </div>
        </div>

        {/* AOC Scraper Card */}
        <div className="bg-gradient-to-br from-rose-600 to-pink-700 rounded-3xl p-6 text-white shadow-xl shadow-rose-200 dark:shadow-none relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <ShieldCheck size={100} />
          </div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-lg font-black tracking-tight">AOC Intelligence</h3>
            </div>
            <p className="text-xs text-rose-100 mb-6 leading-relaxed">
              Extract Air Operator Certificate holder lists from global aviation authority websites.
            </p>
            
            <div className="mt-auto space-y-4">
              {isAOCScraping ? (
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center gap-3">
                  <Loader2 className="animate-spin text-white" size={20} />
                  <span className="text-sm font-bold">Scraping AOCs...</span>
                </div>
              ) : aocScrapingResults ? (
                <div className="bg-emerald-500/20 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-400" size={20} />
                    <span className="text-sm font-bold">{aocScrapingResults.filter(r => r.status === 'Success').length} Authorities</span>
                  </div>
                  <button 
                    onClick={() => setAOCScrapingResults(null)}
                    className="text-[10px] font-black uppercase tracking-widest text-emerald-200 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleRunAOCScraping}
                  className="w-full bg-white text-rose-600 py-3 rounded-2xl font-black hover:bg-rose-50 transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                >
                  <ShieldCheck size={16} />
                  Run AOC Scraper
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle size={20} />
          <p className="text-sm font-bold uppercase tracking-tight">{error}</p>
          <button 
            onClick={loadTasks}
            className="ml-auto px-3 py-1 bg-red-100 dark:bg-red-800 rounded-lg text-xs font-black uppercase hover:bg-red-200 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Automation Tasks Table */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Active n8n Workflows</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <tr>
              <th className="px-6 py-4 text-left">Task Name</th>
              <th className="px-6 py-4 text-left">Type</th>
              <th className="px-6 py-4 text-left">Schedule</th>
              <th className="px-6 py-4 text-left">Due Date</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <Webhook size={32} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-bold">No active workflows</p>
                  <p className="text-xs mt-1">Connect your n8n instance to start syncing data.</p>
                </td>
              </tr>
            ) : (
              tasks.map(task => (
                <tr key={task.id} className="text-sm">
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{task.name}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{task.type}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{task.schedule}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    {task.dueDate ? (
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-gray-400" />
                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-xs">No deadline</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${task.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => toggleTask(task)} className="p-2 text-gray-400 hover:text-indigo-600 transition bg-gray-50 dark:bg-gray-900 rounded-xl">
                      {task.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button 
                      onClick={() => handleDeleteTask(task.id!)}
                      className="p-2 text-gray-400 hover:text-red-600 transition bg-gray-50 dark:bg-gray-900 rounded-xl"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
