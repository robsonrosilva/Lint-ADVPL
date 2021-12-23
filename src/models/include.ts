export class Include {
  name: string;
  line: number;
  required: boolean = false;
  obsolet: boolean = false;

  constructor(name: string, line: number) {
    this.name = name.toUpperCase();
    this.line = line;
  }
}
