import type { Area } from "react-easy-crop";

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (err) => reject(err));
    image.src = url;
  });
}

const OUTPUT_MAX = 512;

/** Rasterize crop region to a JPEG file suitable for upload. */
export async function getCroppedImgFile(imageSrc: string, pixelCrop: Area, fileName = "avatar.jpg"): Promise<File> {
  const image = await createImage(imageSrc);
  let outW = pixelCrop.width;
  let outH = pixelCrop.height;
  const scale = Math.min(1, OUTPUT_MAX / Math.max(outW, outH));
  outW = Math.round(outW * scale);
  outH = Math.round(outH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", 0.92);
  });
  return new File([blob], fileName, { type: "image/jpeg" });
}
