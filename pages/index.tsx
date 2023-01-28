import { Button, UnstyledButton } from "@mantine/core";
import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import Lottie from "lottie-react";

const Home: NextPage = () => {
  return (
    <div className="text-shark-50 flex min-h-screen flex-col items-start justify-center">
      <Head>
        <title>NyumatFlix - Streaming, Streamlined.</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="bg-movie-banner flex w-full pt-8 flex-1 flex-col items-center justify-center px-20 text-center"></div>
      <main className="flex w-full pt-8 flex-1 flex-col items-center justify-center px-20 text-center">
        <div className="">
          {/* <Lottie animationData={require("../public/movie.json")} /> */}
        </div>
        <motion.div
          animate={{
            opacity: 1,
            y: 0,
          }}
          initial={{
            opacity: 0,
            y: 100,
          }}
          transition={{
            duration: 1.5,
            ease: "easeOut",
          }}
        >
          <h1 className="text-6xl sm:text-6xl lg:text-8xl md:7xl font-bold drop-shadow-2xl">
            NyumatFlix
          </h1>
        </motion.div>
        <motion.div
          animate={{
            opacity: 1,
            y: 0,
          }}
          initial={{
            opacity: 0,
            y: 60,
          }}
          transition={{
            duration: 2.0,
            ease: "easeOut",
          }}
        >
          <p className="mt-3 text-2xl lg:text-4xl md:text-2xl drop-shadow-2xl">
            Streaming, Streamlined.
          </p>
        </motion.div>
        {/* Need this old reference from prior to Appshell.
        <div className="flex flex-wrap items-center justify-around max-w-4xl mt-6 sm:w-full"></div> */}
        <motion.div
          animate={{
            opacity: 1,
            y: 0,
          }}
          initial={{
            opacity: 0,
            y: 60,
          }}
          transition={{
            duration: 2.8,
            ease: "easeOut",
          }}
        >
          <span className="flex flex-row gap-2 mt-6">
            <Link href="/home">
              <UnstyledButton
                className="bg-shark-100  bg-clip-padding backdrop-filter backdrop-blur-3xl bg-opacity-60 hover:bg-opacity-100
               inline-block rounded border border-current px-8 py-3 text-xl font-bold text-shark-600 transition duration-[200ms] hover:scale-110 hover:shadow-xl focus:outline-none focus:ring active:text-shark-500 hover:ease-in ease-linear"
              >
                Get Started
              </UnstyledButton>
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
