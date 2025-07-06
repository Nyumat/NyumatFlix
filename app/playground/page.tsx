// "use client";

// import { ServerSelector } from "@/components/ui/server-selector";
// import { MediaItem } from "@/utils/typings";
// import { useState } from "react";

// // Sample movie data for testing
// const sampleMovie: MediaItem = {
//   id: 550, // Fight Club
//   title: "Fight Club",
//   media_type: "movie",
//   overview:
//     "A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.",
//   poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
//   backdrop_path: "/52AfXWuXCHn3UjD17rBruA9f5qb.jpg",
//   release_date: "1999-10-15",
//   vote_average: 8.4,
//   popularity: 61.416,
//   adult: false,
//   video: false,
//   vote_count: 26280,
//   genre_ids: [18, 53],
// };

// // Sample TV show data for testing
// const sampleTVShow: MediaItem = {
//   id: 1399, // Game of Thrones
//   name: "Game of Thrones",
//   media_type: "tv",
//   overview:
//     "Seven noble families fight for control of the mythical land of Westeros.",
//   poster_path: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
//   backdrop_path: "/mUkuc2wyV9dHLG0D0Loaw5pO2s8.jpg",
//   first_air_date: "2011-04-17",
//   vote_average: 8.3,
//   popularity: 369.594,
//   adult: false,
//   video: false,
//   vote_count: 11504,
//   genre_ids: [18, 10765, 10759],
// };

// export default function PlaygroundPage() {
//   const [selectedMedia, setSelectedMedia] = useState<MediaItem>(sampleMovie);

//   return (
//     <div className="min-h-screen bg-background p-8">
//       <div className="max-w-4xl mx-auto">
//         <h1 className="text-3xl font-bold mb-8">Server Switching Test</h1>

//         {/* Media Selection */}
//         <div className="mb-8">
//           <h2 className="text-xl font-semibold mb-4">Select Media Type:</h2>
//           <div className="flex gap-4">
//             <button
//               onClick={() => setSelectedMedia(sampleMovie)}
//               className={`px-4 py-2 rounded-lg border ${
//                 selectedMedia.media_type === "movie"
//                   ? "bg-primary text-primary-foreground"
//                   : "bg-background border-border"
//               }`}
//             >
//               Movie (Fight Club)
//             </button>
//             <button
//               onClick={() => setSelectedMedia(sampleTVShow)}
//               className={`px-4 py-2 rounded-lg border ${
//                 selectedMedia.media_type === "tv"
//                   ? "bg-primary text-primary-foreground"
//                   : "bg-background border-border"
//               }`}
//             >
//               TV Show (Game of Thrones)
//             </button>
//           </div>
//         </div>

//         {/* Current Media Info */}
//         <div className="mb-8 p-6 border border-border rounded-lg">
//           <h2 className="text-xl font-semibold mb-4">Current Media:</h2>
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             <div>
//               <h3 className="font-medium text-lg">
//                 {selectedMedia.title || selectedMedia.name}
//               </h3>
//               <p className="text-sm text-muted-foreground mb-2">
//                 Type: {selectedMedia.media_type}
//               </p>
//               <p className="text-sm text-muted-foreground mb-2">
//                 TMDB ID: {selectedMedia.id}
//               </p>
//               <p className="text-sm text-muted-foreground mb-2">
//                 Rating: {selectedMedia.vote_average}/10
//               </p>
//               <p className="text-sm">{selectedMedia.overview}</p>
//             </div>
//             <div className="flex items-center justify-center">
//               <img
//                 src={`https://image.tmdb.org/t/p/w300${selectedMedia.poster_path}`}
//                 alt={selectedMedia.title || selectedMedia.name}
//                 className="rounded-lg shadow-lg max-w-[200px]"
//               />
//             </div>
//           </div>
//         </div>

//         {/* Server Selector Test */}
//         <div className="mb-8 p-6 border border-border rounded-lg">
//           <h2 className="text-xl font-semibold mb-4">Server Selector Test:</h2>
//           <div className="flex flex-col gap-4">
//             <p className="text-sm text-muted-foreground">
//               The server selector below will check availability for the selected
//               media across all servers. It will automatically select an
//               available server if the current one is not available.
//             </p>
//             <div className="flex items-center gap-4">
//               <span className="font-medium">Current Server:</span>
//               <ServerSelector media={selectedMedia} />
//             </div>
//           </div>
//         </div>

//         {/* Server Information */}
//         <div className="p-6 border border-border rounded-lg">
//           <h2 className="text-xl font-semibold mb-4">Server Information:</h2>
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
//             <div>
//               <h3 className="font-medium mb-2">VidSrc</h3>
//               <p className="text-muted-foreground">
//                 • No availability checking
//               </p>
//               <p className="text-muted-foreground">
//                 • Always assumed available
//               </p>
//               <p className="text-muted-foreground">• URL: vidsrc.me</p>
//             </div>
//             <div>
//               <h3 className="font-medium mb-2">Embed.su</h3>
//               <p className="text-muted-foreground">
//                 • Bulk availability checking
//               </p>
//               <p className="text-muted-foreground">
//                 • Checks full movie/TV lists
//               </p>
//               <p className="text-muted-foreground">• URL: embed.su</p>
//             </div>
//             <div>
//               <h3 className="font-medium mb-2">111Movies</h3>
//               <p className="text-muted-foreground">
//                 • No availability checking
//               </p>
//               <p className="text-muted-foreground">
//                 • Always assumed available
//               </p>
//               <p className="text-muted-foreground">• URL: 111movies.com</p>
//             </div>
//             <div>
//               <h3 className="font-medium mb-2">FilmKu</h3>
//               <p className="text-muted-foreground">
//                 • Individual availability checking
//               </p>
//               <p className="text-muted-foreground">
//                 • Uses status API endpoint
//               </p>
//               <p className="text-muted-foreground">• URL: filmku.stream</p>
//             </div>
//           </div>
//         </div>

//         {/* Test Instructions */}
//         <div className="mt-8 p-6 bg-muted rounded-lg">
//           <h2 className="text-xl font-semibold mb-4">Test Instructions:</h2>
//           <ol className="list-decimal list-inside space-y-2 text-sm">
//             <li>
//               Switch between Movie and TV Show to see how the server selector
//               adapts
//             </li>
//             <li>Click on the server selector to see all available servers</li>
//             <li>
//               Notice the availability indicators (green = available, red = not
//               available, yellow = checking)
//             </li>
//             <li>
//               The system will automatically select the first available server on
//               initial load
//             </li>
//             <li>Try switching servers manually to test the functionality</li>
//           </ol>
//         </div>
//       </div>
//     </div>
//   );
// }
