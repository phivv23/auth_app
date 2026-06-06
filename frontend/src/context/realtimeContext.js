import { createContext } from "react";

export const RealtimeContext = createContext({
  connectionStatus: "idle",
  subscribe() {
    return () => {};
  },
});
