import { createContext, useContext } from "react";
import type { Me } from "@/data/queries";
import type { Couple } from "@/lib/domain";

export type DenMe = Me & { couple: Couple };

export interface DenValue {
  me: DenMe;
  refresh: () => Promise<Me | undefined>;
}

export const DenContext = createContext<DenValue | null>(null);

export function useDen(): DenValue {
  const value = useContext(DenContext);
  if (!value) {
    throw new Error("useDen must be used under RequireDen.");
  }
  return value;
}
