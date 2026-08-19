import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { FalsePositiveAggregate } from './report'

/**
 * Material de revisão de falso positivo.
 *
 * Apurar a taxa exige **olhar o trecho que disparou** — e o trecho é fonte
 * padrão do Protheus. Gravá-lo no repositório seria uma cópia parcial do
 * corpus, violando o FR-023 e a restrição de licença pela porta dos fundos, que
 * é exatamente como esse tipo de vazamento costuma acontecer.
 *
 * Por isso: o material sai em diretório **local e ignorado pelo
 * versionamento**, e do relatório sobe **apenas o agregado** — números e o
 * identificador da regra, mais nada.
 */

/** Diretório local do material de revisão. Ignorado pelo versionamento. */
export const REVIEW_DIR = '.fp-review'

export interface RuleHit {
  readonly ruleId: string
  readonly path: string
  readonly line: number
  readonly excerpt: string
}

export interface ReviewMaterialOptions {
  readonly dir: string
  readonly sampleSize: number
}

export interface WrittenReviewMaterial {
  readonly path: string
  readonly sampled: number
}

export interface HitCounts {
  readonly hits: number
  readonly reviewed: number
  readonly falsePositives: number
}

/**
 * Escolhe a amostra a revisar percorrendo os disparos com passo uniforme.
 *
 * Pegar os primeiros N traria os disparos de um punhado de arquivos vizinhos —
 * e a taxa apurada falaria daquele canto do corpus, não do corpus.
 */
function pickForReview(hits: readonly RuleHit[], sampleSize: number): RuleHit[] {
  if (sampleSize >= hits.length) return [...hits]
  const stride = hits.length / sampleSize
  const picked: RuleHit[] = []
  for (let k = 0; k < sampleSize; k += 1) {
    const hit = hits[Math.floor(k * stride)]
    if (hit) picked.push(hit)
  }
  return picked
}

export async function writeReviewMaterial(
  hits: readonly RuleHit[],
  options: ReviewMaterialOptions,
): Promise<WrittenReviewMaterial> {
  await mkdir(options.dir, { recursive: true })

  const picked = pickForReview(hits, options.sampleSize)
  const ruleId = hits[0]?.ruleId ?? 'disparos'
  const path = join(options.dir, `${ruleId}.md`)

  const linhas = [
    `# Revisão de falso positivo — ${ruleId}`,
    '',
    '> ⚠️ Arquivo LOCAL. Contém trecho de fonte padrão do Protheus e **nunca**',
    '> pode ser versionado. Do relatório sobe apenas o agregado (FR-022).',
    '',
    `Disparos no corpus: ${hits.length}. Nesta amostra: ${picked.length}.`,
    '',
    '| # | Arquivo | Linha | Trecho | Falso positivo? |',
    '| - | ------- | ----- | ------ | --------------- |',
    ...picked.map(
      (hit, index) => `| ${index + 1} | ${hit.path} | ${hit.line} | \`${hit.excerpt.trim()}\` | |`,
    ),
    '',
  ]

  await writeFile(path, linhas.join('\n'), 'utf8')

  return { path, sampled: picked.length }
}

export interface ReviewVerdict {
  readonly reviewed: number
  readonly falsePositives: number
}

/** O veredito fica ao lado do material revisado, no mesmo diretório local. */
export function verdictFileName(ruleId: string): string {
  return `${ruleId}.verdict.json`
}

/**
 * O resultado da revisão humana, de volta para o relatório.
 *
 * Existe para que a taxa apurada não precise ser digitada dentro do relatório
 * gerado: número escrito à mão em arquivo gerado some na próxima execução, e
 * some justamente sem avisar.
 *
 * Devolve `null` quando ninguém revisou ainda — e isso é diferente de "revisou
 * e não achou nada". O relatório mostra "0 revisados", que é honesto.
 */
export async function readVerdict(dir: string, ruleId: string): Promise<ReviewVerdict | null> {
  const path = join(dir, verdictFileName(ruleId))

  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    return null
  }

  // Daqui para baixo, qualquer problema é ERRO e não recuo silencioso: um
  // veredito ilegível tratado como zero faria o relatório mentir — e é a taxa
  // que decide se a regra fica ligada por padrão (Princípio III).
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`veredito de revisão ilegível em ${path}`)
  }

  const candidate = parsed as Partial<ReviewVerdict>
  const { reviewed, falsePositives } = candidate

  if (typeof reviewed !== 'number' || typeof falsePositives !== 'number') {
    throw new Error(`veredito de revisão precisa declarar "reviewed" e "falsePositives" em ${path}`)
  }
  if (!Number.isInteger(reviewed) || !Number.isInteger(falsePositives) || reviewed < 0 || falsePositives < 0) {
    throw new Error(`veredito de revisão com números inválidos em ${path}`)
  }
  if (falsePositives > reviewed) {
    throw new Error(`veredito de revisão impossível em ${path}: mais falsos positivos que revisados`)
  }

  return { reviewed, falsePositives }
}

export function aggregateHits(ruleId: string, counts: HitCounts): FalsePositiveAggregate {
  const { hits, reviewed, falsePositives } = counts

  if (reviewed > hits) throw new Error(`${ruleId}: revisados (${reviewed}) não pode passar dos disparos (${hits})`)
  if (falsePositives > reviewed) {
    throw new Error(`${ruleId}: falsos positivos (${falsePositives}) não pode passar dos revisados (${reviewed})`)
  }

  // A taxa é uma estimativa AMOSTRAL: divide pelo que foi revisado, não pelo
  // total de disparos. Dividir pelo total daria um número menor e falso — e a
  // decisão de ligar a regra por padrão depende dele (Princípio III).
  const rate = reviewed > 0 ? falsePositives / reviewed : 0

  return { ruleId, hits, reviewed, falsePositives, rate }
}
