import type { MetadataRoute } from "next";

/** Web App Manifest: deixa o site instalável ("Adicionar à tela inicial"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Café da Firma",
    short_name: "Café",
    description: "Feitas, xícaras e notas do café da equipe.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf6ef",
    theme_color: "#241610",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  };
}
