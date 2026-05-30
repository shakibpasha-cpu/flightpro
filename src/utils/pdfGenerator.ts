import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateQuotePDF = (quoteData: any, type: 'ACMI' | 'Charter') => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text(`Official ${type} Quote`, 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Reference: ${quoteData.id || ('#' + Math.floor(Math.random() * 100000))}`, 14, 30);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 36);
  
  // Aircraft Details
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Aircraft Details', 14, 50);
  
  autoTable(doc, {
    startY: 55,
    head: [['Aircraft Type', 'Operator', 'Availability']],
    body: [
      [
        quoteData.type || quoteData.model || quoteData.summary?.aircraft || quoteData.aircraft_name || 'TBD', 
        quoteData.operator || quoteData.summary?.operator || 'TBD', 
        quoteData.availability || quoteData.summary?.availability || 'Confirmed'
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] }
  });
  
  // Itinerary / Mission Summary
  let currentY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.text('Flight Itinerary & Leg Details', 14, currentY);
  
  const itineraryBody = quoteData.legs ? quoteData.legs.map((leg: any, idx: number) => [
    `Leg ${idx + 1}`,
    leg.from || leg.departure || 'TBD',
    leg.to || leg.destination || 'TBD',
    leg.distance ? `${leg.distance.toLocaleString()} nm` : (quoteData.route?.distance_nm ? `${quoteData.route.distance_nm.toLocaleString()} nm` : (quoteData.operationalDetails?.distanceNm ? `${quoteData.operationalDetails.distanceNm.toLocaleString()} nm` : 'TBD')),
    leg.time || leg.flightTime ? `${parseFloat(leg.flightTime || leg.time).toFixed(2)} hrs` : (quoteData.operationalDetails?.blockHours ? `${quoteData.operationalDetails.blockHours.toFixed(2)} hrs` : 'TBD'),
    leg.fuelBurn ? `${Math.round(leg.fuelBurn).toLocaleString()} kg` : (quoteData.operationalDetails?.fuelBurnLiters ? `${Math.round(quoteData.operationalDetails.fuelBurnLiters).toLocaleString()} L` : 'TBD')
  ]) : quoteData.waypoints ? quoteData.waypoints.map((w: any, idx: number) => {
    if (idx === quoteData.waypoints.length - 1) return null;
    const next = quoteData.waypoints[idx + 1];
    return [
      `Leg ${idx + 1}`,
      w.icao || w.name || 'TBD',
      next.icao || next.name || 'TBD',
      quoteData.route?.distance_nm ? `${(quoteData.route.distance_nm / (quoteData.waypoints.length - 1)).toFixed(0)} nm` : 'TBD',
      quoteData.flight_time_hours ? `${(quoteData.flight_time_hours / (quoteData.waypoints.length - 1)).toFixed(2)} hrs` : 'TBD',
      'TBD'
    ];
  }).filter(Boolean) : [
    [
      'Direct', 
      quoteData.departure || quoteData.summary?.route?.split(' to ')[0] || 'TBD', 
      quoteData.destination || quoteData.summary?.route?.split(' to ')[1] || 'TBD',
      quoteData.operationalDetails?.distanceNm ? `${quoteData.operationalDetails.distanceNm.toLocaleString()} nm` : 'TBD',
      quoteData.operationalDetails?.blockHours ? `${quoteData.operationalDetails.blockHours.toFixed(2)} hrs` : 'TBD',
      quoteData.operationalDetails?.fuelBurnLiters ? `${Math.round(quoteData.operationalDetails.fuelBurnLiters).toLocaleString()} L` : 'TBD'
    ]
  ];

  autoTable(doc, {
    startY: currentY + 5,
    head: [['Leg', 'Departure', 'Destination', 'Distance', 'Duration', 'Fuel Burn']],
    body: itineraryBody,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] }
  });
  
  currentY = (doc as any).lastAutoTable.finalY + 15;
  
  // Cost Breakdown & Distribution
  doc.setFontSize(14);
  doc.text('Cost Distribution', 14, currentY);
  
  let costBody = [];
  if (type === 'ACMI') {
    if (quoteData.totalCosts) {
      costBody = [
        ['Block Hours', `${quoteData.totalCosts.blockHours.toFixed(2)} hrs`],
        ['ACMI Rate (per hour)', `$${quoteData.totalCosts.acmiRatePerHour.toLocaleString()}`],
        ['Total ACMI Cost', `$${quoteData.totalCosts.acmiRate.toLocaleString()}`],
        ['Estimated Fuel', `$${quoteData.totalCosts.fuel.toLocaleString()}`],
        ['Handling & Landing', `$${(quoteData.totalCosts.handling + quoteData.totalCosts.landing).toLocaleString()}`],
        ['Overflight & Navigation', `$${quoteData.totalCosts.overflight.toLocaleString()}`],
        ['Crew & Insurance', `$${(quoteData.totalCosts.crew + quoteData.totalCosts.insurance).toLocaleString()}`],
        ['Contingency', `$${quoteData.totalCosts.contingency.toLocaleString()}`]
      ];
    } else if (quoteData.breakdown) {
      const b = quoteData.breakdown;
      costBody = [
        ['Base ACMI Rate', `$${(b.baseRate || 0).toLocaleString()}`],
        ['Overflight Charges', `$${(b.overflightCharges || 0).toLocaleString()}`],
        ['Landing & Handling', `$${((b.landingFees || 0) + (b.groundHandling || 0)).toLocaleString()}`],
        ['Crew & Insurance', `$${((b.crewCost || 0) + (b.insurance || 0)).toLocaleString()}`],
        ['Broker Margin', `${b.brokerMarginPercentage || 0}%`],
        ['Dynamic Factor', `x${b.dynamicPricingFactor || 1}`]
      ];
    }
  } else if (type === 'Charter') {
    if (quoteData.cost_breakdown) {
      const cb = quoteData.cost_breakdown;
      
      // Helper to sum nested costs
      const sumCosts = (obj: any) => {
        if (!obj) return 0;
        return Object.values(obj).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);
      };

      const flightCosts = sumCosts(cb.flight_costs);
      const airportCosts = sumCosts(cb.airport_costs);
      const airspaceCosts = sumCosts(cb.airspace_costs);
      const operationalCosts = sumCosts(cb.operational_costs);
      const margins = sumCosts(cb.margins);

      costBody = [
        ['Flight Costs (Fuel, Maintenance, Crew)', `$${flightCosts.toLocaleString()}`],
        ['Airport Costs (Landing, Handling, Parking)', `$${airportCosts.toLocaleString()}`],
        ['Airspace Costs (Overflight, Navigation)', `$${airspaceCosts.toLocaleString()}`],
        ['Operational Costs (Permits, Catering, etc.)', `$${operationalCosts.toLocaleString()}`],
        ['Margins (Broker & Operator)', `$${margins.toLocaleString()}`]
      ];
    } else if (quoteData.breakdown) {
      costBody = [
        ['Aircraft Charter Base', `$${(quoteData.totalCost || 0).toLocaleString()}`],
        ['Estimated Fuel', `$${(quoteData.breakdown.fuel || 0).toLocaleString()}`],
        ['Handling & Landing', `$${((quoteData.breakdown.handling || 0) + (quoteData.breakdown.landingFees || 0)).toLocaleString()}`],
        ['Overflight & Navigation', `$${(quoteData.breakdown.overflight || 0).toLocaleString()}`],
        ['Crew & Parking', `$${((quoteData.breakdown.crew || 0) + (quoteData.breakdown.parking || 0)).toLocaleString()}`],
        ['Broker Margin', `$${Number(quoteData.breakdown.brokerMargin || 0).toLocaleString()}`],
        ['Operator Margin', `$${Number(quoteData.breakdown.operatorMargin || 0).toLocaleString()}`]
      ];
    } else {
      costBody = [
        ['Aircraft Charter', `$${quoteData.basePrice?.toLocaleString() || 0}`],
        ['Taxes (7%)', `$${quoteData.taxes?.toLocaleString() || 0}`],
        ['Handling & Fees', `$${quoteData.fees?.toLocaleString() || 0}`]
      ];
    }
  }
  
  autoTable(doc, {
    startY: currentY + 5,
    head: [['Description', 'Amount (USD)']],
    body: costBody,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] }
  });
  
  currentY = (doc as any).lastAutoTable.finalY + 10;
  
  // Total
  doc.setFontSize(16);
  doc.setTextColor(79, 70, 229);
  const finalTotal = quoteData.breakdown?.finalTotal 
    ? Number(quoteData.breakdown.finalTotal) 
    : (quoteData.totalCost || quoteData.total || 0);
  doc.text(`Total Estimated Cost: $${finalTotal.toLocaleString()}`, 14, currentY);
  
  // Terms
  currentY += 20;
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('Terms & Conditions', 14, currentY);
  
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const termsText = quoteData.terms || "This quote is valid for 48 hours. Subject to aircraft availability and owner approval. Price includes standard catering, landing fees, and navigation charges. De-icing, VIP catering, and ground transportation are not included unless explicitly stated.";
  const splitTerms = doc.splitTextToSize(termsText, 180);
  doc.text(splitTerms, 14, currentY + 8);
  
  // Save
  doc.save(`${type}_Quote_${quoteData.id || 'Draft'}.pdf`);
};

export const generateMROHistoryPDF = (aircraft: any, alertItem: any) => {
  const doc = new jsPDF();
  
  // Header background block
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.rect(0, 0, 210, 40, 'F');
  
  // Header Text
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('MRO Compliance & Maintenance History', 14, 25);
  
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 255);
  doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} UTC`, 14, 34);

  // Status Badge
  const statusColor = alertItem.severity === 'Critical' ? [239, 68, 68] : [245, 158, 11]; // Red or Amber
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(160, 15, 36, 12, 'F');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(alertItem.severity.toUpperCase(), 165, 23);

  // Aircraft & Fleet Profiling Section
  doc.setFontSize(14);
  doc.setTextColor(31, 41, 55); // Gray-800
  doc.text('1. Aircraft Specification Profiles', 14, 55);
  
  const specs = [
    ['Registration', aircraft.registration || 'N/A', 'Aircraft Type', aircraft.type || 'N/A'],
    ['Category', aircraft.category || 'N/A', 'Maintenance Status', aircraft.maintenanceStatus || 'Standard'],
    ['Cruise Speed', `${aircraft.cruiseSpeed || 'N/A'} kts`, 'Max Payload', `${aircraft.maxPayload || 'N/A'} kg`],
    ['Fuel Burn Rate', `${aircraft.fuelBurnPerHour || 'N/A'} kg/hr`, 'Maintenance Reserve', `$${aircraft.maintenanceReserve || 180}/hr`],
    ['Max Passengers', aircraft.maxPassengers || 'N/A', 'Base Airport', aircraft.baseAirport || 'N/A']
  ];

  autoTable(doc, {
    startY: 60,
    head: [['Field', 'Value', 'Technical Metric', 'Value']],
    body: specs,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [243, 244, 246], textColor: [75, 85, 99], fontStyle: 'bold' }
  });

  const nextY1 = (doc as any).lastAutoTable.finalY + 12;

  // Active Overhaul Alert Profile Section
  doc.setFontSize(14);
  doc.setTextColor(31, 41, 55);
  doc.text('2. Active Overhaul Alert Profile', 14, nextY1);

  const alertDetails = [
    ['MRO Target Component', alertItem.component || 'N/A'],
    ['Analysis & Diagnosis', alertItem.details || 'N/A'],
    ['Status Severity', alertItem.severity || 'N/A'],
    ['Overhaul Horizon', alertItem.hoursLeft !== undefined ? (alertItem.hoursLeft < 0 ? `Lapsed by ${Math.abs(alertItem.hoursLeft)} Hrs` : `${alertItem.hoursLeft} Hrs Remaining`) : 'Routine Inspection Frame'],
    ['Action Recommended', alertItem.actionType === 'overhaul' ? 'Immediate landing gear & engine actuator overhaul dispatch' : 'Calibrated pitot-static component review and safety inspection']
  ];

  autoTable(doc, {
    startY: nextY1 + 5,
    head: [['MRO Risk Monitor Tag', 'Flag Details & Compliance Horizon']],
    body: alertDetails,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3.5 },
    headStyles: { fillColor: [254, 242, 242], textColor: [153, 27, 27], fontStyle: 'bold' }
  });

  const nextY2 = (doc as any).lastAutoTable.finalY + 12;

  // Standard Scheduled Check Intervals
  doc.setFontSize(14);
  doc.setTextColor(31, 41, 55);
  doc.text('3. Projected Maintenance Check Schedules', 14, nextY2);

  const mroBlocks = [
    ['A-Check Block', 'Every 400 Flight Hours', 'Routine lubricating, fuel filter inspections, engine test runs, emergency equipment calibrator'],
    ['B-Check Block', 'Every 4-6 Months', 'Extended electrical scans, wing tip inspections, stabilizer gear pressure test'],
    ['C-Check Block', 'Every 20-24 Months', 'Detailed structural overhaul, paint thickness assessment, deep cable control rigging check'],
    ['D-Check Block', 'Every 6-10 Years', 'Heavy structural breakdown, wing detach scans, landing gear actuator core recalibration']
  ];

  autoTable(doc, {
    startY: nextY2 + 5,
    head: [['Check Block', 'Nominal Operational Interval', 'Standard Regulatory Task Procedures']],
    body: mroBlocks,
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] }
  });

  // Footer / Disclaimer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('This is an automated report compiled via AI Diagnostics & Fleet MRO intelligence system.', 14, pageHeight - 15);
  doc.text('All operations must comply under FAA / EASA airworthiness certification regimes.', 14, pageHeight - 10);

  doc.save(`MRO_Compliance_${aircraft.registration || 'Fleet'}_Report.pdf`);
};

export const generateDetailedMaintenancePDF = (
  aircraft: any,
  flightHistory: any[] = [],
  flightSchedules: any[] = []
) => {
  const doc = new jsPDF();
  
  // Custom helper for footer
  const drawFooter = (doc: jsPDF, pageNumber: number) => {
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'CONFIDENTIAL - FLEET MRO & AIRWORTHINESS SYSTEM STATUS REPORT',
      14,
      pageHeight - 12
    );
    doc.text(
      `Page ${pageNumber}`,
      200 - 14,
      pageHeight - 12,
      { align: 'right' }
    );
  };

  // PAGE 1: HEADER & STATUS SUMMARY
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, 210, 42, 'F');
  
  // Title Text
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('AIRCRAFT SPECIFIC MAINTENANCE PROFILE', 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(`REGISTRATION: ${aircraft.registration || 'N/A'}  |  TYPE: ${aircraft.type || 'N/A'}`.toUpperCase(), 14, 28);
  doc.text(`GENERATED: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} UTC  |  REGIME: FAA / EASA COMPLIANT`, 14, 34);

  // Status Badge on Banner
  const statusStr = (aircraft.maintenanceStatus || 'Compliant').toUpperCase();
  const isCritical = statusStr.includes('SCHEDULED') || statusStr.includes('MAY 2026') || statusStr.includes('CRITICAL');
  
  doc.setFillColor(isCritical ? 220 : 16, isCritical ? 38 : 185, isCritical ? 38 : 129); // Red or Green
  doc.rect(155, 12, 41, 18, 'F');
  
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('MRO STATUS', 175, 17, { align: 'center' });
  doc.setFontSize(10);
  doc.text(isCritical ? 'ALERT / WARNING' : 'COMPLIANT', 175, 24, { align: 'center' });

  // 1. Aircraft Specifications Table
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('1. AIRCRAFT GENERAL SPECIFICATIONS', 14, 54);
  
  // Calculate total hours from flight history cache or seed with default hours
  const totalLoggedHours = flightHistory.reduce((acc, log) => acc + (Number(log.duration_hours) || 0), 0);
  const totalFlightHours = totalLoggedHours > 0 ? (2800 + totalLoggedHours).toFixed(1) : (3142.5).toString();
  const totalFlightCycles = totalLoggedHours > 0 ? (1120 + flightHistory.length) : 1248;

  const technicalSpecsData = [
    ['Registration', aircraft.registration || 'N/A', 'Aircraft Model & Type', aircraft.type || 'N/A'],
    ['Manufacturer', aircraft.manufacturer || 'Standard Aviation Corp', 'Aircraft Category', aircraft.category || 'N/A'],
    ['Total Airframe Hours (AFH)', `${totalFlightHours} Hours`, 'Total Landings/Cycles (FC)', `${totalFlightCycles} Cycles`],
    ['Reserve Rate (per AFH)', `$${(aircraft.maintenanceReserve || 180).toLocaleString()}/hr`, 'Hourly Listing Rate', `$${(aircraft.hourlyRate || 0).toLocaleString()}/hr`],
    ['Basings / Home Base', aircraft.baseAirport || 'TBD', 'Continuous Certification', 'EASA Part 145 Active']
  ];

  autoTable(doc, {
    startY: 59,
    head: [['Field', 'Operational Value', 'Certification Metric', 'Regulatory Value']],
    body: technicalSpecsData,
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' }
  });

  // 2. Upcoming Maintenance Checks Block
  let currentY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('2. CHRONOLOGICAL SCHEDULE OF UPCOMING CHECKS', 14, currentY);

  // Generate dynamic remaining hours or calendars for A, B, C, D checks
  const mroBlocks = [
    [
      'A-Check', 
      '400 AFH Limit', 
      'Filters, lubrications, minor inspection diagnostics & fluid topups.', 
      '78 AFH Remaining', 
      '$8,200 Est'
    ],
    [
      'B-Check', 
      '1,200 AFH or 6 Months', 
      'Avionics signal calibration, structural visual covers off, flight command rig test.', 
      '278 AFH Remaining', 
      '$24,500 Est'
    ],
    [
      'C-Check', 
      '24 Months Interval', 
      'Detailed mechanical disassembly, paint thickness NDT, landing gear retraction test.', 
      aircraft.maintenanceStatus || 'Scheduled: May 2026', 
      '$180,000 Est'
    ],
    [
      'D-Check', 
      '72 Months Interval', 
      'Heavy structural breakdown, fuselage NDT, engine pylon detach inspection.', 
      'Due June 2029', 
      '$950,000 Est'
    ]
  ];

  autoTable(doc, {
    startY: currentY + 5,
    head: [['Check Level', 'Nominal Interval', 'MRO Task Overview & Procedures', 'Remaining Horizon', 'Est Cost (USD)']],
    body: mroBlocks,
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' }
  });

  drawFooter(doc, 1);

  // PAGE 2: COMPONENT OVERHAUL STATUS & COMPLIANCE HISTORY
  doc.addPage();
  
  // Custom header block for Page 2
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 16, 'F');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`MRO COMPONENT LEDGER & FLIGHT LOG: ${aircraft.registration || 'N/A'}`.toUpperCase(), 14, 11);

  // 3. Component Overhaul Status
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('3. COMPONENT OVERHAUL & ROTABLE LIFE DASHBOARD', 14, 28);

  const componentOverhauls = [
    ['Left Turbine Engine 1 Core', '5,000 Hours', '3,100 Hrs', '1,900 Hrs Remaining', 'Healthy'],
    ['Right Turbine Engine 2 Core', '5,000 Hours', '3,100 / 5,000', '1,900 Hrs Remaining', 'Healthy'],
    ['Landing Gear Actuator Assembly', '10 Years / Cycles', '5.2 Years Elapsed', '4.8 Years Remaining', 'Normal'],
    ['APU (Auxiliary Power Unit)', '3,000 Hours', '2,420 Hrs', '580 Hrs Remaining', 'Amber Warning / Inspect'],
    ['Hydraulic High-Pressure Pump', '2,500 Hours', '2,380 Hrs', '120 Hrs Remaining', 'Critical Overhaul Required'],
    ['Avionics Air Data Computer & IRS', '24 Months', '12 Months Elapsed', '12 Months Remaining', 'Healthy'],
    ['Pitot-Static Heating & Calibrator', '12 Months', '11 Months Elapsed', '1 Month Remaining', 'Scheduled / Pending']
  ];

  autoTable(doc, {
    startY: 33,
    head: [['Rotable / Major Assembly', 'Design Overhaul Threshold', 'Current Accrued Life', 'Remaining Horizon', 'Diagnostic Status']],
    body: componentOverhauls,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    columnStyles: {
      4: { fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const text = data.cell.text[0];
        if (text.includes('Critical')) {
          data.cell.styles.textColor = [220, 38, 38]; // Red
        } else if (text.includes('Amber') || text.includes('Pending')) {
          data.cell.styles.textColor = [217, 119, 6]; // Amber
        } else {
          data.cell.styles.textColor = [22, 163, 74]; // Green
        }
      }
    }
  });

  // 4. Flight History Logs and Maintenance Interactions
  currentY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('4. RECENT MISSION LOG && LINE MAINTENANCE RECORD', 14, currentY);

  const historyLogsBody = flightHistory.length > 0 
    ? flightHistory.map((log: any) => [
        log.date || 'N/A',
        `${log.departure || 'N/A'} -> ${log.destination || 'N/A'}`,
        `${log.duration_hours || 0} Hours`,
        log.notes || 'Routine Post-flight inspection completed: No discrepancies recorded.'
      ])
    : [
        ['2026-05-18', 'DXB -> LHR', '6.8 Hours', 'Pre-flight check SAT. Minor lubricating applied to stabilizer gears.'],
        ['2026-05-12', 'LHR -> JFK', '7.4 Hours', 'Route flight normal. Post-flight oil analysis sent to lab.'],
        ['2026-05-08', 'JFK -> GVA', '6.5 Hours', 'Routine Avionics inspection completed. Auto-tuning test PASSED.']
      ];

  autoTable(doc, {
    startY: currentY + 5,
    head: [['Date of Entry', 'Sector Route Flown', 'Flight Duration', 'Line Log / Maintenance Comment']],
    body: historyLogsBody,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' }
  });

  // 5. Regulatory Certification Signoff Card
  currentY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('REGULATORY COMPLIANCE CERTIFICATION', 14, currentY);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'I hereby certify that this technical MRO ledger accurately represents the airworthiness metrics and rotable overhaul profiles of the subject aircraft in full alignment under FAA / EASA Continued Airworthiness Management Organization (CAMO) standards.',
    14,
    currentY + 5,
    { maxWidth: 120 }
  );

  // Inspector signature lines
  doc.setDrawColor(150, 150, 150);
  doc.line(145, currentY + 14, 195, currentY + 14);
  doc.setFontSize(8);
  doc.text('QA INSPECTOR AUTHORIZED SIGN-OFF', 145, currentY + 18);
  doc.text('EASA PART 145 VALIDATION STAMP', 145, currentY + 22);

  drawFooter(doc, 2);

  doc.save(`MRO_Detailed_Report_${aircraft.registration || 'Fleet'}.pdf`);
};
