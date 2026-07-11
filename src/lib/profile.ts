const PROFILE_KEY = "ezboard.profile.v1";
const ACCENTS = ["#6054ee", "#e15d4f", "#118a73", "#ca7a18", "#2473d5"];

export type Profile = {
  actorId: string;
  name: string;
  avatar?: string;
  accent: string;
};

function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function sanitizeName(value: string): string {
  return Array.from(value.normalize("NFC"), (character) =>
    character >= " " && character !== String.fromCharCode(127) ? character : "",
  ).join("").trim().slice(0, 40);
}

export function getProfile(): Profile {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null") as Partial<Profile> | null;
    if (parsed?.actorId && parsed.name && ACCENTS.includes(parsed.accent ?? "")) {
      return { actorId: parsed.actorId, name: sanitizeName(parsed.name), avatar: parsed.avatar, accent: parsed.accent! };
    }
  } catch {
    // Local preferences are optional; start fresh if a browser extension or old build corrupted them.
  }
  return { actorId: randomId(), name: "You", accent: ACCENTS[0] };
}

export function saveProfile(profile: Profile): Profile {
  const next = { ...profile, name: sanitizeName(profile.name) || "You" };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}

export async function readAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 100 * 1024) {
    throw new Error("Use an image under 100 KB so it can be shared quickly.");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export { ACCENTS };
