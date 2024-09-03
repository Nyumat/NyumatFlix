import { Marquee } from "@devnomic/marquee";
import "@devnomic/marquee/dist/index.css";
import Image from "next/image";
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
    <section id="sponsors" className="max-w-[75%] mx-auto pb-24 sm:pb-32">
      <h2 className="text-lg md:text-xl text-center mb-6 select-none pointer-events-none">
        Curated From All Your Favorite Services
      </h2>

      <div className="mx-auto">
        <Marquee
          className="gap-[3rem]"
          fade
          innerClassName="gap-[3rem]"
        >
          {services.map(({ filePath, name }) => (
            <div
              key={name}
              className="flex flex-col items-center text-xl md:text-2xl font-medium select-none pointer-events-none"
            >
              <Image
                src={filePath}
                alt={name}
                width={100}
                height={100}
                className="flex-none w-20 h-20 mr-4 grayscale select-none pointer-events-none"
                unselectable="on"
              />
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
