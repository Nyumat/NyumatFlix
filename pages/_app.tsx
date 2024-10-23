import { MantineProvider } from "@mantine/core";
import "@styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Layout from "../components/Layout";

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
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta name="theme-color" content="#000000" />
        <meta
          name="description"
          content="The best streaming service for all your needs."
        />
        <meta property="og:image" content="/preview.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:title"
          content="NyumatFlix - Streaming, Streamlined."
        />
        <meta
          property="og:description"
          content="The best streaming service for all your needs."
        />
        <meta property="og:url" content="https://nyumatflix.com" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="NyumatFlix" />
        <meta property="og:locale" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="NyumatFlix - Streaming, Streamlined."
        />
        <meta
          name="twitter:description"
          content="The best streaming service for all your needs."
        />
        <meta name="twitter:image" content="/preview.jpg" />
        <meta name="twitter:site" content="https://nyumatflix.com" />
        <meta name="twitter:creator" content="@notnyumat" />
        <meta name="twitter:domain" content="nyumatflix.com" />
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
          <Analytics />
        </Layout>
      </MantineProvider>
    </>
  );
};

export default MyApp;
