export const GET = ({ site }) => {
  const origin = site?.origin || "https://cool-bienenstitch-6090eb.netlify.app";
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin-paneli.html",
      "Disallow: /marka-paneli.html",
      "Disallow: /marka-paneli-analiz.html",
      "Disallow: /marka-paneli-proje.html",
      "Disallow: /marka-paneli-projeler.html",
      "Disallow: /marka-paneli-urunler.html",
      "Disallow: /mimar-paneli.html",
      "Disallow: /moodboard.html",
      `Sitemap: ${origin}/sitemap.xml`,
      "",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
};
