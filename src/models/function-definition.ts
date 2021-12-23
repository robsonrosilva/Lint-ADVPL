/*
  Definição de expressões de identificação de funções, classes, webservices, métodos e estruturas.
  ****ATENÇÃO**** sempre o segundo agrupamento deve retornar o nome do item.
*/

export class FunctionDefinitionList {
  list: FunctionDefinition[] = [];
  constructor() {
    this.list.push(
      new FunctionDefinition('user', /(^\s*user\s+function\s+)([A-Z0-9]+).*/gim)
    );

    this.list.push(
      new FunctionDefinition(
        'static',
        /(^\s*static\s+function\s+)([A-Z0-9]+).*/gim
      )
    );

    this.list.push(
      new FunctionDefinition('function', /(^\s*function\s+)([A-Z0-9]+).*/gim)
    );

    this.list.push(
      new FunctionDefinition('class', /(^\s*class\s+)([A-Z0-9]+).*/gim)
    );

    this.list.push(
      new FunctionDefinition(
        'method',
        /(^\s*method\s+)([A-Z0-9]+).*(\sclass\s)/gim,
        /(^\s*method\s+[A-Z0-9]+.*\sclass\s)([A-Z0-9]+)/gim
      )
    );

    this.list.push(
      new FunctionDefinition(
        'wsmethod',
        /(^\s*wsmethod\s+)([A-Z0-9]+).*(\swsservice\s)([A-Z0-9]+)/gim,
        /(^\s*wsmethod\s+[A-Z0-9]+.*\swsservice\s)([A-Z0-9]+)/gim
      )
    );

    this.list.push(
      new FunctionDefinition('wsservice', /(^\s*wsservice\s+)([A-Z0-9]+).*/gim)
    );

    this.list.push(
      new FunctionDefinition('wsrestful', /(^\s*wsrestful\s+)([A-Z0-9]+).*/gim)
    );

    this.list.push(
      new FunctionDefinition('wsstruct', /(^\s*wsstruct\s+)([A-Z0-9]+).*/gim)
    );
  }
}

export class FunctionDefinition {
  type: string;
  expression: RegExp;
  mainExpression: RegExp;
  constructor(type: string, expression: RegExp, mainExpression?: RegExp) {
    this.type = type;
    this.expression = expression;
    this.mainExpression = mainExpression as RegExp;
    return this;
  }
}
