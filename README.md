# ADVPL Lint - Biblioteca Completa de Análise de Código ADVPL/TLPP

Extensão moderna, otimizada e **completa** para análise de qualidade, segurança e performance de códigos ADVPL e TLPP. Implementa todas as **49 regras oficiais do TOTVS Code Analyzer** (SonarQube Protheus).

---

## 🚀 Principais Funcionalidades

- **Validação completa**: 49 regras oficiais TOTVS (Parser, Legacy, Performance, Segurança, Pitfall, Bug, Maintainability)
- **Detecção de problemas críticos**: SQL Injection, senhas expostas, uso de APIs obsoletas, manipulação direta de metadados, includes errados, duplicidade de funções, etc.
- **Performance otimizada**: Cache inteligente, processamento paralelo, análise incremental
- **Relatórios detalhados**: Severidade, localização exata, sugestão de correção
- **Internacionalização**: Mensagens em português e inglês
- **API flexível**: Uso simples para arquivos, projetos ou integração CI/CD

---

## 📦 Instalação

```bash
npm install advpl-lint
```

---

## 🛠️ Uso Básico

### Validação de Arquivo

```typescript
import { AdvplValidator } from 'advpl-lint';
const validator = new AdvplValidator({ enableCache: true });
const resultado = await validator.validate(codigo, 'meuarquivo.prw');
console.log(resultado.diagnostics);
```

### Validação de Projeto

```typescript
import { AdvplProjectValidator } from 'advpl-lint';
const projectValidator = new AdvplProjectValidator({
  extensions: ['prw', 'tlpp'],
});
const resultado = await projectValidator.validateProject(['./src']);
console.log(resultado.summary);
```

---

timeout?: number;
validateIncludes?: boolean;
validateFunctions?: boolean;
validateSyntax?: boolean;
}

---

- **Warning**: Alertas importantes (ex: includes errados, duplicidade)
- **Hint**: Dicas de formatação e estilo

### Exemplos de Códigos de Diagnóstico

Esta extensão valida tanto as **regras oficiais TOTVS** quanto as **regras do projeto legado**. Veja abaixo a lista completa e detalhada de tudo que é validado:

### 🏛️ Regras do Projeto Legado

- **Documentação ProtheusDoc obrigatória**: Funções públicas devem ter documentação padrão.
- **Complexidade ciclomática**: Funções com muitos blocos de decisão são sinalizadas para refatoração.
- **Funções muito longas**: Funções acima de 100 linhas recebem alerta, acima de 200 linhas recebem erro.
- **Variáveis não inicializadas**: Detecta uso de variáveis locais sem inicialização.
- **Números mágicos e strings hardcoded**: Sugere uso de constantes nomeadas.
- **Convenções de nomenclatura**: Funções e variáveis fora do padrão (PascalCase/camelCase) são sinalizadas.
- **Práticas depreciadas**: Uso de comandos antigos como DbSelectArea, DbGoTo, Found(), Eof().
- **Estruturas de controle aninhadas**: Sinaliza blocos com mais de 4 níveis de aninhamento.
- **Duplicidade de funções/arquivos**: Detecta funções e arquivos duplicados no projeto.
- **Includes obrigatórios/obsoletos**: Valida presença e ausência de includes conforme padrão.
- **Padrões de sintaxe e boas práticas**: Pontos e vírgulas duplos, espaços em branco, etc.

### 📋 Regras Oficiais TOTVS Code Analyzer (49 regras)

#### Parser

- **CA0000**: Análise sintática e de compilação

#### LegacyCode

- **CA1000**: Uso de drivers ISAM descontinuados (MSCREATE, DBCREATE, etc.)
- **CA1001**: Uso indevido de bloqueio exclusivo em disco (FCREATE/FOPEN .F.)
- **CA1001-2**: FileSystem efêmero/compartilhado em SmartERP
- **CA1002**: API incorreta em transações
- **CA1003**: API crítica em loop (SUPERGETMV, FWTMPFILENAME, etc.)
- **CA1003-2**: API crítica em loop (versão adicional)
- **CA1004**: Uso incorreto de API de console
- **CA1006**: Funções descontinuadas (ALLUSER, ALLUSERS)

#### Performance/Metadados

- **CA2000**: Uso não permitido do Metadados SM0
- **CA2001**: Uso não permitido do Metadados SIX
- **CA2001-2**: Leitura não permitida do Metadados SIX
- **CA2002**: Uso não permitido do Metadados SX1
- **CA2002-2**: Leitura não permitida do Metadados SX1
- **CA2003**: Uso não permitido do Metadados SX2
- **CA2003-2**: Leitura não permitida do Metadados SX2
- **CA2004**: Uso não permitido do Metadados SX3
- **CA2004-2**: Leitura não permitida do Metadados SX3
- **CA2005**: Uso indevido do Metadados SX7
- **CA2005-2**: Leitura indevida do Metadados SX7
- **CA2006**: Uso não permitido do Metadados SX9
- **CA2006-2**: Leitura não permitida do Metadados SX9
- **CA2007**: Uso não permitido do Metadados SXA
- **CA2008**: Uso não permitido do Metadados SXB
- **CA2008-2**: Leitura não permitida do Metadados SXB
- **CA2009**: Uso não permitido do Metadados SX5
- **CA2009-2**: Leitura não permitida do Metadados SX5
- **CA2010**: Uso não permitido do Metadados SX6
- **CA2010-2**: Leitura não permitida do Metadados SX6
- **CA2011**: Uso não permitido do Metadados SXG
- **CA2011-2**: Leitura não permitida do Metadados SXG
- **CA2012**: Uso não permitido do Metadados SXD
- **CA2012-2**: Leitura não permitida do Metadados SXD
- **CA2013**: Uso não permitido de tabelas de Framework (FW, ZZ, SY)
- **CA2014**: Chamada de API/Classe depreciada
- **CA2015**: Sobrescrita de FormCommit não recomendada
- **CA2016**: Funções de erro/log sem internacionalização

#### Maintainability

- **CA2017**: Uso não permitido de API SPF
- **CA2018**: Uso não permitido de API restrita

#### Security

- **CA2019**: Funções binárias não permitidas (FWCONVRESE, BIN2STR, etc.)
- **CA2020**: Função descontinuada (ALLUSER)
- **CA2021**: Uso de tabela/campos descontinuados SE5
- **CA2022**: Uso não permitido de StaticCall
- **CA2023**: Uso não permitido de PTInternal
- **CA2050**: SQL Injection (queries concatenadas sem ?)
- **CA2052**: Senha exposta no código

#### Pitfall/Armadilhas

- **CA3001**: Include em lower case
- **CA3002**: Herança feita de forma incorreta

#### Bug/Código Limpo

- **CA4000**: Uso de IIF (evitar IIF aninhado, preferir if/else)

---

Cada regra retorna diagnóstico com severidade (Error, Warning, Info, Hint), localização exata e sugestão de correção.

---

## 🌟 Exemplos de Detecção

- **CA2050 (SQL Injection)**: Detecta concatenação de queries sem prepared statement
- **CA2052 (Senha Exposta)**: Identifica variáveis ou strings com senha no código
- **CA1006 (Função Descontinuada)**: Aponta uso de ALLUSER, ALLUSERS, etc.
- **CA3001 (Include em LowerCase)**: Sugere correção para includes em case errado
- **CA4000 (IIF)**: Recomenda uso de if/else ao invés de IIF aninhado

---

## 🎯 Performance

- **Cache inteligente**: Hash do conteúdo, persistência opcional, expiração automática
- **Processamento paralelo**: Configurável, ideal para projetos grandes
- **Relatórios em tempo real**: Callback de progresso, estatísticas detalhadas

---

## 🤝 Contribuição

Contribuições são bem-vindas!

1. Fork o repositório
2. Crie uma branch
3. Adicione testes
4. Execute `npm test`
5. Abra um Pull Request

---

## 📄 Licença

ISC © Robson Rogério Silva

---

## � Próximas Validações ADVPL/TLPP

Baseado nas melhores práticas das linguagens ADVPL e TLPP, planejamos implementar as seguintes validações:

### 🔍 Validações de Sintaxe e Estrutura ADVPL

- **Declarações ADVPL**: Validar uso correto de `LOCAL`, `PRIVATE`, `PUBLIC`, `STATIC`
- **Estruturas de controle**: Verificar `IF/ENDIF`, `FOR/NEXT`, `WHILE/ENDDO` balanceadas
- **Funções ADVPL**: Detectar funções sem `RETURN`, parâmetros não utilizados
- **Arrays ADVPL**: Validar inicialização correta, acesso a índices válidos, uso de `AADD`, `ADEL`
- **Blocos de código**: Verificar sintaxe correta de blocos `{|| }`, `&()`, e macros
- **Operadores**: Detectar uso incorreto de operadores de comparação (`=`, `==`, `!=`, `<>`)

### 🏗️ Validações TLPP Orientação a Objetos

- **Encapsulamento**: Verificar uso correto de `PROTECTED`, `PRIVATE`, `PUBLIC` em métodos
- **Herança**: Validar chamadas corretas para `::New()`, `::Super()`, implementação de interfaces
- **Métodos abstratos**: Garantir implementação de métodos abstratos em classes filhas
- **Sobrecarga de métodos**: Detectar assinaturas conflitantes ou incompatíveis
- **Propriedades de classe**: Validar inicialização e acesso correto a propriedades
- **Namespaces**: Verificar uso consistente de namespaces e importações

### ⚡ Validações de Performance e Otimização

- **Loops ineficientes**: Detectar loops que podem ser otimizados por funções nativas
- **Manipulação de strings**: Sugerir uso de `StringBuilder` para concatenação múltipla
- **Consultas SQL**: Validar uso de prepared statements, índices apropriados, evitar `SELECT *`
- **Uso de memória**: Detectar vazamentos de memória, objetos não liberados
- **Funções recursivas**: Alertar sobre potencial estouro de pilha em recursões profundas

### 🛡️ Validações de Segurança e Boas Práticas

- **Validação de entrada**: Verificar sanitização de parâmetros em funções públicas
- **Logs e auditoria**: Garantir que operações críticas sejam logadas adequadamente
- **Credenciais**: Detectar senhas, tokens ou chaves hardcoded no código
- **Injection prevention**: Validar proteção contra SQL Injection e code injection

### 🏢 Validações Específicas do Framework Protheus

- **Uso de tabelas padrão**: Validar acesso correto a tabelas do sistema (SX1, SX2, SX3, etc.)
- **Rotinas automáticas**: Verificar implementação correta de ExecAuto, rotinas de integração
- **MVC Pattern**: Validar implementação correta do padrão MVC em aplicações Protheus
- **Pontos de entrada**: Detectar uso adequado de pontos de entrada e validações
- **Relatórios**: Validar estrutura correta de relatórios (TReport, Crystal Reports)

### 🌐 Validações de Integração e Conectividade

- **WebServices**: Verificar implementação correta de SOAP/REST, tratamento de timeouts
- **APIs REST**: Validar estrutura JSON, códigos de status HTTP, autenticação
- **Conectividade de banco**: Detectar problemas em conexões, transações não commitadas

### 🔬 Validações Avançadas

- **Análise de fluxo**: Detectar código inalcançável, condições sempre verdadeiras/falsas
- **Complexidade cognitiva**: Medir complexidade além da ciclomática (aninhamento, condições)
- **Cobertura de testes**: Sugerir áreas que precisam de testes unitários
- **Refatoração**: Identificar code smells e sugerir melhorias estruturais

---

## �🔗 Links Úteis

- [Guia TOTVS SonarQube(Gerado por IA)](./Guia%20Completo%20-%20Regras%20SonarQube%20TOTVS%20Protheus.pdf)
- [Regras Detalhadas(Gerado por IA)](./SONNAR-RULES.md)
- [GitHub](https://github.com/robsonrosilva/Lint-ADVPL)
- [Issues](https://github.com/robsonrosilva/Lint-ADVPL/issues)
- [Documentação ADVPL](https://tdn.totvs.com/display/tec/AdvPL)
- [Documentação TLPP](https://tdn.totvs.com/display/tec/TLPP)
