import {
  AppShell,
  Aside,
  Burger,
  Center,
  Footer,
  Header,
  MediaQuery,
  useMantineTheme,
} from "@mantine/core";
import { useState } from "react";
import useCurrentState from "../hooks/useCurrentState";
import useDefaultMovies from "../hooks/useDefaultMovies";
import useFilter from "../hooks/useFilter";
import useLoading from "../hooks/useLoading";
import useSearch from "../hooks/useSearch";
import { LayoutProps } from "../utils/typings";
import Body from "./Body";
import FooterMain from "./Footer";
import Heading from "./Heading";
import NavigationBar from "./NavigationBar";
import SideBar from "./SideBar";

export default function Layout({ children, isPathRoot }: LayoutProps) {
  const theme = useMantineTheme();
  const [opened, setOpened] = useState(false);
  const [filter, setFilter] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const { filterData, filterLoading } = useFilter({ filter });
  const { searchData, searchLoading } = useSearch({ search: searchTerm });
  const { defaultLoading } = useDefaultMovies(1);

  const { currentState, setCurrentState } = useCurrentState({
    filter,
    searchTerm,
  });

  const isLoaded = useLoading({ filterLoading, searchLoading, defaultLoading });

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
          navbarOffsetBreakpoint="xs"
          asideOffsetBreakpoint="sm"
          navbar={
            <NavigationBar
              currentState={currentState}
              setCurrentState={setCurrentState}
              setSearchTerm={setSearchTerm}
              setFilter={setFilter}
              hidden={!opened}
              opened={opened}
              setOpen={setOpened}
              p="md"
              hiddenBreakpoint="xs"
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
                    searchTerm={searchTerm}
                    filter={filter}
                    setFilter={setFilter}
                    setSearchTerm={setSearchTerm}
                  />
                </Center>
              </Aside>
            </MediaQuery>
          }
          footer={
            <Footer
              p="md"
              className="translate-y-2 xs:mb-1 sm:mb-2"
              height={50}
            >
              <FooterMain />
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
          <Body
            filter={filter}
            filterData={filterData}
            filterLoading={filterLoading}
            searchData={searchData}
            currentState={currentState}
            isLoaded={isLoaded}
            setSearchTerm={setSearchTerm}
            setFilter={setFilter}
            searchTerm={searchTerm}
            setCurrentState={setCurrentState}
          >
            {children}
          </Body>
        </AppShell>
      )}
    </>
  );
}
