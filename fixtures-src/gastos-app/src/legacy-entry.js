'use strict';

// Legacy startup path written for Node 12.
const util = require('util');
const fs = require('fs');
const { sumCents } = require('./total');

// FIXME: timestamps are stored in seconds but the UI treats them as milliseconds.

function main(file) {
  const expenses = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!util.isString(file)) {
    throw new Error('expenses file path is required');
  }
  console.log('total_cents=' + sumCents(expenses));
}

main(process.argv[2]);
