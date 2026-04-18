export const REAL_WORLD_ACMI_RATES = [
  {
    type: 'A319',
    category: 'Narrowbody',
    manufacturer: 'Airbus',
    acmiRateRange: { min: 2200, max: 3200 },
    fuelBurnPerHour: 2200,
    seats: { min: 120, max: 140 },
    rangeKm: 6900
  },
  {
    type: 'A320',
    category: 'Narrowbody',
    manufacturer: 'Airbus',
    acmiRateRange: { min: 2800, max: 4200 },
    fuelBurnPerHour: 2500,
    seats: { min: 150, max: 180 },
    rangeKm: 6100
  },
  {
    type: 'A321',
    category: 'Narrowbody',
    manufacturer: 'Airbus',
    acmiRateRange: { min: 3500, max: 5200 },
    fuelBurnPerHour: 2900,
    seats: { min: 180, max: 220 },
    rangeKm: 7400
  },
  {
    type: 'B737-700',
    category: 'Narrowbody',
    manufacturer: 'Boeing',
    acmiRateRange: { min: 2500, max: 3800 },
    fuelBurnPerHour: 2400,
    seats: { min: 130, max: 150 },
    rangeKm: 6200
  },
  {
    type: 'B737-800',
    category: 'Narrowbody',
    manufacturer: 'Boeing',
    acmiRateRange: { min: 3000, max: 4500 },
    fuelBurnPerHour: 2600,
    seats: { min: 160, max: 189 },
    rangeKm: 5800
  },
  {
    type: 'B737-900',
    category: 'Narrowbody',
    manufacturer: 'Boeing',
    acmiRateRange: { min: 3800, max: 5500 },
    fuelBurnPerHour: 2900,
    seats: { min: 180, max: 220 },
    rangeKm: 5900
  },
  {
    type: 'A330-200',
    category: 'Widebody',
    manufacturer: 'Airbus',
    acmiRateRange: { min: 6000, max: 8500 },
    fuelBurnPerHour: 5500,
    seats: { min: 250, max: 270 },
    rangeKm: 13400
  },
  {
    type: 'A330-300',
    category: 'Widebody',
    manufacturer: 'Airbus',
    acmiRateRange: { min: 7000, max: 9500 },
    fuelBurnPerHour: 6000,
    seats: { min: 280, max: 300 },
    rangeKm: 11700
  },
  {
    type: 'B767-300',
    category: 'Widebody',
    manufacturer: 'Boeing',
    acmiRateRange: { min: 5500, max: 8000 },
    fuelBurnPerHour: 5200,
    seats: { min: 218, max: 269 },
    rangeKm: 12200
  },
  {
    type: 'B777-200',
    category: 'Widebody',
    manufacturer: 'Boeing',
    acmiRateRange: { min: 9000, max: 13000 },
    fuelBurnPerHour: 7500,
    seats: { min: 300, max: 350 },
    rangeKm: 15800
  },
  {
    type: 'B787-8',
    category: 'Widebody',
    manufacturer: 'Boeing',
    acmiRateRange: { min: 8000, max: 11500 },
    fuelBurnPerHour: 5800,
    seats: { min: 240, max: 260 },
    rangeKm: 13600
  },
  {
    type: 'B737-400F',
    category: 'Cargo',
    manufacturer: 'Boeing',
    acmiRateRange: { min: 3500, max: 5000 },
    fuelBurnPerHour: 2800,
    seats: { min: 0, max: 0 },
    payloadKg: 18000,
    rangeKm: 3700
  },
  {
    type: 'B737-800BCF',
    category: 'Cargo',
    manufacturer: 'Boeing',
    acmiRateRange: { min: 4000, max: 6500 },
    fuelBurnPerHour: 3000,
    seats: { min: 0, max: 0 },
    payloadKg: 23000,
    rangeKm: 3900
  },
  {
    type: 'ATR72F',
    category: 'Cargo',
    manufacturer: 'ATR',
    acmiRateRange: { min: 1500, max: 2800 },
    fuelBurnPerHour: 1200,
    seats: { min: 0, max: 0 },
    payloadKg: 8000,
    rangeKm: 1500
  },
  {
    type: 'A321P2F',
    category: 'Cargo',
    manufacturer: 'Airbus',
    acmiRateRange: { min: 5500, max: 8000 },
    fuelBurnPerHour: 3200,
    seats: { min: 0, max: 0 },
    payloadKg: 27000,
    rangeKm: 4000
  },
  {
    type: 'B757F',
    category: 'Cargo',
    manufacturer: 'Boeing',
    acmiRateRange: { min: 6500, max: 9500 },
    fuelBurnPerHour: 4500,
    seats: { min: 0, max: 0 },
    payloadKg: 32000,
    rangeKm: 5800
  },
  {
    type: 'B767-300F',
    category: 'Cargo',
    manufacturer: 'Boeing',
    acmiRateRange: { min: 8000, max: 12000 },
    fuelBurnPerHour: 6000,
    seats: { min: 0, max: 0 },
    payloadKg: 52000,
    rangeKm: 6000
  },
  {
    type: 'B777F',
    category: 'Cargo',
    manufacturer: 'Boeing',
    acmiRateRange: { min: 10000, max: 16000 },
    fuelBurnPerHour: 8500,
    seats: { min: 0, max: 0 },
    payloadKg: 102000,
    rangeKm: 9000
  },
  {
    type: 'Gulfstream G450',
    category: 'VIP/Private',
    manufacturer: 'Gulfstream',
    acmiRateRange: { min: 5500, max: 8000 },
    fuelBurnPerHour: 1200,
    seats: { min: 12, max: 16 },
    rangeKm: 8000
  },
  {
    type: 'Gulfstream G650',
    category: 'VIP/Private',
    manufacturer: 'Gulfstream',
    acmiRateRange: { min: 8000, max: 12000 },
    fuelBurnPerHour: 1500,
    seats: { min: 14, max: 18 },
    rangeKm: 12000
  },
  {
    type: 'Global 6000',
    category: 'VIP/Private',
    manufacturer: 'Bombardier',
    acmiRateRange: { min: 7500, max: 11000 },
    fuelBurnPerHour: 1400,
    seats: { min: 12, max: 16 },
    rangeKm: 11000
  }
];
