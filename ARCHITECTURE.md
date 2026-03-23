# AeroOps AI - Enterprise Architecture Blueprint

This document outlines the professional, aviation-grade architecture for **AeroOps AI**, transitioning from the current MVP to a scalable, multi-tenant SaaS platform.

---

## 1. Full System Architecture

### Tech Stack
*   **Frontend:** Next.js (React 18+), Tailwind CSS, Framer Motion, React-Leaflet (Mapbox tiles).
*   **Backend:** Python (FastAPI) for high-performance, asynchronous API endpoints and data processing. Node.js (Express) can be used as a BFF (Backend-For-Frontend) if SSR/Next.js requires it.
*   **Database:** PostgreSQL with **PostGIS** extension for advanced geospatial calculations (e.g., routing, airspace intersections, radius searches).
*   **Caching & Queue:** Redis (for caching METAR/TAF, NOTAMs, live pricing) and Celery/RabbitMQ for background tasks (e.g., async flight plan generation).
*   **AI Engine:** Google Gemini API (for natural language parsing, complex routing logic, and optimization strategies).
*   **External APIs:**
    *   *Aviationstack / FlightAware:* Live flight tracking and schedules.
    *   *OpenSky Network:* Real-time ADS-B traffic data.
    *   *FAA / Eurocontrol B2B:* Official NOTAMs, restricted airspaces, and routing restrictions.

### Architecture Diagram (Conceptual)
```text
[ Client (Web/Mobile) ]  <-- HTTPS -->  [ Next.js Frontend / CDN ]
                                                |
                                                v
[ API Gateway / Load Balancer (Nginx/AWS ALB) ]
                                                |
        +---------------------------------------+---------------------------------------+
        |                                       |                                       |
[ Auth Service ]                        [ Flight Engine ]                       [ Data Integration ]
(JWT, RBAC)                             (FastAPI, PostGIS)                      (Celery Workers)
        |                                       |                                       |
        v                                       v                                       v
[ PostgreSQL + PostGIS ]                [ Redis Cache ]                         [ External APIs ]
(Users, Fleets, Routes)                 (Weather, Pricing)                      (Aviationstack, Gemini)
```

---

## 2. Database Schema (PostgreSQL + PostGIS)

The database is designed for multi-tenancy (SaaS) and geospatial accuracy.

```sql
-- Core SaaS Tables
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'basic'
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL -- 'admin', 'operator', 'dispatcher'
);

-- Aviation Data
CREATE TABLE airports (
    icao CHAR(4) PRIMARY KEY,
    iata CHAR(3),
    name VARCHAR(255),
    location GEOMETRY(Point, 4326), -- PostGIS Point (Lon, Lat)
    elevation_ft INTEGER,
    runway_length_ft INTEGER,
    has_customs BOOLEAN
);

CREATE TABLE aircraft_types (
    id UUID PRIMARY KEY,
    model VARCHAR(100),
    range_nm INTEGER,
    cruise_speed_kts INTEGER,
    fuel_burn_ph NUMERIC
);

CREATE TABLE fleet (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    type_id UUID REFERENCES aircraft_types(id),
    tail_number VARCHAR(20) UNIQUE,
    hourly_rate NUMERIC
);

-- Flight Operations
CREATE TABLE flights (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    created_by UUID REFERENCES users(id),
    status VARCHAR(50), -- 'draft', 'quoted', 'scheduled', 'completed'
    total_distance_nm NUMERIC,
    total_cost NUMERIC
);

CREATE TABLE flight_legs (
    id UUID PRIMARY KEY,
    flight_id UUID REFERENCES flights(id),
    sequence_number INTEGER,
    dep_icao CHAR(4) REFERENCES airports(icao),
    arr_icao CHAR(4) REFERENCES airports(icao),
    routing_distance_nm NUMERIC,
    flight_time_hrs NUMERIC,
    fuel_burn NUMERIC
);

-- Geospatial Restrictions
CREATE TABLE restricted_airspaces (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    geometry GEOMETRY(Polygon, 4326), -- PostGIS Polygon
    active_from TIMESTAMP,
    active_to TIMESTAMP,
    severity VARCHAR(50)
);
```

---

## 3. API Endpoints (FastAPI / REST)

*   `POST /api/v1/auth/login` - Authenticate user and return JWT.
*   `GET /api/v1/airports?radius=50&lat=X&lng=Y` - PostGIS spatial query to find nearby alternate airports.
*   `POST /api/v1/flights/plan` - Core AI planning engine.
    *   *Payload:* `{ "prompt": "London to NY", "optimization": "cheapest", "passengers": 4 }`
    *   *Response:* Full JSON flight plan (Legs, Costs, Fuel, Safety).
*   `POST /api/v1/costing/calculate` - Calculate precise costs based on live fuel pricing and FIR overflight formulas.
*   `GET /api/v1/weather/{icao}/metar` - Fetch live METAR (cached in Redis for 5 mins).
*   `GET /api/v1/safety/notams?route_id=123` - Fetch NOTAMs intersecting the flight path geometry.

---

## 4. UI Wireframes & UX Flow

1.  **Dashboard (Home):**
    *   *Left Sidebar:* Navigation (Planner, Fleet, Airports, Empty Legs, Settings).
    *   *Top Bar:* Tenant Name, User Profile, Global Search (ICAO/Tail Number).
    *   *Main Area:* KPI Widgets (Active Flights, Pending Quotes, Revenue), Map preview of live fleet.
2.  **AI Planner Screen:**
    *   *Top:* Natural language input bar ("Plan flight from...") with optimization toggles (Cheapest/Fastest).
    *   *Left Panel:* Step-by-step breakdown of generated legs, aircraft selection dropdown.
    *   *Right Panel:* Interactive Mapbox map showing the route polyline, restricted airspaces (red polygons), and fuel stops.
3.  **Cost & Fuel Screen:**
    *   *Data Grid:* Tabular breakdown of Fuel, Handling, Navigation, Overflight, and Crew costs.
    *   *Visuals:* Donut chart showing cost distribution.
    *   *Export:* "Generate PDF Quote" button.

---

## 5. Step-by-step Development Plan

*   **Phase 1: Infrastructure & DB (Weeks 1-2)**
    *   Set up AWS/GCP infrastructure.
    *   Deploy PostgreSQL with PostGIS. Run migrations for base schema.
    *   Implement FastAPI backend with JWT Authentication and RBAC.
*   **Phase 2: Core Aviation Engine (Weeks 3-5)**
    *   Ingest global airport/FIR data into PostGIS.
    *   Implement spatial queries (Great Circle distance, route intersection with FIRs).
    *   Build the deterministic Costing and Fuel calculation algorithms.
*   **Phase 3: Real-time Integrations (Weeks 6-7)**
    *   Integrate Aviationstack/OpenSky APIs.
    *   Set up Redis caching for METAR/TAF and NOTAMs to prevent API rate limiting.
*   **Phase 4: AI Layer (Weeks 8-9)**
    *   Integrate Gemini API.
    *   Build the prompt engineering pipeline to convert natural language into structured API calls to the Core Engine.
*   **Phase 5: Frontend & Polish (Weeks 10-12)**
    *   Develop Next.js frontend.
    *   Implement Mapbox for high-performance vector maps.
    *   End-to-end testing, security audits, and beta launch.

---

## 6. Sample Working Code (MVP API)

*Note: The current application running in this environment has been updated to a Full-Stack Express + Vite app to demonstrate the API layer. See `server.ts` for the working MVP API endpoints.*

**Example FastAPI (Python) PostGIS Query for future backend:**
```python
@app.get("/api/v1/airports/nearby")
async def get_nearby_airports(lat: float, lng: float, radius_nm: int, db: Session = Depends(get_db)):
    # Convert NM to meters for PostGIS ST_DWithin
    radius_meters = radius_nm * 1852 
    
    query = text("""
        SELECT icao, name, ST_Distance(location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)) as dist
        FROM airports
        WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :radius_meters)
        ORDER BY dist ASC LIMIT 5;
    """)
    
    results = db.execute(query, {"lat": lat, "lng": lng, "radius_meters": radius_meters}).fetchall()
    return [{"icao": r.icao, "name": r.name, "distance_meters": r.dist} for r in results]
```

---

## 7. Deployment Guide

1.  **Containerization:**
    *   Dockerize the Next.js frontend and FastAPI backend.
    *   Use `docker-compose` for local development (including a PostGIS image and Redis).
2.  **Cloud Infrastructure (AWS):**
    *   **Database:** Amazon RDS for PostgreSQL (enable PostGIS extension).
    *   **Backend Compute:** AWS ECS (Fargate) or EKS for scalable container orchestration.
    *   **Frontend:** Vercel (recommended for Next.js) or AWS Amplify.
    *   **Caching:** Amazon ElastiCache (Redis).
3.  **CI/CD Pipeline:**
    *   GitHub Actions: On push to `main`, run PyTest/Jest suites.
    *   If tests pass, build Docker images and push to Amazon ECR.
    *   Trigger rolling update on ECS.
4.  **Security:**
    *   Place DB and Redis in private subnets.
    *   Use AWS Secrets Manager for API keys (Aviationstack, Gemini).
    *   Configure WAF (Web Application Firewall) on the API Gateway.
