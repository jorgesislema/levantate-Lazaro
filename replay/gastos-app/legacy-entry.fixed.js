'use strict';

// Supported startup path: no removed util helpers, still valid on Node 12.
const fs = require('fs');
const { sumCents } = require('./total');

// FIXME: timestamps are stored in seconds but the UI treats them as milliseconds.

function main(file) {
  if (typeof file !== 'string') {
    throw new Error('expenses file path is required');
  }
  const expenses = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log('total_cents=' + sumCents(expenses));
}

main(process.argv[2]);
