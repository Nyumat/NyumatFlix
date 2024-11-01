import { Carousel } from "@mantine/carousel";
import {
  Badge,
  Box,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Transition,
} from "@mantine/core";
import { IconCalendar, IconChevronLeft, IconStar } from "@tabler/icons-react";
import { Actor, Movie } from "@utils/typings";
import axios from "axios";
import { hasFlag } from "country-flag-icons";
import getUnicodeFlagIcon from "country-flag-icons/unicode";
import moment from "moment";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

interface PlayerProps {
  movie: Movie;
  actors: Actor[];
  url?: string;
}

const WatchMovie = ({ movie, actors, url }: PlayerProps) => {
  const router = useRouter();
  const { id } = router.query;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  if (!url) {
    return (
      <Container
        size="xl"
        className="h-screen flex items-center justify-center"
      >
        <Text size="xl" weight={700} color="dimmed">
          Movie not available
        </Text>
      </Container>
    );
  }

  const CastCarousel = () => (
    <Carousel
      dragFree
      withControls
      slideSize="25%"
      slideGap="md"
      align="start"
      classNames={{
        root: "px-4",
        control:
          "bg-neutral-600 hover:bg-blue-700/50 transition-colors duration-200",
        indicators: "gap-2",
        indicator: "bg-neutral-600/50 w-2 h-2 transition-colors duration-200",
      }}
    >
      {actors.map((actor) => (
        <Carousel.Slide key={actor.id}>
          <Paper
            shadow="lg"
            radius="md"
            p="md"
            withBorder={false}
            className="h-full py-4"
          >
            <Stack spacing="xs" align="center">
              <Box className="relative w-40 h-40 rounded-full overflow-hidden py-6">
                <Image
                  src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                  alt={actor.name}
                  fill
                  className="object-cover"
                />
              </Box>
              <Text
                size="sm"
                weight={600}
                align="center"
                className="text-white"
              >
                {actor.name}
              </Text>
              <Text
                size="xs"
                color="dimmed"
                align="center"
                className="text-gray-400"
              >
                {actor.character}
              </Text>
            </Stack>
          </Paper>
        </Carousel.Slide>
      ))}
    </Carousel>
  );

  const MoviePlayer = () => (
    <Box className="relative aspect-video w-full max-w-7xl mx-auto rounded-lg overflow-hidden shadow-xl">
      <iframe
        src={url}
        allowFullScreen
        className="absolute inset-0 w-full h-full"
        title={movie.title}
      />
    </Box>
  );

  const Hero = () => (
    <Box
      className="relative h-[70vh] w-full bg-cover bg-center"
      sx={{
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.9))`,
        },
      }}
    >
      <Box
        className="absolute inset-0 z-0 rounded-md"
        sx={{
          backgroundImage: `url(https://image.tmdb.org/t/p/original${movie.backdrop_path})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          filter: "blur(2.5px)",
        }}
      />

      {/* black div overlays */}
      <div className="absolute inset-0 z-0 bg-black/60 rounded-md -m-2"></div>

      <Container size="xl" className="relative h-full z-10">
        <Group position="apart" className="h-full">
          <Stack spacing="xl" className="max-w-2xl">
            <Group>
              <IconChevronLeft
                className="cursor-pointer text-white hover:text-blue-400 transition-colors"
                size={32}
                onClick={() => router.back()}
              />
            </Group>

            <Stack spacing="md">
              <Text
                component="h1"
                size="xl"
                weight={700}
                color="white"
                className="text-5xl font-bold"
              >
                {movie.title}
              </Text>

              <Group spacing="md">
                <Badge
                  size="lg"
                  variant="gradient"
                  gradient={{ from: "gray", to: "gray" }}
                  leftSection={<IconCalendar size={14} />}
                >
                  {moment(movie.release_date).format("MMM DD, YYYY")}
                </Badge>
                {/* stubc2 */}
                <Badge
                  size="lg"
                  variant="gradient"
                  gradient={{ from: "gray", to: "gray" }}
                  leftSection={<IconStar fill="#ffd700" size={14} />}
                >
                  {movie.vote_average.toFixed(1)}
                </Badge>

                <Badge
                  size="lg"
                  variant="gradient"
                  gradient={{ from: "gray", to: "gray" }}
                >
                  {hasFlag(movie.origin_country[0]) && (
                    <p className="scale-150">
                      {getUnicodeFlagIcon(movie.origin_country[0])}
                    </p>
                  )}
                </Badge>
              </Group>

              <Text className="text-gray-300 text-lg leading-relaxed">
                {movie.overview}
              </Text>

              <Group spacing="xs">
                {movie.genres.map((genre) => (
                  <Badge
                    key={genre.id}
                    size="lg"
                    radius="sm"
                    variant="dot"
                    className="bg-blue-900/50"
                  >
                    {genre.name}
                  </Badge>
                ))}
              </Group>
            </Stack>
          </Stack>

          <Box
            className="hidden lg:block relative w-72 h-[450px] overflow-hidden shadow-2xl"
            sx={{
              "&::after": {
                content: '""',
                position: "absolute",
                inset: 0,
                boxShadow: "inset 0 0 2000px rgba(255, 255, 255, .3)",
                filter: "blur(10px)",
              },
            }}
          >
            <Image
              src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              alt={movie.title}
              fill
              className="object-cover rounded-md"
            />
          </Box>
        </Group>
      </Container>
    </Box>
  );

  return (
    <>
      <Head>
        <title>{movie.title} | NyumatFlix</title>
        <meta
          name="description"
          content={`Watch ${movie.title} on NyumatFlix`}
        />
        <meta property="og:title" content={`${movie.title} | NyumatFlix`} />
        <meta
          property="og:description"
          content={`Watch ${movie.title} on NyumatFlix`}
        />
        <meta property="og:image" content="/preview.png" />
        <meta
          property="og:url"
          content={`https://nyumatflix.com/movies/watch/${id}`}
        />
      </Head>

      <Transition mounted={loaded} transition="fade" duration={400}>
        {(styles) => (
          <Box style={styles}>
            <Hero />

            <Container size="xl" py="xl">
              <Stack spacing="xl">
                <MoviePlayer />

                <Paper shadow="sm" radius="lg" p="xl">
                  <Stack spacing="xl">
                    <Group position="center">
                      <Text size="xl" weight={700} className="text-white">
                        Cast
                      </Text>
                    </Group>
                    <CastCarousel />
                  </Stack>
                </Paper>
              </Stack>
            </Container>
          </Box>
        )}
      </Transition>
    </>
  );
};

export async function getServerSideProps(context) {
  const { id } = context.query;
  const url = process.env.NYUMATFLIX_VPS + "?tmdb=" + `${id}`;

  if (id === undefined) {
    return { notFound: true };
  }

  const movieDetails = await axios.get(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.API_KEY}&language=en-US`,
  );

  const staffData = await axios.get(
    `https://api.themoviedb.org/3/movie/${id}/credits?api_key=${process.env.API_KEY}&language=en-US`,
  );

  const nonNullPosterCast = staffData.data.cast.filter(
    (actor: Actor) => actor.profile_path !== null,
  );
  const sortedTopTenCast = nonNullPosterCast
    .sort((a: Actor, b: Actor) => b.popularity - a.popularity)
    .slice(0, 10);

  return {
    props: {
      movie: movieDetails.data,
      actors: sortedTopTenCast,
      url: url,
    },
  };
}

export default WatchMovie;
