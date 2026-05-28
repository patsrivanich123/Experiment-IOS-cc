import type { MetadataRoute } from "next";

/**
 * PWA manifest. With this + the iOS meta tags in layout.tsx, the dashboard
 * can be "Add to Home Screen"-ed on iPhone and launches fullscreen with
 * a custom icon and dark splash, like a native app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "THB Dashboard",
    short_name: "THB",
    description: "Macro signals for the Thai baht.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
