import React, { useEffect } from "react";

interface CurrentStateProps {
  filter: string[];
  searchTerm: string;
}

const useCurrentState = ({ filter, searchTerm }: CurrentStateProps) => {
  const [currentState, setCurrentState] = React.useState<string>("all");

  useEffect(() => {
    if (filter.length >= 1) {
      setCurrentState("filter");
    }

    if (searchTerm.length > 0) {
      setCurrentState("search");
    }
    if (filter.length < 1 && searchTerm.length < 1) {
      setCurrentState("all");
    }
  }, [filter, searchTerm]);

  return { currentState, setCurrentState };
};

export default useCurrentState;
