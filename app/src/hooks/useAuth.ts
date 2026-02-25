import React, { createContext, useContext } from "react";
import { User } from "firebase/auth";

type AuthContextValue = {
  user: User | null;
};

export const AuthContext = createContext<AuthContextValue>({ user: null });

export function useAuth() {
  return useContext(AuthContext);
}
