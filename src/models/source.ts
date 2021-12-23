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
    includeDefinitions: IncludeDefinition,
    configuration: Configuration,
    source?: string
  ) {
    this.content = content;
    this.lines = content.split(/\r\n/gim);
    this.source = source as string;
    this.functions = [];
    this.includes = [];
    this.errors = [];

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
    for (var key in this.clearLines) {
      if (this.clearLines[key].match(/(\*\/)/i) && inComentary) {
        inComentary = false;
        this.clearLines[key] = this.clearLines[key].split('*/')[1];
      } else if (this.clearLines[key].match(/\/\*/)) {
        inComentary = true;
        this.clearLines[key] = this.clearLines[key].split(/\/\*/)[0];
      } else {
        this.clearLines[key] = inComentary ? '' : this.clearLines[key];
      }
      // remove todos os comentários // até o fim da linha e tira os espaços
      this.clearLines[key] = this.clearLines[key]
        .replace(/(\/\/)(.*)()$/gim, '')
        .trim();
    }

    this.clearContent = this.clearLines.join('\r\n');
  }

  private searchFunctions() {
    const definitions: FunctionDefinitionList = new FunctionDefinitionList();
    for (var key in this.clearLines) {
      // verifica sea primeira linha está nas monitoradas
      const definitionFunction: FunctionDefinition = definitions.list.find(
        (x) => {
          return this.clearLines[key].match(x.expression);
        }
      ) as FunctionDefinition;
      if (definitionFunction) {
        this.functions.push(
          new Function(this.clearLines[key], parseInt(key), definitionFunction)
        );
      } else if (this.functions.length) {
        // Adiciona a variável na Última Função do Array
        const variable = ESCOPES.find((x) => {
          return this.clearLines[key].match(x);
        });

        if (variable) {
          let variableData = this.clearLines[key].match(variable);
          if (variableData) {
            variableData = variableData.toString().split(/\s+/);
            this.functions[this.functions.length - 1].variables.push(
              new Variable(variableData[1], parseInt(key), variableData[0])
            );
          }
        }
      }
    }
  }

  private searchIncludes(includeDefinitions: IncludeDefinition) {
    for (var key in this.lines) {
      if (this.lines[key].match(/^\s*#include\s(\"|\')(.*)(\"|\').*/gim)) {
        this.includes.push(
          new Include(
            this.lines[key].replace(
              /^\s*#include\s(\"|\')(.*)(\"|\').*/gim,
              '$2'
            ),
            parseInt(key)
          )
        );
      }
    }

    // Verifica se o include é obsoleto ou necessário
    for (var key in this.includes) {
      this.includes[key].obsolet =
        includeDefinitions.includesObsoletos.find(
          (x) => x === this.includes[key].name
        ) !== undefined;

      const defInclude = includeDefinitions.includeExpressoes.find(
        (x) => x.include === this.includes[key].name
      );

      // se não encontrar o include nas definições indica que é necessário se não for obsoleto
      if (defInclude) {
        if (!this.includes[key].obsolet) {
          for (var keyExp in defInclude.expressoes) {
            if (this.clearContent.match(defInclude.expressoes[keyExp])) {
              this.includes[key].required = true;
              break;
            }
          }
        }
      } else {
        // se não tem definição subentende que precisa dele
        this.includes[key].required = true;
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
    for (var key in includeNotUsed) {
      const definition = includeNotUsed[key];
      for (var keyExp in definition.expressoes) {
        const expression = definition.expressoes[keyExp];
        if (this.clearContent.match(expression)) {
          for (var keyLine in this.clearLines) {
            if (this.clearLines[keyLine].match(expression)) {
              this.requiredIncludes.push({
                include: definition.include,
                line: parseInt(keyLine),
              });
            }
          }
        }
      }
    }
  }
}
