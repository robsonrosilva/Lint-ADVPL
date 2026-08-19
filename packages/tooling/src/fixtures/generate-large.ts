import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Gera fonte ADVPL grande para os testes de tamanho.
 *
 * Por que GERAR e não versionar: o maior fonte do corpus tem 24.636 linhas, e
 * um arquivo desse porte no repositório seria (a) peso morto no clone e (b)
 * indistinguível, à primeira vista, de uma cópia de fonte padrão do Protheus —
 * exatamente o que a verificação do FR-027 existe para impedir. Fixture grande
 * é gerada em tempo de teste e vive em `test/fixtures/generated/`, que está no
 * .gitignore.
 *
 * O conteúdo é deliberadamente ASCII: o que estas fixtures exercitam é TAMANHO.
 * Codificação tem fixtures próprias, autorais e versionadas, com os bytes da
 * faixa 0x80-0x9F escritos à mão.
 */

export interface LargeSourceOptions {
  /** Total de linhas do fonte gerado. */
  readonly lines: number
  /** De quantas em quantas linhas aparece uma diretiva em caixa alta. */
  readonly directiveEvery: number
  readonly eol: '\r\n' | '\n'
}

export const DEFAULT_LARGE_SOURCE: LargeSourceOptions = {
  // O máximo observado no corpus em 2026-08-19. Ver memoria/distribuicao-tamanho-fontes.md.
  lines: 24636,
  directiveEvery: 50,
  eol: '\r\n',
}

const HEADER = [
  '// FIXTURE GERADA - advpl-lint - NAO e copia de fonte padrao do Protheus.',
  '// Proposito: exercitar TAMANHO. Gerada por packages/tooling/src/fixtures/generate-large.ts',
]

/** Monta o texto. Uma passagem, sem concatenação em laço. */
export function buildLargeSource(options: LargeSourceOptions = DEFAULT_LARGE_SOURCE): string {
  const { lines, directiveEvery, eol } = options
  if (lines < HEADER.length) throw new Error(`lines precisa ser ao menos ${HEADER.length}`)
  if (directiveEvery < 1) throw new Error('directiveEvery precisa ser ao menos 1')

  const out = new Array<string>(lines)
  for (let i = 0; i < HEADER.length; i += 1) out[i] = HEADER[i]!

  for (let i = HEADER.length; i < lines; i += 1) {
    out[i] =
      i % directiveEvery === 0
        ? '#INCLUDE "TOTVS.CH"'
        : `Local xVar${i} := "valor ${i}"  // comentario da linha ${i}`
  }
  return out.join(eol)
}

/** Quantas violações de CA3001 o fonte gerado contém. */
export function countDirectives(options: LargeSourceOptions = DEFAULT_LARGE_SOURCE): number {
  let total = 0
  for (let i = HEADER.length; i < options.lines; i += 1) {
    if (i % options.directiveEvery === 0) total += 1
  }
  return total
}

/** Grava o fonte gerado. Assíncrono — o Princípio I vale também nas ferramentas. */
export async function writeLargeFixture(
  path: string,
  options: LargeSourceOptions = DEFAULT_LARGE_SOURCE,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  // ASCII puro, então `ascii` e CP1252 coincidem byte a byte aqui.
  await writeFile(path, Buffer.from(buildLargeSource(options), 'ascii'))
}
