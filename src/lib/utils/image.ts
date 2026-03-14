export function getArtworkUrl(url: string | null, size: 'small' | 'medium' | 'large' = 'medium'): string {
  if (!url) return '';

  const sizeMap = {
    small: '-small',      // 32x32
    medium: '-t200x200',  // 200x200
    large: '-t500x500',   // 500x500
  };

  return url.replace('-large', sizeMap[size]);
}
