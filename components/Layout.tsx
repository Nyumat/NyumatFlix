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
  Loader,
} from "@mantine/core";
import NavigationBar from "./NavigationBar";
import SideBar from "./SideBar";
import FooterMain from "./Footer";
import { LayoutProps } from "../typings";
import Heading from "./Heading";
import UpUpTransition from "./UpUpTransition";
import Body from "./Body";
import useFilter from "../hooks/useFilter";
import useCurrentState from "../hooks/useCurrentState";
import useSearch from "../hooks/useSearch";
import useDefaultMovies from "../hooks/useDefaultMovies";
import useLoading from "../hooks/useLoading";

export default function Layout({ children, isPathRoot }: LayoutProps) {
  const theme = useMantineTheme();
  const [opened, setOpened] = useState(false);
  const [filter, setFilter] = useState<string[]>([""]);
  const [searchTerm, setSearchTerm] = useState("");

  const { filterData, filterLoading, filterError } = useFilter({ filter });
  const { searchData, searchLoading, page, totalPages } = useSearch({
    search: searchTerm,
  });
  const { defaultData, defaultLoading, defaultError } = useDefaultMovies(1);

  const { currentState } = useCurrentState({ filter, searchTerm });

  const isLoaded = useLoading({
    filterLoading,
    searchLoading,
    defaultLoading,
  });

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
              <Aside
                p="md"
                hiddenBreakpoint="sm"
                width={{ sm: 200, lg: 300 }}
                className="overflow-scroll"
              >
                <Center>
                  <SideBar
                    filter={filter}
                    setFilter={setFilter}
                    setSearchTerm={setSearchTerm}
                  />
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
          <UpUpTransition>
            <div>
              <Body
                filter={filter}
                filterData={filterData}
                filterLoading={filterLoading}
                searchData={searchData}
                currentState={currentState}
                isLoaded={isLoaded}
              >
                {children}
              </Body>
            </div>
          </UpUpTransition>
        </AppShell>
      )}
    </>
  );
}
