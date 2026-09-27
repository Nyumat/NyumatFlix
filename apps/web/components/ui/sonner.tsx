"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const monochromeToast =
  "group toast !border-white/10 !bg-black !text-white !shadow-lg";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      closeButton
      className="toaster group"
      icons={{
        success: null,
        info: null,
        warning: null,
        error: null,
        loading: null,
      }}
      toastOptions={{
        classNames: {
          toast: monochromeToast,
          title: "group-[.toast]:text-white",
          description: "group-[.toast]:text-white/60",
          actionButton:
            "group-[.toast]:!border-white/10 group-[.toast]:!bg-white group-[.toast]:!text-black",
          cancelButton:
            "group-[.toast]:!border-white/10 group-[.toast]:!bg-white/10 group-[.toast]:!text-white/80",
          closeButton:
            "group-[.toast]:!border-white/10 group-[.toast]:!bg-white/5 group-[.toast]:!text-white/60 hover:group-[.toast]:!text-white",
          success: monochromeToast,
          error: monochromeToast,
          info: monochromeToast,
          warning: monochromeToast,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
