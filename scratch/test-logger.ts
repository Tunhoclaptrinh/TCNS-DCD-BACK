import { logger } from '../src/utils/logger';

// Mock env for testing
process.env.LOG_LEVEL = 'debug';

console.log('--- TEST START ---');
logger.info('Testing object logging', 'TEST', { a: 1, b: { c: 2 } });
logger.debug('Testing payload logging', 'TEST', {
  users: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ],
});
console.log('--- TEST END ---');
