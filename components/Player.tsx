interface PlayerProps {
  id: string;
  url?: string;
}

export const Player = ({ url }: PlayerProps) => {
  return (
    <>
      <div className="flex flex-row items-center justify-center">
        <iframe
          seamless
          src={`${url}`}
          allowFullScreen
          width={1920}
          height={1080}
          title="movie"
          security="restricted"
          className=" w-8/12 mx-auto mb-12 h-[50dvh]"
        />
      </div>
    </>
  );
};
