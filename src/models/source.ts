import { Configuration } from '.';
import { Function } from './function';
import { ErrorAdvpl, Severity } from './error-advpl';
import {
  FunctionDefinitionList,
  FunctionDefinition,
} from './function-definition';
import { Include } from './include';
import { IncludeDefinition } from './include-definitions';
import { Variable } from './variable';

const ESCOPES = [
  /^LOCAL\s+[A-Z0-9]+/gim,
  /^STATIC\s+[A-Z0-9]+/gim,
  /^PRIVATE\s+[A-Z0-9]+/gim,
  /^PUBLIC\s+[A-Z0-9]+/gim,
  /^PROTECTED\s+[A-Z0-9]+/gim,
];
export class Source {
  public source: string;
  public functions: Function[];
  public content: string;
  public clearContent: string = '';
  public lines: string[]; // linhas originais
  public clearLines: string[] = []; // linhas sem strings, comentários e espaços no começo e fim
  public includes: Include[];
  public errors: ErrorAdvpl[];
  public requiredIncludes: { include: string; line: number }[] = [];

  constructor(
    content: string,
    source?: string
  ) {
    this.content = content;
    this.lines = content.split(/\r\n/gim);
    this.source = source as string;
    this.functions = [];
    this.includes = [];
    this.errors = [];
  }

  public analise(includeDefinitions: IncludeDefinition,
    configuration: Configuration): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.setClearLines();
      this.searchFunctions();

      if (configuration.includeAnalisys) {
        // verifica se tem includes se achar pelo menos 1
        if (this.content.match(/^\s*#include\s/gim)) {
          this.searchIncludes(includeDefinitions);
          // include que precisa mas não estão declarados
          for (var key in this.requiredIncludes) {
            const include = this.requiredIncludes[key];
            this.errors.push(
              new ErrorAdvpl(
                include.line,
                include.line,
                'includes.desnecessarioContido ' + include.include,
                Severity.Warning
              )
            );
          }

          // Existem includes sem usar
          const semNecessidade = this.includes.filter((x) => {
            return !x.required;
          });
          for (var key in semNecessidade) {
            const include = semNecessidade[key];
            this.errors.push(
              new ErrorAdvpl(
                include.line,
                include.line,
                'includes.desnecessarioContido ' + include.name,
                Severity.Warning
              )
            );
          }
        }
      }
      resolve();
    });
  }

  private setClearLines() {
    // remove strings entre aspas duplas e simples
    let clearContent = this.content.replace(/(\").+(\")/gim, '');
    clearContent = clearContent.replace(/(\').+(\')/gim, '');

    // remove todos os comentários /* */ na mesma linha
    clearContent = clearContent.replace(/(\/\*)(.*)(\*\/)/gim, '');

    //Pega as linhas do documento ativo e separa o array por linha
    this.clearLines = clearContent.split(/\r\n/gim);

    //Percorre todas as linhas para remover os comentários multiline
    let inComentary: boolean = false;
    for (let i = 0; i < this.clearLines.length; i++) {
      const line = this.clearLines[i];
      if (line.match(/(\*\/)/i) && inComentary) {
        inComentary = false;
        this.clearLines[i] = line.split('*/')[1];
      } else if (line.match(/\/\*/)) {
        inComentary = true;
        this.clearLines[i] = line.split(/\/\*/)[0];
      } else {
        this.clearLines[i] = inComentary ? '' : line;
      }
      // remove todos os comentários // até o fim da linha e tira os espaços
      this.clearLines[i] = this.clearLines[i]
        .replace(/(\/\/)(.*)()$/gim, '')
        .trim();
    }

    this.clearContent = this.clearLines.join('\r\n');
  }

  private searchFunctions() {
    const definitions: FunctionDefinitionList = new FunctionDefinitionList();
    for (let i = 0; i < this.clearLines.length; i++) {
      const line = this.clearLines[i];
      // verifica sea primeira linha está nas monitoradas
      const definitionFunction: FunctionDefinition = definitions.list.find(
        (x) => {
          return line.match(x.expression);
        }
      ) as FunctionDefinition;
      if (definitionFunction) {
        this.functions.push(
          new Function(line, i, definitionFunction)
        );
      } else if (this.functions.length) {
        // Adiciona a variável na Última Função do Array
        const variable = ESCOPES.find((x) => {
          return line.match(x);
        });

        if (variable) {
          let variableData: RegExpMatchArray | null = line.match(variable);
          if (variableData) {
            const variableString = variableData[0].toString();
            const variableDataSplited = variableString.split(/\s+/);
            this.functions[this.functions.length - 1].variables.push(
              new Variable(variableDataSplited[1], i, variableDataSplited[0])
            );
          }
        }
      }
    }
  }

  private searchIncludes(includeDefinitions: IncludeDefinition) {
    for (const [i, line] of this.lines.entries()) {
      if (line.match(/^\s*#include\s(\"|\')(.*)(\"|\').*/gim)) {
        this.includes.push(
          new Include(
            line.replace(
              /^\s*#include\s(\"|\')(.*)(\"|\').*/gim,
              '$2'
            ),
            i
          )
        );
      }
    }

    // Verifica se o include é obsoleto ou necessário
    for (const include of this.includes) {
      include.obsolet =
        includeDefinitions.includesObsoletos.find(
          (x) => x === include.name
        ) !== undefined;

      const defInclude = includeDefinitions.includeExpressoes.find(
        (x) => x.include === include.name
      );

      // se não encontrar o include nas definições indica que é necessário se não for obsoleto
      if (defInclude) {
        if (!include.obsolet) {
          for (const expression of defInclude.expressoes) {
            if (this.clearContent.match(expression)) {
              include.required = true;
              break;
            }
          }
        }
      } else {
        // se não tem definição subentende que precisa dele
        include.required = true;
      }
    }

    // verifica os includes que não estão no fonte se usa alguma das expressões
    const includeNotUsed = includeDefinitions.includeExpressoes.filter((x) => {
      return (
        this.includes.find((y) => {
          return x.include === y.name;
        }) === undefined
      );
    });
    for (const definition of includeNotUsed) {
      this.findExpression(definition);
    }
  }

  private findExpression(definition: { include: string; expressoes: RegExp[] }) {
    for (const expression of definition.expressoes) {
      for (const [i, line] of this.clearLines.entries()) {
        if (line.match(expression)) {
          const requiredInclude = {
            include: definition.include,
            line: i,
          };
          if (!this.requiredIncludes.find(ri => ri.include === requiredInclude.include)) {
            this.requiredIncludes.push(requiredInclude);
          }
          return;
        }
      }
    }
  }
}
