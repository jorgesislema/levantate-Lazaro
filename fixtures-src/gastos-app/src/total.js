'use strict';

// Dependency-free expense math. Amounts are integer cents.
function sumCents(expenses) {
  let total = 0;
  for (const e of expenses) total += e.cents;
  return total;
}

module.exports = { sumCents };
