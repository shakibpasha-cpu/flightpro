import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // ==========================================
  // API Endpoints (MVP Backend)
  // ==========================================
  const apiRouter = express.Router();

  // 1. Health Check
  apiRouter.get('/health', (req, res) => {
    res.json({ status: 'operational', version: '1.0.0', environment: process.env.NODE_ENV || 'development' });
  });

  // 2. Flight Planning Engine (Placeholder for PostGIS/Python integration)
  apiRouter.post('/flights/plan', async (req, res) => {
    const { departure, destination, aircraft_id, optimization } = req.body;
    
    // In a production environment, this would:
    // 1. Query PostGIS for great circle distance and restricted airspaces
    // 2. Call Aviationstack for live weather
    // 3. Call OpenSky for live traffic
    // 4. Use Gemini API for complex routing logic
    
    res.json({
      status: 'success',
      message: 'Flight plan generated successfully',
      data: {
        route: `${departure} -> ${destination}`,
        optimization_strategy: optimization || 'balanced',
        estimated_cost: 45000,
        currency: 'USD',
        legs: []
      }
    });
  });

  // 3. Costing Engine
  apiRouter.post('/costing/calculate', async (req, res) => {
    const { route_id, fuel_price_override } = req.body;
    res.json({
      status: 'success',
      breakdown: {
        fuel: 12000,
        handling: 1500,
        navigation: 800,
        overflight: 2500,
        landing: 1200,
        total: 18000
      }
    });
  });

  // 4. Live Weather & NOTAMs (Proxy to external APIs)
  apiRouter.get('/weather/:icao', async (req, res) => {
    const { icao } = req.params;
    res.json({
      airport: icao,
      metar: `METAR ${icao} 181200Z 24015KT 9999 FEW030 25/15 Q1012 NOSIG`,
      notams: [
        { id: 'A1234/26', description: 'RWY 09/27 CLSD WIP' }
      ]
    });
  });

  // Mount API Router
  app.use('/api/v1', apiRouter);

  // ==========================================
  // Vite Middleware (Frontend Serving)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AeroOps API] Server running on http://localhost:${PORT}`);
    console.log(`[AeroOps API] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(console.error);
