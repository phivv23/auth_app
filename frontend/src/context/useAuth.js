import { useContext } from "react";
import { AuthContext } from "./authContext.js";

/**
 * Custom hook giúp component dùng auth dễ hơn.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth phải được dùng bên trong AuthProvider.");
  }

  return context;
}
