import { ActionIcon, Group } from "@mantine/core";
import {
  IconBrandGithub,
  IconBrandNextjs,
  IconBrandReact,
  IconBrandTypescript,
} from "@tabler/icons";

/*
const useStyles = createStyles((theme) => ({
  footer: {
    borderTop: `1px solid ${
      theme.colorScheme === "dark" ? theme.colors.dark[5] : theme.colors.gray[2]
    }`,
  },

  inner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: `${theme.spacing.md}px ${theme.spacing.md}px`,

    [theme.fn.smallerThan("sm")]: {
      flexDirection: "column",
    },
  },
}));

interface FooterCenteredProps {
  links?: { link: string; label: string }[];
  height?: number;
  p?: string;
}
*/

const FooterMain = () => {
  return (
    <div className="px-4 pt-2 top-0 absolute right-0 flex flex-row gap-4">
      <p className="pt-1">NyumatFlix is Built with:</p>
      <Group spacing="xs" position="right" noWrap>
        <a href="https://github.com/Nyumat/NyumatFlix" target="_blank">
          <ActionIcon
            aria-label="GitHub"
            size="lg"
            variant="default"
            radius="xl"
          >
            <IconBrandGithub size={18} stroke={1.5} />
          </ActionIcon>
        </a>
        <a href="https://nextjs.org/" target="_blank">
          <ActionIcon
            aria-label="NextJS"
            size="lg"
            variant="default"
            radius="xl"
          >
            <IconBrandNextjs size={18} stroke={1.5} />
          </ActionIcon>
        </a>
        <a href="https://react.dev" target="_blank">
          <ActionIcon
            aria-label="React"
            size="lg"
            variant="default"
            radius="xl"
          >
            <IconBrandReact size={18} stroke={1.5} />
          </ActionIcon>
        </a>
        <a href="https://www.typescriptlang.org/" target="_blank">
          <ActionIcon
            aria-label="Typescript"
            size="lg"
            variant="default"
            radius="xl"
          >
            <IconBrandTypescript size={18} stroke={1.5} />
          </ActionIcon>
        </a>
      </Group>
    </div>
  );
};

export default FooterMain;
