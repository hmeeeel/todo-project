const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const taskRepository = require('../models/taskRepository');
const { formatDate, today } = require('../utils/dateUtils');

function redirectBack(req, res) {
  const back = req.body.returnTo || '/';
  res.redirect(back);
}

function storedFileFromRequest(file) {
  return {
    id: crypto.randomUUID(),
    originalName: file.originalname,
    storedName: file.filename,
    size: file.size
  };
}

function removeUploadedFile(file) {
  if (!file || !file.path) { return; }

  fs.unlinkSync(file.path);
}

function removeUploadedFiles(files = []) {
  files.forEach(removeUploadedFile);
}

function getStoredFilePath(file) {
  return path.join(
    __dirname,
    '..',
    'uploads',
    file.storedName
  );
}

function createTask(req, res) {
  const title = req.body.title ? req.body.title.trim() : '';
  const dueDate = req.body.dueDate;
  const task = taskRepository.create({title, dueDate});

  if (req.files && req.files.length > 0) {
    const files = req.files.map(storedFileFromRequest);

    taskRepository.addFiles(task.id, files);
  }

  redirectBack(req, res);
}

function editTask(req, res) {
  const id = req.params.id;
  const task = taskRepository.findById(id);

  if (!task) {
    removeUploadedFiles(req.files);

    return res.status(404).send('Задача не найдена');
  }

  const title = req.body.title ? req.body.title.trim() : '';
  const status = req.body.status === 'done' ? 'done' : 'todo';
  let deletedFileIds = [];

  if (req.body.deletedFileIds) {
    try {
      deletedFileIds = JSON.parse(req.body.deletedFileIds);

      if (!Array.isArray(deletedFileIds)) {
        deletedFileIds = [];
      }
    } catch (error) {
      deletedFileIds = [];
    }
  }

  const filesToKeep = (task.files || []).filter(
    file => !deletedFileIds.includes(file.id)
  );

  const newFiles = req.files ? req.files.map(storedFileFromRequest) : [];

  // 3
  const totalFiles = filesToKeep.length + newFiles.length;

  if (totalFiles > 3) {
    removeUploadedFiles(req.files);

    const back = req.body.returnTo || '/';
    const separator = back.includes('?') ? '&' : '?';

    return res.redirect(
      `${back}${separator}error=${encodeURIComponent(
        'Можно прикрепить не более 3 файлов'
      )}`
    );
  }

  const deletedFiles = (task.files || []).filter(
    file => deletedFileIds.includes(file.id)
  );

  deletedFiles.forEach(file => {
    fs.unlinkSync(getStoredFilePath(file));
  });

  taskRepository.update(id, {
    title,
    status,
    files: filesToKeep
  });


  if (newFiles.length > 0) {taskRepository.addFiles(id, newFiles);}

  redirectBack(req, res);
}

function updateStatus(req, res) {
  const id = req.params.id;

  const task = taskRepository.findById(id);

  if (!task) {return res.status(404).send('Задача не найдена');}

  const status = req.body.status === 'done' ? 'done' : 'todo';
  taskRepository.update(id, {status});
  redirectBack(req, res);
}

module.exports = {
  createTask,
  editTask,
  updateStatus
};