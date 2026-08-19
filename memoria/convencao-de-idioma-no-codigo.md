---
name: convencao-de-idioma-no-codigo
description: Inglês no que a máquina lê (identificadores, arquivos, chaves); pt-BR no que a pessoa lê (comentários, nomes de teste, documentação, commits)
metadata:
  type: feedback
---

Decisão do dono em 2026-08-19, durante a spec `001-esqueleto-lsp-harness` (research.md, R9),
confirmada antes de existir uma linha de código.

A linha divisória **não** é "código versus documentação". É **o que a máquina interpreta versus o
que uma pessoa lê**:

| Em inglês | Em pt-BR |
| --------- | -------- |
| identificadores — variáveis, funções, tipos, classes | **comentários dentro do código** |
| nomes de arquivo e de diretório | nomes e descrições de teste (`describe`/`it`) |
| chaves de configuração e de tradução | documentação (`docs/`, `specs/`, `README.md`) |
| mensagens de erro internas | mensagens de commit |

**Why:** a API do VS Code, o LSP e o npm são em inglês — identificador em português produz híbrido
como `validaDocument`, que era o que o legado tinha. Mas comentário existe para explicar **por que** o
código é assim a quem for mantê-lo, e quem mantém este repositório pensa em português. Comentário em
inglês forçado sai mais raso e vira paráfrase da linha seguinte. O Princípio I depende de comentários
que expliquem decisões contraintuitivas de desempenho; esses precisam ser bem escritos, não
traduzidos.

**How to apply:** ao criar qualquer arquivo de código neste repositório, escrever identificadores em
inglês e comentários em português, sem exceção e sem perguntar de novo. Mensagens destinadas ao
usuário final não entram nesta regra — elas passam pelo NLS e existem nos quatro idiomas do Protheus
(ver [[idiomas-do-protheus]]).
