import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const AVATAR_DIR = path.join(process.cwd(), "public", "avatars");

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function sanitizeFilename(input: string) {
  // Keep only basename-ish value to prevent traversal and odd separators.
  return input.replace(/[/\\]/g, "").trim();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename: rawFilename } = await params;
  const filename = sanitizeFilename(rawFilename);

  if (!filename) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || "application/octet-stream";
  const filePath = path.join(AVATAR_DIR, filename);

  try {
    const bytes = await readFile(filePath);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }
}
