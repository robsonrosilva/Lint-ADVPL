// FIXTURE AUTORAL - advpl-lint - NAO e copia de fonte padrao do Protheus.
// Proposito: PJ0001 - referencia de include divergindo do nome real no disco.
// O disco de teste guarda ACADEF.CH em caixa alta e totvs.ch em caixa baixa.
#include "acadef.ch"
#include "totvs.ch"
#INCLUDE "TOTVS.CH"

User Function PjBasico()
    Local cTexto := "acadef.ch"  // literal: nao e referencia de include
    // #include "acadef.ch"      <- comentario: nao e referencia de include
    Return cTexto
