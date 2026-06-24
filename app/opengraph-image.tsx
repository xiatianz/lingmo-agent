import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #061c3d 0%, #47309b 58%, #745ee8 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 42 }}>
          <div
            style={{
              width: 154,
              height: 154,
              borderRadius: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.12)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
            }}
          >
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
              <path d="M28 24h14v38h28v13H28V24Z" fill="white" />
              <path d="M58 22c13 12 21 25 21 38 0 11-8 19-20 19-11 0-19-8-19-19 0-13 7-26 18-38Z" fill="white" fillOpacity=".18" />
              <circle cx="65" cy="54" r="12" fill="white" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 86, fontWeight: 800, letterSpacing: 0 }}>{siteConfig.name}</div>
            <div style={{ marginTop: 16, fontSize: 34, fontWeight: 500, opacity: 0.86 }}>{siteConfig.subtitle}</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
