/**
 * CP1252 (Windows-1252) — decodificação e codificação, sem dependência externa.
 *
 * Por que uma tabela local em vez de `iconv-lite`:
 *
 * - CP1252 é totalmente especificado e imutável. Diverge de ISO-8859-1 em
 *   exatamente 32 posições. Não há evolução futura a acompanhar.
 * - Cabe em ~40 linhas e é EXAUSTIVAMENTE testável: 256 bytes de entrada, ida e
 *   volta, cobertura total num único teste. Nenhuma dependência oferece essa
 *   garantia de forma verificável aqui dentro.
 * - `Buffer.toString('latin1')` é o defeito do legado — diverge justamente na
 *   faixa 0x80-0x9F, onde vivem travessão, aspas tipográficas e o euro.
 * - `TextDecoder('windows-1252')` existe no Node, mas é SÓ decodificação. Não há
 *   `TextEncoder` para CP1252, e o Princípio II vai exigir GRAVAR em CP1252.
 *   Ter metade do par vindo da plataforma e metade escrita à mão é pior que ter
 *   as duas juntas, provadas pelo mesmo teste de ida e volta.
 *
 * Propriedade da qual o resto do motor depende: CP1252 é de byte único e todos
 * os 256 pontos ficam no plano básico, sem pares substitutos. Logo
 *
 *     deslocamento em bytes == índice de caractere == unidade de código UTF-16
 *
 * e não há conversão de índice em lugar nenhum. Ver contracts/diagnostico.md.
 */

/**
 * Os cinco bytes que CP1252 não define. O padrão de codificação da WHATWG —
 * que é o comportamento adotado por navegadores e pelo próprio VS Code — os
 * mapeia para os pontos de controle C1 de mesmo valor. Decisão registrada, não
 * acidente: sem ela, um fonte com byte 0x81 viraria U+FFFD e a coluna de todo
 * diagnóstico seguinte na linha andaria.
 */
export const CP1252_UNDEFINED_BYTES: readonly number[] = [0x81, 0x8d, 0x8f, 0x90, 0x9d]

/**
 * A faixa 0x80-0x9F, que é onde CP1252 e ISO-8859-1 divergem. As posições sem
 * definição aparecem como o próprio valor, conforme acima.
 */
const HIGH_RANGE = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, // 0x80-0x87
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f, // 0x88-0x8F
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, // 0x90-0x97
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178, // 0x98-0x9F
] as const

/** Byte usado para caractere sem representação em CP1252: '?'. */
const REPLACEMENT_BYTE = 0x3f

/**
 * Tabela de decodificação: um caractere pronto por byte. Montada uma vez, no
 * carregamento do módulo — a decodificação em si nunca recalcula nada.
 */
const DECODE_TABLE: readonly string[] = (() => {
  const table = new Array<string>(256)
  for (let byte = 0; byte < 256; byte += 1) {
    if (byte >= 0x80 && byte <= 0x9f) {
      table[byte] = String.fromCharCode(HIGH_RANGE[byte - 0x80]!)
    } else {
      // ASCII e a faixa 0xA0-0xFF são idênticos a Latin-1.
      table[byte] = String.fromCharCode(byte)
    }
  }
  return table
})()

/**
 * Tabela inversa. `Map` e não objeto porque a chave é numérica e esparsa: os
 * pontos de código vão de 0x00 a 0x20AC com buracos enormes no meio.
 */
const ENCODE_TABLE: ReadonlyMap<number, number> = (() => {
  const map = new Map<number, number>()
  for (let byte = 255; byte >= 0; byte -= 1) {
    // Percorre de trás para frente para que, em qualquer empate, o byte MENOR
    // vença. Hoje não há empate; a ordem existe para que uma eventual mudança
    // de tabela não altere a saída de forma imprevisível.
    map.set(DECODE_TABLE[byte]!.charCodeAt(0), byte)
  }
  return map
})()

/**
 * Decodifica bytes CP1252 em texto.
 *
 * Nunca lança e nunca produz U+FFFD: os 256 bytes têm mapeamento definido.
 */
export function decodeCp1252(bytes: Uint8Array): string {
  // Acumular em array e juntar no fim é mais barato que concatenar string a
  // string, que realoca a cada iteração.
  const chars = new Array<string>(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) {
    chars[i] = DECODE_TABLE[bytes[i]!]!
  }
  return chars.join('')
}

/**
 * Codifica texto em bytes CP1252.
 *
 * Caractere sem representação vira '?' — UM byte, nunca zero e nunca dois.
 * Preservar o comprimento importa: é o que mantém deslocamento em bytes e
 * índice de caractere alinhados, e toda a aritmética de coluna depende disso.
 */
export function encodeCp1252(text: string): Buffer {
  const bytes = Buffer.allocUnsafe(text.length)
  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = ENCODE_TABLE.get(text.charCodeAt(i)) ?? REPLACEMENT_BYTE
  }
  return bytes
}
