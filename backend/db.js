const { Pool, types } = require('pg');

// PostgreSQL по умолчанию возвращает колонку типа DATE как JS Date
// (со сдвигом по часовому поясу сервера). Чтобы избежать путаницы,
// просим возвращать её как обычную строку 'YYYY-MM-DD' без изменений.
const DATE_OID = 1082;
types.setTypeParser(DATE_OID, (value) => value);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'tasks_db'
});

module.exports = pool;
