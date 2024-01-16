import IconPytorchlightning from "@icons/Zap";
import {
  Center,
  Drawer,
  MantineNumberSize,
  Navbar,
  Stack,
  Text,
  createStyles,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { TablerIcon } from "@tabler/icons";
import {
  IconDeviceTv,
  IconFilterSearch,
  IconHome,
  IconMovie,
  IconSearch,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { SetStateAction, useState } from "react";
import { v4 as uuid } from "uuid";

const useStyles = createStyles((theme) => ({
  link: {
    borderRadius: theme.radius.md,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    justifyContent: "center",
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    margin: `6px 0`,
    transition: "color 180ms ease, background-color 180ms ease",
    color: theme.colorScheme === "dark" ? theme.colors.dark[0] : theme.black,
    backgroundColor: "transparent",
    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[4]
          : theme.colors.gray[0],
    },
    "& + &": {
      marginTop: theme.spacing.xs,
    },
  },

  active: {
    "&, &:hover": {
      backgroundColor: theme.fn.variant({
        variant: "light",
        color: theme.primaryColor,
      }).background,
      color: theme.fn.variant({ variant: "light", color: theme.primaryColor })
        .color,
    },
  },
}));

interface NavbarLinkProps {
  icon: TablerIcon;
  label: string;
  active?: boolean;
  onClick?(): void;
  drawer?: boolean;
}

function NavbarLink({
  icon: Icon,
  label,
  active,
  onClick,
  drawer,
}: NavbarLinkProps) {
  const { classes, cx } = useStyles();

  if (drawer) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cx(classes.link, { [classes.active]: active })}
        style={{ cursor: "pointer" }}
        key={label}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onClick?.();
          }
        }}
      >
        <Icon stroke={1.5} width={30} height={30} />
        <Text className="whitespace-nowrap overflow-hidden overflow-ellipsis text-xl">
          {label}
        </Text>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cx(classes.link, { [classes.active]: active })}
      style={{ cursor: "pointer" }}
      key={label}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onClick?.();
        }
      }}
    >
      <Icon stroke={1.5} size={20} width={20} height={20} />
      <Text className="whitespace-nowrap overflow-hidden overflow-ellipsis">
        {label}
      </Text>
    </div>
  );
}

{
  /* <Navbar.Section className="flex items-center px-6 py-4">
  <Link href="/">
    <Image src="/logo.png" alt="NyumatFlix" width={100} height={100} />
  </Link>
</Navbar.Section> */
}

const mockdata = [
  { icon: IconHome, label: "Home" },
  { icon: IconMovie, label: "Movies" },
  { icon: IconDeviceTv, label: "TV Shows" },
  { icon: IconSearch, label: "Search" },
  //   { icon: IconUser, label: "Account" },
  //   { icon: IconSettings, label: "Settings" },
];

const drawerData = [
  { icon: IconHome, label: "Home" },
  { icon: IconMovie, label: "Movies" },
  { icon: IconDeviceTv, label: "TV Shows" },
  { icon: IconFilterSearch, label: "Filters" },
  { icon: IconSearch, label: "Search" },
  //   { icon: IconUser, label: "Account" },
  //   { icon: IconSettings, label: "Settings" },
];

interface NavigationBarProps {
  hidden?: boolean;
  p?: string;
  hiddenBreakpoint?: MantineNumberSize;
  currentState?: string;
  setCurrentState?: React.Dispatch<SetStateAction<string>>;
  setFilter?: React.Dispatch<SetStateAction<string[]>>;
  setSearchTerm?: React.Dispatch<SetStateAction<string>>;
  opened: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function NavigationBar({
  hidden,
  p,
  hiddenBreakpoint,
  setSearchTerm,
  currentState,
  setCurrentState,
  setFilter,
  opened,
  setOpen,
}: NavigationBarProps) {
  const [, setActive] = useState(0 as number);
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const pathnameArray = router.pathname.split("/");
  const route = pathnameArray[1];

  const links = mockdata.map((link, index) => (
    <div className="flex flex-row justify-start items-center" key={uuid()}>
      <NavbarLink
        icon={link.icon}
        key={uuid()}
        active={route === link.label.toLowerCase().split(" ").join("")}
        onClick={() => {
          if (currentState !== "all") {
            setCurrentState?.("all");
            setFilter?.([""]);
            setSearchTerm?.("");
          }
          if (link.label.includes("Coming Soon")) return;
          if (link.label.includes("TV")) {
            setActive(index);
            router.push("/tvshows");
            return;
          }
          setActive(index);
          router.push({ pathname: `/${link.label.toLowerCase()}` });
        }}
        label={link.label}
      />
    </div>
  ));

  const drawerLinks = drawerData.map((link, index) => (
    <div className="flex flex-row justify-start items-center" key={uuid()}>
      <NavbarLink
        drawer
        icon={link.icon}
        key={uuid()}
        active={route === link.label.toLowerCase().split(" ").join("")}
        onClick={() => {
          setOpen(false);
          if (currentState !== "all") {
            setCurrentState?.("all");
            setFilter?.([""]);
            setSearchTerm?.("");
          }
          if (link.label.includes("Coming Soon")) return;
          if (link.label.includes("TV")) {
            setActive(index);
            router.push("/tvshows");
            return;
          }
          if (link.label.includes("Filters")) {
            setActive(index);
            router.push("/genre");
            return;
          }
          setActive(index);
          router.push({ pathname: `/${link.label.toLowerCase()}` });
        }}
        label={link.label}
      />
    </div>
  ));

  return isMobile ? (
    <Drawer
      opened={opened}
      onClose={() => setOpen(false)}
      title="Menu"
      className="text-2xl"
      padding="md"
      size={"sm"}
      transition="slide-right"
    >
      {drawerLinks}
    </Drawer>
  ) : (
    <Navbar
      width={{ base: 160 }}
      p={p}
      hiddenBreakpoint={hiddenBreakpoint}
      hidden={hidden}
    >
      <Center>
        <Link href="/">
          <IconPytorchlightning />
        </Link>
      </Center>
      <Navbar.Section grow mt={25}>
        <Stack justify="center" spacing={0} w={"full"}>
          {links}
        </Stack>
      </Navbar.Section>
    </Navbar>
  );
}
