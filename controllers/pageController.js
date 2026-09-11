const taskRepository = require('../models/taskRepository');
const {
  formatDate,
  today,
  buildRibbon,
  buildMonthGrid,
  MONTH_NAMES
} = require('../utils/dateUtils');

function showMain(req, res) {
  const todayStr = formatDate(today());
  const selectedDate = req.query.date || todayStr;
  const status = req.query.status || 'all';
  const ribbon = buildRibbon();
  const tasks = taskRepository.getByDate(selectedDate, status);
  const canCreate = selectedDate >= todayStr;

  res.render('index', {
    ribbon,
    tasks,
    selectedDate,
    status,
    todayStr,
    canCreate,
    error: req.query.error || null,
    currentUrl: req.originalUrl
  });
}

function showCalendar(req, res) {
  const now = today();
  const year = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
  const month = req.query.month !== undefined ? parseInt(req.query.month, 10) : now.getMonth();
  const todayStr = formatDate(now);
  const weeks = buildMonthGrid(year, month);
  const tasksByDate = {};

  taskRepository.getAll().forEach(task => {
    if (!tasksByDate[task.dueDate]) { tasksByDate[task.dueDate] = []; }

    tasksByDate[task.dueDate].push(task);
  });

  const selectedDate = req.query.date || todayStr;
  const selectedTasks = taskRepository.getByDate( selectedDate, 'all');
  const canCreate = selectedDate >= todayStr;

  const prev = month === 0 ? {year: year - 1, month: 11}
                           : {year, month: month - 1};

  const next = month === 11 ? {year: year + 1, month: 0}
                            : {year, month: month + 1};

  res.render('calendar', {
    weeks,
    tasksByDate,
    year,
    month,
    monthName: MONTH_NAMES[month],
    selectedDate,
    selectedTasks,
    todayStr,
    canCreate,
    prev,
    next,
    error: req.query.error || null,
    currentUrl: req.originalUrl
  });
}

module.exports = {showMain, showCalendar};