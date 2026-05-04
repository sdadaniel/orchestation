"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useNewTaskPageModel } from "../hooks/useNewTaskPageModel";
import type { NewTaskPageGetValue, NewTaskPageSetValue } from "./types";

const NewTaskPageGetContext = createContext<NewTaskPageGetValue | null>(null);
const NewTaskPageSetContext = createContext<NewTaskPageSetValue | null>(null);

export function NewTaskPageProvider({ children }: { children: ReactNode }) {
  const { getValue, setValue } = useNewTaskPageModel();

  return (
    <NewTaskPageGetContext.Provider value={getValue}>
      <NewTaskPageSetContext.Provider value={setValue}>
        {children}
      </NewTaskPageSetContext.Provider>
    </NewTaskPageGetContext.Provider>
  );
}

export function useNewTaskPageGet(): NewTaskPageGetValue {
  const v = useContext(NewTaskPageGetContext);
  if (!v) {
    throw new Error("useNewTaskPageGet must be used within NewTaskPageProvider");
  }
  return v;
}

export function useNewTaskPageSet(): NewTaskPageSetValue {
  const v = useContext(NewTaskPageSetContext);
  if (!v) {
    throw new Error("useNewTaskPageSet must be used within NewTaskPageProvider");
  }
  return v;
}

/** Merged get + set (re-renders on any read change). */
export function useNewTaskPage(): NewTaskPageGetValue & NewTaskPageSetValue {
  return { ...useNewTaskPageGet(), ...useNewTaskPageSet() };
}
