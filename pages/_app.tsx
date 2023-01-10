import "../styles/globals.css";
import { AppProps } from "next/app";
import Head from "next/head";
import { MantineProvider } from "@mantine/core";
import UpUpTransition from "../components/UpUpTransition";
import Layout from "../components/Layout";
import { useEffect } from "react";
import { useRouter } from "next/router";

const MyApp = (props: AppProps) => {
  const { Component, pageProps } = props;
  const router = useRouter();

  const isPathRoot = router.pathname === "/";

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    document.documentElement.style.opacity = "1";
  }, []);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
        <title>NyumatFlix - Streaming, Streamlined.</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <MantineProvider
        withGlobalStyles
        withNormalizeCSS
        theme={{
          colorScheme: "dark",
        }}
      >
        {/* <UpUpTransition> This is the transition that causes the issue */}
        <Layout isPathRoot={isPathRoot}>
          <Component {...pageProps} />
        </Layout>
        {/* </UpUpTransition> */}
      </MantineProvider>
    </>
  );
};

export default MyApp;
