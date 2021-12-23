import { FunctionDefinition } from './function-definition';
import { Variable } from './variable';

export class Function {
  public type: string;
  public name: string;
  public main: string = '';
  public line: number;
  public variables: Variable[] = [];

  constructor(
    lineContent: string,
    line: number,
    definition: FunctionDefinition
  ) {
    this.type = definition.type;
    //extrai o nome da função
    this.name = lineContent.replace(definition.expression, '$2');
    if (definition.mainExpression) {
      this.main = lineContent.replace(definition.mainExpression, '$2');
    }
    this.line = line;
  }
}
