import { Pool, PoolClient, QueryResult } from 'pg';

// Parse the DATABASE_URL from environment (loaded by env.ts before this module is used)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('WARNING: DATABASE_URL is not set. Database queries will fail.');
}

// Create a connection pool
export const pool = new Pool({
  connectionString: connectionString || '',
  ssl: connectionString?.includes('supabase')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Log pool errors (do not crash)
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

/**
 * Execute a parameterized SQL query and return all rows.
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result: QueryResult<T> = await pool.query<T>(text, params);
  return result.rows;
}

/**
 * Execute a parameterized SQL query and return the first row or null.
 */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const result: QueryResult<T> = await pool.query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a parameterized SQL query and return the count of affected rows.
 */
export async function execute(text: string, params?: any[]): Promise<number> {
  const result = await pool.query(text, params);
  return result.rowCount ?? 0;
}

/**
 * Run a set of operations inside a database transaction.
 * If the callback throws, the transaction is rolled back.
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Helper: query within a transaction client
 */
export async function txQuery<T = any>(client: PoolClient, text: string, params?: any[]): Promise<T[]> {
  const result: QueryResult<T> = await client.query<T>(text, params);
  return result.rows;
}

/**
 * Helper: query one row within a transaction client
 */
export async function txQueryOne<T = any>(client: PoolClient, text: string, params?: any[]): Promise<T | null> {
  const result: QueryResult<T> = await client.query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Helper: execute within a transaction client
 */
export async function txExecute(client: PoolClient, text: string, params?: any[]): Promise<number> {
  const result = await client.query(text, params);
  return result.rowCount ?? 0;
}

/**
 * Check database connectivity.
 */
export async function checkDatabaseConnection(): Promise<{ connected: boolean; status: 'connected' | 'unavailable' }> {
  try {
    await pool.query('SELECT 1');
    return { connected: true, status: 'connected' };
  } catch (err) {
    console.error('Database connection check failed:', err instanceof Error ? err.message : err);
    return { connected: false, status: 'unavailable' };
  }
}

/**
 * Close the pool (for graceful shutdown).
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
