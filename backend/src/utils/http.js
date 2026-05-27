export function sendError(res, status, message, code = "ERROR", fields = null) {
  const payload = {
    message,
    code,
  };

  if (fields) {
    payload.fields = fields;
  }

  return res.status(status).json(payload);
}
