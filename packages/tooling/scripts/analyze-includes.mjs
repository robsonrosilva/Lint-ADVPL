// Análise ad-hoc: caixa das diretivas #include e dos nomes de arquivo no corpus.
//
// NÃO faz parte do portão. É instrumento de decisão: foi este script que
// produziu os números de memoria/medicao-includes-corpus.md, em 2026-08-19 —
// 71,9% das diretivas em caixa alta, e 706 referências que quebrariam se a
// caixa do NOME fosse baixada automaticamente.
//
// Está versionado porque a medição custa minutos e vai ser reconsultada quando
// as regras de include forem implementadas.
//
//   node packages/tooling/scripts/analyze-includes.mjs [caminho-do-corpus]
//
// O caminho do corpus NUNCA entra no repositório — ver a seção "Corpus de
// Medição" da constituição.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'D:\\Workspace\\FONTES'
const SRC = new Set(['prw', 'prx', 'prg', 'apw', 'apl', 'tlpp'])

const realNames = new Set() // nome exato como está no disco
const byLower = new Map() // minúsculo -> [nomes exatos]
const sources = []

function walk(dir, depth = 0) {
  if (depth > 8) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      walk(full, depth + 1)
      continue
    }
    const lower = e.name.toLowerCase()
    const ext = lower.slice(lower.lastIndexOf('.') + 1)
    if (ext === 'ch' || ext === 'th') {
      realNames.add(e.name)
      if (!byLower.has(lower)) byLower.set(lower, [])
      byLower.get(lower).push(e.name)
    } else if (SRC.has(ext) && sources.length < 6000) {
      sources.push(full)
    }
  }
}
walk(ROOT)

const DIRECTIVE = /^[ \t]*#[ \t]*include[ \t]+["']([^"']+)["']/gim
let totalDirectives = 0
let upperDirective = 0
let upperFileName = 0
const referenced = new Map()

for (const f of sources) {
  let text
  try {
    text = readFileSync(f, 'latin1')
  } catch {
    continue
  }
  for (const m of text.matchAll(DIRECTIVE)) {
    totalDirectives += 1
    const raw = m[1]
    const slash = Math.max(raw.lastIndexOf('/'), raw.lastIndexOf('\\'))
    const name = slash >= 0 ? raw.slice(slash + 1) : raw
    const directiveWord = m[0].match(/#[ \t]*(\w+)/)[1]
    if (directiveWord !== 'include') upperDirective += 1
    if (/[A-Z]/.test(name)) upperFileName += 1
    referenced.set(name, (referenced.get(name) ?? 0) + 1)
  }
}

let refExactOk = 0
let refNotFound = 0
let refWouldBreak = 0
const breakExamples = []

for (const [name, count] of referenced) {
  const lower = name.toLowerCase()
  const candidates = byLower.get(lower)
  if (!candidates) {
    refNotFound += count
    continue
  }
  if (realNames.has(name)) refExactOk += count
  const hasLowerFile = candidates.some((c) => c === lower)
  if (!hasLowerFile) {
    refWouldBreak += count
    if (breakExamples.length < 10) breakExamples.push(`${name} -> disco tem ${candidates[0]}`)
  }
}

const pct = (n) => `${((n / totalDirectives) * 100).toFixed(1)}%`

console.log('fontes amostrados             :', sources.length)
console.log('includes no disco (nomes)     :', realNames.size)
console.log('diretivas #include lidas      :', totalDirectives)
console.log('  DIRETIVA em caixa alta      :', upperDirective, `(${pct(upperDirective)})`)
console.log('  NOME do arquivo com maiúscula:', upperFileName, `(${pct(upperFileName)})`)
console.log()
console.log('nomes referenciados (únicos)  :', referenced.size)
console.log('  resolvem por caixa exata    :', refExactOk)
console.log('  arquivo não existe no corpus:', refNotFound)
console.log('  >>> QUEBRARIAM se baixar a caixa:', refWouldBreak)
if (breakExamples.length) {
  console.log('\nexemplos que quebrariam:')
  for (const e of breakExamples) console.log('  ', e)
}
