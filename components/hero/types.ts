import { Logo, MediaItem } from "@/utils/typings";

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
}
