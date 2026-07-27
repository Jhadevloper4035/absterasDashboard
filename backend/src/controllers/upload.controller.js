import { createPresignedUpload, uploadMultipartFiles } from '../services/upload.service.js';

export async function uploadFiles(req, res) {
  const uploads = await uploadMultipartFiles(req.files, req.user);
  return res.status(201).json({ data: uploads });
}

export async function presignUpload(req, res) {
  const upload = await createPresignedUpload(req.body, req.user);
  return res.json({ data: upload });
}
