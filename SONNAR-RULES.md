# Guia Completo - Regras SonarQube TOTVS Protheus

## Índice

- [Regras de Compilação e Parser](#regras-de-compilação-e-parser)
- [Regras de Código Legado](#regras-de-código-legado)
- [Regras de Performance](#regras-de-performance)
- [Regras de Manutenibilidade](#regras-de-manutenibilidade)
- [Regras de Segurança](#regras-de-segurança)
- [Regras de Armadilhas (Pitfall)](#regras-de-armadilhas-pitfall)
- [Regras de Código Limpo](#regras-de-código-limpo)

---

## Regras de Compilação e Parser

### CA0000: Error de compilação

| Propriedade | Valor |
|------------|-------|
| **TypeName** | SyntaxError |
| **CheckId** | CA0000 |
| **Categoria** | Parser |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Erro de compilação que pode ocorrer por diversas causas relacionadas à sintaxe da linguagem.

#### Causas Possíveis
- Erro de sintaxe da linguagem
- Caracteres inválidos
- Uso de charset incorreto na IDE (recomendado: Windows-1252)

#### Como Corrigir
1. Identificar e corrigir erros de sintaxe
2. Verificar charset da IDE (usar Windows-1252)
3. Verificar caracteres especiais inválidos
4. Seguir guia de boas práticas para fechamento de blocos

---

## Regras de Código Legado

### CA1000: Chamada inválida de drive ISAM

| Propriedade | Valor |
|------------|-------|
| **TypeName** | InvalidLocalDriverCallFunction |
| **CheckId** | CA1000 |
| **Categoria** | LegacyCode |
| **Tipo** | BUG |
| **Aplicabilidade** | Except Framework |
| **Supressão** | ⚠️ Permitida apenas para clientes com licença CtreeServer |

#### Descrição
O uso de drive ISAM na linha Microsiga Protheus foi descontinuado a partir da versão 12.

#### Justificativa
- Perda significativa de desempenho
- Arquitetura legada
- Necessidade de adoção de modelo relacional

#### Comparativo de Performance

| Driver | Tipo de Acesso | Tempo (segundos) |
|--------|----------------|------------------|
| Ctree BoundServer (PREIMAGE) | ISAM Legado | 10.024 |
| Ctree BoundServer | ISAM Legado | 11483.171 |
| TempDb | Relacional | 1.845 |
| TempDb | ISAM | 91.256 |

#### Como Corrigir
- **Para arquivos temporários**: Utilizar [FWTemporaryTable](http://tdn.totvs.com/display/framework/FWTemporaryTable) em modo Relacional
- **Para exportação de dados**: Utilizar API ExpExcel para formato CSV

#### Exemplos de Violação
A regra detecta tentativas de acesso a drivers ISAM como:
- DbCreate()
- DbUseArea() com driver local
- Operações com arquivos .DBF locais

---

### CA1001: Uso indevido de Bloqueio Exclusivo no FileSystem/RootPath

| Propriedade | Valor |
|------------|-------|
| **TypeName** | InvalidUseDiskSemaphore |
| **CheckId** | CA1001 |
| **Categoria** | LegacyCode |
| **Tipo** | CODE SMELL |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso indevido de bloqueio exclusivo em disco e/ou criação/abertura de arquivo em modo exclusivo no RootPath do Application Server.

#### Justificativa
A partir da versão 12, deve ser evitado qualquer tipo de semáforo em disco.

#### Como Corrigir
- Utilizar [LockByName](http://tdn.totvs.com/pages/releaseview.action?pageId=6814894) como último recurso
- Recomendação: eliminar necessidade de bloqueio exclusivo

---

### CA1001-2: Ofensor para SmartERP com FileSystem compartilhado

| Propriedade | Valor |
|------------|-------|
| **TypeName** | InvalidUseDiskSemaphore |
| **CheckId** | CA1001-2 |
| **Categoria** | LegacyCode |
| **Tipo** | CODE SMELL |
| **Aplicabilidade** | All |
| **Supressão** | ✅ Permitida em casos específicos |

#### Descrição
Ofensor para SmartERP com FileSystem compartilhado/efêmero no RootPath do Application Server.

#### Justificativa
O FileSystem trabalhará em modo compartilhado/efêmero, incompatível com operações tradicionais de arquivo.

#### Quando Suprimir
Quando a função:
- Consultar/criar arquivo criado pela mesma ou pelo processo que a iniciou
- O arquivo será removido após o término da execução

---

### CA2021: Uso de tabela/campos descontinuados SE5

| Propriedade | Valor |
|------------|-------|
| **TypeName** | CA2021 |
| **CheckId** | CA2021 |
| **Categoria** | LegacyCode |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
A tabela SE5 (Movimentação bancária) está em processo de descontinuidade.

#### Justificativa
A partir da versão 12, os dados passam a ser gravados em um novo conjunto de tabelas em substituição à SE5.

#### Como Corrigir
- **Para gravação**: Usar ExecAuto das rotinas de baixa
- **Para leitura**: Consultar documento [Reestruturação da tabela SE5 na família de tabelas FKx](https://tdn.totvs.com.br/pages/releaseview.action?pageId=181965434)

---

## Regras de Performance

### CA1002: Chamada de API não permitida em transação

| Propriedade | Valor |
|------------|-------|
| **TypeName** | InvalidFunctionTransationScope |
| **CheckId** | CA1002 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido de leitura do metadados de Descrição das propriedades de tabelas (SX3).

#### Como Corrigir
- Utilizar APIs padrão de leitura
- Consultar [FWSX3Util](http://tdn.totvs.com/display/PROT/FWSX3Util)
- Manipulações apenas por Configurador ou atualização

---

### CA2005: Uso indevido do Metadados - SX7

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSX7 |
| **CheckId** | CA2005 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | Except Framework |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso indevido do metadados de Gatilhos (SX7).

#### Justificativa
Em futuras versões, o alias SX7 não estará disponível, sendo obrigatório uso de APIs padrão de forma indireta.

#### Como Corrigir
- Utilizar APIs padrão de leitura
- Remover manipulação direta
- Manipulações apenas por Configurador ou atualização

---

### CA2005-2: Uso indevido de leitura Metadados - SX7

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAccessSX7 |
| **CheckId** | CA2005-2 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | Except Framework |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso indevido de leitura metadados de Gatilhos (SX7).

#### Como Corrigir
Utilizar APIs padrão de leitura do metadados.

---

### CA2006: Uso indevido do Metadados - SX9

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSX9 |
| **CheckId** | CA2006 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | Except Framework |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso indevido do metadados de Relacionamento (SX9).

#### Justificativa
Em futuras versões, o alias SX9 não estará disponível.

#### Como Corrigir
- Utilizar APIs padrão de leitura
- Remover manipulação direta
- Manipulações apenas por Configurador ou atualização

---

### CA2006-2: Uso indevido de leitura do Metadados - SX9

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAccessSX9 |
| **CheckId** | CA2006-2 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | Except Framework |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso indevido de leitura metadados de Relacionamento (SX9).

#### Como Corrigir
Utilizar APIs padrão de leitura do metadados.

---

### CA2007: Uso não permitido do Metadados - SXA

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSXA |
| **CheckId** | CA2007 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | Except Framework |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido do metadados das Propriedades de Pastas (SXA).

#### Justificativa
Em futuras versões, o alias SXA não estará disponível.

#### Como Corrigir
- Utilizar APIs padrão de leitura
- Remover manipulação direta
- Manipulações apenas por Configurador ou atualização

---

### CA2008: Uso não permitido do Metadados - SXB

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSXB |
| **CheckId** | CA2008 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | Except Framework |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido do metadados de LookUP/Consultas (SXB).

#### Justificativa
Em futuras versões, o alias SXB não estará disponível.

#### Como Corrigir
- Utilizar APIs padrão de leitura
- Remover manipulação direta
- Manipulações apenas por Configurador ou atualização

---

### CA2008-2: Uso não permitido de leitura do Metadados - SXB

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAccessSXB |
| **CheckId** | CA2008-2 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | Except Framework |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido de leitura do metadados de LookUP/Consultas (SXB).

#### Como Corrigir
Utilizar APIs padrão de leitura do metadados.

---

### CA2009: Uso descontinuado de atribuição e leitura do Metadados - SX5

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSX5 |
| **CheckId** | CA2009 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso descontinuado do metadados de Tabelas Genéricas (SX5).

#### Justificativa
O uso de atribuição comprovou-se equivocado e foi descontinuado devido a bloqueio exclusivo de processos em transação.

#### Impacto Futuro
Em futuras versões, o alias SX5 será aberto/fechado conforme demanda para evitar perda de desempenho.

#### Como Corrigir
- Utilizar APIs padrão de leitura
- Remover manipulação direta
- Manipulações apenas por Configurador ou atualização

---

### CA2009-2: Uso descontinuado de leitura do Metadados - SX5

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAccessSX5 |
| **CheckId** | CA2009-2 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso descontinuado de leitura do metadados de Tabelas Genéricas (SX5).

#### Como Corrigir
Utilizar APIs padrão de leitura do metadados.

---

### CA2010: Uso descontinuado de leitura e atualização do Metadados - SX6

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSX6 |
| **CheckId** | CA2010 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso descontinuado de leitura e atualização do metadados de parâmetros (SX6).

#### Justificativa
O uso de atribuição comprovou-se equivocado devido a bloqueio exclusivo de processos em transação.

#### Impacto Futuro
Em futuras versões, o alias SX6 não será aberto.

#### Como Corrigir
- Utilizar GetMV() / SuperGetMV()
- Remover manipulação direta
- Manipulações apenas por Configurador ou atualização

---

### CA2010-2: Uso descontinuado de leitura do Metadados - SX6

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAccessSX6 |
| **CheckId** | CA2010-2 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso descontinuado de leitura do metadados de parâmetros (SX6).

#### Como Corrigir
Utilizar GetMV() / SuperGetMV() para leitura.

---

### CA2011: Uso inválido do Metadados - SXG

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSXG |
| **CheckId** | CA2011 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso indevido do metadados de grupos de campos (SXG).

#### Justificativa
Em futuras versões, o alias SXG não será aberto.

#### Como Corrigir
- Utilizar APIs padrão de leitura
- Remover manipulação direta
- Manipulações apenas por Configurador ou atualização

---

### CA2011-2: Uso inválido de leitura do Metadados - SXG

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAccessSXG |
| **CheckId** | CA2011-2 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso indevido da leitura do metadados de grupos de campos (SXG).

#### Como Corrigir
Utilizar APIs padrão de leitura do metadados.

---

### CA2012: Uso descontinuado do Metadados - SXD

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSXD |
| **CheckId** | CA2012 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso descontinuado do metadados do Schedule (SXD).

#### Justificativa
Esta tabela teve seu uso descontinuado e foi substituída pela padronização [SchedDef](http://tdn.totvs.com/display/framework/Rotinas+de+processamento).

#### Impacto Futuro
Em futuras versões, o alias SXD será removido.

#### Como Corrigir
- Utilizar padronização SchedDef
- Remover manipulação direta
- Manipulações apenas por Configurador ou atualização

---

### CA2012-2: Uso descontinuado de leitura do Metadados - SXD

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAccessSXD |
| **CheckId** | CA2012-2 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso descontinuado de leitura do metadados do Schedule (SXD).

#### Como Corrigir
Utilizar padronização SchedDef para leitura.

---

### CA2013: Uso não permitido das tabelas de Framework

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigment |
| **CheckId** | CA2013 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Acesso direto a tabelas de Framework não permitido.

#### Justificativa
As tabelas do Framework não podem ser manipuladas através de workarea ou por Classes/Funções que não são de Framework.

#### Tabelas do Framework Protegidas
- Todas as tabelas internas do Framework
- Tabelas de configuração e controle

#### Como Corrigir
Utilizar as APIs padrão fornecidas pelo Framework.

---

## Regras de Manutenibilidade

### CA1004: Uso não permitido de chamada de API de Console

| Propriedade | Valor |
|------------|-------|
| **TypeName** | InvalidLogFunction |
| **CheckId** | CA1004 |
| **Categoria** | Maintainability |
| **Tipo** | CODE SMELL |
| **Aplicabilidade** | All |
| **Supressão** | ✅ Permitida quando referente a Brand do produto |

#### Descrição
Uso indevido de chamada de API de Log.

#### Justificativa
A regra avalia tentativas de chamadas de API de log que devem ser suprimidas e o não uso de internacionalização (I18N).

#### APIs Detectadas
- ConOut()
- ConOutR()
- Outras funções de console

#### Como Corrigir
Alterar para utilizar API de Log padrão com internacionalização.

#### Funções Permitidas
- Funções de log que seguem padrão I18N
- APIs de log do Framework

#### Quando Suprimir
Quando a regra for referente a uma Brand do produto.

---

### CA1006: Uso de Função/Classe Descontinuada - AllUsers

| Propriedade | Valor |
|------------|-------|
| **TypeName** | invalid_allusers_call |
| **CheckId** | CA1006 |
| **Categoria** | Maintainability |
| **Tipo** | CODE SMELL |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso de funções descontinuadas.

#### Funções Detectadas
- AllUsers() - Função descontinuada

#### Como Corrigir
Substituir AllUsers() pela função recomendada ou alterar a aplicação.

---

## Regras de Armadilhas (Pitfall)

### CA2014: Uso inválido do Metadados - SX1 (API Depreciada)

| Propriedade | Valor |
|------------|-------|
| **TypeName** | FunctionCallDeprecated |
| **CheckId** | CA2014 |
| **Categoria** | Pitfall |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Chamada de API/Classe depreciada que teve seu ciclo de vida encerrado (DEPRECATED).

#### Como Corrigir
Alterar o código-fonte para utilizar API em ciclo de vida ativo.

---

### CA2015: Sobrescrita de FormCommit não recomendada

| Propriedade | Valor |
|------------|-------|
| **TypeName** | FunctionCallDeprecated |
| **CheckId** | CA2015 |
| **Categoria** | Pitfall |
| **Tipo** | CODE SMELL |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Sobrescrita de FormCommit não é recomendada.

#### Como Corrigir
Alterar o código-fonte para utilizar API em ciclo de vida.

---

### CA2016: Funções de erro/Log sem String de Internacionalização

| Propriedade | Valor |
|------------|-------|
| **TypeName** | FunctionCallDeprecated |
| **CheckId** | CA2016 |
| **Categoria** | Pitfall |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Funções de erro/Log sem String de Internacionalização (I18N).

#### Como Corrigir
Alterar o código-fonte para utilizar STR (strings internacionalizadas).

---

### CA2017: Uso não permitido de API SPF

| Propriedade | Valor |
|------------|-------|
| **TypeName** | FunctionCallDeprecated |
| **CheckId** | CA2017 |
| **Categoria** | Pitfall |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido de API SPF (API legada).

#### Como Corrigir
Alterar o código-fonte para utilizar funções de Framework.

---

### CA2018: Uso não permitido de API

| Propriedade | Valor |
|------------|-------|
| **TypeName** | FunctionCallDeprecated |
| **CheckId** | CA2018 |
| **Categoria** | Pitfall |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido de API genérica.

#### Como Corrigir
Utilizar alternativas recomendadas.

---

### CA2019: Uso de funções de leitura/gravação binária não permitido

| Propriedade | Valor |
|------------|-------|
| **TypeName** | FunctionCallDeprecated |
| **CheckId** | CA2019 |
| **Categoria** | Pitfall |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso de funções que fazem gravação/leitura binária de dados.

#### Funções Detectadas e Como Corrigir

| Função | Ação |
|--------|------|
| FWConvRese() | Retirar do fonte - uso não permitido |
| FWConvBin() | Retirar do fonte - uso não permitido |
| Bin2Str() | Usar X3OBRIGAT() para obrigatoriedade de campo, ou retirar |
| Str2Bin() | Avaliar necessidade (alguns bancos não suportam binários) |
| X3Reserv() | Usar X3OBRIGAT() para obrigatoriedade de campo, ou retirar |

---

### CA2020: Uso de Função/Classe Descontinuada

| Propriedade | Valor |
|------------|-------|
| **TypeName** | FunctionCallDeprecated |
| **CheckId** | CA2020 |
| **Categoria** | Pitfall |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso de funções descontinuadas.

#### Funções Detectadas
- AllUser() → Substituir por [FWSFALLUSERS()](http://tdn.totvs.com/display/PROT/FWSFALLUSERS)

---

### CA3001: Include em lower case

| Propriedade | Valor |
|------------|-------|
| **TypeName** | FunctionCallDeprecated |
| **CheckId** | CA3001 |
| **Categoria** | Pitfall |
| **Tipo** | CODE SMELL |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Include em lower case (minúsculas).

#### Como Corrigir
Trocar o texto do include para lowercase (minúsculas).

#### Exemplo
```advpl
// ❌ Incorreto
#INCLUDE "PROTHEUS.CH"

// ✅ Correto
#include "protheus.ch"
```

---

### CA3002: Herança feita de forma incorreta

| Propriedade | Valor |
|------------|-------|
| **TypeName** | FunctionCallDeprecated |
| **CheckId** | CA3002 |
| **Categoria** | Pitfall |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Herança feita de forma incorreta.

#### Como Corrigir
Trocar de LongClassName para LongNameClass.

#### Exemplo
```advpl
// ❌ Incorreto
oObj := LongClassName():New()

// ✅ Correto
oObj := LongNameClass():New()
```

---

## Regras de Segurança

### CA2022: Uso não permitido de função restrita StaticCall

| Propriedade | Valor |
|------------|-------|
| **TypeName** | CA2022 |
| **CheckId** | CA2022 |
| **Categoria** | Security |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido da função restrita StaticCall.

#### Justificativa
Função de uso interno e restrito. A partir do release 33, fontes customizados irão sinalizar erro de compilação.

#### Como Corrigir
- Suprimir o uso da função, OU
- **Fontes customizados**: Alterar escopo para User Function
- **Fontes padrão**: Alterar escopo para Function

---

### CA2023: Uso não permitido de função restrita PTInternal

| Propriedade | Valor |
|------------|-------|
| **TypeName** | CA2023 |
| **CheckId** | CA2023 |
| **Categoria** | Security |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido da função restrita PTInternal.

#### Justificativa
Função de uso interno e restrito. A partir do release 33, fontes customizados irão sinalizar erro de compilação.

#### Como Corrigir
- Suprimir o uso da função
- **Caso específico**: Se usado PTInternal(1), utilizar [FWMonitorMsg](https://tdn.totvs.com/display/framework/FWMonitorMsg)

---

### CA2050: SQL Injection

| Propriedade | Valor |
|------------|-------|
| **TypeName** | CA2050 |
| **CheckId** | CA2050 |
| **Categoria** | Security |
| **Tipo** | VULNERABILIDADE |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Possíveis pontos de vulnerabilidade de ataque de injeção de SQL.

#### Justificativa
A injeção de SQL é uma técnica de injeção de código que pode destruir seu banco de dados e é uma das técnicas de hacking mais comuns na web.

#### Exemplo de Vulnerabilidade
```advpl
User Function retUserByCode(ctxtUserId as Character)
    local cAlias := "TRB"
    // ❌ VULNERÁVEL - Concatenação direta
    dbUseArea(.T., "TOPCONN", TcGenQry(,,"SELECT * FROM Users WHERE UserId = " + ctxtUserId), cAlias, .T., .T.)
    If !((cAlias)->(EOF()))
        //Faz Algo
    Endif
...
```

#### Cenário de Ataque
Se o parâmetro `ctxtUserId` receber: `105 OR 1=1`
O SQL resultante será: `SELECT * FROM Users WHERE UserId = 105 OR 1=1`
Retornando TODOS os usuários.

#### Como Corrigir
Utilizar funções que utilizem o conceito de **Prepared Statement** (substituição de valores com `?`).

#### Funções Recomendadas
- TcGenQry() com prepared statements
- Funções que suportam bind de parâmetros
- APIs do Framework que tratam SQL injection

#### Exemplo Correto
```advpl
User Function retUserByCode(ctxtUserId as Character)
    local cAlias := "TRB"
    local cQuery := ""
    
    // ✅ SEGURO - Prepared Statement
    cQuery := "SELECT * FROM Users WHERE UserId = ?"
    dbUseArea(.T., "TOPCONN", TcGenQry(,, cQuery, {ctxtUserId}), cAlias, .T., .T.)
    ...
```

---

### CA2052: Senha Exposta

| Propriedade | Valor |
|------------|-------|
| **TypeName** | CA2052 |
| **CheckId** | CA2052 |
| **Categoria** | Security |
| **Tipo** | CODE SMELL |
| **Aplicabilidade** | All |
| **Supressão** | ✅ Permitida quando for falso positivo |

#### Descrição
Senha exposta no código fonte.

#### Como Corrigir
Avaliar possibilidade de substituição da string em um pipeline de deploy.

#### Quando Suprimir
Quando o item for um falso positivo (não é realmente uma senha).

---

## Regras de Código Limpo

### CA4000: Código limpo | Não utilização de IIF

| Propriedade | Valor |
|------------|-------|
| **TypeName** | CA4000 |
| **CheckId** | CA4000 |
| **Categoria** | Bug |
| **Tipo** | CODE SMELL |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Construções utilizando iif() ou if() inline dificultam a leitura do código, prejudicam o debug e mascaram a cobertura de código de teste.

#### Justificativa
- Dificulta leitura do código
- Prejudica debug
- Mascara cobertura de testes
- Reduz manutenibilidade

#### Como Corrigir
Fazer a construção de código de maneira mais limpa, utilizando a estrutura `if/else`.

#### Exemplo
```advpl
// ❌ Incorreto - Dificulta leitura
cResult := iif(nValor > 100, iif(lAtivo, "A", "B"), iif(lNovo, "C", "D"))

// ✅ Correto - Código limpo
If nValor > 100
    If lAtivo
        cResult := "A"
    Else
        cResult := "B"
    EndIf
Else
    If lNovo
        cResult := "C"
    Else
        cResult := "D"
    EndIf
EndIf
```

---

## Resumo por Categoria

### 📊 Estatísticas das Regras

| Categoria | Quantidade | BUG | CODE SMELL | VULNERABILIDADE |
|-----------|------------|-----|------------|-----------------|
| Parser | 1 | 1 | 0 | 0 |
| LegacyCode | 4 | 2 | 2 | 0 |
| Performance | 28 | 28 | 0 | 0 |
| Maintainability | 2 | 0 | 2 | 0 |
| Security | 4 | 2 | 1 | 1 |
| Pitfall | 9 | 7 | 2 | 0 |
| Bug | 1 | 0 | 1 | 0 |
| **TOTAL** | **49** | **40** | **8** | **1** |

### ⚠️ Regras que NÃO Permitem Supressão

Das 49 regras, **45 não permitem supressão** de avisos.

### ✅ Regras que Permitem Supressão (Condicionalmente)

1. **CA1000** - Apenas para clientes com licença CtreeServer
2. **CA1001-2** - Em casos específicos de FileSystem efêmero
3. **CA1004** - Quando referente a Brand do produto
4. **CA2052** - Quando for falso positivo

---

## Melhores Práticas

### 🎯 Priorização de Correções

1. **Prioridade CRÍTICA** - Segurança (VULNERABILIDADE)
   - CA2050: SQL Injection

2. **Prioridade ALTA** - BUGs que afetam Performance
   - Todas as regras CA20XX (Metadados)
   - CA1002, CA1003 (APIs em transação/loop)

3. **Prioridade MÉDIA** - CODE SMELLs
   - CA1004: API de Console
   - CA4000: Uso de IIF
   - CA2052: Senha Exposta

4. **Prioridade BAIXA** - Refatoração
   - CA3001: Include em lowercase
   - CA3002: Herança incorreta

### 📚 Recursos Úteis

- [TDN TOTVS](http://tdn.totvs.com)
- [FWTemporaryTable](http://tdn.totvs.com/display/framework/FWTemporaryTable)
- [FWSX3Util](http://tdn.totvs.com/display/PROT/FWSX3Util)
- [TXMLManager](https://tdn.totvs.com/display/tec/Classe+TXmlManager)
- [Reestruturação SE5](https://tdn.totvs.com.br/pages/releaseview.action?pageId=181965434)

---

## Glossário

- **ISAM**: Indexed Sequential Access Method - Método legado de acesso a dados
- **Metadados**: Tabelas de dicionário de dados do sistema (SX1, SX2, SX3, etc.)
- **Framework**: Conjunto de bibliotecas e APIs padrão do Protheus
- **RootPath**: Diretório raiz do Application Server
- **Prepared Statement**: Técnica de parametrização de queries SQL para evitar injection
- **I18N**: Internacionalização (Internationalization)
- **CSV**: Comma-Separated Values - Formato de arquivo de dados
- **ExecAuto**: Função automática de execução de rotinas
- **SchedDef**: Padronização de rotinas de processamento agendado
- **Pitfall**: Armadilha de código, padrão que leva a erros
- **Code Smell**: Indicador de possível problema no código
- **Deprecated**: Funcionalidade descontinuada, em fase de remoção

---

## Tabelas de Metadados

### Referência Rápida

| Alias | Descrição | Regras Relacionadas |
|-------|-----------|---------------------|
| **SM0** | Tabela de Empresas | CA2000 |
| **SIX** | Índices | CA2001, CA2001-2 |
| **SX1** | Perguntas (Parambox) | CA2002, CA2002-2, CA2014 |
| **SX2** | Tabelas | CA2003, CA2003-2 |
| **SX3** | Campos/Propriedades | CA2004, CA2004-2 |
| **SX5** | Tabelas Genéricas | CA2009, CA2009-2 |
| **SX6** | Parâmetros | CA2010, CA2010-2 |
| **SX7** | Gatilhos | CA2005, CA2005-2 |
| **SX9** | Relacionamentos | CA2006, CA2006-2 |
| **SXA** | Pastas | CA2007 |
| **SXB** | Consultas/LookUp | CA2008, CA2008-2 |
| **SXD** | Schedule | CA2012, CA2012-2 |
| **SXG** | Grupos de Campos | CA2011, CA2011-2 |

---

## Checklist de Conformidade

Use este checklist para validar seu código antes do commit:

### ✅ Estrutura e Sintaxe
- [ ] Código compila sem erros (CA0000)
- [ ] Includes em lowercase (CA3001)
- [ ] Herança de classes correta (CA3002)

### ✅ Performance
- [ ] Não usa drivers ISAM (CA1000)
- [ ] Não usa bloqueio exclusivo em disco (CA1001, CA1001-2)
- [ ] Não chama APIs de interface em transação (CA1002)
- [ ] Não chama APIs custosas em loop (CA1003, CA1003-2)
- [ ] Não acessa metadados diretamente (CA2000-CA2013)

### ✅ Segurança
- [ ] Não usa StaticCall (CA2022)
- [ ] Não usa PTInternal (CA2023)
- [ ] Protegido contra SQL Injection (CA2050)
- [ ] Sem senhas expostas no código (CA2052)

### ✅ Manutenibilidade
- [ ] Usa APIs de log com I18N (CA1004, CA2016)
- [ ] Não usa funções descontinuadas (CA1006, CA2020)
- [ ] Código limpo sem IIFs aninhados (CA4000)

### ✅ APIs Legadas
- [ ] Não usa APIs SPF (CA2017)
- [ ] Não usa APIs não permitidas (CA2018)
- [ ] Não usa funções binárias (CA2019)
- [ ] Substituiu tabela SE5 por FKx (CA2021)

---

## Exemplos Práticos de Correção

### Exemplo 1: SQL Injection (CA2050)

#### ❌ Código Vulnerável
```advpl
User Function BuscaCliente(cCodigo)
    Local cQuery := ""
    
    // VULNERÁVEL A SQL INJECTION
    cQuery := "SELECT * FROM " + RetSqlName("SA1")
    cQuery += " WHERE A1_COD = '" + cCodigo + "'"
    
    DbUseArea(.T., "TOPCONN", TcGenQry(,,cQuery), "TRB", .F., .T.)
Return
```

#### ✅ Código Seguro
```advpl
User Function BuscaCliente(cCodigo)
    Local cQuery := ""
    Local aParams := {}
    
    // SEGURO - USA PREPARED STATEMENT
    cQuery := "SELECT * FROM " + RetSqlName("SA1")
    cQuery += " WHERE A1_COD = ?"
    
    aAdd(aParams, cCodigo)
    
    DbUseArea(.T., "TOPCONN", TcGenQry(,, cQuery, aParams), "TRB", .F., .T.)
Return
```

---

### Exemplo 2: Acesso a Metadados (CA2003, CA2004)

#### ❌ Código Incorreto
```advpl
User Function GetTableInfo()
    Local cNomeTab := ""
    
    // VIOLAÇÃO CA2003 - Acesso direto ao SX2
    DbSelectArea("SX2")
    SX2->(DbSetOrder(1))
    If SX2->(DbSeek("SA1"))
        cNomeTab := SX2->X2_NOME
    EndIf
    
    // VIOLAÇÃO CA2004 - Acesso direto ao SX3
    DbSelectArea("SX3")
    SX3->(DbSetOrder(2))
    If SX3->(DbSeek("A1_NOME"))
        cTitulo := SX3->X3_TITULO
    EndIf
Return
```

#### ✅ Código Correto
```advpl
User Function GetTableInfo()
    Local cNomeTab := ""
    Local cTitulo := ""
    
    // CORRETO - USA API PADRÃO
    cNomeTab := RetSqlName("SA1")
    
    // CORRETO - USA FWSX3Util
    cTitulo := FWX3Titulo("A1_NOME")
    // OU
    cTitulo := GetSX3Cache("A1_NOME", "X3_TITULO")
Return
```

---

### Exemplo 3: API em Loop (CA1003)

#### ❌ Código Incorreto
```advpl
User Function ProcessaItens()
    Local nI := 0
    Local aItens := {}
    
    DbSelectArea("SC6")
    SC6->(DbGoTop())
    
    While !SC6->(EOF())
        // VIOLAÇÃO CA1003 - GetMV em loop
        If SC6->C6_VALOR > GetMV("MV_VLRMIN")
            aAdd(aItens, SC6->C6_PRODUTO)
        EndIf
        SC6->(DbSkip())
    EndDo
Return aItens
```

#### ✅ Código Correto
```advpl
User Function ProcessaItens()
    Local nI := 0
    Local aItens := {}
    Local nVlrMin := 0
    
    // CORRETO - GetMV fora do loop
    nVlrMin := GetMV("MV_VLRMIN")
    
    DbSelectArea("SC6")
    SC6->(DbGoTop())
    
    While !SC6->(EOF())
        If SC6->C6_VALOR > nVlrMin
            aAdd(aItens, SC6->C6_PRODUTO)
        EndIf
        SC6->(DbSkip())
    EndDo
Return aItens
```

---

### Exemplo 4: Driver ISAM (CA1000)

#### ❌ Código Incorreto
```advpl
User Function CriaTempISAM()
    Local aStruct := {}
    
    // VIOLAÇÃO CA1000 - Uso de ISAM
    aAdd(aStruct, {"CODIGO", "C", 6, 0})
    aAdd(aStruct, {"NOME",   "C", 40, 0})
    
    DbCreate("TEMP01", aStruct, "DBFCDXADS")
    DbUseArea(.T.,, "TEMP01", "TRB", .F., .F.)
Return
```

#### ✅ Código Correto
```advpl
#Include "FWMVCDef.ch"

User Function CriaTempRelacional()
    Local oTempTable := Nil
    Local aStruct := {}
    
    // CORRETO - USA FWTemporaryTable RELACIONAL
    aAdd(aStruct, {"CODIGO", "C", 6, 0})
    aAdd(aStruct, {"NOME",   "C", 40, 0})
    
    oTempTable := FWTemporaryTable():New("TRB")
    oTempTable:SetFields(aStruct)
    oTempTable:AddIndex("01", {"CODIGO"})
    oTempTable:Create()
    
    // Usa a tabela TRB normalmente
    DbSelectArea("TRB")
    
    // Ao final, destruir
    oTempTable:Delete()
Return
```

---

### Exemplo 5: Código Limpo - IIF (CA4000)

#### ❌ Código Incorreto
```advpl
User Function CalculaDesconto(nValor, cTipo, lAtivo)
    Local nDesconto := 0
    
    // VIOLAÇÃO CA4000 - IIF aninhado, difícil de ler
    nDesconto := iif(cTipo == "A", ;
                    iif(lAtivo, nValor * 0.1, nValor * 0.05), ;
                    iif(nValor > 1000, nValor * 0.15, nValor * 0.08))
Return nDesconto
```

#### ✅ Código Correto
```advpl
User Function CalculaDesconto(nValor, cTipo, lAtivo)
    Local nDesconto := 0
    
    // CORRETO - Estrutura if/else clara
    If cTipo == "A"
        If lAtivo
            nDesconto := nValor * 0.1  // 10% para tipo A ativo
        Else
            nDesconto := nValor * 0.05 // 5% para tipo A inativo
        EndIf
    Else
        If nValor > 1000
            nDesconto := nValor * 0.15 // 15% para valor alto
        Else
            nDesconto := nValor * 0.08 // 8% para valor normal
        EndIf
    EndIf
Return nDesconto
```

---

### Exemplo 6: Internacionalização (CA2016)

#### ❌ Código Incorreto
```advpl
User Function ValidaCampo(cValor)
    // VIOLAÇÃO CA2016 - Sem I18N
    If Empty(cValor)
        Help(,, "Atenção",, "Campo obrigatório não preenchido!", 1, 0)
        Return .F.
    EndIf
Return .T.
```

#### ✅ Código Correto
```advpl
User Function ValidaCampo(cValor)
    // CORRETO - Usa STR para I18N
    If Empty(cValor)
        Help(,, STR0001,, STR0002, 1, 0) // STR0001="Atenção" STR0002="Campo obrigatório não preenchido!"
        Return .F.
    EndIf
Return .T.
```

---

## FAQ - Perguntas Frequentes

### 1. Por que não posso mais usar ISAM?
**R:** O ISAM é uma tecnologia legada que apresenta sérios problemas de performance. A tabela comparativa mostra que operações relacionais são até 49x mais rápidas que ISAM. Além disso, o ISAM não escala bem em ambientes modernos com alta concorrência.

### 2. Posso suprimir uma regra se for muito trabalhoso corrigir?
**R:** A maioria das regras (45 de 49) não permite supressão. Isso porque são regras críticas que afetam segurança, performance ou compatibilidade futura. As exceções são apenas para casos muito específicos e documentados.

### 3. Quando o código com essas violações vai parar de funcionar?
**R:** Muitas regras já afetam a performance atual. Para regras de descontinuação de APIs (como StaticCall e PTInternal), a partir do release 33 os fontes customizados irão sinalizar erro de compilação.

### 4. Como sei qual API usar no lugar da descontinuada?
**R:** Este guia fornece a API substituta para cada regra. Além disso, consulte sempre o [TDN TOTVS](http://tdn.totvs.com) para documentação oficial e exemplos.

### 5. O que fazer se meu código tiver centenas de violações?
**R:** Priorize conforme a seção "Priorização de Correções":
1. Primeiro: Vulnerabilidades de segurança (SQL Injection)
2. Segundo: BUGs críticos de performance
3. Terceiro: Code Smells
4. Quarto: Refatorações de código limpo

### 6. Existe ferramenta para correção automática?
**R:** O SonarQube identifica os problemas, mas a correção deve ser manual na maioria dos casos, pois envolve entendimento do contexto do negócio. Algumas IDEs podem ajudar com refatorações simples.

### 7. As regras se aplicam a customizações de clientes?
**R:** Sim! Especialmente as regras de segurança e performance. Customizações devem seguir as mesmas boas práticas do código padrão.

### 8. Como faço para acessar metadados sem violar as regras?
**R:** Use sempre as APIs fornecidas:
- **SM0**: FWLoadSM0(), FWCodEmp(), FWCodFil()
- **SX1**: Pergunte()
- **SX2**: RetSqlName(), X2Nome()
- **SX3**: FWSX3Util(), GetSX3Cache(), FWX3Titulo()
- **SX6**: GetMV(), SuperGetMV()

---

## Roadmap de Migração

### Fase 1: Análise (Semana 1-2)
- [ ] Executar análise completa no SonarQube
- [ ] Gerar relatório de violações
- [ ] Classificar por prioridade (CRÍTICA, ALTA, MÉDIA, BAIXA)
- [ ] Estimar esforço de correção

### Fase 2: Correções Críticas (Semana 3-4)
- [ ] Corrigir todas as vulnerabilidades (CA2050)
- [ ] Corrigir BUGs de segurança (CA2022, CA2023)
- [ ] Validar com testes de segurança

### Fase 3: Correções de Performance (Semana 5-8)
- [ ] Corrigir acesso direto a metadados (CA20XX)
- [ ] Corrigir APIs em transação/loop (CA1002, CA1003)
- [ ] Substituir drivers ISAM (CA1000)
- [ ] Validar com testes de performance

### Fase 4: Code Smells (Semana 9-10)
- [ ] Corrigir APIs de console (CA1004)
- [ ] Implementar I18N (CA2016)
- [ ] Remover senhas expostas (CA2052)

### Fase 5: Refatoração (Semana 11-12)
- [ ] Limpar código com IIF (CA4000)
- [ ] Padronizar includes (CA3001)
- [ ] Corrigir heranças (CA3002)
- [ ] Revisão final de código

### Fase 6: Validação (Semana 13-14)
- [ ] Executar suite completa de testes
- [ ] Validar em ambiente de homologação
- [ ] Documentar mudanças
- [ ] Aprovar para produção

---

## Suporte e Recursos Adicionais

### 📖 Documentação Oficial
- [Portal TDN TOTVS](http://tdn.totvs.com)
- [Framework TOTVS](http://tdn.totvs.com/display/framework)
- [Documentação Protheus](http://tdn.totvs.com/display/PROT)

### 🔧 Ferramentas
- SonarQube Server TOTVS
- TDS - TOTVS Developer Studio
- Visual Studio Code com extensões TOTVS

### 👥 Comunidades
- [Fórum TDN](http://forum.totvs.com.br)
- Grupos internos de desenvolvimento
- Equipe de Engenharia de Produto

### 📧 Contatos
- Suporte Técnico TOTVS
- Engenharia de Produto
- Arquitetura de Software

---

## Conclusão

Este guia documenta todas as 49 regras do SonarQube para TOTVS Protheus. O cumprimento dessas regras é essencial para:

✅ **Segurança**: Proteger contra vulnerabilidades como SQL Injection
✅ **Performance**: Garantir alto desempenho das aplicações
✅ **Manutenibilidade**: Facilitar manutenção e evolução do código
✅ **Compatibilidade**: Preparar o código para futuras versões do produto
✅ **Qualidade**: Manter padrões de código limpo e profissional

### Estatísticas Finais

- **Total de Regras**: 49
- **Regras Críticas (Não Suprimíveis)**: 45 (92%)
- **Categorias**: 7
- **Tipos de Violação**: BUG (40), CODE SMELL (8), VULNERABILIDADE (1)

### Mensagem Final

A adoção dessas práticas não é apenas uma questão de conformidade com regras, mas um investimento na qualidade, segurança e longevidade do seu código. Quanto mais cedo você corrigir as violações, menor será o custo de manutenção no futuro.

**Boas práticas de desenvolvimento são a base para aplicações robustas, seguras e de alto desempenho!**

---

**Versão do Documento**: 1.0
**Data**: Outubro 2025
**Fonte**: https://sonar-rules.engpro.totvs.com.br/rules
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso indevido de chamada de interface dentro de uma transação.

#### APIs Detectadas
A regra detecta chamadas de interface como:
- Alert()
- MsgInfo()
- MsgYesNo()
- Aviso()
- E outras funções de interação com usuário

#### Como Corrigir
Alterar a lógica para que a transação não tenha nenhuma interrupção de interface.

---

### CA1003: Uso não permitido de chamada de API em LOOP

| Propriedade | Valor |
|------------|-------|
| **TypeName** | InvalidLoopFunction |
| **CheckId** | CA1003 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso indevido de chamada de API em loop que reconhecidamente provoca baixo desempenho.

#### APIs Detectadas em Loop
- GetMV()
- SuperGetMV()
- Posicione()
- E outras que devem ser evitadas em loops

#### Como Corrigir
Alterar a lógica para que a chamada seja feita fora do loop, armazenando o resultado em variável local.

---

### CA1003-2: Uso de chamada de API em LOOP a ser avaliado

| Propriedade | Valor |
|------------|-------|
| **TypeName** | AttentionLoopFunction |
| **CheckId** | CA1003-2 |
| **Categoria** | Performance |
| **Tipo** | CODE SMELL |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso de chamada de API em loop que deve ser avaliada, pois pode provocar baixo desempenho.

#### APIs Detectadas
- Type() em loop
- Outras funções que podem degradar performance

#### Recomendação Especial
Se Type() for usado para verificar propriedades XML, substituir completamente o tratamento para a classe [TXMLManager](https://tdn.totvs.com/display/tec/Classe+TXmlManager).

---

### CA2000: Uso não permitido do Metadados - SM0

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSM0 |
| **CheckId** | CA2000 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido da tabela de empresas (SM0).

#### Justificativa
Em futuras versões, o alias SM0 não será aberto em modo ISAM, sendo obrigatório o uso de Queries.

#### Como Corrigir
- Utilizar APIs padrão: FWLoadSM0(), FWCodEmp(), FWCodFil()
- Remover manipulação direta do alias
- Manipulações devem ser feitas apenas pelo Configurador ou atualização de versão

---

### CA2001: Uso não permitido do Metadados - SIX

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSIX |
| **CheckId** | CA2001 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido do metadados de Índices (SIX).

#### Justificativa
Em futuras versões, o alias SIX não estará disponível, sendo obrigatório uso de APIs padrão de forma indireta.

#### Como Corrigir
- Utilizar APIs padrão de leitura
- Remover manipulação direta
- Manipulações apenas por Configurador ou atualização

---

### CA2001-2: Leitura não permitida do Metadados - SIX

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAccessSIX |
| **CheckId** | CA2001-2 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido de leitura de metadados de Índices (SIX).

#### Como Corrigir
Utilizar APIs padrão de leitura do metadados.

---

### CA2002: Uso não permitido de atribuição do Metadados - SX1

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSX1 |
| **CheckId** | CA2002 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido de atribuição do metadados de Perguntas (SX1).

#### Justificativa
Em futuras versões, o alias SX1 não estará disponível, sendo obrigatório uso da função Pergunte().

#### Como Corrigir
- Utilizar função Pergunte()
- Remover manipulação direta
- Manipulações apenas por Configurador ou atualização

---

### CA2002-2: Formato de leitura não permitida do Metadados - SX1

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAccessSX1 |
| **CheckId** | CA2002-2 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido de leitura do metadados de Perguntas (SX1).

#### Como Corrigir
Utilizar função Pergunte() para leitura.

---

### CA2003: Uso não permitido do Metadados - SX2

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSX2 |
| **CheckId** | CA2003 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido do metadados de Tabelas (SX2).

#### Justificativa
Em futuras versões, o alias SX2 não estará disponível.

#### Como Corrigir
Utilizar APIs padrão: RetSqlName(), X2Nome().

---

### CA2003-2: Uso não permitido de leitura do Metadados - SX2

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAccessSX2 |
| **CheckId** | CA2003-2 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido de leitura de metadados de Tabelas (SX2).

#### Como Corrigir
Utilizar RetSqlName() para leitura.

---

### CA2004: Uso não permitido do Metadados - SX3

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAssigmentSX3 |
| **CheckId** | CA2004 |
| **Categoria** | Performance |
| **Tipo** | BUG |
| **Aplicabilidade** | All |
| **Supressão** | ❌ Não permitida |

#### Descrição
Uso não permitido do metadados de Descrição das propriedades de tabelas (SX3).

#### Atenção Especial
⚠️ O SX3 teve sua estrutura alterada e a gravação indevida pode causar prejuízos ao sistema.

#### Justificativa
Em futuras versões, o alias SX3 será aberto/fechado conforme demanda para evitar perda de desempenho.

#### Como Corrigir
- Utilizar APIs padrão de leitura
- Consultar [FWSX3Util](http://tdn.totvs.com/display/PROT/FWSX3Util) para acesso aos dados de campos
- Manipulações apenas por Configurador ou atualização

---

### CA2004-2: Formato de leitura não permitido do Metadados - SX3

| Propriedade | Valor |
|------------|-------|
| **TypeName** | DictionaryAccessSX3 |
| **CheckId** | CA2004-2 |
| **Categoria** | Performance |