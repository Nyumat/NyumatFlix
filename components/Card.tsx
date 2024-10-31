import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Card as MantineCard,
  Modal,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  IconDeviceTv,
  IconInfoCircle,
  IconMovie,
  IconPlayerPlay,
} from "@tabler/icons";
import { MapGenreMovie, MediaItem, Movie, TvShow } from "@utils/typings";
import moment from "moment";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";

interface CardProps {
  item: MediaItem | Movie | TvShow;
  mediaType: "movie" | "tv";
}

export default function Component({ item, mediaType }: CardProps) {
  const router = useRouter();
  const [previewOpened, { open: openPreview, close: closePreview }] =
    useDisclosure(false);
  const [isLongPressed, setIsLongPressed] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const handleWatch = () => {
    router.push(
      `/${mediaType === "movie" ? "movies" : "tvshows"}/watch/${item.id}`,
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleWatch();
    }
  };

  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      setIsLongPressed(true);
      openPreview();
    }, 1000);
    return () => clearTimeout(timer);
  };

  const handleTouchEnd = () => {
    if (!isLongPressed && !previewOpened) {
      handleWatch();
    }
    setIsLongPressed(false);
  };

  if (!item) return null;

  console.log({
    itemFirstAirDate: item.first_air_date,
    itemReleaseDate: item.release_date,
    mediaType,
  });

  return (
    <>
      <MantineCard
        p={0}
        radius="md"
        className="w-full transition-transform duration-300 cursor-pointer bg-transparent border-0 hover:scale-105 hover:z-10"
        tabIndex={0}
        role="button"
        aria-label={item.title}
        onKeyDown={handleKeyDown}
        onClick={isMobile ? undefined : undefined}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        <div className="relative aspect-[2/3] w-full">
          <Image
            src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
            alt={item.title}
            className="rounded-lg object-cover"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority
          />

          {!isMobile && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300">
              <Group spacing="md">
                <Tooltip label="Watch">
                  <ActionIcon
                    variant="filled"
                    color="blue"
                    size="xl"
                    radius="xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWatch();
                    }}
                  >
                    <IconPlayerPlay size={20} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Preview">
                  <ActionIcon
                    variant="filled"
                    color="gray"
                    size="xl"
                    radius="xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPreview();
                    }}
                  >
                    <IconInfoCircle size={20} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </div>
          )}

          {item.vote_average > 0 && (
            <Badge
              className="absolute top-2 right-2 bg-black/60 backdrop-blur-md"
              radius="sm"
              size="sm"
              color={
                item.vote_average >= 7
                  ? "green"
                  : item.vote_average >= 5
                    ? "yellow"
                    : "red"
              }
            >
              {item.vote_average.toFixed(1)}
            </Badge>
          )}
        </div>

        <Stack spacing={4} className="p-2">
          <Text size="sm" weight={500} lineClamp={1} className="text-white">
            {item.title}
          </Text>

          <Group position="apart" spacing={8}>
            {item.release_date && (
              <Text size="xs" className="text-gray-400">
                {moment(item.release_date).format("MMMM Do, YYYY")}
              </Text>
            )}
            {item.adult && (
              <Badge size="sm" color="red">
                18+
              </Badge>
            )}
          </Group>

          {item.genre_ids && (
            <Group spacing={4}>
              {item.genre_ids.slice(0, 2).map((genreId) => (
                <Badge
                  key={genreId}
                  size="sm"
                  variant="filled"
                  color="gray"
                  className="opacity-75"
                >
                  {MapGenreMovie[genreId]}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
      </MantineCard>

      <Modal
        opened={previewOpened}
        onClose={closePreview}
        title={item.title}
        size="lg"
        centered
      >
        <Stack spacing="md">
          <Group spacing="md" align="flex-start">
            {item.trailerUrl && (
              <div className="relative w-full aspect-video mb-4">
                <iframe
                  src={item.trailerUrl}
                  title="Trailer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="rounded-md w-full h-full"
                />
              </div>
            )}
            <div className="relative w-[200px] aspect-[2/3]">
              <Image
                src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                alt={item.title}
                className="rounded-md object-cover"
                fill
                sizes="200px"
              />
            </div>
            <Stack spacing="xs" style={{ flex: 1 }}>
              <Group position="apart">
                <Text size="xl" weight={600}>
                  {item.title}
                </Text>
                {item.vote_average > 0 && (
                  <Badge size="lg" variant="filled" color="blue">
                    {item.vote_average.toFixed(1)}
                  </Badge>
                )}
              </Group>

              <Text size="sm" color="dimmed">
                {mediaType === "movie"
                  ? moment(item.release_date).format("MMMM Do, YYYY")
                  : moment(item.first_air_date).format("MMMM Do, YYYY")}
              </Text>

              {item.overview && (
                <Text size="sm" lineClamp={4}>
                  {item.overview}
                </Text>
              )}

              <Group spacing="xs">
                {item.adult && <Badge color="red">18+</Badge>}
                {mediaType === "movie" ? (
                  <Badge leftSection={<IconMovie size={12} />}>Movie</Badge>
                ) : (
                  <Badge leftSection={<IconDeviceTv size={12} />}>
                    TV Show
                  </Badge>
                )}
                {item.original_language && (
                  <Badge color="gray">
                    {item.original_language.toUpperCase()}
                  </Badge>
                )}
              </Group>

              <Button
                variant="filled"
                color="blue"
                size="sm"
                radius="sm"
                fullWidth={false}
                className="w-1/2 mt-4"
                onClick={handleWatch}
              >
                Watch Now
              </Button>
            </Stack>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
