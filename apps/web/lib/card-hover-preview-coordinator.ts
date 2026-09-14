type CardHoverPreviewListener = (activeId: string | null) => void;

let activePreviewId: string | null = null;
const listeners = new Set<CardHoverPreviewListener>();

const notify = () => {
  for (const listener of listeners) {
    listener(activePreviewId);
  }
};

export const getActiveCardHoverPreviewId = (): string | null => activePreviewId;

export const subscribeCardHoverPreview = (
  listener: CardHoverPreviewListener,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const claimCardHoverPreview = (previewId: string): void => {
  if (activePreviewId === previewId) {
    return;
  }
  activePreviewId = previewId;
  notify();
};

export const releaseCardHoverPreview = (previewId: string): void => {
  if (activePreviewId !== previewId) {
    return;
  }
  activePreviewId = null;
  notify();
};

export const cancelAllCardHoverPreviews = (): void => {
  if (!activePreviewId) {
    return;
  }
  activePreviewId = null;
  notify();
};
