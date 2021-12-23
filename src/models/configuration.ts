import { version } from './../../package.json';
export class Configuration {
  // query configurations
  queryEmbedded: boolean = true;
  deleteFrom: boolean = true;
  selectAll: boolean = true;
  noSchema: boolean = true;
  tableFixed: boolean = true;

  // functions end variables
  messageBox: boolean = true;
  mvFolMes: boolean = true;
  crlf: boolean = true;
  conout: boolean = true;
  putSX1: boolean = true;

  conflictMerge: boolean = true;

  dictionaryUse: boolean = true;
  Isam: boolean = true;
  bestAnalitc: boolean = true;

  // comentary configurations
  dafaultSouceComment: boolean = true;
  functionNoCommented: boolean = true;
  flassNoCommented: boolean = true;
  webServiceNoCommented: boolean = true;
  structNoCommented: boolean = true;
  commentNoFunction: boolean = true;

  // includes
  lackTOTVS: boolean = true;
  includeObsoleto: boolean = true;
  includeDuplicity: boolean = true;
  includeLack: boolean = true;
  includeNotNecessary: boolean = true;

  foundFile: boolean = true;
  functionDuplicate: boolean = true;
  fileDuplicate: boolean = true;

  commentaryDefault: RegExp[] = [];
  dataBases: string[] = [];
  companies: string[] = [];
  version: string = version;

  get includeAnalisys(): boolean {
    return (
      this.lackTOTVS ||
      this.includeObsoleto ||
      this.includeDuplicity ||
      this.includeLack ||
      this.includeNotNecessary
    );
  }
}
