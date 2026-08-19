import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { createControllableToken, neverCancelled } from '../../src/harness/tokens'

describe('Token que nunca cancela', () => {
  it('nunca relata cancelamento', () => {
    assert.equal(neverCancelled.isCancellationRequested, false)
  })

  it('entrega um descarte que pode ser chamado sem efeito', () => {
    // O motor tem direito de registrar um ouvinte e soltá-lo depois. Um token
    // que devolvesse `undefined` aqui quebraria no dia em que ele fizer isso.
    const subscription = neverCancelled.onCancellationRequested(() => {})

    assert.equal(typeof subscription.dispose, 'function')
    assert.doesNotThrow(() => subscription.dispose())
  })
})

describe('Token acionável', () => {
  it('começa sem cancelamento', () => {
    assert.equal(createControllableToken().isCancellationRequested, false)
  })

  it('passa a relatar cancelamento depois de acionado', () => {
    const token = createControllableToken()

    token.cancel()

    assert.equal(token.isCancellationRequested, true)
  })

  it('também entrega um descarte utilizável', () => {
    const subscription = createControllableToken().onCancellationRequested()

    assert.doesNotThrow(() => subscription.dispose())
  })
})
