import { useRouter } from "next/router";
import { useState } from "react";
import Card from "../../components/Card";
import useFilter from "../../hooks/useFilter";

const Filter = () => {
  const router = useRouter();
  const { filter } = router.query;
  const { filterData } = useFilter({ filter });
  const [, setShow] = useState<boolean>(false);

  //console.log("Filter: ", filter);

  //console.log(router);

  return (
    <div>
      <h1>Filter {filter}</h1>
      {filterData && filterData.filter_data.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filterData.filter_data.map((movie, index) => (
            <span
              key={index}
              onClick={() => setShow(true)}
              tabIndex={0}
              role="button"
              onKeyDown={() => setShow(true)}
            >
              <Card key={index} item={movie} />
            </span>
          ))}
        </div>
      ) : (
        <h1 className="text-2xl text-center">
          No movies found with these filters.
        </h1>
      )}
    </div>
  );
};

export default Filter;
