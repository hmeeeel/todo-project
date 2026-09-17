const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

function pad(number) {
  return String(number).padStart(2, '0');
}

function formatDate(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-');
}

function today() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
  const [year, month, day] = dateString.split('-').map(Number);

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;

  date.setHours(0, 0, 0, 0);
  return date;
}

function isPast(dateString) {
  const date = parseDate(dateString);
  if (!date) return true;
  return date < today();
}

function createCalendarDay(date, inCurrentMonth) {
  const dateStr = formatDate(date);

  return {
    dateStr,
    dayNumber: date.getDate(),
    inCurrentMonth,
    isToday: dateStr === formatDate(today())
  };
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const cells = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    cells.push(createCalendarDay(date, false));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push(createCalendarDay(date, true));
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const date = new Date(year, month + 1, nextDay++);
    cells.push(createCalendarDay(date, false));
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}

module.exports = {
  MONTH_NAMES,
  formatDate,
  today,
  parseDate,
  isPast,
  buildMonthGrid
};
