# Contrato — Configuração

**O que este contrato governa**: as chaves que a extensão contribui ao editor. Remover ou renomear
qualquer uma é bump **MAJOR** (Portão 5 da constituição). Todo rótulo e toda descrição passam pelo
NLS do manifesto, nos quatro idiomas.

## Espaço de nomes

Raiz `advplLint.*` — próprio, sem colisão com a extensão atual, porque a nova publica com identidade
independente (D1). Nenhuma configuração da extensão atual é lida ou migrada.

## Chaves desta spec

| Chave | Tipo | Padrão | Para quê |
| ----- | ---- | ------ | -------- |
| `advplLint.rules.CA3001.enabled` | `boolean` | `true` | liga e desliga a regra individualmente (FR-013) |
| `advplLint.rules.CA3001.severity` | `"default" \| "error" \| "warning" \| "information" \| "hint"` | `"default"` | severidade exibida; `default` usa a tabela versionada (FR-013) |
| `advplLint.trace.server` | `"off" \| "messages" \| "verbose"` | `"off"` | rastreamento do LSP — **desligado por padrão** |
| `advplLint.log.level` | `"off" \| "error" \| "warn" \| "info" \| "debug"` | `"off"` | canal de log com nível — **desligado por padrão** (FR-007) |

**Uma chave por regra.** Regra sem chave própria é rejeitada no registro (Princípio IV). As chaves de
regra são **geradas a partir do registro**, não escritas à mão no manifesto — é o que impede o
manifesto e o motor de divergirem.

## Padrões que a extensão impõe ao editor

```jsonc
"configurationDefaults": {
  "[advpl]": { "files.encoding": "windows1252" },
  "[tlpp]":  { "files.encoding": "windows1252" }
}
```

Isto é o coração do FR-003 no caminho de edição (R0 da [research.md](../research.md)): quem
decodifica o byte CP1252 é o VS Code, antes de o servidor ver qualquer coisa. `files.encoding` é
`language-overridable`, então a sobreposição por linguagem é legítima; e `configurationDefaults`
**altera o padrão sem sobrescrever escolha explícita do usuário**.

Complemento obrigatório: ao abrir um documento ADVPL/TLPP cuja codificação efetiva não seja
`windows1252`, a extensão mostra **um** aviso acionável — uma vez por sessão, nunca por arquivo.
Com o padrão errado, o editor entrega mojibake ou `U+FFFD`, e sequências que por acaso formem UTF-8
válido colapsam dois bytes em um caractere e **deslocam a coluna** de todo diagnóstico seguinte na
linha. O usuário precisa saber disso; um diagnóstico na coluna errada é pior que nenhum.

## Ativação

```jsonc
"activationEvents": ["onLanguage:advpl", "onLanguage:tlpp"]
```

Ativação por `*` é **proibida** (Princípio I). Extensões de arquivo reconhecidas: `prw`, `prx`,
`prg`, `apw`, `apl`, `tlpp`.

## Reação a mudança

Mudar qualquer chave `advplLint.*` revalida os documentos abertos **sem reiniciar o editor**
(US3, cenários 1 e 2). A revalidação passa pelo mesmo caminho debounced e cancelável da análise
normal — configuração não é atalho para furar o Princípio I.
