// FIXTURE AUTORAL - advpl-lint - NAO e copia de fonte padrao do Protheus.
// Proposito: CA3001 NAO dispara dentro de comentario nem de literal de texto
// Nao usar #INCLUDE em caixa alta neste projeto.
/*
   Bloco explicativo citando #INCLUDE "TOTVS.CH" de proposito.
*/
#INCLUDE "TOTVS.CH"

User Function FixQuoted()
   Local cTexto := "#INCLUDE dentro de aspas duplas"
   Local cOutro := '#INCLUDE dentro de aspas simples'
Return { cTexto, cOutro }
