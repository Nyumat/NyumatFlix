import { Marquee } from "@devnomic/marquee";
import "@devnomic/marquee/dist/index.css";
import Image from "next/legacy/image";

interface StreamingService {
  filePath: string;
  name: string;
}

const services: StreamingService[] = [
  {
    filePath: "/peacock.svg",
    name: "Peacock",
  },
  {
    filePath: "/hbomax.svg",
    name: "HBO Max",
  },
  {
    filePath: "/hulu.svg",
    name: "Hulu",
  },
  {
    filePath: "/netflix.svg",
    name: "Netflix",
  },
  {
    filePath: "/appletvplus.svg",
    name: "Apple TV",
  },
  {
    filePath: "/disneyplus.svg",
    name: "Disney+",
  },
  {
    filePath: "/primevideo.svg",
    name: "Prime Video",
  },
];

export default function Sponsors() {
  return (
    <section
      id="sponsors"
      className="w-full max-w-full mx-auto overflow-hidden"
    >
      <h2 className="text-sm font-extralight sm:text-base md:text-lg lg:text-xl max-w-screen-sm mx-auto text-center select-none pointer-events-none px-4 mb-6">
        Curated from all the <span className="line-through">expensive ass</span>{" "}
        streaming services below, Nyumatflix is a no-cost, ad-free, and
        open-source aggregator.
      </h2>

      <div className="w-full overflow-hidden">
        <Marquee
          className="gap-[2rem] sm:gap-[3rem]"
          fade
          innerClassName="gap-[2rem] sm:gap-[3rem]"
        >
          {services.map(({ filePath, name }) => (
            <div
              key={name}
              className="flex flex-col items-center text-xl md:text-2xl font-medium select-none pointer-events-none"
            >
              <Image
                src={filePath}
                alt={name}
                width={80}
                height={80}
                className="flex-none w-16 h-16 sm:w-20 sm:h-20 grayscale select-none pointer-events-none"
                unselectable="on"
              />
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
