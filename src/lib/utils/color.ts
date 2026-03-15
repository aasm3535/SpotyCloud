/**
 * Extract the dominant color from an image URL using a canvas.
 * Returns an [r, g, b] tuple, or a fallback dark grey.
 */
export function extractDominantColor(imageUrl: string): Promise<[number, number, number]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !imageUrl) {
      resolve([40, 40, 40]);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve([40, 40, 40]); return; }

        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          // skip very dark and very bright pixels
          const lum = pr * 0.299 + pg * 0.587 + pb * 0.114;
          if (lum > 20 && lum < 220) {
            r += pr; g += pg; b += pb; count++;
          }
        }

        if (count > 0) {
          resolve([Math.round(r / count), Math.round(g / count), Math.round(b / count)]);
        } else {
          resolve([83, 83, 83]);
        }
      } catch {
        resolve([83, 83, 83]);
      }
    };
    img.onerror = () => resolve([83, 83, 83]);
    img.src = imageUrl;
  });
}
