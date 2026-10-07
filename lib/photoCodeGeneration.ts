import { randomInt } from "crypto"

// Emit one canonical glyph per OCR-confusable group. The OCR service uses
// the same mapping: 0/Q/C/D->O, 1/L->I, 2/7->Z, 5/3->S, 8->B,
// 6/G->9, H/4->A, V->Y. Existing issued codes are never rewritten.
const PHOTO_CODE_ALPHABET = "9ABFIJKMNOPRSTUWXYZ"
const PHOTO_CODE_LENGTH = 12

export function generatePhotoCode() {
  let code = ""
  for (let index = 0; index < PHOTO_CODE_LENGTH; index += 1) {
    code += PHOTO_CODE_ALPHABET[randomInt(PHOTO_CODE_ALPHABET.length)]
  }
  return code
}

