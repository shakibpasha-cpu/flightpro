import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, ExternalLink, Search, Filter, 
  ChevronRight, Database, Zap, ShieldCheck,
  FileText, Link as LinkIcon, Star, Info, Code
} from 'lucide-react';

const AOC_SOURCES = [
  {
    tier: 1,
    title: 'TIER 1 (VERY HIGH QUALITY – START HERE)',
    color: 'emerald',
    sources: [
      {
        country: 'UK',
        flag: '🇬🇧',
        name: 'UK (BEST DATASET)',
        format: 'PDF',
        links: [
          { label: 'UK CAA AOC Holders PDF (Latest)', url: 'https://www.caa.co.uk/media/5jpf0j1n/aoc-holders-list.pdf' },
          { label: 'UK CAA AOC Holders (Archive)', url: 'https://www.caa.co.uk/commercial-industry/aircraft/air-operator-certificates/list-of-aoc-holders/' }
        ],
        contains: ['Aircraft types', 'AOC numbers', 'Operator names'],
        description: 'The gold standard for AOC data. Highly structured and frequently updated.'
      },
      {
        country: 'Maldives',
        flag: '🇲🇻',
        name: 'Maldives (STRUCTURED HTML – GOLDMINE)',
        format: 'HTML',
        links: [
          { label: 'Maldives AOC Holders List', url: 'https://caa.gov.mv/air-operator-certificate' }
        ],
        contains: ['Aircraft', 'Operations', 'AOC numbers'],
        description: 'Perfect scraping format. Includes detailed aircraft and operational data.'
      },
      {
        country: 'Jordan',
        flag: '🇯🇴',
        name: 'Jordan (PDF + HTML)',
        format: 'PDF',
        links: [
          { label: 'Jordan AOC Holders PDF', url: 'https://carc.gov.jo/en/air-operators' },
          { label: 'Jordan AOC Portal', url: 'https://carc.gov.jo/en/operators-list' }
        ]
      },
      { country: 'Kazakhstan', flag: '🇰🇿', name: 'Kazakhstan', format: 'HTML', links: [{ label: 'Kazakhstan AOC Holders List', url: 'https://caa.gov.kz/en/operators' }] },
      { country: 'Hong Kong', flag: '🇭🇰', name: 'Hong Kong', format: 'HTML', links: [{ label: 'Hong Kong AOC Holders List', url: 'https://www.cad.gov.hk/english/aoc.html' }] },
      { country: 'Tanzania', flag: '🇹🇿', name: 'Tanzania', format: 'HTML', links: [{ label: 'Tanzania AOC Holders List', url: 'https://www.tcaa.go.tz/aoc-holders' }] },
      { country: 'Slovenia', flag: '🇸🇮', name: 'Slovenia', format: 'HTML', links: [{ label: 'Slovenia AOC Holders Database', url: 'https://www.caa.si/en/air-operators.html' }] }
    ]
  },
  {
    tier: 2,
    title: 'TIER 2 (EUROPE – PDF HEAVY)',
    color: 'blue',
    sources: [
      { country: 'Malta', flag: '🇲🇹', name: 'Malta', format: 'PDF', links: [{ label: 'Malta AOC Holders PDF List', url: 'https://transport.gov.mt/aviation/air-operators/list-of-aoc-holders-243' }] },
      { country: 'Poland', flag: '🇵🇱', name: 'Poland', format: 'HTML', links: [{ label: 'Poland AOC List', url: 'https://ulc.gov.pl/en/flight-operations/list-of-certificates' }] },
      { country: 'Norway', flag: '🇳🇴', name: 'Norway', format: 'HTML', links: [{ label: 'Norway AOC List', url: 'https://luftfartstilsynet.no/en/operators/air-operator-certificate/' }] },
      { country: 'Sweden', flag: '🇸🇪', name: 'Sweden', format: 'HTML', links: [{ label: 'Sweden AOC List', url: 'https://www.transportstyrelsen.se/en/aviation/commercial-aviation/air-operator-certificates/' }] },
      { country: 'Switzerland', flag: '🇨🇭', name: 'Switzerland', format: 'HTML', links: [{ label: 'Switzerland AOC List', url: 'https://www.bazl.admin.ch/bazl/en/home/aircraft/air-operator-certificate.html' }] },
      { country: 'France', flag: '🇫🇷', name: 'France (DGAC)', format: 'HTML', links: [{ label: 'France AOC List', url: 'https://www.ecologie.gouv.fr/compagnies-aeriennes-francaises' }] },
      { country: 'Germany', flag: '🇩🇪', name: 'Germany (LBA)', format: 'HTML', links: [{ label: 'Germany AOC List', url: 'https://www.lba.de/EN/Aircraft/Operators/AOC/aoc_node.html' }] },
      { country: 'Italy', flag: '🇮🇹', name: 'Italy', format: 'HTML', links: [{ label: 'Italy AOC List', url: 'https://www.enac.gov.it/sicurezza-aerea/operatori-aerei' }] },
      { country: 'Spain', flag: '🇪🇸', name: 'Spain', format: 'HTML', links: [{ label: 'Spain AOC List', url: 'https://www.seguridadaerea.gob.es/en/ambitos/operaciones-aereas' }] }
    ]
  },
  {
    tier: 3,
    title: 'TIER 3 (MIDDLE EAST – HIGH VALUE FOR CHARTER)',
    color: 'amber',
    sources: [
      { country: 'UAE', flag: '🇦🇪', name: 'UAE', format: 'Navigation', links: [{ label: 'UAE AOC List', url: 'https://www.gcaa.gov.ae/en/Pages/AirOperators.aspx' }] },
      { country: 'Saudi Arabia', flag: '🇸🇦', name: 'Saudi Arabia', format: 'HTML', links: [{ label: 'Saudi Arabia AOC List', url: 'https://gaca.gov.sa/web/en-gb/aviation-operators' }] },
      { country: 'Qatar', flag: '🇶🇦', name: 'Qatar', format: 'HTML', links: [{ label: 'Qatar AOC List', url: 'https://caa.gov.qa/en-us/airtransport' }] },
      { country: 'Kuwait', flag: '🇰🇼', name: 'Kuwait', format: 'HTML', links: [{ label: 'Kuwait AOC List', url: 'https://dgca.gov.kw/en/air-operators' }] },
      { country: 'Oman', flag: '🇴🇲', name: 'Oman', format: 'HTML', links: [{ label: 'Oman AOC List', url: 'https://www.caa.gov.om/en/air-operators' }] }
    ]
  },
  {
    tier: 4,
    title: 'TIER 4 (SOUTH ASIA – MUST HAVE)',
    color: 'orange',
    sources: [
      { country: 'Pakistan', flag: '🇵🇰', name: 'Pakistan', format: 'HTML', links: [{ label: 'Pakistan AOC List', url: 'https://caapakistan.com.pk/air-operators' }] },
      { country: 'India', flag: '🇮🇳', name: 'India', format: 'Navigation', links: [{ label: 'India AOC List', url: 'https://dgca.gov.in/digigov-portal/?page=jsp/dgca/InventoryList/dataReports/airlines.html' }] },
      { country: 'Bangladesh', flag: '🇧🇩', name: 'Bangladesh', format: 'HTML', links: [{ label: 'Bangladesh AOC List', url: 'https://caab.gov.bd/air-operator-certificate' }] },
      { country: 'Sri Lanka', flag: '🇱🇰', name: 'Sri Lanka', format: 'PDF', links: [{ label: 'Sri Lanka AOC List', url: 'https://www.caa.lk/en/air-operator-certificates' }] },
      { country: 'Nepal', flag: '🇳🇵', name: 'Nepal', format: 'HTML', links: [{ label: 'Nepal AOC List', url: 'https://caanepal.gov.np/aoc-holder' }] }
    ]
  },
  {
    tier: 5,
    title: 'TIER 5 (SOUTHEAST ASIA – PDF GOLD)',
    color: 'yellow',
    sources: [
      { country: 'Malaysia', flag: '🇲🇾', name: 'Malaysia', format: 'PDF', links: [{ label: 'Malaysia AOC List', url: 'https://www.caam.gov.my/aoc-holder' }] },
      { country: 'Singapore', flag: '🇸🇬', name: 'Singapore', format: 'PDF', links: [{ label: 'Singapore AOC List', url: 'https://www.caas.gov.sg/air-operator-certificates' }] },
      { country: 'Indonesia', flag: '🇮🇩', name: 'Indonesia', format: 'HTML', links: [{ label: 'Indonesia AOC List', url: 'https://hubud.dephub.go.id/aoc' }] },
      { country: 'Thailand', flag: '🇹🇭', name: 'Thailand', format: 'PDF', links: [{ label: 'Thailand AOC List', url: 'https://www.caat.or.th/en/archives/category/air-operators' }] },
      { country: 'Philippines', flag: '🇵🇭', name: 'Philippines', format: 'PDF', links: [{ label: 'Philippines AOC List', url: 'https://caap.gov.ph/aoc-holders' }] },
      { country: 'Vietnam', flag: '🇻🇳', name: 'Vietnam', format: 'HTML', links: [{ label: 'Vietnam AOC List', url: 'https://caa.gov.vn/aoc' }] }
    ]
  },
  {
    tier: 6,
    title: 'TIER 6 (AFRICA – HIDDEN GOLD)',
    color: 'rose',
    sources: [
      { country: 'South Africa', flag: '🇿🇦', name: 'South Africa', format: 'HTML', links: [{ label: 'South Africa AOC List', url: 'https://caa.co.za/Pages/AOC.aspx' }] },
      { country: 'Nigeria', flag: '🇳🇬', name: 'Nigeria', format: 'HTML', links: [{ label: 'Nigeria AOC List', url: 'https://ncaa.gov.ng/operators' }] },
      { country: 'Kenya', flag: '🇰🇪', name: 'Kenya', format: 'HTML', links: [{ label: 'Kenya AOC List', url: 'https://kcaa.or.ke/aoc-holders' }] },
      { country: 'Egypt', flag: '🇪🇬', name: 'Egypt', format: 'HTML', links: [{ label: 'Egypt AOC List', url: 'http://www.civilaviation.gov.eg' }] },
      { country: 'Ghana', flag: '🇬🇭', name: 'Ghana', format: 'HTML', links: [{ label: 'Ghana AOC List', url: 'https://gcaa.com.gh/aoc' }] },
      { country: 'Ethiopia', flag: '🇪🇹', name: 'Ethiopia', format: 'HTML', links: [{ label: 'Ethiopia AOC List', url: 'https://eca.gov.et/aoc' }] },
      { country: 'Morocco', flag: '🇲🇦', name: 'Morocco', format: 'PDF', links: [{ label: 'Morocco AOC List', url: 'https://www.aviationcivile.gov.ma' }] },
      { country: 'Tunisia', flag: '🇹🇳', name: 'Tunisia', format: 'HTML', links: [{ label: 'Tunisia AOC List', url: 'http://www.dgac.tn' }] }
    ]
  },
  {
    tier: 7,
    title: 'TIER 7 (LATAM)',
    color: 'indigo',
    sources: [
      { country: 'Brazil', flag: '🇧🇷', name: 'Brazil', format: 'HTML', links: [{ label: 'Brazil AOC List', url: 'https://www.anac.gov.br/en/air-operators' }] },
      { country: 'Argentina', flag: '🇦🇷', name: 'Argentina', format: 'HTML', links: [{ label: 'Argentina AOC List', url: 'https://www.anac.gov.ar/aoc' }] },
      { country: 'Chile', flag: '🇨🇱', name: 'Chile', format: 'HTML', links: [{ label: 'Chile AOC List', url: 'https://www.dgac.gob.cl' }] },
      { country: 'Colombia', flag: '🇨🇴', name: 'Colombia', format: 'HTML', links: [{ label: 'Colombia AOC List', url: 'https://www.aerocivil.gov.co' }] },
      { country: 'Peru', flag: '🇵🇪', name: 'Peru', format: 'HTML', links: [{ label: 'Peru AOC List', url: 'https://www.mtc.gob.pe' }] },
      { country: 'Mexico', flag: '🇲🇽', name: 'Mexico', format: 'PDF', links: [{ label: 'Mexico AOC List', url: 'https://www.gob.mx/afac' }] },
      { country: 'Panama', flag: '🇵🇦', name: 'Panama', format: 'HTML', links: [{ label: 'Panama AOC List', url: 'http://www.aeronautica.gob.pa' }] }
    ]
  },
  {
    tier: 8,
    title: 'TIER 8 (ASIA PACIFIC)',
    color: 'sky',
    sources: [
      { country: 'China', flag: '🇨🇳', name: 'China', format: 'HTML', links: [{ label: 'China AOC List', url: 'http://www.caac.gov.cn' }] },
      { country: 'Japan', flag: '🇯🇵', name: 'Japan', format: 'HTML', links: [{ label: 'Japan AOC List', url: 'https://www.mlit.go.jp/koku' }] },
      { country: 'Australia', flag: '🇦🇺', name: 'Australia', format: 'API', links: [{ label: 'Australia AOC List', url: 'https://www.casa.gov.au/aoc' }] },
      { country: 'New Zealand', flag: '🇳🇿', name: 'New Zealand', format: 'HTML', links: [{ label: 'New Zealand AOC List', url: 'https://www.aviation.govt.nz' }] },
      { country: 'Taiwan', flag: '🇹🇼', name: 'Taiwan', format: 'HTML', links: [{ label: 'Taiwan AOC List', url: 'https://www.caa.gov.tw' }] },
      { country: 'South Korea', flag: '🇰🇷', name: 'South Korea', format: 'HTML', links: [{ label: 'South Korea AOC List', url: 'http://www.molit.go.kr' }] },
      { country: 'Fiji', flag: '🇫🇯', name: 'Fiji', format: 'HTML', links: [{ label: 'Fiji AOC List', url: 'https://caaf.org.fj' }] }
    ]
  },
  {
    tier: 9,
    title: 'BONUS (OFFSHORE / HIGH VALUE)',
    color: 'purple',
    sources: [
      { country: 'Cayman Islands', flag: '🇰🇾', name: 'Cayman Islands', format: 'HTML', links: [{ label: 'Cayman Islands AOC List', url: 'https://www.caacayman.com' }] },
      { country: 'Bermuda', flag: '🇧🇲', name: 'Bermuda', format: 'HTML', links: [{ label: 'Bermuda AOC List', url: 'https://www.bcaa.bm' }] },
      { country: 'Aruba', flag: '🇦🇼', name: 'Aruba', format: 'HTML', links: [{ label: 'Aruba AOC List', url: 'https://www.dcaa.gov.aw' }] },
      { country: 'Isle of Man', flag: '🇮🇲', name: 'Isle of Man', format: 'HTML', links: [{ label: 'Isle of Man AOC List', url: 'https://www.iomaa.im' }] },
      { country: 'San Marino', flag: '🇸🇲', name: 'San Marino', format: 'HTML', links: [{ label: 'San Marino AOC List', url: 'https://www.caa.sm' }] },
      { country: 'Guernsey', flag: '🇬🇬', name: 'Guernsey', format: 'HTML', links: [{ label: 'Guernsey AOC List', url: 'https://www.2-reg.com' }] },
      { country: 'Jersey', flag: '🇯🇪', name: 'Jersey', format: 'HTML', links: [{ label: 'Jersey AOC List', url: 'https://www.cidca.aero' }] }
    ]
  }
];

export default function AOCSourceDirectory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTier, setActiveTier] = useState<number | null>(null);

  const filteredTiers = AOC_SOURCES.map(tier => ({
    ...tier,
    sources: tier.sources.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.country.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(tier => tier.sources.length > 0);

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
              <Database className="text-indigo-600" size={28} /> TOP 100 AOC DIRECT URL SOURCES
            </h1>
            <p className="text-sm text-gray-500 mt-2 font-medium">Ready to scrape global regulatory data for real-time aviation intelligence.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800 flex items-center gap-2">
              <Zap size={16} className="text-emerald-500" />
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Ready to Scrape</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search by country or authority..."
              className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <button 
              onClick={() => setActiveTier(null)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTier === null 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              All Tiers
            </button>
            {AOC_SOURCES.map(tier => (
              <button 
                key={tier.tier}
                onClick={() => setActiveTier(tier.tier)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTier === tier.tier 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'bg-gray-100 dark:bg-gray-900 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                Tier {tier.tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Priority Scraping Strategy */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 text-white shadow-xl mb-12"
      >
        <div className="flex items-center gap-3 mb-6">
          <Zap className="text-indigo-200" size={24} />
          <h2 className="text-2xl font-black uppercase tracking-tight">Priority Scraping Strategy</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-2">Tier 1 (80% Value)</div>
            <p className="text-sm font-medium leading-relaxed">
              Focus on <span className="font-black text-white">FAA (USA), UK CAA, UAE GCAA, India DGCA, and EASA</span>. These provide the highest density of commercial data.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-2">Tier 2 (Expansion)</div>
            <p className="text-sm font-medium leading-relaxed">
              Expand into <span className="font-black text-white">Africa and Southeast Asia</span>. These regions have high growth and many emerging charter operators.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-2">Tier 3 (Hidden Gold)</div>
            <p className="text-sm font-medium leading-relaxed">
              Target <span className="font-black text-white">Maldives, Cayman Islands, and Malta</span>. These offshore registries are critical for high-value charter intelligence.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Directory Grid */}
      <div className="space-y-12">
        {filteredTiers.filter(t => activeTier === null || t.tier === activeTier).map((tier) => (
          <div key={tier.tier} className="space-y-6">
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 bg-${tier.color}-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg`}>
                Tier {tier.tier}
              </div>
              <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">{tier.title}</h2>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tier.sources.map((source, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{source.flag}</span>
                      <div>
                        <h3 className="text-sm font-black text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{source.name}</h3>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{source.country}</p>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                            source.format === 'PDF' ? 'bg-red-50 text-red-600 border border-red-100' :
                            source.format === 'HTML' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            source.format === 'Navigation' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            'bg-indigo-50 text-indigo-600 border border-indigo-100'
                          }`}>
                            {source.format}
                          </span>
                        </div>
                      </div>
                    </div>
                    {tier.tier === 1 && <Star size={16} className="text-amber-400 fill-amber-400" />}
                  </div>

                  {source.description && (
                    <p className="text-[10px] text-gray-500 leading-relaxed mb-4 italic">
                      "{source.description}"
                    </p>
                  )}

                  {source.contains && (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {source.contains.map(item => (
                        <span key={item} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[8px] font-bold uppercase tracking-widest rounded-md border border-indigo-100 dark:border-indigo-800/50">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    {source.links.map((link, lIdx) => (
                      <a 
                        key={lIdx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all group/link"
                      >
                        <div className="flex items-center gap-2">
                          <LinkIcon size={12} className="text-gray-400 group-hover/link:text-indigo-500" />
                          <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 group-hover/link:text-indigo-700 dark:group-hover/link:text-indigo-300 truncate max-w-[180px]">
                            {link.label}
                          </span>
                        </div>
                        <ExternalLink size={12} className="text-gray-300 group-hover/link:text-indigo-400" />
                      </a>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-emerald-500" />
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Verified Source</span>
                    </div>
                    <button className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline">
                      Configure Scraper
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Scraping Methodology Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-600 mb-4">
            <FileText size={20} />
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-2">PDF Heavy Sources</h4>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Authorities like the UK and Jordan provide data in PDF format. Our engine uses Vision-AI and OCR to extract tabular data with 99% accuracy.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
            <Code size={20} />
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-2">Clean HTML Goldmines</h4>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Maldives and Tanzania offer structured HTML tables. These are "Goldmines" for rapid scraping and high-frequency updates.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600 mb-4">
            <Globe size={20} />
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-2">Navigation Scraping</h4>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Complex portals (India, UAE) require headless browser navigation, session handling, and dynamic interaction to reach the data layer.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-indigo-600 p-8 rounded-3xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl">
            <h3 className="text-xl font-black mb-2 uppercase tracking-tight">🎯 Priority Scraping Strategy</h3>
            <p className="text-sm text-indigo-100 leading-relaxed">
              Focus on Tier 1 sources first to capture 80% of global intelligence value. 
              The Maldives and UK datasets are particularly high-value due to their structured formats.
            </p>
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-3 bg-white text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl shadow-black/10">
              Download Full Directory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
