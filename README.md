# advpl-lint

Extension for Lint advpl laguage.

## Installation

```bash
npm install advpl-lint
```

## Usage

```typescript
import { Linter } from 'advpl-lint';
import * as fs from 'fs';

// Read the file content
const content = fs.readFileSync('path/to/your/file.prw', 'latin1');

// Create a new Linter instance
const linter = new Linter([
  {
    name: 'file.prw',
    content: content,
  },
]);

// Run the analysis
linter.runAnalisys().then(() => {
  console.log(linter.sourceList[0].errors);
});
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[ISC](https://opensource.org/licenses/ISC)
