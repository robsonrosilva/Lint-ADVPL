# Memória do projeto

Índice da memória versionada. Um arquivo por fato; conteúdo mora no arquivo, nunca aqui.

> **Retomando o trabalho? Comece por [Estado atual](estado-atual.md) e
> [Armadilhas do ambiente](armadilhas-do-ambiente.md).**

- [**Estado atual**](estado-atual.md) — onde parou, o que falta, o que espera decisão. **Leia primeiro**
- [**Armadilhas do ambiente**](armadilhas-do-ambiente.md) — erros de ferramenta que já custaram tempo aqui
- [Escopo decidido da spec 002](spec-002-escopo-decidido.md) — ações de correção + portabilidade de include
- [Corpus externo de fontes reais](corpus-externo.md) — onde está, por que não pode ser versionado, e como usá-lo para derivar fixture
- [Distribuição de tamanho dos fontes](distribuicao-tamanho-fontes.md) — p50 309, p95 2.933, máx 24.636 linhas
- [Orçamento de desempenho subdimensionado](orcamento-desempenho-subdimensionado.md) — o "1.000 linhas" do Princípio I fica abaixo do p95 real
- [Identificador de regra](identificador-de-regra.md) — id puro do catálogo (`CA3001`); regras próprias na faixa `PJ####`
- [Identidade da extensão](identidade-da-extensao.md) — publica independente da atual; assumir a antiga é spec futura
- [Severidade MINOR → Information](severidade-minor-information.md) — a tabela mapeia por catálogo; volume se resolve por sobreposição com razão
- [Medição de includes no corpus](medicao-includes-corpus.md) — 71,9% das diretivas em caixa alta; baixar a caixa do nome quebraria 706 referências
- [Idiomas do Protheus](idiomas-do-protheus.md) — quatro idiomas (pt-br, es, en, ru); Princípio V emendado na v2.2.0
- [Convenção de idioma no código](convencao-de-idioma-no-codigo.md) — inglês no que a máquina lê, pt-BR no que a pessoa lê (comentários inclusive)
- [Cobertura mínima de 98%](cobertura-minima-98.md) — teste nunca é opcional; limiar no runner, exclusão só com razão registrada
