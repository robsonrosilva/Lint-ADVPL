---
name: identidade-da-extensao
description: A extensão nova publica com identidade própria e convive com a atual; assumir a identidade antiga é decisão de spec futura
metadata:
  type: project
---

Decisão do dono em 2026-08-19, na spec `001-esqueleto-lsp-harness` (registrada lá como **D1**).

A extensão escrita neste repositório tem **identidade de publicação própria** e convive instalada ao
lado da extensão atual. Nada publicado daqui chega à base instalada da extensão atual como
atualização.

**Why:** a spec 001 entrega **uma** regra. Assumir a identidade atual empurraria, como atualização
automática, uma extensão com 1 diagnóstico onde havia 33 e sem a formatação — que era a melhor
entrega do legado.

**How to apply:** as chaves de `contributes.configuration` vivem em espaço de nomes próprio, sem
colisão com as da extensão atual, e nenhuma configuração da extensão atual é lida ou migrada. A
decisão de assumir a identidade antiga pertence a uma **spec de publicação futura**, quando houver
paridade de regras e a formatação existir — não se antecipa em spec de motor.

Ver [[identificador-de-regra]].

## Identidade visual — o ícone, desde 2026-08-19

O dono entregou a marca em SVG. Dois arquivos, e a diferença importa:

| Arquivo | O que é |
| ------- | ------- |
| `packages/extension/icon.svg` | **a marca** — quadrado escuro arredondado, duas chaves douradas envolvendo três barras escalonadas e um sinal de confirmação verde |
| `docs/design/icone-apresentacao.svg` | a prancha original, com a marca mais pré-visualizações de 64 px e 32 px e seus rótulos |

O arquivo entregue era a **prancha**, não o ícone: `viewBox` de `0 0 680 300`, com dois
`<use href="#advplIcon">` em escala e dois `<text>` de legenda. Usado direto, a extensão apareceria
com a marca espremida à esquerda e duas miniaturas legendadas ao lado.

A marca foi extraída recortando o `viewBox` para `170 40 220 220` e removendo os `<use>` e os
`<text>`. Saiu também o atributo `style` repetido em cada elemento — herança do editor que gerou o
arquivo, que redeclarava o que os atributos próprios já diziam e referenciava uma família de fontes
inexistente fora dali. De 5.681 para 1.158 bytes, sem perder um pixel.

⚠️ **PENDENTE: o VS Code não aceita SVG como ícone de extensão.** O manifesto exige **PNG**, 256×256
recomendado (mínimo 128×128), e por isso `"icon"` ainda **não** está declarado em
`packages/extension/package.json`.

Não há conversor nesta máquina — sem ImageMagick, sem Inkscape, sem rsvg. O `convert` que aparece no
PATH é o `convert.exe` do Windows, que converte volumes FAT para NTFS; **não usar**.

**How to apply:** três saídas, e a escolha é do dono — exportar o PNG à mão; acrescentar
`@resvg/resvg-js` como dependência de desenvolvimento e derivar o PNG do SVG no build (o que impede
os dois divergirem, ao custo de uma dependência nova); ou deixar para a spec de publicação, junto de
`galleryBanner`, `categories` e o resto do que o marketplace pede.
