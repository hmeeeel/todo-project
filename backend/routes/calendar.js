const express = require('express');
const pool = require('../db');
const { buildMonthGrid, MONTH_NAMES, today } = require('../utils/dateUtils');

const router = express.Router();

// GET /api/calendar?year=YYYY&month=M  (месяц с 0 — январь = 0)
router.get('/', async (req, res) => {
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
      const dateStr = task.due_date; // уже строка YYYY-MM-DD
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
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
