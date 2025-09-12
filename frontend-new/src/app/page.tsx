"use client";

export default function Home() {
  return (
    <div 
      style={{ 
        width: "100vw", 
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#000",
        margin: 0,
        padding: 0,
        position: "relative"
      }}
    >
      <iframe
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/jjy0bIO-YNI?autoplay=1&mute=0&controls=1&showinfo=0&rel=0&modestbranding=1&playsinline=1"
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          border: "none"
        }}
      ></iframe>
    </div>
  );
}