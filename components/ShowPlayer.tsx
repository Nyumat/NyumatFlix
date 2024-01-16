import React from "react";

interface ShowPlayerProps {
  id: string;
  url?: string;
}

const ShowPlayer = ({ url }: ShowPlayerProps) => {
  return (
    <>
      <div className="flex flex-row items-center justify-center">
        <iframe
          src={`${url}`}
          allowFullScreen
          width={1920}
          height={1080}
          title="movie"
          security="restricted"
          className="pl-4 w-10/12 h-[50vh] mb-32"
        />
      </div>
    </>
  );
};

export default ShowPlayer;
