# Contrato — Ação de correção

**O que este contrato governa**: como uma correção é oferecida ao editor e o que ela tem direito de
alterar. Ele existe porque uma correção automática é a única coisa neste produto que **escreve** no
código de quem usa — todo o resto só aponta.

## O provedor

```ts
connection.onCodeAction((params: CodeActionParams): CodeAction[] => …)
```

Capacidade declarada na inicialização:

```jsonc
"codeActionProvider": {
  "codeActionKinds": ["quickfix", "source.fixAll"]
}
```

`source.fixAll` não é convenção nossa: é o tipo que o VS Code procura para `editor.codeActionsOnSave`.
Declará-lo é o que habilita "corrigir ao salvar" sem nenhum código de cliente.

## As três garantias

| # | Garantia | Requisito |
| - | -------- | --------- |
| 1 | A edição é o **menor conjunto possível** de alterações | FR-005 |
| 2 | A edição **não** altera encoding, fim de linha, nem um caractere fora do intervalo | FR-007 |
| 3 | A edição é **recusada** se o documento mudou desde o cálculo | FR-006 |

A terceira é do protocolo, não nossa: usar `documentChanges` com
`OptionalVersionedTextDocumentIdentifier` faz o **editor** rejeitar a aplicação quando a versão não
bate. Usar a forma simples (`changes`) perderia a garantia — e é o tipo de detalhe que só aparece
quando o usuário digita entre pedir e clicar.

## O que cada correção pode tocar

| Regra | Toca | NUNCA toca |
| ----- | ---- | ---------- |
| `CA3001` | o token da diretiva, do `#` ao fim da palavra | o nome do arquivo, as aspas, o espaçamento, a caixa de qualquer outra coisa |
| `PJ0001` | o nome do arquivo, e só para a grafia real lida do disco | a diretiva, o caminho, as aspas |

**A assimetria é medida, não estética.** Baixar a caixa da diretiva é inerte: 71,9% dos fontes do
corpus usam caixa alta e compilam, logo o pré-processador não distingue. Baixar a caixa do **nome**
quebraria 706 referências que hoje resolvem, porque 7% dos includes do disco têm maiúscula no nome
real e o AppServer roda em Linux.

## Ordem e sobreposição

Numa linha como `#INCLUDE "acadef.ch"` as duas regras disparam. As edições são **disjuntas** — uma
cobre a diretiva, a outra o nome — e entram na mesma `WorkspaceEdit`.

| # | Regra | Requisito |
| - | ----- | --------- |
| 1 | Edições no mesmo documento são ordenadas por posição | FR-016 |
| 2 | Duas edições NUNCA se sobrepõem; se se sobrepusessem, uma seria descartada | FR-016 |
| 3 | O resultado independe da ordem em que as regras foram registradas | FR-016 |

## `source.fixAll`

| # | Regra | Requisito |
| - | ----- | --------- |
| 1 | Reúne as correções automáticas do documento em **uma** operação de desfazer | FR-013 |
| 2 | Documento sem violação ⟹ **zero** edições, e o documento não é marcado como modificado | FR-015 |
| 3 | Respeita cancelamento e não bloqueia o salvamento de forma perceptível | FR-017 |
| 4 | A participação de **cada regra** é configurável | FR-018 |
| 5 | `PJ0001` fica **fora** por padrão | FR-040, D9 |

O item 5 é a diferença entre as duas correções: trocar a diretiva é inerte; trocar o nome muda o que
o compilador vai procurar. Aplicar isso em massa, ao salvar, sem o usuário olhar, propagaria um
índice errado pelo arquivo inteiro.

## O que o provedor NÃO faz

| Proibição | Razão |
| --------- | ----- |
| I/O síncrono | Princípio I; imposto por lint |
| Log no caminho quente | Princípio I |
| Oferecer ação de regra desligada | FR-008 — a lâmpada não ressuscita o que o usuário desligou |
| Montar título literal no código | Princípio V — tudo pelo NLS, nos quatro idiomas |
| Usar `codeAction/resolve` | desnecessário aqui: a edição é uma troca de palavra cuja posição o diagnóstico já carrega. O `resolve` custaria uma ida e volta de protocolo para economizar trabalho que não existe |

## Como se prova

| O quê | Onde |
| ----- | ---- |
| A edição altera **exatamente** o intervalo previsto | unitário, comparando o texto byte a byte |
| Encoding e fim de linha preservados | unitário, sobre fixture CP1252 com CRLF |
| Versão obsoleta é recusada | unitário |
| A lâmpada aparece e aplica no editor real | integração |
| "Corrigir tudo" é revertido por **um** desfazer | integração |
| Correção ao salvar funciona no fonte de 24.636 linhas sem atraso perceptível | integração |
