import { Badge } from "@/components/ui/badge";
import { getStatusDisplayText } from "@/utils/movie-helpers";
import { Clock, Film } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const displayText = getStatusDisplayText(status);

  const getIcon = () => {
    switch (status) {
      case "In Production":
      case "Post Production":
        return <Film className="w-3 h-3 mr-1" />;
      case "Rumored":
      case "Planned":
        return <Clock className="w-3 h-3 mr-1" />;
      default:
        return null;
    }
  };

  return (
    <Badge variant="chrome" className={`flex items-center ${className}`}>
      {getIcon()}
      {displayText}
    </Badge>
  );
};
