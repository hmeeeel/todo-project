const express = require('express');
const path = require('path');
const fs = require('fs');

const tasksRouter = require('./routes/tasks');
const calendarRouter = require('./routes/calendar');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const uploadsDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}
app.use('/uploads', express.static(uploadsDirectory));

app.use('/api/tasks', tasksRouter);
app.use('/api/calendar', calendarRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

app.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
});
