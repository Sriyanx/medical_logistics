const { Pool } = require('pg');
const deasync = require('deasync');
const { SQLITE_SCHEMA } = require('./db');

function waitFor(promise) {
  let settled = false;
  let value;
  let error;
  promise.then(result => { value = result; settled = true; }, err => { error = err; settled = true; });
  deasync.loopWhile(() => !settled);
  if (error) throw error;
  return value;
}

function postgresSql(sql) {
  let index = 0;
  return sql
    .replace(/date\('now', '\+90 days'\)/g, "CURRENT_DATE + INTERVAL '90 days'")
    .replace(/date\('now'\)/g, 'CURRENT_DATE')
    .replace(/JULIANDAY\(([^)]+)\)\s*-\s*JULIANDAY\('now'\)/gi, '($1::date - CURRENT_DATE)')
    .replace(/\?/g, () => `$${++index}`);
}

function querySync(db, sql, params = []) {
  const client = db._activeClient || db._client;
  return waitFor(client.query(postgresSql(sql), params));
}

function createStatement(db, sql) {
  return {
    get(...params) { return querySync(db, sql, params).rows[0]; },
    all(...params) { return querySync(db, sql, params).rows; },
    run(...params) {
      const result = querySync(db, sql, params);
      return { changes: result.rowCount, lastInsertRowid: undefined };
    }
  };
}

function openPostgresDatabase(connectionString) {
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
  });
  const db = {
    _pool: pool,
    _client: waitFor(pool.connect()),
    _activeClient: null,
    prepare(sql) { return createStatement(db, sql); },
    exec(sql) { return querySync(db, sql); },
    transaction(fn) {
      return (...args) => {
        const previous = db._activeClient;
        const client = waitFor(pool.connect());
        db._activeClient = client;
        try {
          querySync(db, 'BEGIN');
          const result = fn(...args);
          querySync(db, 'COMMIT');
          return result;
        } catch (error) {
          try { querySync(db, 'ROLLBACK'); } catch { /* preserve original error */ }
          throw error;
        } finally {
          db._activeClient = previous;
          client.release();
        }
      };
    },
    close() {
      if (db._client) db._client.release();
      return waitFor(pool.end());
    }
  };
  return db;
}

function initializePostgresDatabase(db) {
  const schema = SQLITE_SCHEMA.replace(/^PRAGMA foreign_keys = ON;\s*/m, '');
  db.exec(schema);
  return db;
}

module.exports = { initializePostgresDatabase, openPostgresDatabase, postgresSql };
