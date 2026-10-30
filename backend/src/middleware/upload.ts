import multer from 'multer';
import { Request } from 'express';
import { ApiError } from '../utils/apiError';

// Store files in memory so plaintext is never written to disk before encryption
const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/json',
  'application/dicom',
  'application/octet-stream',
  'text/plain',
];

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (
    allowedMimeTypes.includes(file.mimetype) ||
    file.originalname.endsWith('.dcm') ||
    file.originalname.endsWith('.pdf') ||
    file.originalname.endsWith('.json') ||
    file.originalname.endsWith('.jpg') ||
    file.originalname.endsWith('.png')
  ) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Unsupported file type '${file.mimetype}'. Allowed types: PDF, JPG, PNG, DICOM, JSON.`
      )
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB maximum
  },
  fileFilter,
});
