import { Info, Loader2, User, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboardingForm } from "@/hooks/useOnboardingForm";

const showOnboardingSkipToast = () => {
  toast.custom(
    (id) => (
      <div className="relative flex w-[calc(100vw-2rem)] max-w-[380px] overflow-hidden rounded-2xl border border-white/12 bg-zinc-950/95 text-white shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="w-1 bg-sky-300" />
        <div className="flex min-w-0 flex-1 gap-3 px-4 py-3.5">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-sky-300/25 bg-sky-300/12 text-sky-200">
            <Info className="size-4" />
          </div>
          <div className="min-w-0 flex-1 pr-7">
            <p className="text-sm font-semibold leading-5 text-zinc-50">
              Skipped for now
            </p>
            <p className="mt-1 text-sm leading-5 text-zinc-400">
              The next time you open NyumatFlix, we'll ask you again.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => toast.dismiss(id)}
            className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/8 hover:text-zinc-100"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    ),
    { duration: 4200 },
  );
};

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

export const OnboardingDialog = ({
  open,
  onComplete,
}: OnboardingDialogProps) => {
  const { name, isLoading, setName, handleSubmit, handleSkip } =
    useOnboardingForm();

  return (
    <Dialog open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-2xl border-white/12 bg-zinc-950/92 p-0 text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:max-w-md"
        hideCloseButton
      >
        <div className="border-b border-white/10 bg-white/[0.03] px-6 py-6 sm:px-8">
          <DialogHeader className="space-y-5 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-white/12 bg-black/35">
              <div className="flex size-11 items-center justify-center rounded-xl bg-white/8">
                <Image
                  src="/logo.svg"
                  alt="NyumatFlix"
                  width={30}
                  height={30}
                  className="size-[30px]"
                />
              </div>
            </div>
            <div className="mx-auto max-w-sm space-y-3">
              <DialogTitle className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
                Welcome to NyumatFlix
              </DialogTitle>
            </div>
          </DialogHeader>
        </div>

        <form
          onSubmit={async (e) => {
            if (!name.trim()) {
              toast.error("Please enter your name");
              return;
            }
            try {
              await handleSubmit(e, () => {
                toast.success("Welcome to NyumatFlix!");
                onComplete();
              });
            } catch (error) {
              console.error("Error updating name:", error);
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Failed to update name",
              );
            }
          }}
          className="space-y-6 px-6 py-6 sm:px-8"
        >
          <div>
            <Label
              htmlFor="name"
              className="mb-3 block text-sm font-medium text-zinc-200"
            >
              Display name
            </Label>
            <div className="relative flex h-12 items-center rounded-xl border border-white/12 bg-black/30 px-3 transition-colors focus-within:border-sky-300/45 focus-within:ring-2 focus-within:ring-sky-300/20">
              <User className="mr-2.5 size-4 shrink-0 text-zinc-500" />
              <Input
                id="name"
                type="text"
                placeholder="What should we call you?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-full flex-1 rounded-none border-0 bg-transparent px-0 py-0 text-base text-white shadow-none outline-none placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-0 dark:bg-transparent"
                maxLength={100}
                disabled={isLoading}
                autoFocus
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              This can't be changed later, so choose wisely.
            </p>
          </div>

          <DialogFooter className="gap-3 pt-1 sm:flex-row sm:justify-between sm:space-x-0">
            <Button
              type="button"
              onClick={() => {
                handleSkip(() => {
                  showOnboardingSkipToast();
                  onComplete();
                });
              }}
              disabled={isLoading}
              variant="ghost"
              className="h-11 w-full rounded-xl px-5 text-zinc-300 shadow-none hover:bg-white/8 hover:text-white sm:w-auto"
            >
              Skip for now
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="h-11 w-full rounded-xl border-sky-300/20 bg-sky-300/15 px-5 text-sm font-semibold text-sky-50 shadow-none hover:border-sky-300/35 hover:bg-sky-300/22 sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
