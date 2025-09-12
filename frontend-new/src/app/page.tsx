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
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div 
      style={{ 
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100vw", 
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#000",
        margin: 0,
        padding: 0
      }}
    >
      <div
        className="tenor-gif-embed"
        data-postid="15167809337439398898"
        data-share-method="host"
        data-aspect-ratio="1.77857"
        data-width="100%"
        style={{ 
          width: "100vw", 
          height: "100vh",
          maxWidth: "100vw",
          maxHeight: "100vh"
        }}
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