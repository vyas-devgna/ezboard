export const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

export function normalizeRoomCode(value: string): string | null {
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return new RegExp(`^[${ROOM_ALPHABET}]{${ROOM_CODE_LENGTH}}$`).test(code) ? code : null;
}

export function generateRoomCode(): string {
  const limit = 256 - (256 % ROOM_ALPHABET.length);
  let code = "";

  while (code.length < ROOM_CODE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
    for (const byte of bytes) {
      if (byte < limit) code += ROOM_ALPHABET[byte % ROOM_ALPHABET.length];
      if (code.length === ROOM_CODE_LENGTH) break;
    }
  }

  return code;
}
