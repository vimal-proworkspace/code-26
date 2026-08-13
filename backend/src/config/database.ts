// Re-export database utilities from the pg-based module.
// This file exists for backward compatibility — previously it exported PrismaClient.
export { pool, query, queryOne, execute, transaction, txQuery, txQueryOne, txExecute, checkDatabaseConnection, closePool } from './db';
