export class Variable {
  name: string;
  type: string;
  line: number;

  constructor(name: string, line: number, type: string) {
    this.name = name.toUpperCase();
    this.line = line;
    this.type = type;
  }
}
