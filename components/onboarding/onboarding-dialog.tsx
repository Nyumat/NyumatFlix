import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

export const OnboardingDialog = ({
  open,
  onComplete,
}: OnboardingDialogProps) => {
  const { update } = useSession();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/user/update-name", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update name");
      }

      await update({ name: name.trim() });

      toast.success("Welcome to NyumatFlix! 🎉");
      onComplete();
    } catch (error) {
      console.error("Error updating name:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update name",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("onboardingSkipped", "true");
    toast.info("The next time you open NyumatFlix, we'll ask you again.");
    onComplete();
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md bg-card/80 backdrop-blur-md border-border/50 shadow-2xl"
        hideCloseButton
      >
        <DialogHeader className="text-center space-y-6">
          <div className="mx-auto">
            <div className="w-20 h-20 bg-black/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto shadow-lg border border-black/30">
              <Image
                src="/logo.svg"
                alt="NyumatFlix"
                width={40}
                height={40}
                className="w-10 h-10"
              />
            </div>
          </div>
          <div className="space-y-2 max-w-sm mx-auto">
            <DialogTitle className="text-3xl font-light text-foreground text-center">
              Welcome to NyumatFlix
            </DialogTitle>
            <DialogDescription className=" max-w-64 mx-auto text-muted-foreground font-light text-center">
              Let's personalize your experience. What should we call you?
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="text-sm font-medium text-foreground"
            >
              Your Name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10"
                maxLength={100}
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-4 pt-6">
            <Button
              type="button"
              onClick={handleSkip}
              disabled={isLoading}
              className="w-full sm:w-auto backdrop-blur-md bg-white/10 border border-white/30 text-white hover:bg-white/20 hover:border-white/40 hover:shadow-xl transition-all duration-200 shadow-lg font-medium"
            >
              Skip for now
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="w-full sm:w-auto backdrop-blur-md bg-white/20 border border-white/30 text-white hover:bg-white/30 hover:border-white/40 hover:shadow-xl transition-all duration-200 shadow-lg font-bold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
