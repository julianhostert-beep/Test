const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/-_";

function base44Encode(bytes) {
  let num = 0n;
  for (const b of bytes) {
    num = (num << 8n) + BigInt(b);
  }
  if (num === 0n) return alphabet[0];
  let encoded = "";
  while (num > 0n) {
    const rem = Number(num % 44n);
    num = num / 44n;
    encoded = alphabet[rem] + encoded;
  }
  return encoded;
}

function base44Decode(str) {
  let num = 0n;
  for (const ch of str) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) throw new Error("Ungültiges Zeichen: " + ch);
    num = num * 44n + BigInt(idx);
  }
  const bytes = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xFFn));
    num = num >> 8n;
  }
  return new Uint8Array(bytes);
}

function encode() {
  const text = document.getElementById("input").value;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  document.getElementById("output").value = base44Encode(bytes);
}

function decode() {
  const encoded = document.getElementById("input").value;
  try {
    const bytes = base44Decode(encoded);
    const decoder = new TextDecoder();
    document.getElementById("output").value = decoder.decode(bytes);
  } catch (e) {
    document.getElementById("output").value = "Fehler: " + e.message;
  }
}
