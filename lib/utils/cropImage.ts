export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageFilters {
  brightness: number; // 0.5 – 2.0,  default 1.0
  contrast: number;   // 0.5 – 2.0,  default 1.0
  saturation: number; // 0   – 3.0,  default 1.0
}

export interface ImageTransform {
  rotation: number;    // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
}

/**
 * Crop an image from a given URL using a pixel-space crop area,
 * and optionally apply brightness / contrast / saturation filters
 * via the Canvas 2D filter API before extracting the result.
 *
 * @param imageSrc   - object URL or data URL of the source image
 * @param pixelCrop  - { x, y, width, height } in *pixel* coordinates
 * @param filters    - optional brightness/contrast/saturation adjustments
 * @param outputType - MIME type of the output blob (default: "image/jpeg")
 * @param quality    - JPEG/WebP quality 0–1 (default: 0.92)
 * @param transform  - optional rotation/flip settings
 *
 * @returns a Blob of the cropped + filtered image
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea,
  filters: ImageFilters = { brightness: 1, contrast: 1, saturation: 1 },
  outputType: "image/jpeg" | "image/webp" | "image/png" = "image/jpeg",
  quality = 0.92,
  transform?: ImageTransform,
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  canvas.width  = pixelCrop.width;
  canvas.height = pixelCrop.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2D context");

  // Apply CSS-style filters before drawing
  const { brightness, contrast, saturation } = filters;
  ctx.filter = [
    `brightness(${brightness})`,
    `contrast(${contrast})`,
    `saturate(${saturation})`,
  ].join(" ");

  // Apply transforms if provided
  if (transform && (transform.rotation !== 0 || transform.flipH || transform.flipV)) {
    ctx.save();
    ctx.translate(pixelCrop.width / 2, pixelCrop.height / 2);
    if (transform.rotation) {
      ctx.rotate((transform.rotation * Math.PI) / 180);
    }
    ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
    ctx.translate(-pixelCrop.width / 2, -pixelCrop.height / 2);
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  if (transform && (transform.rotation !== 0 || transform.flipH || transform.flipV)) {
    ctx.restore();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      },
      outputType,
      quality,
    );
  });
}

// ── helpers ────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/** Convert a File object to an object URL for use with getCroppedImg */
export function createObjectURL(file: File): string {
  return URL.createObjectURL(file);
}
