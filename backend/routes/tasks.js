const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const pool = require('../db');
const upload = require('../middlewares/upload');
const { isPast, parseDate } = require('../utils/dateUtils');

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(id) {
  return UUID_REGEX.test(id);
}

function removeUploadedFiles(files) {
  if (!files) return;
  files.forEach(file => {
    if (file && file.path) fs.unlinkSync(file.path);
  });
}

function removeFileFromDisk(storedName) {
  const filePath = path.join(__dirname, '..', 'uploads', storedName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// вернуть задачу вместе со списком её файлов
async function getTaskWithFiles(id) {
  const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (taskResult.rows.length === 0) return null;

  const task = taskResult.rows[0];
  const filesResult = await pool.query('SELECT * FROM task_files WHERE task_id = $1', [id]);
  task.files = filesResult.rows;
  return task;
}

// GET /api/tasks?date=YYYY-MM-DD&status=all|todo|done
router.get('/', async (req, res) => {
  const { date, status } = req.query;

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Некорректный формат даты', field: 'date' });
  }

  try {
    let query = 'SELECT * FROM tasks';
    const params = [];
    const conditions = [];

    if (date) {
      params.push(date);
      conditions.push(`due_date = $${params.length}`);
    }
    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at ASC';

    const tasksResult = await pool.query(query, params);
    const tasks = tasksResult.rows;

    for (const task of tasks) {
      const filesResult = await pool.query('SELECT * FROM task_files WHERE task_id = $1', [task.id]);
      task.files = filesResult.rows;
    }

    res.status(200).json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Некорректный id задачи' });
  }

  try {
    const task = await getTaskWithFiles(id);
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    res.status(200).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/tasks — создать задачу (+файлы)
router.post('/', upload.array('attachments', 3), async (req, res) => {
  const title = req.body.title ? req.body.title.trim() : '';
  const dueDate = req.body.dueDate;

  if (!title) {
    removeUploadedFiles(req.files);
    return res.status(400).json({ error: 'Название задачи обязательно', field: 'title' });
  }

  if (!dueDate || !parseDate(dueDate)) {
    removeUploadedFiles(req.files);
    return res.status(400).json({ error: 'Укажите корректную дату', field: 'dueDate' });
  }

  if (isPast(dueDate)) {
    removeUploadedFiles(req.files);
    return res.status(400).json({ error: 'Нельзя создавать задачу на прошедшую дату', field: 'dueDate' });
  }

  try {
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO tasks (id, title, due_date, status) VALUES ($1, $2, $3, $4)',
      [id, title, dueDate, 'todo']
    );

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileId = crypto.randomUUID();
        await pool.query(
          'INSERT INTO task_files (id, task_id, original_name, stored_name, size) VALUES ($1, $2, $3, $4, $5)',
          [fileId, id, file.originalname, file.filename, file.size]
        );
      }
    }

    const task = await getTaskWithFiles(id);
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    removeUploadedFiles(req.files);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PUT /api/tasks/:id — обновить название и статус
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Некорректный id задачи' });
  }

  const title = req.body.title ? String(req.body.title).trim() : '';
  const status = req.body.status;

  if (!title) {
    return res.status(400).json({ error: 'Название задачи обязательно', field: 'title' });
  }
  if (status !== 'todo' && status !== 'done') {
    return res.status(400).json({ error: 'Некорректный статус', field: 'status' });
  }

  try {
    const existing = await pool.query('SELECT id FROM tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    await pool.query('UPDATE tasks SET title = $1, status = $2 WHERE id = $3', [title, status, id]);
    const task = await getTaskWithFiles(id);
    res.status(200).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/tasks/:id/status — быстрая смена статуса
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Некорректный id задачи' });
  }

  const status = req.body.status === 'done' ? 'done' : 'todo';

  try {
    const existing = await pool.query('SELECT id FROM tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, id]);
    const task = await getTaskWithFiles(id);
    res.status(200).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/tasks/:id — удалить задачу и её файлы
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ error: 'Некорректный id задачи' });
  }

  try {
    const filesResult = await pool.query('SELECT * FROM task_files WHERE task_id = $1', [id]);

    const deleteResult = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    filesResult.rows.forEach(file => removeFileFromDisk(file.stored_name));

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/tasks/:id/files — добавить файлы к существующей задаче
router.post('/:id/files', upload.array('attachments', 3), async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    removeUploadedFiles(req.files);
    return res.status(400).json({ error: 'Некорректный id задачи' });
  }

  try {
    const taskResult = await pool.query('SELECT id FROM tasks WHERE id = $1', [id]);
    if (taskResult.rows.length === 0) {
      removeUploadedFiles(req.files);
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    const countResult = await pool.query('SELECT COUNT(*) FROM task_files WHERE task_id = $1', [id]);
    const existingCount = parseInt(countResult.rows[0].count, 10);
    const newCount = req.files ? req.files.length : 0;

    if (existingCount + newCount > 3) {
      removeUploadedFiles(req.files);
      return res.status(400).json({ error: 'Можно прикрепить не более 3 файлов' });
    }

    const addedFiles = [];
    for (const file of req.files) {
      const fileId = crypto.randomUUID();
      await pool.query(
        'INSERT INTO task_files (id, task_id, original_name, stored_name, size) VALUES ($1, $2, $3, $4, $5)',
        [fileId, id, file.originalname, file.filename, file.size]
      );
      addedFiles.push({
        id: fileId,
        original_name: file.originalname,
        stored_name: file.filename,
        size: file.size
      });
    }

    res.status(201).json(addedFiles);
  } catch (err) {
    console.error(err);
    removeUploadedFiles(req.files);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/tasks/:id/files/:fileId — удалить один файл
router.delete('/:id/files/:fileId', async (req, res) => {
  const { id, fileId } = req.params;
  if (!isValidId(id) || !isValidId(fileId)) {
    return res.status(400).json({ error: 'Некорректный id' });
  }

  try {
    const fileResult = await pool.query(
      'SELECT * FROM task_files WHERE id = $1 AND task_id = $2',
      [fileId, id]
    );
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    await pool.query('DELETE FROM task_files WHERE id = $1', [fileId]);
    removeFileFromDisk(fileResult.rows[0].stored_name);

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
