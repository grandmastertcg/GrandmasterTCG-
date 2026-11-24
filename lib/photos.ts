const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const KINDS = {
  jpg: { mime: "image/jpeg", check: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  png: { mime: "image/png", check: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  webp: { mime: "image/webp", check: (bytes: Uint8Array) => bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 }
} as const;

export function photoKind(bytes: Uint8Array, mime: string) {
  if (bytes.byteLength < 12 || bytes.byteLength > MAX_PHOTO_BYTES) return null;
  const match = Object.entries(KINDS).find(([, kind]) => kind.mime === mime && kind.check(bytes));
  return match ? match[0] as keyof typeof KINDS : null;
}

export function ownCardPhoto(value: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  try {
    const url = new URL(value);
    const expected = new URL(base);
    return url.origin === expected.origin && url.pathname.startsWith("/storage/v1/object/public/card-photos/");
  } catch {
    return false;
  }
}
