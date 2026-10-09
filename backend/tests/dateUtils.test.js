const { parseDate } = require('../utils/dateUtils');

test('parseDate возвращает Date для корректной строки', () => {
  const result = parseDate('2026-09-20');
  expect(result).not.toBeNull();
  expect(result.getFullYear()).toBe(2026);
  expect(result.getMonth()).toBe(8);
  expect(result.getDate()).toBe(20);
});

test('parseDate возвращает null для некорректной строки', () => {
  expect(parseDate('20-09-2026')).toBeNull();
  expect(parseDate('не дата')).toBeNull();
  expect(parseDate('2026-13-40')).toBeNull();
});
