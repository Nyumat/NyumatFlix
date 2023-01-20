import { useState, useEffect } from "react";

export default function useDebounceSearch<T>(value: T, delay: number): T {
  const [debouncedSearch, setDebouncedString] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedString(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedSearch;
}
