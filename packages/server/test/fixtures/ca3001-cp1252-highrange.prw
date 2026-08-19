// FIXTURE AUTORAL - advpl-lint - NAO e copia de fonte padrao do Protheus.
// Proposito: bytes CP1252 0x80-0x9F nao deslocam a posicao do diagnostico
// Saída com travessão — e aspas “tipográficas” e € 100
// Segunda linha com cedilha ç, til õ e acento ó
#INCLUDE "TOTVS.CH"

User Function FixHighRange()
   Local cMsg := "Operação concluída"
Return cMsg
