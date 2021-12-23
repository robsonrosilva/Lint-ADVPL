import { Configuration } from '../models/configuration';
import { Source } from '../models/source';
import { IncludeDefinition } from '../models/include-definitions';

export class Linter {
  configuration: Configuration = new Configuration();
  sourceList: Source[] = [];
  includeDefinitions: IncludeDefinition = new IncludeDefinition();
  listFiles: { name: string; content: string }[] = [];

  constructor(listFiles: { name: string; content: string }[]) {
    this.listFiles = listFiles;
  }

  runAnalisys(): Promise<any> {
    const listPromisses: Promise<any>[] = [];
    const that = this;

    // cria os promisses de análise
    for (var x = 0; x < this.listFiles.length; x++) {
      let file = this.listFiles[x];
      listPromisses.push(
        new Promise((resolve: Function, reject: Function) => {
          console.log('Arquivo: ' + file.name);
          that.sourceList.push(
            new Source(
              file.content,
              that.includeDefinitions,
              that.configuration,
              file.name
            )
          );
          resolve();
        })
      );
    }

    return Promise.all(listPromisses);
  }
}
