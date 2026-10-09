const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middlewares/auth');
const logger = require('../logger');

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// весь файл - только для admin
router.use(authenticate, requireRole('admin'));

// GET /api/users - список всех пользователей с ролями
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, failed_login_attempts, locked_until, created_at FROM users ORDER BY created_at ASC'
    );
    res.status(200).json(result.rows);
  } catch (err) {
    logger.error('users_list_failed', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/users/:id/role - изменить роль пользователя
router.patch('/:id/role', async (req, res) => {
  const { id } = req.params;
  const role = req.body.role;

  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Некорректный id пользователя' });
  }
  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Роль должна быть admin, editor или viewer', field: 'role' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    logger.info('user_role_changed', { targetUserId: id, newRole: role, changedBy: req.user.id });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    logger.error('user_role_change_failed', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
