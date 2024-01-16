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
        <title>NyumatFlix - Streaming, Streamlined.</title>
        <link rel="icon" href="/favicon.ico" />
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
          <h1 className="text-6xl xs:text-6xl sm:text-7xl lg:text-7xl xl:text-8xl font-bold drop-shadow-2xl">
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
          <p className="mt-3 text-2xl lg:text-4xl md:text-2xl drop-shadow-2xl font-semibold whitespace-nowrap">
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
          <span className="flex flex-col gap-2 mt-6 justify-center items-center scale-100 xs:scale-90 sm:scale-90 md:scale-95 lg:scale-100 xl:scale-100">
            <Link
              href="/home"
              className="relative inline-flex items-center justify-start px-3 py-4 overflow-hidden font-bold rounded-full group"
            >
              <span className="w-full h-full rotate-45 translate-x-12 -translate-y-2 absolute left-0 top-0 bg-white opacity-[3%]"></span>
              <span className="absolute top-0 left-0 w-48 h-48 -mt-1 transition-all duration-500 ease-in-out rotate-45 -translate-x-56 -translate-y-24 bg-white opacity-100 group-hover:-translate-x-8"></span>
              <span className="relative w-full text-2xl text-left text-white transition-colors duration-200 ease-in-out group-hover:text-gray-900">
                Get Started
              </span>
              <span className="absolute inset-0 border-2 border-white rounded-full"></span>
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
