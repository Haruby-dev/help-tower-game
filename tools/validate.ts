import { checkProject } from './checks';

const problems = checkProject();

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

console.log('All data files and text keys are valid.');
