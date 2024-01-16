import React from "react";

function useBreakpointDebug() {
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}

export function BreakpointDebug() {
  const width = useBreakpointDebug();
  const breakpoint =
    width < 640
      ? "sm"
      : width < 768
        ? "md"
        : width < 1024
          ? "lg"
          : width < 1280
            ? "xl"
            : "2xl";
  return (
    <div className=" fixed top-0 right-2 p-2 bg-gray-800 text-white rounded-md shadow-md z-50">
      Current Breakpoint: <span className="font-bold">{breakpoint}</span>
    </div>
  );
}
