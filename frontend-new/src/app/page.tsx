"use client";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    // Dynamically load the Tenor embed script
    const script = document.createElement("script");
    script.src = "https://tenor.com/embed.js";
    script.async = true;
    document.body.appendChild(script);

    // Cleanup script on unmount
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="flex min-h-screen min-w-screen items-center justify-center bg-white p-0 m-0" style={{ width: "100vw", height: "100vh" }}>
      <div
        className="tenor-gif-embed"
        data-postid="15167809337439398898"
        data-share-method="host"
        data-aspect-ratio="1.77857"
        data-width="100%"
        style={{ width: "100vw", maxWidth: "100vw" }}
      >
        <a href="https://tenor.com/view/67-6-7-six-seven-sixty-seven-67-kid-gif-15167809337439398898">
          67 6 7 GIF
        </a>
        from{" "}
        <a href="https://tenor.com/search/67-gifs">
          67 GIFs
        </a>
      </div>
    </div>
  );
}