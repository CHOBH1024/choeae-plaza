// Decode provider HTML entities as plain text, never HTML. Renderers must still escape.
const entities = Object.freeze({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',hellip:'…',ndash:'–',mdash:'—'});
export function providerText(value, limit = 200) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 2000).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] !== '#') return entities[code.toLowerCase()] ?? entity;
    const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '\ufffd';
  }).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}
