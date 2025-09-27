"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AdblockerIcons from "@/components/content/adblocker-icons";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type AdblockerAlertProps = {
  openSignal: boolean;
};

export const AdblockerAlert = ({ openSignal }: AdblockerAlertProps) => {
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    if (openSignal) {
      setShowOptions(false);
      setOpen(true);
    }
  }, [openSignal, setOpen, setShowOptions]);

  const handleShowOptions = () => {
    setShowOptions(true);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent
        role="dialog"
        aria-label="adblock recommendation dialog"
        className="max-w-md p-5 sm:p-6"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you don&apos;t want an ad-blocker?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-bold text-primary">nyumatflix.com</span>{" "}
            itself is ad-free. However, the APIs we aggregate from often inject
            scripts within their iframes to display popups and or ads.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-2">
          <AnimatePresence mode="wait" initial={false}>
            {!showOptions ? (
              <motion.div
                key="cta"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex w-full flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3"
              >
                <Button
                  variant="default"
                  className="font-bold w-full sm:w-auto whitespace-normal text-center text-sm sm:text-base"
                  onClick={handleShowOptions}
                  aria-label="Show ad blocker options"
                >
                  Show me adblockers
                </Button>
                <Button
                  variant="outline"
                  className="font-bold w-full sm:w-auto whitespace-normal text-center text-sm sm:text-base"
                  onClick={() => {
                    setOpen(false);
                    router.push("/home");
                  }}
                  aria-label="Proceed without ad blocker"
                >
                  No thanks, I&apos;m fine with popups
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="options"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <AdblockerIcons />
                <div className="mt-4 flex">
                  <Button
                    variant="outline"
                    className="font-bold w-full whitespace-normal text-center"
                    onClick={() => {
                      setOpen(false);
                      router.push("/home");
                    }}
                    aria-label="Continue to home"
                  >
                    No thanks, I&apos;m fine with popups
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AdblockerAlert;
