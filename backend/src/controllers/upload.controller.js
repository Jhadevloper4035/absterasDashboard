import { deleteUploadedAttachment, uploadMultipartFiles } from '../services/upload.service.js';

export async function uploadFiles(req, res) {
  const uploads = await uploadMultipartFiles(req.files, req.user);
  return res.status(201).json({ data: uploads });
}

export async function deleteUpload(req, res) {
  await deleteUploadedAttachment(req.body, req.user);
  return res.status(204).end();
}
