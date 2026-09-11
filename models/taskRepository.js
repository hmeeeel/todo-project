const fs = require('fs');
const path = require('path');

class TaskRepository {
  constructor() {
    this.dataDirectory = path.join(
      __dirname,
      '..',
      'data'
    );

    this.dbFile = path.join(
      this.dataDirectory,
      'tasks.json'
    );

    this.ensureDbFile();
  }

  ensureDbFile() {
    if (!fs.existsSync(this.dataDirectory)) {
      fs.mkdirSync(
        this.dataDirectory,
        { recursive: true }
      );
    }

    if (!fs.existsSync(this.dbFile)) {
      fs.writeFileSync(
        this.dbFile,
        '[]',
        'utf8'
      );
    }
  }

  readAll() {
    this.ensureDbFile();

    const content = fs.readFileSync(
      this.dbFile,
      'utf8'
    );

    if (!content.trim()) {
      return [];
    }

    return JSON.parse(content);
  }

  writeAll(tasks) {
    this.ensureDbFile();

    fs.writeFileSync(
      this.dbFile,
      JSON.stringify(tasks, null, 2),
      'utf8'
    );
  }

  getAll() {
    return this.readAll();
  }

  getByDate(dateStr, status = 'all') {
    const tasks = this.readAll();

    return tasks.filter(task => {
      const sameDate = task.dueDate === dateStr;

      if (!sameDate) return false;
      if (status === 'all') return true;

      return task.status === status;
    });
  }

  findById(id) {
    const tasks = this.readAll();

    return tasks.find(
      task => task.id === id
    );
  }

  create({ title, dueDate }) {
    const tasks = this.readAll();

    const task = {
      id: crypto.randomUUID(),
      title,
      dueDate,
      status: 'todo',
      files: [],
      createdAt: new Date().toISOString()
    };

    tasks.push(task);
    this.writeAll(tasks);
    return task;
  }

  update(id, changes) {
    const tasks = this.readAll();

    const index = tasks.findIndex(
      task => task.id === id
    );

    if (index === -1) return null;

    tasks[index] = {
      ...tasks[index],
      ...changes
    };

    this.writeAll(tasks);
    return tasks[index];
  }

  addFiles(id, files) {
    const tasks = this.readAll();

    const task = tasks.find(
      item => item.id === id
    );

    if (!task) return null;

    if (!Array.isArray(task.files)) task.files = [];

    task.files.push(...files);
    this.writeAll(tasks);
    return task;
  }
}

const crypto = require('crypto');

module.exports = new TaskRepository();