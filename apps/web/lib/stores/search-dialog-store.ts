import { create } from "zustand";

type SearchDialogStoreState = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export const useSearchDialogStore = create<SearchDialogStoreState>((set) => ({
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
}));
