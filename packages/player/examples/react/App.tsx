// Minimal React example for @movi-player/react.
// Run inside any Vite/CRA/Next React app:  npm i movi-player @movi-player/react
import { useRef, useState } from "react";
import { MoviPlayer, type MoviElement, type QoEEvent } from "@movi-player/react";

export default function App() {
  const playerRef = useRef<MoviElement>(null);
  const [qoe, setQoe] = useState<QoEEvent[]>([]);

  return (
    <div style={{ maxWidth: 900, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>movi-player · React</h1>

      <MoviPlayer
        ref={playerRef}
        src="https://moviplayer.com/sample.mkv"
        controls
        autoplay
        muted
        theme="dark"
        style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 12 }}
        onReady={(el) => console.log("ready — duration:", el.duration)}
        onQoe={(e) => setQoe((q) => [e, ...q].slice(0, 8))}
        onEnded={() => console.log("ended")}
      />

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={() => playerRef.current?.play()}>Play</button>
        <button onClick={() => playerRef.current?.pause()}>Pause</button>
        <button onClick={() => (playerRef.current!.volume = 2)}>Boost 200%</button>
        <button onClick={() => console.log(playerRef.current?.getQoeSession())}>
          Log QoE session
        </button>
      </div>

      <h3>QoE stream</h3>
      <ul>
        {qoe.map((e, i) => (
          <li key={i}>
            <code>{JSON.stringify(e)}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
