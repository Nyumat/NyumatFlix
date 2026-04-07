export type ImageSize = (typeof imageSizes)[keyof typeof imageSizes];
export type PosterSize = keyof typeof imageSizes.poster;
export type BackdropSize = keyof typeof imageSizes.backdrop;
export type ProfileSize = keyof typeof imageSizes.profile;
export type LogoSize = keyof typeof imageSizes.logo;

const imageSizes = {
  backdrop: {
    w300: "w300",
    w780: "w780",
    w1280: "w1280",
    original: "original",
  },
  logo: {
    w45: "w45",
    w92: "w92",
    w154: "w154",
    w185: "w185",
    w300: "w300",
    w500: "w500",
    original: "original",
  },
  poster: {
    w92: "w92",
    w154: "w154",
    w185: "w185",
    w342: "w342",
    w500: "w500",
    w780: "w780",
    original: "original",
  },
  profile: {
    w45: "w45",
    w185: "w185",
    h632: "h632",
    original: "original",
  },
  still: {
    w92: "w92",
    w185: "w185",
    w300: "w300",
    original: "original",
  },
  original: "original",
};

const url = (path: string, type: ImageSize = "original") => {
  if (!path) {
    console.error("Invalid image path provided.");
    return "/placeholder.png";
  }
  return `https://image.tmdb.org/t/p/${type}/${path}`;
};

const poster = (path: string, size: PosterSize = "original") => {
  return url(path, imageSizes.poster[size]);
};

const backdrop = (path: string, size: BackdropSize = "original") => {
  return url(path, imageSizes.backdrop[size]);
};

const profile = (path: string, size: ProfileSize = "original") => {
  return url(path, imageSizes.profile[size]);
};

const logo = (path: string, size: LogoSize = "original") => {
  return url(path, imageSizes.logo[size]);
};

export const tmdbImage = {
  url,
  poster,
  backdrop,
  profile,
  logo,
};

const content = (string: string) => {
  return string
    .split("\n")
    .filter((section) => section !== "")
    .map((section) => `<p>${section}</p>`)
    .join("");
};

const runtime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours ? hours + "h" : ""} ${mins}min`;
};

const date = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    dateStyle: "long",
  });
};

const year = (date: string) => new Date(date).getFullYear();

const currency = (x: number) => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
  return formatter.format(x);
};

const country = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

export const format = {
  content,
  runtime,
  date,
  year,
  currency,
  country,
};

const video = (key: string, autoplay: boolean = false) =>
  `https://www.youtube.com/embed/${key}?rel=0&showinfo=0&autoplay=${
    autoplay ? 1 : 0
  }`;

const thumbnail = (key: string) =>
  `https://img.youtube.com/vi/${key}/hqdefault.jpg`;

export const yt = {
  video,
  thumbnail,
};
