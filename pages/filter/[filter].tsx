import React from "react";
import { useRouter } from "next/router";

const Filter = () => {
  const router = useRouter();
  const { filter } = router.query;
  console.log(router.query);

  return (
    <div>
      <h1>Filter</h1>
      {filter}
    </div>
  );
};

export default Filter;
