const pool = require('../db');
const { verifyToken } = require('../utils/jwt');
const logger = require('../logger');

async function authenticate(req, res, next) {
  //const header = req.headers.authorization || '';
 // const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = req.cookies ? req.cookies.token : null;
  
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Токен недействителен или истёк' });
  }

  try {
    const sessionResult = await pool.query(
      'SELECT * FROM sessions WHERE id = $1 AND user_id = $2',
      [payload.sessionId, payload.sub]
    );

    if (sessionResult.rows.length === 0 || sessionResult.rows[0].revoked) {
      return res.status(401).json({ error: 'Сессия завершена, войдите заново' });
    }

    await pool.query('UPDATE sessions SET last_active_at = now() WHERE id = $1', [payload.sessionId]);

    req.user = { id: payload.sub, role: payload.role, sessionId: payload.sessionId };
    next();
  } catch (err) {
    logger.error('auth_check_failed', { error: err.message });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

//admin, editor
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав для этого действия' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
