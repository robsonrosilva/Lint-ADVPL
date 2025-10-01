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

  runAnalisys(): Promise<Source[]> {
    const promises = this.listFiles.map(file => {
      return new Promise<Source>((resolve, reject) => {
        console.log('Arquivo: ' + file.name);
        const source = new Source(
          file.content,
          file.name
        );
        source.analise(this.includeDefinitions, this.configuration).then(()=>{
            this.sourceList.push(source);
            resolve(source);
        });
      });
    });

    return Promise.all(promises);
  }
}
