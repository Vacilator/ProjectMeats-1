/**
 * Theme Utilities - Dynamic brand color extraction
 * Note: colorthief types are not available, using 'any' sparingly
 */

let cachedColorThiefModule: any | null = null;
let cachedColorThiefInstance: any | null = null;

const getColorThiefModule = async (): Promise<any> => {
  if (cachedColorThiefModule) return cachedColorThiefModule;

  // colorthief export shape varies across versions and bundlers.
  // Use dynamic import to avoid Rollup static export checks.
  cachedColorThiefModule = await import('colorthief');
  return cachedColorThiefModule;
};

const getColorThiefInstance = async (): Promise<any> => {
  if (cachedColorThiefInstance) return cachedColorThiefInstance;

  const mod: any = await getColorThiefModule();
  const exported: any = mod?.default ?? mod?.ColorThief ?? mod;

  // Some bundlers expose an already-created instance; others expose a constructor.
  if (exported && typeof exported.getColor === 'function') {
    cachedColorThiefInstance = exported;
    return cachedColorThiefInstance;
  }

  if (typeof exported === 'function') {
    try {
      cachedColorThiefInstance = new exported();
      return cachedColorThiefInstance;
    } catch {
      // Fallback: some builds may expose a factory function.
      cachedColorThiefInstance = exported();
      return cachedColorThiefInstance;
    }
  }

  throw new TypeError('Unsupported colorthief export shape');
};

const resolveLogoSrc = async (logoUrl: string): Promise<{ src: string; revoke: (() => void) | null }> => {
  const isDataUrl = typeof logoUrl === 'string' && logoUrl.startsWith('data:');
  if (isDataUrl) return { src: logoUrl, revoke: null };

  // Hardening: logo URLs may be behind auth.
  // Fetching as a blob with credentials + Authorization avoids CORS/tainted-canvas issues.
  try {
    const { getAuthHeader, refreshAccessToken } = await import('../services/jwtService');

    let authHeader = getAuthHeader();
    if (!authHeader) {
      try {
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) authHeader = `Bearer ${newAccessToken}`;
      } catch {
        // ignore refresh failures; we'll attempt fetch without Authorization
      }
    }

    const headers: HeadersInit = {};
    if (authHeader) headers['Authorization'] = authHeader;

    const res = await fetch(logoUrl, { credentials: 'include', headers });
    if (res.ok) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      return { src: objectUrl, revoke: () => URL.revokeObjectURL(objectUrl) };
    }
  } catch {
    // Fall back to direct image load
  }

  return { src: logoUrl, revoke: null };
};

const loadImageElement = async (src: string): Promise<HTMLImageElement> => {
  const img = new Image();
  // For same-origin or object URLs this is fine; for cross-origin it requires server CORS.
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });

  // Some browsers may still be decoding when onload fires; decode() hardens canvas reads.
  try {
    await img.decode();
  } catch {
    // ignore decode errors; canvas draw may still work
  }

  return img;
};

const clampChannel = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

const getSaturation = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};

const getFastLuminance = (r: number, g: number, b: number): number => {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const extractDominantColorViaCanvas = (img: HTMLImageElement): number[] | null => {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const maxSide = 64;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(img, 0, 0, cw, ch);
    const { data } = ctx.getImageData(0, 0, cw, ch);

    type Bucket = { count: number; r: number; g: number; b: number };
    const buckets = new Map<number, Bucket>();

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 20) continue; // ignore near-transparent

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 4-bit quantization per channel (4096 buckets)
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
        existing.r += r;
        existing.g += g;
        existing.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }

    if (buckets.size === 0) return null;

    const top = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 15);

    let best: { score: number; rgb: [number, number, number] } | null = null;

    for (const bucket of top) {
      const r = bucket.r / bucket.count;
      const g = bucket.g / bucket.count;
      const b = bucket.b / bucket.count;
      const sat = getSaturation(r, g, b);
      const lum = getFastLuminance(r, g, b);

      // Prefer frequent, more-saturated colors, and avoid extreme whites/blacks.
      const midLumBoost = 0.6 + Math.min(lum, 1 - lum); // 0.6..1.1
      const score = bucket.count * (0.5 + sat) * midLumBoost;

      if (!best || score > best.score) {
        best = { score, rgb: [clampChannel(r), clampChannel(g), clampChannel(b)] };
      }
    }

    return best?.rgb ?? null;
  } catch (e) {
    // SecurityError (tainted canvas) or unsupported image type
    console.warn('Canvas color extraction failed:', e);
    return null;
  } finally {
    // Avoid holding onto a canvas in memory
    canvas.width = 0;
    canvas.height = 0;
  }
};

const parseHexColor = (value: string): [number, number, number] | null => {
  const v = value.trim();
  const hex3 = /^#([0-9a-f]{3})$/i.exec(v);
  if (hex3) {
    const [r, g, b] = hex3[1].split('').map((c) => parseInt(c + c, 16));
    return [r, g, b];
  }
  const hex6 = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex6) {
    const n = hex6[1];
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  }
  return null;
};

const parseRgbColor = (value: string): [number, number, number] | null => {
  const m = /^rgba?\(([^)]+)\)$/i.exec(value.trim());
  if (!m) return null;
  const parts = m[1].split(',').map((p) => p.trim());
  if (parts.length < 3) return null;
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return [clampChannel(r), clampChannel(g), clampChannel(b)];
};

const decodeSvgDataUrl = (dataUrl: string): string | null => {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;
  const meta = dataUrl.slice(0, commaIdx);
  const data = dataUrl.slice(commaIdx + 1);

  try {
    if (/;base64/i.test(meta)) {
      return atob(data);
    }
    return decodeURIComponent(data);
  } catch {
    return null;
  }
};

const extractColorFromSvgDataUrl = (logoUrl: string): number[] | null => {
  if (!logoUrl.startsWith('data:image/svg+xml')) return null;

  const svgText = decodeSvgDataUrl(logoUrl);
  if (!svgText) return null;

  const candidates: Array<[number, number, number]> = [];
  const colorRegex = /(fill|stroke)\s*=\s*"([^"]+)"|\b(fill|stroke)\s*:\s*([^;\"]+)/gi;

  let match: RegExpExecArray | null;
  while ((match = colorRegex.exec(svgText))) {
    const raw = (match[2] ?? match[4] ?? '').trim();
    if (!raw) continue;
    const lowered = raw.toLowerCase();
    if (lowered === 'none' || lowered === 'transparent' || lowered === 'currentcolor') continue;

    const rgb = parseHexColor(raw) ?? parseRgbColor(raw);
    if (rgb) candidates.push(rgb);
  }

  if (candidates.length === 0) return null;

  // Prefer non-extreme colors (avoid pure white/black) and higher saturation.
  let best: { score: number; rgb: [number, number, number] } | null = null;
  for (const rgb of candidates) {
    const sat = getSaturation(rgb[0], rgb[1], rgb[2]);
    const lum = getFastLuminance(rgb[0], rgb[1], rgb[2]);
    const midLumBoost = 0.6 + Math.min(lum, 1 - lum);
    const score = (0.25 + sat) * midLumBoost;
    if (!best || score > best.score) best = { score, rgb };
  }

  return best?.rgb ?? null;
};

export const extractBrandColors = async (logoUrl: string): Promise<number[] | null> => {
  // SVG logos (especially uploaded ones) can cause canvas-based extractors to throw.
  // Prefer parsing inline SVG colors when possible.
  const svgColor = extractColorFromSvgDataUrl(logoUrl);
  if (svgColor) return svgColor;

  const { src, revoke } = await resolveLogoSrc(logoUrl);
  try {
    const img = await loadImageElement(src);

    // Try ColorThief first (higher quality when it works).
    try {
      const colorThief: any = await getColorThiefInstance();
      const color = colorThief?.getColor?.(img);
      if (Array.isArray(color) && color.length === 3) return color;
    } catch {
      // Fall through to canvas-based extraction
    }

    return extractDominantColorViaCanvas(img);
  } catch (error) {
    console.error('Error in extractBrandColors:', error);
    return null;
  } finally {
    revoke?.();
  }
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
};

export const hexToRgb = (hex: string): [number, number, number] | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
};

const getLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

export const isLightColor = (r: number, g: number, b: number): boolean => {
  return getLuminance(r, g, b) > 0.5;
};

export const lightenColor = (r: number, g: number, b: number, amount = 0.2): [number, number, number] => {
  return [
    Math.min(255, Math.round(r + (255 - r) * amount)),
    Math.min(255, Math.round(g + (255 - g) * amount)),
    Math.min(255, Math.round(b + (255 - b) * amount)),
  ];
};

export const darkenColor = (r: number, g: number, b: number, amount = 0.2): [number, number, number] => {
  return [
    Math.max(0, Math.round(r * (1 - amount))),
    Math.max(0, Math.round(g * (1 - amount))),
    Math.max(0, Math.round(b * (1 - amount))),
  ];
};

export const applyBrandColorToTheme = (rgb: number[]): void => {
  if (rgb && rgb.length === 3) {
    document.documentElement.style.setProperty('--color-primary', rgb.join(', '));
    const lighterRgb = lightenColor(rgb[0], rgb[1], rgb[2], 0.1);
    document.documentElement.style.setProperty('--color-primary-hover', lighterRgb.join(', '));
  }
};

export const loadTenantBrandingColors = async (logoUrl: string): Promise<void> => {
  try {
    const brandColor = await extractBrandColors(logoUrl);
    if (brandColor) {
      applyBrandColorToTheme(brandColor);
    }
  } catch (error) {
    console.error('Failed to load tenant branding colors:', error);
  }
};
