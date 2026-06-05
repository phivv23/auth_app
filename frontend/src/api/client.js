const viteEnv = import.meta.env || {};

export const API_URL = viteEnv.VITE_API_URL || "http://localhost:5000/api";

export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export function getFileUrl(filePath) {
  if (!filePath) return "";

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  return `${API_ORIGIN}${filePath}`;
}

export class ApiRequestError extends Error {
  constructor(message, { name = "ApiRequestError", status = 0, code = "", requestId = "", fields = null, cause = null } = {}) {
    super(message);
    this.name = name;
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.fields = fields;
    this.cause = cause;
  }
}

function createTimeoutError() {
  return new ApiRequestError("Kết nối quá lâu. Vui lòng thử lại.", {
    name: "TimeoutError",
    code: "REQUEST_TIMEOUT",
  });
}

function createAbortError() {
  return new ApiRequestError("Yêu cầu đã bị hủy.", {
    name: "AbortError",
    code: "REQUEST_ABORTED",
  });
}

function createNetworkError(error) {
  return new ApiRequestError(
    "Không thể kết nối server. Vui lòng kiểm tra mạng và thử lại.",
    {
      name: "NetworkError",
      code: "NETWORK_ERROR",
      cause: error,
    }
  );
}

function createHttpError(response, data) {
  const requestId =
    response.headers?.get?.("X-Request-Id") || data?.requestId || "";

  return new ApiRequestError(data?.message || "Có lỗi xảy ra", {
    status: response.status,
    code: data?.code || "HTTP_ERROR",
    requestId,
    fields: data?.fields || null,
  });
}

export function isRetryableApiError(error) {
  return (
    error?.name === "TimeoutError" ||
    error?.name === "NetworkError" ||
    Number(error?.status || 0) >= 500
  );
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
      throw createHttpError(response, data);
    }

    return data;
  } catch (error) {
    if (controller.signal.aborted) {
      const isTimeout = abortReason === "timeout";
      throw isTimeout ? createTimeoutError() : createAbortError();
    }

    if (error instanceof ApiRequestError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw createNetworkError(error);
    }

    if (!error?.status && !error?.code) {
      throw createNetworkError(error);
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
