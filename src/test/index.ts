const fs = require('fs');
import { globby } from 'globby';
import { Linter } from './../index.js';
var advplExtensions = ['prw', 'prx', 'prg', 'apw', 'apl', 'tlpp'];

// Validação de um Arquivo
/* */
function Run1() {
  let antes = Date.now();

  const conteudo = fs.readFileSync(
    'D:\\OneDrive - POUPEX\\POUPEX_ADVPL\\SIGACFG\\CLEAR_AUDIT.PRW',
    'latin1'
  );

  const linter = new Linter([{ name: 'CLEAR_AUDIT.PRW', content: conteudo }]);
  linter.runAnalisys().then((x) => {
    var duracao = Date.now() - antes;
    console.log('fim em ' + duracao / 1000 + ' segundos');
    console.log(linter.sourceList[0]);
    const y = 1;
  });
}
/**/

// Validação de Projeto
function Run2() {
  let antes = Date.now();
  const pathsProject = ['D:\\OneDrive - POUPEX\\POUPEX_ADVPL'];

  // monta expressão para buscar arquivos
  let globexp: any[] = [];
  for (var i = 0; i < advplExtensions.length; i++) {
    globexp.push(`**/*.${advplExtensions[i]}`);
  }

  let promissesGlobby = [];
  for (var i = 0; i < pathsProject.length; i++) {
    let pathProject: string = pathsProject[i];

    promissesGlobby.push(
      globby(globexp, {
        cwd: pathProject,
        caseSensitiveMatch: false,
      })
    );
  }

  Promise.all(promissesGlobby).then((folder: any[]) => {
    for (var x = 0; x < folder.length; x++) {
      let files = folder[x];
      const linterFiles = [];
      let linter: Linter;
      for (var j = 0; j < files.length; j++) {
        let fileName: string = files[j];
        let conteudo = fs.readFileSync(
          pathsProject + '\\' + fileName,
          'latin1'
        );
        linterFiles.push({ name: fileName, content: conteudo });
      }
      linter = new Linter(linterFiles);
      linter.runAnalisys().then((x) => {
        var duracao = Date.now() - antes;
        console.log('fim em ' + duracao / 1000 + ' segundos');
      });
    }
  });
}

Run1();
Run2();

/**/
