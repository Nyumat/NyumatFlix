import { useTheme } from "next-themes";
import { Button } from "../ui/button";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";

export const ToggleTheme = () => {
  const { theme, setTheme } = useTheme();

  const handleThemeToggle = () => {
    if (theme === "dark") {
      toast("Light mode coming soon!");
      return;
    }
    setTheme("dark");
  };

  return (
    <Button
      onClick={handleThemeToggle}
      size="sm"
      variant="ghost"
      className="w-full justify-start"
    >
      <div className="flex gap-2 dark:hidden">
        <Moon className="size-5" />
        <span className="hidden">Dark</span>
      </div>

      <div className="dark:flex gap-2 hidden">
        <Sun className="size-5" />
        <span className="hidden">Light</span>
      </div>

      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};
