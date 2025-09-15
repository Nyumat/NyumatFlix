"use client";

import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";

export interface UseOnboardingFormState {
  name: string;
  isLoading: boolean;
}

export interface UseOnboardingFormActions {
  setName: (name: string) => void;
  handleSubmit: (e: React.FormEvent, onComplete: () => void) => Promise<void>;
  handleSkip: (onComplete: () => void) => void;
}

export interface UseOnboardingFormReturn
  extends UseOnboardingFormState,
    UseOnboardingFormActions {}

export const useOnboardingForm = (): UseOnboardingFormReturn => {
  const { update } = useSession();
  const [name, setName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent, onComplete: () => void) => {
      e.preventDefault();

      if (!name.trim()) {
        // leave toasts to caller to keep this hook side-effect light
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch("/api/user/update-name", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update name");
        }
        await update({ name: name.trim() });
        onComplete();
      } finally {
        setIsLoading(false);
      }
    },
    [name, update],
  );

  const handleSkip = useCallback((onComplete: () => void) => {
    try {
      localStorage.setItem("onboardingSkipped", "true");
    } catch {
      // ignore storage failures silently
    }
    onComplete();
  }, []);

  return { name, isLoading, setName, handleSubmit, handleSkip };
};

export type UseOnboardingForm = typeof useOnboardingForm;
