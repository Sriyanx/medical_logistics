const { openDatabase } = require('./db');
const { seedDemo } = require('./seed');
const { createApp } = require('./app');
const db = openDatabase(process.env.DATABASE_PATH);
if (db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0) seedDemo(db);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
createApp(db).listen(port, host, () => console.log(`MediSales API is running on ${host}:${port}`));
