# Proveniência — Referências TOTVS

Cópia local das referências oficiais da TOTVS que a constituição declara **normativas**
(ver `.specify/memory/constitution.md`, seção *Fontes de Referência*).

Estes arquivos são **cópia fiel, não editada**. Correção, complemento ou interpretação vive em
documento próprio deste repositório — **nunca** dentro destes arquivos, porque a próxima
atualização os sobrescreve e a correção se perde sem aviso.

## Origem

| Campo               | Valor                                                        |
| ------------------- | ------------------------------------------------------------ |
| Repositório         | `https://github.com/totvs/engpro-advpl-tlpp-skills`           |
| Release             | `v1.0.1`                                                      |
| Publicada em        | 2026-06-01                                                    |
| **Consultada em**   | **2026-08-19**                                                |
| Licença             | MIT — declarada no *frontmatter* de 19 `SKILL.md` do pacote    |
| Origem do catálogo  | `https://sonar-rules.engpro.totvs.com.br`                     |

> ⚠️ O pacote **não traz arquivo `LICENSE`**. A licença MIT está declarada campo a campo nos
> `SKILL.md`. Confirmar antes de redistribuir qualquer parte deste diretório.

## Arquivos trazidos

| Arquivo local                        | Origem no pacote                                          | Bytes  | SHA-256 (12 primeiros) |
| ------------------------------------ | --------------------------------------------------------- | ------ | ---------------------- |
| `sonarqube-rules-reference.md`       | `skills/advpl-tlpp/references/sonarqube-rules-reference.md` | 6.010  | `67659f7fc2a6`         |
| `totvs-advpl-tlpp-guidelines.md`     | ativo de release `AGENTS.md`                               | 24.443 | `42212bdd73d9`         |
| `advpl-tlpp-skills-reference.md`     | `skills/advpl-tlpp/references/advpl-tlpp-skills-reference.md` | 12.457 | `e6ec89043575`         |
| `skill-code-review.md`               | `skills/advpl-tlpp/code-review/SKILL.md`                    | 10.295 | `017b1656fe1a`         |
| `skill-sql-code-review.md`           | `skills/advpl-tlpp/sql-code-review/SKILL.md`                | 14.146 | `9324fb7a6a76`         |

Conferido após a cópia: os cinco SHA-256 batem com os originais baixados.

### Por que dois foram renomeados

- **`AGENTS.md` → `totvs-advpl-tlpp-guidelines.md`**. O arquivo original instrui um agente a
  trabalhar num *workspace Protheus* — estrutura `Fontes_Doc/`, testes TIR em Python, notação
  húngara. **Este repositório não é isso**: é uma extensão VS Code em TypeScript. Mantido com o
  nome `AGENTS.md`, ele seria carregado automaticamente como instrução deste repositório e
  passaria orientação errada. Aqui ele é **dado consultável**, não instrução ativa.
- **`SKILL.md` → `skill-*.md`**. Mesmo motivo, mais a colisão de nome entre dois arquivos
  chamados `SKILL.md`.

> Os ativos de release `AGENTS.md` e `CLAUDE.md` são **byte-idênticos** (24.443 bytes, mesmo
> SHA-256). Só um foi trazido.

## O que NÃO foi trazido

O `skills.zip` completo tem **106 arquivos** (324.963 bytes, SHA-256 `0b902ae93369…`) — 21 skills
de ADVPL/TLPP e 10 de processo. As não trazidas geram ou migram código Protheus
(`mvc-generator`, `advpl-to-tlpp-migration`, `tir-test-generator`, `query-builder`…): são úteis
para **escrever** ADVPL, não para **construir um analisador** dele. O índice completo está em
`advpl-tlpp-skills-reference.md`.

Uma delas merece nota: **`utf8-to-cp1252-conversion`** é a fonte da restrição de encoding da
constituição — ela cita a TDN ("os compiladores Protheus suportam apenas arquivos com código de
página CP1252"). Não foi trazida porque é um procedimento de conversão, não uma regra; a
restrição já está registrada na constituição.

## Como atualizar

```bash
curl -sSL -o skills.zip   https://github.com/totvs/engpro-advpl-tlpp-skills/releases/latest/download/skills.zip
curl -sSL -o AGENTS.md    https://github.com/totvs/engpro-advpl-tlpp-skills/releases/latest/download/AGENTS.md
```

Ao atualizar: substituir os arquivos, **recalcular os SHA-256**, atualizar a tag e a data acima, e
**registrar o que mudou no catálogo de regras** — regra nova, removida ou com severidade alterada
é mudança de requisito do produto, não atualização de documentação.

## Limites destas cópias

- O site `https://skills.engpro.totvs.io/` é uma aplicação React sem renderização no servidor:
  toda rota devolve o mesmo shell HTML. **Não é caminho de consulta** — use o repositório GitHub.
- `SONNAR-RULES.md` e o PDF na raiz deste repositório declaram-se gerados por IA e **divergem**
  deste catálogo. Pela hierarquia da constituição, o catálogo daqui vence.
- O catálogo lista regras que **não existem** no legado `analise-advpl/` nem no README da raiz:
  `BG1000`, `BG1100`, `BG1200`, `CS1000`, `CA2024`, `CA2025`, `CA2051`, `CA2053`, `CA1005`.
