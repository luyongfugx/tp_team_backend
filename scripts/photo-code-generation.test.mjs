import assert from "node:assert/strict"
import { test } from "node:test"
import { generatePhotoCode } from "../lib/photoCodeGeneration.ts"

test("new photo codes use only canonical OCR glyphs", () => {
  const issuedCharacters = new Set()
  for (let i = 0; i < 2000; i++) {
    const code = generatePhotoCode()
    assert.match(code, /^[9ABFIJKMNOPRSTUWXYZ]{12}$/)
    assert.doesNotMatch(code, /[012345678CDEGHLQV]/)
    for (const character of code) issuedCharacters.add(character)
  }
  for (const canonical of "OIZSB9AYF") assert.ok(issuedCharacters.has(canonical))
})
