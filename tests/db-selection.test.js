const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveDatabaseConfig } = require('../src/db');

test('uses SQLite only in test mode and requires DATABASE_URL in production', () => {
  assert.deepEqual(resolveDatabaseConfig({ NODE_ENV: 'test' }), { dialect: 'sqlite', filename: ':memory:' });
  assert.deepEqual(resolveDatabaseConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://user:pass@db.example/medisales' }), {
    dialect: 'postgres',
    connectionString: 'postgres://user:pass@db.example/medisales'
  });
  assert.throws(
    () => resolveDatabaseConfig({ NODE_ENV: 'production' }),
    /DATABASE_URL is required in production/
  );
});
