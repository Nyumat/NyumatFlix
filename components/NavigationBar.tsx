{
  /* <Navbar.Section className="flex items-center px-6 py-4">
  <Link href="/">
    <Image src="/logo.png" alt="NyumatFlix" width={100} height={100} />
  </Link>
</Navbar.Section> */
}
import { FC, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import IconPytorchlightning from "../icons/Zap";
import { useRouter } from "next/router";
import {
  Navbar,
  Center,
  Tooltip,
  UnstyledButton,
  createStyles,
  Stack,
} from "@mantine/core";
import {
  TablerIcon,
  IconHome2,
  IconGauge,
  IconDeviceDesktopAnalytics,
  IconFingerprint,
  IconCalendarStats,
  IconUser,
  IconSettings,
  IconLogout,
  IconSwitchHorizontal,
} from "@tabler/icons";
import { motion, AnimatePresence } from "framer-motion";

const useStyles = createStyles((theme) => ({
  link: {
    width: 50,
    height: 50,
    borderRadius: theme.radius.md,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color:
      theme.colorScheme === "dark"
        ? theme.colors.dark[0]
        : theme.colors.gray[7],

    "&:hover": {
      backgroundColor:
        theme.colorScheme === "dark"
          ? theme.colors.dark[5]
          : theme.colors.gray[0],
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
}

function NavbarLink({ icon: Icon, label, active, onClick }: NavbarLinkProps) {
  const { classes, cx } = useStyles();
  return (
    <Tooltip label={label} position="right" transitionDuration={0}>
      <UnstyledButton
        onClick={onClick}
        className={cx(classes.link, { [classes.active]: active })}
      >
        <Icon stroke={1.5} />
      </UnstyledButton>
    </Tooltip>
  );
}

const mockdata = [
  { icon: IconHome2, label: "Home" },
  { icon: IconGauge, label: "Movies" },
  { icon: IconDeviceDesktopAnalytics, label: "TV Shows" },
  { icon: IconCalendarStats, label: "Search" },
  { icon: IconUser, label: "Coming Soon -> Account" },
  { icon: IconSettings, label: "Coming Soon -> Settings" },
];

interface NavigationBarProps {
  hidden?: boolean;
  p?: string;
  hiddenBreakpoint?: any;
  width?: any;
}

export default function NavigationBar({
  hidden,
  p,
  hiddenBreakpoint,
  width,
}: NavigationBarProps) {
  const [active, setActive] = useState(0 as number);
  const router = useRouter();

  const links = mockdata.map((link, index) => (
    <NavbarLink
      {...link}
      key={link.label}
      active={index === active}
      onClick={() => {
        if (link.label.includes("Coming Soon")) return;
        if (link.label.includes("TV")) {
          setActive(index);
          router.push("/tvshows");
          return;
        }
        setActive(index);
        router.push(link.label.toLowerCase());
      }}
    />
  ));

  return (
    <Navbar
      width={{ base: 80 }}
      p={p}
      hiddenBreakpoint={hiddenBreakpoint}
      hidden={hidden}
    >
      <Center>
        <Link href="/">
          <IconPytorchlightning />
        </Link>
      </Center>
      <Navbar.Section grow mt={50}>
        <Stack justify="center" spacing={0}>
          {links}
        </Stack>
        <NavbarLink
          icon={IconSwitchHorizontal}
          label="Coming Soon -> Change account"
        />
        <NavbarLink icon={IconLogout} label="Coming Soon -> Logout" />
      </Navbar.Section>
    </Navbar>
  );
}
