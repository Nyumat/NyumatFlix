import React from "react";
import { useEffect } from "react";

interface CurrentStateProps {
  filter: string[];
  searchTerm: string;
}

const useCurrentState = ({ filter, searchTerm }: CurrentStateProps) => {
  const [currentState, setCurrentState] = React.useState<string>("all");
  useEffect((): any => {
    if (filter.length <= 1 && searchTerm.length <= 1) {
      setCurrentState("all");
    }

    if (filter.length > 1) {
      setCurrentState("filter");
    }

    if (searchTerm.length > 0) {
      setCurrentState("search");
    }
  }, [filter, searchTerm]);

  return { currentState, setCurrentState };
};

export default useCurrentState;
