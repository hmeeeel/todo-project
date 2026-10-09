const express = require('express');
const crypto = require('crypto');

const pool = require('../db');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
//const { authenticate } = require('../middlewares/auth');
const { authenticate, requireRole } = require('../middlewares/auth');
const { sendPasswordResetCode } = require('../mailer');
const logger = require('../logger');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const RESET_CODE_MINUTES = 15;

// регистрация 
router.post('/register', async (req, res) => {
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
  const password = req.body.password ? String(req.body.password) : '';
  const role = req.body.role === 'viewer' ? 'viewer' : 'editor'; // admin самостоятельно не назначается

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: '/^[^\s@]+@[^\s@]+\.[^\s@]+$/ email', field: 'email' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов', field: 'password' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован', field: 'email' });
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await pool.query(
      'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [id, email, passwordHash, role]
    );

    logger.info('user_registered', { userId: id, email, role });
    res.status(201).json({ id, email, role });
  } catch (err) {
    logger.error('register_failed', { error: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

//  вход
router.post('/login', async (req, res) => {
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
  const password = req.body.password ? String(req.body.password) : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];


    if (!user) {
      logger.warn('login_failed_unknown_email', { email, ip: req.ip });
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      logger.warn('login_blocked_locked_account', { userId: user.id, email });
      return res.status(423).json({
        error: `Аккаунт временно заблокирован из-за нескольких неудачных попыток входа. Попробуйте позже.`
      });
    }

    const passwordMatches = await comparePassword(password, user.password_hash);

    if (!passwordMatches) {
      const attempts = user.failed_login_attempts + 1;

      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await pool.query(
          'UPDATE users SET failed_login_attempts = 0, locked_until = $1 WHERE id = $2',
          [lockedUntil, user.id]
        );
        logger.warn('account_locked', { userId: user.id, email, lockedUntil });
        return res.status(423).json({
          error: `Аккаунт заблокирован на ${LOCKOUT_MINUTES} минут из-за превышения числа попыток входа`
        });
      }

      await pool.query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [attempts, user.id]);
      logger.warn('login_failed_wrong_password', { userId: user.id, email, attempts });
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // успешный вход - сбр счётчик и созд сессию
    await pool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);

    const sessionId = crypto.randomUUID();
    await pool.query(
      'INSERT INTO sessions (id, user_id, user_agent, ip_address) VALUES ($1, $2, $3, $4)',
      [sessionId, user.id, req.headers['user-agent'] || null, req.ip]
    );

    //const token = signToken({ sub: user.id, role: user.role, sessionId });

   // logger.info('login_success', { userId: user.id, email, sessionId });
   // res.status(200).json({ token, user: { id: user.id, email: user.email, role: user.role } });

   const token = signToken({ sub: user.id, role: user.role, sessionId });

    res.cookie('token', token, {
      httpOnly: true,              // JS не может прочитать эту cookie
      sameSite: 'strict',          // браузер не отправит её с чужих сайтов (защита от CSRF)
      secure: false,               // true только при HTTPS
      maxAge: 2 * 60 * 60 * 1000   // 2 часа, как срок жизни JWT
    });

    logger.info('login_success', { userId: user.id, email, sessionId });
    res.status(200).json({ user: { id: user.id, email: user.email, role: user.role } });

  } catch (err) {
    logger.error('login_failed', { error: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

//  выход 
router.post('/logout', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE sessions SET revoked = true WHERE id = $1', [req.user.sessionId]);
    logger.info('logout', { userId: req.user.id, sessionId: req.user.sessionId });
    res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
    res.status(204).end();
  } catch (err) {
    logger.error('logout_failed', { error: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

//  кто я: клиент спрашивает это при загрузке страницы 
//клиент брал email и роль из localStorage. 
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    res.status(200).json({ id: req.user.id, email: result.rows[0].email, role: req.user.role });
  } catch (err) {
    logger.error('me_failed', { error: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

//  список активных сессий 
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_agent, ip_address, created_at, last_active_at
       FROM sessions
       WHERE user_id = $1 AND revoked = false
       ORDER BY last_active_at DESC`,
      [req.user.id]
    );

    const sessions = result.rows.map(s => ({
      ...s,
      isCurrent: s.id === req.user.sessionId
    }));

    res.status(200).json(sessions);
  } catch (err) {
    logger.error('sessions_list_failed', { error: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

//  завершить конкретную сессию 
router.delete('/sessions/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Некорректный id сессии' });
  }

  try {
    const result = await pool.query(
      'UPDATE sessions SET revoked = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Сессия не найдена' });
    }

    logger.info('session_revoked', { userId: req.user.id, revokedSessionId: id });
    res.status(204).end();
  } catch (err) {
    logger.error('session_revoke_failed', { error: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

//  массовый logout: админ отзывает ВСЕ сессии, кроме своей текущей
router.post('/logout-all', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE sessions SET revoked = true WHERE revoked = false AND id != $1 RETURNING id',
      [req.user.sessionId]
    );

    logger.warn('mass_logout_triggered', {
      triggeredBy: req.user.id,
      sessionsRevoked: result.rows.length
    });

    res.status(200).json({ revokedCount: result.rows.length });
  } catch (err) {
    logger.error('mass_logout_failed', { error: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

//  запрос кода восстановления пароля
router.post('/forgot-password', async (req, res) => {
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Укажите корректный email' });
  }

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      const code = String(crypto.randomInt(100000, 1000000)); // 6-значный код
      const expiresAt = new Date(Date.now() + RESET_CODE_MINUTES * 60 * 1000);

      await pool.query(
        'INSERT INTO password_reset_codes (id, user_id, code, expires_at) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), userId, code, expiresAt]
      );

      await sendPasswordResetCode(email, code);
      logger.info('password_reset_requested', { userId, email });
    } else {
      logger.info('password_reset_requested_unknown_email', { email });
    }

    res.status(200).json({ message: 'Если такой email зарегистрирован, код отправлен на почту' });
  } catch (err) {
    logger.error('forgot_password_failed', { error: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

//  подтверждение кода и установка нового пароля 
router.post('/reset-password', async (req, res) => {
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
  const code = req.body.code ? String(req.body.code).trim() : '';
  const newPassword = req.body.newPassword ? String(req.body.newPassword) : '';

  if (!EMAIL_REGEX.test(email) || !code) {
    return res.status(400).json({ error: 'Укажите email и код из письма' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов', field: 'newPassword' });
  }

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Неверный или истёкший код' });
    }
    const userId = userResult.rows[0].id;

    const codeResult = await pool.query(
      `SELECT id FROM password_reset_codes
       WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, code]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ error: 'Неверный или истёкший код' });
    }

    const passwordHash = await hashPassword(newPassword);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await pool.query('UPDATE password_reset_codes SET used = true WHERE id = $1', [codeResult.rows[0].id]);

    await pool.query('UPDATE sessions SET revoked = true WHERE user_id = $1', [userId]);

    logger.info('password_reset_completed', { userId });
    res.status(200).json({ message: 'Пароль успешно изменён' });
  } catch (err) {
    logger.error('reset_password_failed', { error: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
