import { MantineProvider } from "@mantine/core";
import { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Layout from "../components/Layout";
import "@styles/globals.css";

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
        <Layout isPathRoot={isPathRoot}>
          <Component key={router.asPath} {...pageProps} />
        </Layout>
      </MantineProvider>
    </>
  );
};

export default MyApp;
