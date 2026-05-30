import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as d3 from 'd3';

interface MonthlyMROForecast {
  month: string;
  projectedHours: number;
  reserveCost: number;
  scheduledCheckCost: number;
  componentOverhaulCost: number;
  totalCost: number;
  scheduledEvents: string[];
}

interface MROForecastD3ChartProps {
  data: MonthlyMROForecast[];
  selectedMonth: string | null;
  onSelectMonth: (month: string | null) => void;
}

export default function MROForecastD3Chart({ data, selectedMonth, onSelectMonth }: MROForecastD3ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 280 });
  const [hoveredData, setHoveredData] = useState<{
    month: string;
    reserveCost: number;
    scheduledCheckCost: number;
    componentOverhaulCost: number;
    totalCost: number;
    events: string[];
    x: number;
    y: number;
  } | null>(null);

  // ResizeObserver setup for fluid responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(width, 300),
        height: Math.max(height, 280)
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Main D3 Rendering Effect for Stacked Area Chart
  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous layouts

    const margin = { top: 25, right: 20, bottom: 40, left: 60 };
    const chartWidth = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;

    // Define keys for stack
    const keys = ['reserveCost', 'scheduledCheckCost', 'componentOverhaulCost'];

    // Create stack layout
    const stack = d3.stack<any>()
      .keys(keys);

    const stackedData = stack(data);

    // Setup linear gradients in <defs> for high contrast glowing curves
    const defs = svg.append('defs');

    // 1. Reserves (Blue / Indigo)
    const gradientReserves = defs.append('linearGradient')
      .attr('id', 'grad-reserves')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    gradientReserves.append('stop').attr('offset', '0%').attr('stop-color', '#3B82F6').attr('stop-opacity', 0.55);
    gradientReserves.append('stop').attr('offset', '100%').attr('stop-color', '#3B82F6').attr('stop-opacity', 0.05);

    // 2. Scheduled Check Spikes (Amber)
    const gradientChecks = defs.append('linearGradient')
      .attr('id', 'grad-checks')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    gradientChecks.append('stop').attr('offset', '0%').attr('stop-color', '#F59E0B').attr('stop-opacity', 0.6);
    gradientChecks.append('stop').attr('offset', '100%').attr('stop-color', '#F59E0B').attr('stop-opacity', 0.1);

    // 3. Overhauls (Red / Rose)
    const gradientOverhauls = defs.append('linearGradient')
      .attr('id', 'grad-overhauls')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    gradientOverhauls.append('stop').attr('offset', '0%').attr('stop-color', '#EF4444').attr('stop-opacity', 0.65);
    gradientOverhauls.append('stop').attr('offset', '100%').attr('stop-color', '#EF4444').attr('stop-opacity', 0.15);

    // Mappings for fills and stroke definitions
    const fillColors = d3.scaleOrdinal<string>()
      .domain(keys)
      .range(['url(#grad-reserves)', 'url(#grad-checks)', 'url(#grad-overhauls)']);

    const strokeColors = d3.scaleOrdinal<string>()
      .domain(keys)
      .range(['#3B82F6', '#F59E0B', '#EF4444']);

    // Set Point scale for clean categorical distribution matching month margins
    const x = d3.scalePoint<string>()
      .domain(data.map(d => d.month))
      .range([0, chartWidth]);

    // Max accumulated sum
    const maxVal = d3.max(data, d => d.reserveCost + d.scheduledCheckCost + d.componentOverhaulCost) || 120000;
    
    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.1]) // 10% buffer for visual safety room
      .nice()
      .range([chartHeight, 0]);

    // Main Group Container
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Add Highlight Column rect for selected month
    if (selectedMonth) {
      const selectedX = x(selectedMonth);
      if (selectedX !== undefined) {
        // Calculate dynamic width of columns based on margins
        const itemWidth = chartWidth / (data.length - 1 || 1);
        g.append('rect')
          .attr('x', selectedX - itemWidth / 2)
          .attr('width', itemWidth)
          .attr('y', 0)
          .attr('height', chartHeight)
          .attr('fill', '#6366F1')
          .attr('opacity', 0.08)
          .attr('rx', 8)
          .attr('pointer-events', 'none');
      }
    }

    // Add clean subtle horizontal gridlines
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(y.ticks(6))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', d => y(d))
      .attr('y2', d => y(d))
      .attr('stroke', '#F3F4F6')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    // Setup responsive Area Generator
    const areaGenerator = d3.area<any>()
      .x(d => x(d.data.month) || 0)
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveMonotoneX); // Smooth interpolation curves

    // Setup corresponding Line Generator for bright glowing contours
    const lineGenerator = d3.line<any>()
      .x(d => x(d.data.month) || 0)
      .y(d => y(d[1]))
      .curve(d3.curveMonotoneX);

    // Bind Stacked Data to Paths
    const layers = g.selectAll('.area-layer')
      .data(stackedData)
      .enter()
      .append('g')
      .attr('class', 'area-layer');

    // Render Filled Areas
    layers.append('path')
      .attr('d', areaGenerator)
      .attr('fill', d => fillColors(d.key))
      .attr('class', 'transition-all duration-300');

    // Render Contour Strokes
    layers.append('path')
      .attr('d', lineGenerator)
      .attr('fill', 'none')
      .attr('stroke', d => strokeColors(d.key))
      .attr('stroke-width', 2);

    // Horizontal Baseline
    g.append('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', chartHeight)
      .attr('y2', chartHeight)
      .attr('stroke', '#E5E7EB')
      .attr('stroke-width', 1.5);

    // Glowing alert dots representing weeks containing complex event markers
    data.forEach(d => {
      if (d.scheduledEvents && d.scheduledEvents.length > 0) {
        const dotX = x(d.month) || 0;
        const totalTopY = y(d.reserveCost + d.scheduledCheckCost + d.componentOverhaulCost);

        g.append('circle')
          .attr('cx', dotX)
          .attr('cy', totalTopY)
          .attr('r', 5)
          .attr('fill', '#EF4444')
          .attr('stroke', '#FFFFFF')
          .attr('stroke-width', 1.5)
          .attr('class', 'animate-pulse');
      }
    });

    // Render interactive clean axes
    const xAxisLabel = d3.axisBottom(x)
      .tickSize(0)
      .tickPadding(12);

    g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(xAxisLabel)
      .call(g => g.select('.domain').remove())
      .selectAll('text')
      .attr('class', 'text-[10px] font-semibold text-gray-400')
      .style('fill', '#9CA3AF');

    const yAxisLabel = d3.axisLeft(y)
      .ticks(5)
      .tickSize(0)
      .tickPadding(8)
      .tickFormat(val => `$${Number(val) / 1000}k`);

    g.append('g')
      .call(yAxisLabel)
      .call(g => g.select('.domain').remove())
      .selectAll('text')
      .attr('class', 'text-[10px] font-semibold text-gray-400')
      .style('fill', '#9CA3AF');

    // Vertical hover guide line element
    const hoverLine = g.append('line')
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', '#6366F1')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4')
      .style('opacity', 0)
      .attr('pointer-events', 'none');

    // Transparent interactive event tracing overlay
    const overlay = g.append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .attr('fill', 'transparent')
      .attr('class', 'cursor-crosshair');

    overlay.on('mousemove', function(event) {
      const [mx] = d3.pointer(event);
      const domain = x.domain();
      const length = domain.length;
      
      // Calculate closest point on scale index mapping
      const step = chartWidth / (length - 1 || 1);
      const index = Math.round(mx / step);
      const clampedIndex = Math.max(0, Math.min(length - 1, index));
      const hoveredMonth = domain[clampedIndex];
      const d = data.find(item => item.month === hoveredMonth);

      if (d) {
        const cx = x(d.month) || 0;
        
        // Match mouse focus pointer position
        hoverLine
          .attr('x1', cx)
          .attr('x2', cx)
          .style('opacity', 1);

        const [globalX, globalY] = d3.pointer(event, svgRef.current);
        setHoveredData({
          month: d.month,
          reserveCost: d.reserveCost,
          scheduledCheckCost: d.scheduledCheckCost,
          componentOverhaulCost: d.componentOverhaulCost,
          totalCost: d.totalCost,
          events: d.scheduledEvents,
          x: globalX,
          y: globalY
        });
      }
    });

    overlay.on('mouseout', () => {
      hoverLine.style('opacity', 0);
      setHoveredData(null);
    });

    overlay.on('click', function(event) {
      const [mx] = d3.pointer(event);
      const domain = x.domain();
      const step = chartWidth / (domain.length - 1 || 1);
      const index = Math.round(mx / step);
      const clampedIndex = Math.max(0, Math.min(domain.length - 1, index));
      const hoveredMonth = domain[clampedIndex];
      onSelectMonth(selectedMonth === hoveredMonth ? null : hoveredMonth);
    });

  }, [data, dimensions, selectedMonth, onSelectMonth]);

  const formatCur = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(num);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative" id="d3-mro-forecast-chart">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="overflow-visible" />

      {/* Dynamic Hover Tooltip with exact breakdown */}
      <AnimatePresence>
        {hoveredData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              left: hoveredData.x + 15,
              top: hoveredData.y - 100,
            }}
            className="absolute z-50 bg-gray-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl text-left border border-gray-800 text-[11px] min-w-[200px] pointer-events-none"
          >
            <p className="font-extrabold text-[12px] text-indigo-400 tracking-wide mb-1.5 uppercase font-mono">
              {hoveredData.month}
            </p>
            <div className="space-y-1">
              <div className="flex justify-between gap-4 font-sans text-gray-400">
                <span>Hourly Reserves:</span>
                <span className="font-semibold text-white">{formatCur(hoveredData.reserveCost)}</span>
              </div>
              <div className="flex justify-between gap-4 font-sans text-amber-400">
                <span>Checks (A/B/C):</span>
                <span className="font-bold text-white">+{formatCur(hoveredData.scheduledCheckCost)}</span>
              </div>
              <div className="flex justify-between gap-4 font-sans text-rose-400">
                <span>Major Overhauls:</span>
                <span className="font-bold text-white">+{formatCur(hoveredData.componentOverhaulCost)}</span>
              </div>
              <div className="border-t border-gray-800 my-1 pt-1 flex justify-between gap-4 font-bold text-gray-200">
                <span>Total Budget:</span>
                <span className="text-emerald-400">{formatCur(hoveredData.totalCost)}</span>
              </div>
            </div>

            {hoveredData.events.length > 0 && (
              <div className="mt-2 pt-1.5 border-t border-gray-800">
                <p className="text-[9px] font-black uppercase text-rose-400 tracking-wider mb-0.5">Alerts & Projections</p>
                <div className="space-y-0.5 text-[9.5px] leading-tight text-gray-300 font-sans italic">
                  {hoveredData.events.map((evt, i) => (
                    <div key={i}>• {evt}</div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
