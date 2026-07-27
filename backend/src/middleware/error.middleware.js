export function notFound(req, res) {
  res.status(404).json({ error: { message: 'Route not found' } });
}

export function errorHandler(err, req, res, next) {
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: { message: err.message } });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: { message: 'Invalid id' } });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: { message: err.message } });
  }

  console.error(err);
  return res.status(500).json({ error: { message: 'Internal server error' } });
}
