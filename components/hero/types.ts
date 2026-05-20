import { Logo, MediaItem, SeasonDetails, TvShowDetails } from "@/utils/typings";

export type TvHeroEpisodeData = {
  tvId: string;
  details: TvShowDetails;
  allSeasonDetails: Record<number, SeasonDetails>;
};

export interface HeroProps {
  imageUrl: string;
  title: string;
  subtitle?: string;
  route?: string;
  logo?: Logo;
  hideTitle?: boolean;
}

export interface MediaCarouselProps {
  items: MediaItem[];
}

export interface MediaInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem;
}

export interface CarouselDetailsProps {
  current: MediaItem;
  items: MediaItem[];
  onPosterClick: (index: number) => void;
}

export interface BackgroundImageProps extends HeroProps {
  isFullPage: boolean;
  overlayClassName?: string;
}
