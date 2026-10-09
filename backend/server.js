const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const pool = require('./db');
const logger = require('./logger');
const { hashPassword } = require('./utils/password');

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const tasksRouter = require('./routes/tasks');
const calendarRouter = require('./routes/calendar');

const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('etag', false); // отключаем автоматический ETag - API всегда отдаёт свежие данные

app.use(express.json());
app.use(cookieParser());
// запрещаем браузеру кэшировать любые ответы API - данные меняются постоянно
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
// логирование 
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    logger.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startTime,
      ip: req.ip
    });
  });
  next();
});

const uploadsDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}
app.use('/uploads', express.static(uploadsDirectory));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/calendar', calendarRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// ADMIN
async function bootstrapAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    logger.warn('admin_bootstrap_skipped', { reason: 'ADMIN_EMAIL/ADMIN_PASSWORD не заданы' });
    return;
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existing.rows.length > 0) return;

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(adminPassword);
    await pool.query(
      'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [id, adminEmail, passwordHash, 'admin']
    );
    logger.info('admin_bootstrapped', { email: adminEmail });
  } catch (err) {
    logger.error('admin_bootstrap_failed', { error: err.message });
  }
}

app.listen(PORT, async () => {
  logger.info('server_started', { port: PORT });
  await bootstrapAdmin();
});
