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
  const { signal, timeoutMs, ...fetchOptions } = options;
  const isFormData = fetchOptions.body instanceof FormData;
  const requestTimeoutMs = timeoutMs ?? (isFormData ? 60000 : 20000);
  const controller = new AbortController();
  let timeoutId = null;
  let abortReason = "external";

  function abortRequest() {
    abortReason = "external";
    controller.abort();
  }

  if (signal?.aborted) {
    abortReason = "external";
    controller.abort();
  } else if (signal) {
    signal.addEventListener("abort", abortRequest, {
      once: true,
    });
  }

  if (requestTimeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      abortReason = "timeout";
      controller.abort();
    }, requestTimeoutMs);
  }

  const headers = isFormData
    ? {
        ...(fetchOptions.headers || {}),
      }
    : {
        "Content-Type": "application/json",
        ...(fetchOptions.headers || {}),
      };

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
      credentials: "include",
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.message || "Có lỗi xảy ra");
    }

    return data;
  } catch (error) {
    if (controller.signal.aborted) {
      const isTimeout = abortReason === "timeout";
      const abortError = new Error(
        isTimeout
          ? "Kết nối quá lâu. Vui lòng thử lại."
          : "Yêu cầu đã bị hủy."
      );

      abortError.name = isTimeout ? "TimeoutError" : "AbortError";
      throw abortError;
    }

    throw error;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    if (signal) {
      signal.removeEventListener("abort", abortRequest);
    }
  }
}
