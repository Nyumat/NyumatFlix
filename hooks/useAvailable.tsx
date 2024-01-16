import axios from "axios";
import React from "react";
import { useEffect, useMemo } from "react";

const useAvailable = (id: number) => {
  const [isAvailable, setIsAvailable] = React.useState<boolean>(false);
  const expensiveCalculation = (id: number): boolean => {
    axios
      .get(`http://localhost:3000/api/verify/${id}`)
      .then((res) => {
        if (res.data.status === 1) {
          setIsAvailable(true);
          return true;
        }
      })
      .catch((err) => {
        setIsAvailable(false);
        console.error(err);
      });
    return false;
  };
  const calculation = useMemo(() => expensiveCalculation(id), [id]);
  useEffect(() => {
    setIsAvailable(calculation);
  }, [calculation]);
  return { isAvailable };
};

export default useAvailable;
