import { Carousel } from "@mantine/carousel";
import Image from "next/image";
import { Actor } from "../utils/typings";

function CastCarousel({ actors }: { actors: Actor[] }) {
  return (
    actors && (
      <Carousel
        withControls
        dragFree
        withIndicators
        slideSize="33.333333%"
        slideGap="lg"
        breakpoints={[
          { maxWidth: "md", slideSize: "50%" },
          { maxWidth: "sm", slideSize: "100%", slideGap: 0 },
        ]}
        loop
        align="start"
        styles={{
          control: {
            width: 40,
            height: 40,
            cursor: "default",
            backgroundColor: "#1303fc",
            color: "white",
            "&:hover": {
              background:
                "linear-gradient(180deg, rgba(2,0,36,1) 0%, rgba(9,9,121,1) 0%, rgba(0,212,255,1) 100%)",
            },
            "&:active": {
              background:
                "linear-gradient(90deg, rgba(2,0,36,1) 0%, rgba(9,9,121,1) 50%, rgba(0,212,255,1) 100%)",
            },
          },
        }}
      >
        {actors.map((actor: Actor) => (
          <div key={actor.id} className="flex flex-col items-center">
            <div className="flex flex-row gap-0 -my-16 justify-center scale-50 items-start">
              <Image
                src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                alt={actor.name}
                width={180}
                height={200}
                className="shadow-lg rounded-full max-w-full h-auto align-middle border-none"
              />
            </div>
            <p className="text-xl font-bold text-white text-center mx-16 h-min pb-4">
              {actor.name}
            </p>
          </div>
        ))}
      </Carousel>
    )
  );
}

export default CastCarousel;
