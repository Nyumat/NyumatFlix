const devMagicLinks = new Map<string, string>();

export const setDevMagicLink = (email: string, url: string) => {
  devMagicLinks.set(email, url);
};

export const getDevMagicLink = (email: string): string | undefined => {
  const url = devMagicLinks.get(email);
  devMagicLinks.delete(email);
  return url;
};
