---
name: corpus-externo
description: Corpus de fontes ADVPL reais vive fora do repositório, em D:\Workspace\FONTES, e NUNCA pode ser versionado
metadata:
  type: project
---

O corpus de medição de desempenho e falso positivo é o diretório local
`D:\Workspace\FONTES` (máquina do dono). São fontes **padrão do Protheus**:
~27.139 `.prw`, 4.072 `.tlpp`, 3.210 `.prx`, 1.178 `.prg` e 35.103 `.ch`.

**Restrição dura: nada desse material entra no repositório.** Nem como fixture,
nem como amostra, nem como anexo de spec. O dono declarou (2026-08-19) que em tese
não deveria sequer possuir fontes padrão — versioná-los criaria exposição
desnecessária, além de problema de licença num repositório público.

**Uso permitido**: os fontes padrão são *material de origem para criação de testes*.
Lê-se para entender construções reais (idioms, includes, padrões de código legado)
e **deriva-se** fixture escrita por nós. O que vai para `specs/NNN-*/fixtures/` é
código autoral que reproduz a construção observada — nunca cópia literal.

**Como o harness acha o corpus**: por caminho local em arquivo de configuração
não versionado (ou variável de ambiente). O caminho é da máquina, não do projeto —
quem clonar o repositório sem o corpus roda a suíte, mas não a medição.

Fecha parcialmente o TODO(CORPUS) da constituição: o corpus existe e é robusto,
mas é externo e não reproduzível por terceiros. Ver [[distribuicao-tamanho-fontes]]
e [[orcamento-desempenho-subdimensionado]].
