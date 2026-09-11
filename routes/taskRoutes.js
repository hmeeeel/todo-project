const express = require('express');
const taskController = require('../controllers/taskController');
const upload = require('../middlewares/upload');
const validateTask = require('../middlewares/validateTask');
const router = express.Router();

router.post(
  '/tasks',
  upload.array('attachments', 3),
  validateTask,
  taskController.createTask
);

router.post(
  '/tasks/:id/edit',
  upload.array('attachments', 3),
  validateTask,
  taskController.editTask
);

router.post(
  '/tasks/:id/status',
  taskController.updateStatus
);

module.exports = router;