import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="relative min-h-svh w-full flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: "url('/movie-banner.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/85"></div>
      <div className="relative z-10 max-w-2xl mx-4 p-8 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20">
        <h2 className="text-4xl font-bold text-white mb-4">Page Not Found</h2>
        <p className="text-lg text-white/80 mb-6">
          You've reached a page that doesn't exist.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          Go back to the home page
        </Link>
      </div>
    </div>
  );
}
