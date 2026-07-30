import { uploadMultipartFiles } from '../services/upload.service.js';

export async function uploadFiles(req, res) {
  const uploads = await uploadMultipartFiles(req.files, req.user);
  return res.status(201).json({ data: uploads });
}
