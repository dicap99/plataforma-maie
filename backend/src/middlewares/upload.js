const multer = require('multer');
const path = require('path');
const ApiError = require('../utils/ApiError');

const EXTENSIONES_PERMITIDAS = ['.csv', '.xlsx'];

// Archivos en memoria: se procesan con exceljs / csv-parse y se descartan.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXTENSIONES_PERMITIDAS.includes(ext)) return cb(null, true);
    return cb(ApiError.badRequest('Solo se permiten archivos .csv o .xlsx'));
  },
});

module.exports = upload;
