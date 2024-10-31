import { motion } from "framer-motion";
import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";

const Home: NextPage = () => {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      await router.prefetch("/home");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-shark-50 flex min-h-screen flex-col items-start justify-center">
      <Head>
        <title>NyumatFlix - Home</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="The home page for NyumatFlix." />
        <meta property="og:title" content="NyumatFlix - Home" key="ogtitle" />
        <meta
          property="og:description"
          content="The home page for NyumatFlix."
          key="ogdesc"
        />
        <meta property="og:image" content="/preview.png" key="ogimage" />
        <meta property="og:url" content="https://nyumatflix.com" key="ogurl" />
      </Head>

      <div className="bg-movie-banner flex w-full pt-8 flex-1 flex-col items-center justify-center px-20 text-center"></div>
      <main className="flex w-full pt-12 flex-1 flex-col items-center justify-center px-20 text-center">
        <motion.div
          animate={{
            opacity: 1,
            y: 0,
            x: 0,
          }}
          initial={{
            opacity: 0,
            y: 200,
          }}
          transition={{
            duration: 2.2,
            ease: "anticipate",
          }}
        >
          <h1
            className="text-6xl xs:text-6xl sm:text-7xl lg:text-7xl xl:text-8xl font-bold drop-shadow-2xl"
            style={{
              textShadow: `
              -2px -2px 0 #000,  
               2px -2px 0 #000,
              -2px  2px 0 #000,
               2px  2px 0 #000
            `,
            }}
          >
            NyumatFlix
          </h1>
        </motion.div>

        <motion.div
          animate={{
            opacity: 1,
            y: 0,
            x: 0,
          }}
          initial={{
            opacity: 0,
            y: -40,
          }}
          transition={{
            duration: 1.2,
            ease: "easeInOut",
            delay: 1.0,
          }}
        >
          <p
            className="mt-3 text-2xl lg:text-4xl md:text-2xl drop-shadow-2xl font-semibold whitespace-nowrap"
            style={{
              textShadow: `
              -1px -1px 0 #000,  
               1px -1px 0 #000,
              -1px  1px 0 #000,
               1px  1px 0 #000
            `,
            }}
          >
            Streaming made simple.
          </p>
        </motion.div>

        {/* Need this old reference from prior to App shell.
        <div className="flex flex-wrap items-center justify-around max-w-4xl mt-6 sm:w-full"></div> */}
        <motion.div
          animate={{
            opacity: 1,
            y: 0,
          }}
          initial={{
            opacity: 0,
            y: 0,
          }}
          transition={{
            duration: 1.0,
            ease: "easeOut",
            delay: 2.0,
          }}
        >
          <span className="flex flex-col gap-2 mt-6 justify-center items-center scale-125">
            <Link
              href="/home"
              className="relative inline-flex items-center justify-start px-8 py-4 overflow-hidden font-bold rounded-full group"
            >
              <button className="px-8 py-0.5  border-2 border-black uppercase bg-white text-neutral-700 text-sm shadow-[1px_1px_rgba(0,0,0),2px_2px_rgba(0,0,0),3px_3px_rgba(0,0,0),4px_4px_rgba(0,0,0),5px_5px_0px_0px_rgba(0,0,0)] transition duration-200">
                Get Started
              </button>
            </Link>

            <Link
              href="https://github.com/Nyumat/NyumatFlix"
              className="relative inline-flex items-center justify-start px-3 py-4 overflow-hidden font-bold hover:underline"
            >
              Learn More
            </Link>
          </span>
        </motion.div>
      </main>

      {/* This may be needed if the component isn't as large
       <footer className="flex h-12 w-full items-center justify-center border-t">
        <div className="flex items-center justify-center gap-2">
          Copyright © 2021
          <a
            className="hover:underline"
            href="https://github.com/nyumat/nyumatflix"
            target="_blank"
            rel="noopener noreferrer"
          >
            NyumatFlix
          </a>
        </div>
      </footer> */}
    </div>
  );
};

export default Home;
