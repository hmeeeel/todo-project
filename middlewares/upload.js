const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const uploadDirectory = path.join(
  __dirname,
  '..',
  'uploads'
);

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadDirectory);
  },

  filename(req, file, callback) {
    const uniqueName = crypto.randomUUID();
    const extension = path.extname(file.originalname);

    callback(null, `${uniqueName}${extension}`);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 3
  }
});

module.exports = upload;