import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sphoorthy Events — Operations Portal",
    short_name: "Sphoorthy Events",
    description: "Official campus event calendar, ticket scanner, food desk, and management app for Sphoorthy Engineering College.",
    start_url: "/",
    display: "standalone",
    background_color: "#17221e",
    theme_color: "#17221e",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
