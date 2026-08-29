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
  "data-testid"?: string;
  onProceed?: () => void;
};

export const AdblockerAlert = ({
  openSignal,
  "data-testid": testId,
  onProceed,
}: AdblockerAlertProps) => {
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const router = useRouter();

  const handleProceed = () => {
    setOpen(false);
    if (onProceed) {
      onProceed();
    } else {
      router.push("/");
    }
  };

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
        data-testid={testId || "adblocker-alert-dialog"}
        className="max-w-md p-5 sm:p-6"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you don&apos;t want an ad-blocker?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <a
                  href="https://nyumatflix.com"
                  className="font-bold text-primary hover:underline"
                >
                  nyumatflix.com
                </a>{" "}
                itself is ad-free. However, the embed providers we aggregate
                from often inject scripts within their iframes to display popups
                and/or ads.
              </p>
              <p>
                If you want no ads <em className="italic">and</em> don&apos;t
                want to install an ad blocker, use the{" "}
                <span className="font-semibold text-primary">Scrape</span>{" "}
                method in the server selector.
              </p>
            </div>
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
                className="flex w-full flex-col items-stretch gap-2.5"
              >
                <Button
                  variant="default"
                  className="h-auto min-h-10 w-full py-2.5 text-center text-sm leading-snug whitespace-normal"
                  onClick={handleShowOptions}
                  aria-label="Show ad blocker options"
                >
                  Show me ad blockers
                </Button>
                <Button
                  variant="outline"
                  className="h-auto min-h-10 w-full py-2.5 text-center text-sm leading-snug whitespace-normal"
                  onClick={handleProceed}
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
                    className="h-auto min-h-10 w-full py-2.5 text-center text-sm leading-snug whitespace-normal"
                    onClick={handleProceed}
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
