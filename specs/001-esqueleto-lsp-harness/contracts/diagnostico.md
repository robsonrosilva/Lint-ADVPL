# Contrato — Diagnóstico

**O que este contrato governa**: a forma de todo diagnóstico que a extensão publica no editor. Ele é
o que o usuário filtra, suprime e configura, e por isso é estável entre versões: mudar `code` é bump
**MAJOR**.

## Forma

```jsonc
{
  "code": "CA3001",                                  // id puro do catálogo — sem prefixo (D2)
  "codeDescription": {
    "href": "https://github.com/robsonrosilva/Lint-ADVPL/blob/master/docs/regras/CA3001.md"
  },
  "severity": 3,                                     // Information — vindo da tabela versionada
  "range": {
    "start": { "line": 2, "character": 0 },          // base zero, unidades de código UTF-16
    "end":   { "line": 2, "character": 8 }           // cobre o token, não a linha
  },
  "message": "…",                                    // traduzida; nunca literal no código
  "source": "advpl-lint"
}
```

## Regras

| # | Regra | Requisito |
| - | ----- | --------- |
| 1 | `code` é o identificador do catálogo, sem prefixo nem qualificação de origem | FR-010, D2 |
| 2 | `code` nunca ausente; diagnóstico sem identificador não é publicado | SC-004 |
| 3 | `codeDescription.href` é URL absoluta do arquivo de documentação daquela regra | FR-011 |
| 4 | `severity` sai da configuração do usuário; na falta dela, da tabela versionada. **Nunca** copiada do catálogo | FR-013, FR-014 |
| 5 | `range` cobre o token exato, com início e fim | FR-019 |
| 6 | `message` vem do mecanismo de tradução, nos quatro idiomas | FR-015, FR-016 |
| 7 | `message` **nunca** ecoa valor sensível — só a localização | Restrições Técnicas da constituição |

## Aritmética de posição

As posições do LSP são contadas em **unidades de código UTF-16**, base zero. Como o fonte é CP1252 —
byte único, todos os pontos no plano básico, sem pares substitutos —, deslocamento em bytes, índice
de caractere e unidade de código UTF-16 **coincidem**. Não há conversão de índice em lugar nenhum.

Essa coincidência é uma propriedade do CP1252, não do nosso código. Ela **se perde** no dia em que um
fonte UTF-8 for aceito, e nesse dia toda aritmética de coluna precisa ser revista. Está escrito aqui
para que a perda seja notada, não descoberta por um relato de coluna errada.

## Contrato de teste (FR-029)

A asserção compara o **diagnóstico específico inteiro**:

```text
esperado: { code, severity, range: { start: {line, character}, end: {line, character} } }
```

**Proibido**: assertar apenas contagem de diagnósticos, ou apenas totais por severidade. Foi o que o
legado fazia, e duas regras quebradas em direções opostas mantêm essa suíte verde. O utilitário de
teste não oferece a forma agregada.
