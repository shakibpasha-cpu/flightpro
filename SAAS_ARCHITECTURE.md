# SaaS Architecture: AI-Powered Aircraft Charter Platform

## 1. System Architecture & Multi-Tenant Strategy

The platform uses a **Single Database, Multi-Tenant** architecture with Row-Level Security (RLS) in PostgreSQL to ensure data isolation between charter companies. The RLS policies are implemented in \`db/rls_setup.sql\`.

### User Roles
1. **Super Admin (Platform Owner):** Manages tenants (companies), global aircraft database, billing (Stripe), and platform-wide settings.
2. **Company Admin (Tenant Owner):** Manages their specific brokerage/operator company, team members, custom margins, and views company-wide analytics.
3. **Sales Agent:** Handles specific assigned leads, generates quotes, communicates with clients.
4. **Client (End User):** Accesses a white-labeled portal to view quotes, sign contracts, and pay.

---

## 2. Database Schema (PostgreSQL)

\`\`\`sql
-- Core Multi-Tenancy
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    domain VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    subscription_tier VARCHAR(50),
    created_at TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    role VARCHAR(50), -- 'super_admin', 'company_admin', 'agent', 'client'
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(255)
);

-- CRM & Leads
CREATE TABLE leads (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    assigned_agent_id UUID REFERENCES users(id),
    client_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    source VARCHAR(50), -- 'website', 'whatsapp', 'referral'
    status VARCHAR(50), -- 'new', 'hot', 'cold', 'closed_won', 'closed_lost'
    estimated_value DECIMAL(12,2),
    created_at TIMESTAMP
);

-- Quotes & Flights
CREATE TABLE quotes (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    lead_id UUID REFERENCES leads(id),
    departure_icao VARCHAR(10),
    destination_icao VARCHAR(10),
    departure_date TIMESTAMP,
    pax_count INT,
    status VARCHAR(50), -- 'draft', 'sent', 'accepted', 'rejected'
    total_price DECIMAL(12,2),
    margin_applied DECIMAL(5,2),
    ai_generated BOOLEAN
);

CREATE TABLE quote_options (
    id UUID PRIMARY KEY,
    quote_id UUID REFERENCES quotes(id),
    aircraft_id UUID REFERENCES aircraft(id),
    option_type VARCHAR(50), -- 'cheapest', 'fastest', 'recommended'
    price DECIMAL(12,2),
    flight_time_minutes INT
);
\`\`\`

---

## 3. API Endpoints (FastAPI / Node.js)

### Auth & Tenants
*   \`POST /api/v1/auth/login\` - JWT generation
*   \`POST /api/v1/tenants/register\` - Onboard new charter company

### Leads & CRM
*   \`GET /api/v1/leads\` - List leads (filtered by tenant_id via JWT)
*   \`POST /api/v1/leads\` - Create lead (Webhook target for website/WhatsApp)
*   \`PATCH /api/v1/leads/{id}/status\` - Update lead status

### AI Quote Engine
*   \`POST /api/v1/quotes/generate\` - Triggers Gemini AI pricing logic
*   \`POST /api/v1/quotes/{id}/export/pdf\` - Generates white-labeled PDF
*   \`POST /api/v1/quotes/{id}/send/whatsapp\` - Triggers WhatsApp API

---

## 4. UI/UX Component Structure (React/Next.js)

\`\`\`text
src/
├── app/                      # Next.js App Router
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── overview/         # DashboardOverview.tsx
│   │   ├── leads/            # LeadsManagement.tsx
│   │   ├── quotes/           # CharterQuoteEngine.tsx
│   │   ├── fleet/            # AircraftDatabase.tsx
│   │   └── settings/         # Costing & Margins
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx       # Main navigation
│   │   └── Topbar.tsx        # User profile, notifications
│   ├── ui/                   # Reusable Shadcn/Tailwind components
│   │   ├── Card.tsx
│   │   ├── DataTable.tsx
│   │   └── Badge.tsx
│   └── modules/              # Feature-specific components
├── lib/
│   ├── ai/                   # Gemini API integrations
│   ├── db/                   # Prisma/Drizzle ORM clients
│   └── stripe/               # Billing integration
\`\`\`

---

## 5. Step-by-Step Build Plan

### Phase 1: MVP (Current Focus)
1.  **UI Shell:** Sidebar navigation, responsive layout.
2.  **Dashboard Overview:** High-level metrics (Revenue, Leads, Quotes).
3.  **Leads Management (CRM):** Kanban/Table view for tracking clients.
4.  **AI Quote Engine:** The core Gemini-powered pricing tool (Already built).

### Phase 2: Multi-Tenancy & Backend
1.  **Database Migration:** Move from Firebase to PostgreSQL (Supabase/Neon).
2.  **Auth:** Implement JWT-based role access (Super Admin vs Agent).
3.  **Stripe Integration:** Allow companies to subscribe to the SaaS platform.

### Phase 3: Advanced Integrations
1.  **WhatsApp Bot:** Auto-capture leads via Twilio/Meta API.
2.  **White-label Client Portal:** Allow end-clients to log in and view quotes.
3.  **Multi-language:** i18n support for Arabic/Urdu.
