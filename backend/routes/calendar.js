const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middlewares/auth');
const { buildMonthGrid, MONTH_NAMES, today } = require('../utils/dateUtils');
const logger = require('../logger');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const now = today();
  const year = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
  const month = req.query.month !== undefined ? parseInt(req.query.month, 10) : now.getMonth();

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
    return res.status(400).json({ error: 'Некорректные год или месяц' });
  }

  try {
    const weeks = buildMonthGrid(year, month);

    const tasksResult = await pool.query('SELECT id, title, due_date, status FROM tasks');
    const tasksByDate = {};
    tasksResult.rows.forEach(task => {
      const dateStr = task.due_date;
      if (!tasksByDate[dateStr]) tasksByDate[dateStr] = [];
      tasksByDate[dateStr].push(task);
    });

    res.status(200).json({
      year,
      month,
      monthName: MONTH_NAMES[month],
      weeks,
      tasksByDate
    });
  } catch (err) {
    logger.error('calendar_failed', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
