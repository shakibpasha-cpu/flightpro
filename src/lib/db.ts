import pg from 'pg';
const { Pool } = pg;

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // In a production environment, you would use SSL
  // ssl: { rejectUnauthorized: false }
});

export interface UserContext {
  tenantId: string;
  isSuperAdmin: boolean;
}

/**
 * Executes a database query within a transaction that sets the RLS session context.
 * This ensures that PostgreSQL's Row-Level Security policies are enforced.
 */
export async function queryWithTenantContext<T>(
  context: UserContext,
  queryText: string,
  params: any[] = []
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Set the session variables for RLS
    // These match the functions defined in db/rls_setup.sql
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [context.tenantId]);
    await client.query(`SELECT set_config('app.is_super_admin', $1, true)`, [context.isSuperAdmin ? 'true' : 'false']);

    const res = await client.query(queryText, params);
    
    await client.query('COMMIT');
    return res.rows;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export default pool;
