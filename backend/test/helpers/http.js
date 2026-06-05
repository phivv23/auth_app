export async function request(app, path, options = {}) {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    return {
      body,
      headers: response.headers,
      status: response.status,
    };
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
}
