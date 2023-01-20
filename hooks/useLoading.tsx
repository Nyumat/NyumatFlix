import React from "react";

interface useLoadingProps {
  filterLoading: boolean;
  searchLoading: boolean;
  defaultLoading: boolean;
}

const useLoading = ({
  filterLoading,
  searchLoading,
  defaultLoading,
}: useLoadingProps) => {
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    if (filterLoading || searchLoading || defaultLoading) {
      setIsLoaded(false);
    } else {
      setIsLoaded(true);
    }
  }, [filterLoading, searchLoading, defaultLoading]);

  return isLoaded;
};

export default useLoading;
