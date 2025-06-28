import { toast } from "sonner";
import { Info } from "lucide-react";

export const showToast = {
  info: (message: string) => {
    toast.info(message, {
      duration: 3000,
      position: "top-center",
      icon: <Info className="text-secondary" size={18} />,
    });
  },

  error: (message: string) => {
    toast.error(message, {
      position: "top-center",
      duration: 3000,
    });
  },
};
