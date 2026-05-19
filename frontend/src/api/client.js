export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export function getFileUrl(filePath) {
  if (!filePath) return "";

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  return `${API_ORIGIN}${filePath}`;
}

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;

  const headers = isFormData
    ? {
        ...(options.headers || {}),
      }
    : {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Có lỗi xảy ra");
  }

  return data;
}