-- ==========================================
-- PostgreSQL Row-Level Security (RLS) Setup
-- Multi-Tenant Data Isolation
-- ==========================================

-- 1. Enable RLS on all multi-tenant tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_options ENABLE ROW LEVEL SECURITY;

-- 2. Helper Functions for Session Context
-- These functions retrieve the current tenant and role from the session settings.
-- In Node.js, you would set these via: SET app.current_tenant_id = '...';

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
    SELECT current_setting('app.is_super_admin', TRUE) = 'true';
$$ LANGUAGE SQL STABLE;

-- 3. RLS Policies

-- TENANTS Table
-- Super admins can see all tenants. Company admins can only see their own tenant record.
CREATE POLICY tenants_isolation ON tenants
    FOR SELECT
    USING (is_super_admin() OR id = current_tenant_id());

CREATE POLICY tenants_super_admin_all ON tenants
    FOR ALL
    USING (is_super_admin());

-- USERS Table
-- Users can only see other users in the same tenant, unless they are a super admin.
CREATE POLICY users_tenant_isolation ON users
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

-- LEADS Table
-- Leads are strictly isolated by tenant.
CREATE POLICY leads_tenant_isolation ON leads
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

-- QUOTES Table
-- Quotes are strictly isolated by tenant.
CREATE POLICY quotes_tenant_isolation ON quotes
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id())
    WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

-- QUOTE_OPTIONS Table
-- Since quote_options doesn't have a direct tenant_id, it inherits isolation from the parent quote.
CREATE POLICY quote_options_tenant_isolation ON quote_options
    FOR ALL
    USING (
        is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM quotes 
            WHERE quotes.id = quote_options.quote_id 
            AND quotes.tenant_id = current_tenant_id()
        )
    )
    WITH CHECK (
        is_super_admin() OR 
        EXISTS (
            SELECT 1 FROM quotes 
            WHERE quotes.id = quote_options.quote_id 
            AND quotes.tenant_id = current_tenant_id()
        )
    );

-- 4. Global Tables (Reference Data)
-- Tables like 'aircraft' or 'airports' are usually global and readable by all, 
-- but only writable by super admins.

ALTER TABLE aircraft ENABLE ROW LEVEL SECURITY;
CREATE POLICY aircraft_public_read ON aircraft FOR SELECT USING (true);
CREATE POLICY aircraft_admin_all ON aircraft FOR ALL USING (is_super_admin());

-- 5. Implementation Note for Backend (Node.js/Express)
/*
  When using a connection pool, you MUST set the session variables inside a transaction:
  
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [user.tenant_id]);
  await client.query("SELECT set_config('app.is_super_admin', $1, true)", [user.role === 'super_admin']);
  
  const results = await client.query('SELECT * FROM leads'); // RLS automatically filters
  
  await client.query('COMMIT');
*/
