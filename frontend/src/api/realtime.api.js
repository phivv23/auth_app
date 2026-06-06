import { API_URL } from "./client.js";

export function getRealtimeStreamUrl() {
  return `${API_URL}/realtime/stream`;
}
