const taskRepository = require('../models/taskRepository');
const {
  isPast,
  parseDate
} = require('../utils/dateUtils');

const fs = require('fs');

function removeUploadedFiles(files = []) {
  files.forEach(file => {
    if (!file || !file.path) return;

    fs.unlinkSync(file.path);
  });
}

function redirectWithError(req, res, message) {
  removeUploadedFiles(req.files);

  const back = req.body.returnTo || '/';
  const separator = back.includes('?') ? '&' : '?';

  return res.redirect( `${back}${separator}error=${encodeURIComponent(message)}`);
}

function validateTask(req, res, next) {
  const title = req.body.title ? req.body.title.trim() : '';

  if (!title) {
    return redirectWithError(
      req,
      res,
      'Название задачи обязательно'
    );
  }


  if (req.params.id) {
    const task = taskRepository.findById(req.params.id);

    if (!task) {
      return redirectWithError(
        req,
        res,
        'Задача не найдена'
      );
    }

    return next();
  }


  const dueDate = req.body.dueDate;

  if (!dueDate || !parseDate(dueDate)) {
    return redirectWithError(
      req,
      res,
      'Укажите корректную дату'
    );
  }

  if (isPast(dueDate)) {
    return redirectWithError(
      req,
      res,
      'Нельзя создавать задачу на прошедшую дату'
    );
  }


  if (req.files && req.files.length > 3) {
    return redirectWithError(
      req,
      res,
      'Можно прикрепить не более 3 файлов'
    );
  }

  next();
}

module.exports = validateTask;