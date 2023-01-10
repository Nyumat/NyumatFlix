import { useState, useEffect } from "react";
import {
  AppShell,
  Navbar,
  Header,
  Aside,
  Footer,
  Text,
  MediaQuery,
  Burger,
  useMantineTheme,
  Center,
} from "@mantine/core";
import NavigationBar from "./NavigationBar";
import SideBar from "./SideBar";
import FooterMain from "./Footer";
import { LayoutProps } from "../typings";
import Heading from "./Heading";
import PopOutTransition from "./PopOutTransition";
import UpUpTransition from "./UpUpTransition";

export default function Layout({ children, isPathRoot }: LayoutProps) {
  const theme = useMantineTheme();
  const [opened, setOpened] = useState(false);

  return (
    <>
      {isPathRoot ? (
        <>
          <>{children}</>
        </>
      ) : (
        <AppShell
          styles={{
            main: {
              background:
                theme.colorScheme === "dark"
                  ? theme.colors.dark[7]
                  : theme.colors.gray[0],
            },
          }}
          navbarOffsetBreakpoint="sm"
          asideOffsetBreakpoint="sm"
          navbar={
            <NavigationBar
              hidden={!opened}
              p="md"
              hiddenBreakpoint="sm"
              width={{ sm: 200, lg: 300 }}
            />
          }
          aside={
            <MediaQuery smallerThan="sm" styles={{ display: "none" }}>
              <Aside p="md" hiddenBreakpoint="sm" width={{ sm: 200, lg: 300 }}>
                <Center>
                  <SideBar />
                </Center>
              </Aside>
            </MediaQuery>
          }
          footer={
            <Footer p="md" height={60}>
              <FooterMain
                height={60}
                p={"md"}
                links={[{ link: "", label: "" }]}
              />
            </Footer>
          }
          header={
            <Header height={{ base: 50, md: 70 }} p="md">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <MediaQuery largerThan="sm" styles={{ display: "none" }}>
                  <Burger
                    opened={opened}
                    onClick={() => setOpened((o) => !o)}
                    size="sm"
                    color={theme.colors.gray[6]}
                    mr="xl"
                  />
                </MediaQuery>

                <Heading />
              </div>
            </Header>
          }
        >
          <PopOutTransition>{children}</PopOutTransition>
        </AppShell>
      )}
    </>
  );
}
