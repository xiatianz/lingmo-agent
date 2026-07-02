import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing url parameter", { status: 400 });
  }

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      return new Response("Failed to fetch target image", { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set(
      "Content-Disposition",
      `attachment; filename="lingmo-ai-art-${Date.now()}.${contentType.split("/")[1] || "jpg"}"`
    );

    return new Response(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    return new Response(`Error proxying image download: ${(error as Error).message}`, { status: 500 });
  }
}
