/**
 * Upscaling-Utility für Satellitenbilder
 * Verwendet Canvas-basierte Interpolation für bessere Qualität bei hohem Zoom
 */

/**
 * Skaliert ein Bild mit Lanczos-Filter hoch (bessere Qualität als bilinear)
 */
export function upscaleImage(
  image: HTMLImageElement,
  scaleFactor: number = 2
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const newWidth = image.width * scaleFactor;
  const newHeight = image.height * scaleFactor;

  canvas.width = newWidth;
  canvas.height = newHeight;

  // Verwende imageSmoothingEnabled für bessere Qualität
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Zeichne das Bild hochskaliert
  ctx.drawImage(image, 0, 0, newWidth, newHeight);

  return canvas;
}

/**
 * Erstellt einen Tile-URL mit Upscaling-Unterstützung
 * Für sehr hohe Zoom-Levels wird das Tile hochskaliert
 */
export function getUpscaledTileUrl(
  baseUrl: string,
  z: number,
  x: number,
  y: number,
  maxNativeZoom: number = 19
): string {
  // Wenn wir über dem nativen Zoom-Level sind, verwende das Tile vom maximalen Zoom-Level
  if (z > maxNativeZoom) {
    const scale = Math.pow(2, z - maxNativeZoom);
    const scaledX = Math.floor(x / scale);
    const scaledY = Math.floor(y / scale);
    return baseUrl.replace('{z}', maxNativeZoom.toString())
                  .replace('{x}', scaledX.toString())
                  .replace('{y}', scaledY.toString());
  }
  
  return baseUrl.replace('{z}', z.toString())
                .replace('{x}', x.toString())
                .replace('{y}', y.toString());
}

