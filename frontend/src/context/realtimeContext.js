import { createContext } from "react";

export const RealtimeContext = createContext({
  subscribe() {
    return () => {};
  },
});
