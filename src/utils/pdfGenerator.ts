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
