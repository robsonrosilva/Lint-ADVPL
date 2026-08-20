import type { DiagnosticSeverity } from 'vscode-languageserver-types'
import type { RuleContext } from './context'
import { resolveSeverity, UnmappedSeverityError, type CatalogSeverity } from '../severity/map'

export type RuleOrigin = 'totvs' | 'project'

/** Grupos do catálogo oficial: Segurança, Desempenho, Legado, Metadados, Compilação. */
export type RuleGroup = 'G1' | 'G2' | 'G3' | 'G4' | 'G5'

/**
 * Faixa reservada para regras de origem `project` — as que o catálogo da TOTVS
 * não cobre.
 *
 * `PJ` foi escolhido porque os prefixos em uso no catálogo oficial são `CA`,
 * `BG` e `CS` (D2 da spec 001). Risco aceito e registrado: a TOTVS pode vir a
 * usar `PJ`; detectar a colisão é responsabilidade da atualização de
 * `referencias/totvs/`.
 */
const PROJECT_ID_PATTERN = /^PJ\d{4}$/

export interface RuleDefinition {
  readonly id: string
  readonly origin: RuleOrigin
  /** Obrigatório quando origem é `totvs`; `null` quando é `project`. */
  readonly group: RuleGroup | null
  /** Obrigatório quando origem é `totvs`; `null` quando é `project`. */
  readonly catalogSeverity: CatalogSeverity | null
  /** Chave própria em `contributes.configuration`. Princípio IV. */
  readonly configKey: string
  /** Chave de tradução. Precisa existir nos quatro idiomas (portão check:nls). */
  readonly messageKey: string
  /**
   * O que esta regra pega que o padrão não pega. Obrigatório e não vazio em
   * regra `project`; sem essa frase ela é duplicata não declarada (Princípio
   * III). `null` em regra de catálogo.
   */
  readonly projectRationale: string | null
  /**
   * Severidade exibida, para regra `project` — que não tem catálogo de onde
   * mapear. Em regra `totvs` NÃO é declarada: sai da tabela versionada.
   */
  readonly defaultSeverity?: DiagnosticSeverity
  /**
   * A regra nasce ligada? Omitir significa SIM — é o caso da esmagadora
   * maioria, e obrigar todas a declarar transformaria a exceção em cerimônia.
   *
   * Existe por causa do Princípio VI: regra sem taxa de falso positivo medida
   * sobre o corpus entra DESLIGADA. `PJ0001` é a primeira nessa situação, e o
   * lugar de dizer isso é aqui — o registro é a fonte única de onde saem as
   * chaves do manifesto e a resposta de "esta regra está ligada?". Declarar o
   * padrão em dois lugares é como as duas listas divergem.
   */
  readonly enabledByDefault?: boolean
  /**
   * Sobreposição da tabela, para regra `totvs`, com a razão OBRIGATÓRIA.
   *
   * Existe porque a tabela mapeia severidade de CATÁLOGO, e há um segundo eixo
   * que ela não enxerga: o VOLUME. Duas regras `MINOR` podem disparar uma vez
   * por projeto e setenta vezes por arquivo, e a segunda inunda o painel — o
   * que o Princípio III proíbe — sem que a primeira mereça ser rebaixada junto.
   *
   * A razão é obrigatória e não vazia porque sobreposição sem justificativa é
   * exatamente a "cópia literal disfarçada" que o Princípio III veda. Quem
   * sobrepõe precisa dizer, por escrito e com número, por quê.
   */
  readonly severityOverride?: {
    readonly severity: DiagnosticSeverity
    readonly reason: string
  }
  run(context: RuleContext): void
}

/** Uma regra já validada, com a severidade e o estado padrão resolvidos. */
export interface RegisteredRule extends RuleDefinition {
  readonly defaultSeverity: DiagnosticSeverity
  readonly enabledByDefault: boolean
}

export class RuleDefinitionError extends Error {
  constructor(ruleId: string, problem: string) {
    super(`Regra "${ruleId}" rejeitada no registro: ${problem}`)
    this.name = 'RuleDefinitionError'
  }
}

/**
 * O registro é a FONTE ÚNICA de identidade de regra. Dele saem as chaves de
 * `contributes.configuration`, a exigência de documentação e a validação de que
 * nenhum diagnóstico sai sem identificador.
 *
 * O que ele NÃO faz: tocar no sistema de arquivos. As invariantes "a chave
 * existe nos quatro idiomas" e "a documentação existe" pertencem aos portões
 * `check:nls` e `check:docs`, que rodam em `tooling`. O registro roda dentro do
 * motor, e o Princípio I proíbe I/O aqui.
 */
export class RuleRegistry {
  private readonly byId = new Map<string, RegisteredRule>()
  private readonly configKeys = new Set<string>()

  register(definition: RuleDefinition): void {
    const { id, origin, group, catalogSeverity, configKey, messageKey, projectRationale } = definition

    if (!id) throw new RuleDefinitionError('(sem id)', 'identificador vazio')
    if (this.byId.has(id)) throw new RuleDefinitionError(id, 'identificador já registrado')

    // Princípio IV: regra sem chave própria MUST ser rejeitada.
    if (!configKey.trim()) throw new RuleDefinitionError(id, 'chave de configuração vazia')
    if (this.configKeys.has(configKey)) {
      throw new RuleDefinitionError(id, `chave de configuração "${configKey}" já usada por outra regra`)
    }
    if (!messageKey.trim()) throw new RuleDefinitionError(id, 'chave de mensagem vazia')

    let defaultSeverity: DiagnosticSeverity

    if (origin === 'totvs') {
      if (group === null) throw new RuleDefinitionError(id, 'regra de catálogo precisa declarar o grupo G1-G5')
      if (catalogSeverity === null) {
        throw new RuleDefinitionError(id, 'regra de catálogo precisa declarar a severidade do catálogo')
      }
      if (projectRationale !== null) {
        throw new RuleDefinitionError(id, 'regra de catálogo não leva justificativa de regra própria')
      }
      const override = definition.severityOverride
      if (override !== undefined) {
        if (!override.reason.trim()) {
          throw new RuleDefinitionError(id, 'sobrepor a tabela de severidade exige razão registrada')
        }
        defaultSeverity = override.severity
      } else {
        try {
          // A severidade exibida NUNCA é cópia da severidade do catálogo — ela
          // sai da tabela versionada. Severidade não mapeada reprova AQUI.
          defaultSeverity = resolveSeverity(catalogSeverity)
        } catch (error) {
          if (error instanceof UnmappedSeverityError) throw new RuleDefinitionError(id, error.message)
          throw error
        }
      }
    } else {
      if (!PROJECT_ID_PATTERN.test(id)) {
        throw new RuleDefinitionError(id, 'regra própria precisa de identificador na faixa reservada PJ####')
      }
      if (group !== null) throw new RuleDefinitionError(id, 'regra própria não pertence a grupo do catálogo')
      if (catalogSeverity !== null) throw new RuleDefinitionError(id, 'regra própria não tem severidade de catálogo')
      if (projectRationale === null || !projectRationale.trim()) {
        throw new RuleDefinitionError(
          id,
          'regra própria precisa documentar o que pega que o padrão não pega (Princípio III)',
        )
      }
      if (definition.severityOverride !== undefined) {
        throw new RuleDefinitionError(id, 'regra própria não sobrepõe tabela — ela declara a severidade direto')
      }
      if (definition.defaultSeverity === undefined) {
        throw new RuleDefinitionError(id, 'regra própria precisa declarar a severidade exibida')
      }
      defaultSeverity = definition.defaultSeverity
    }

    this.byId.set(id, { ...definition, defaultSeverity, enabledByDefault: definition.enabledByDefault ?? true })
    this.configKeys.add(configKey)
  }

  get(id: string): RegisteredRule | undefined {
    return this.byId.get(id)
  }

  all(): readonly RegisteredRule[] {
    return [...this.byId.values()]
  }
}
