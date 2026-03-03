/**
 * Compute running totals with operator precedence:
 * x and / bind tighter than + and -.
 *
 * The op on each entry means "what comes after this value."
 * Entries connected by x or / form a multiplicative group.
 * Groups are separated by + or -, which determine how the
 * group result applies to the additive total.
 *
 * Each entry's running total = "total if the tape ended here."
 */
export function computeRunningTotals(tape, mode = 'arithmetic', opPosition = 'postfix') {
  if (opPosition === 'prefix') {
    return mode === 'adding'
      ? computeRunningTotalsPrefixAdding(tape)
      : computeRunningTotalsPrefixArithmetic(tape);
  }
  if (mode === 'adding') {
    return computeRunningTotalsAdding(tape);
  }
  const totals = [];
  const subProducts = [];
  let total = 0;
  let addOp = '+';
  let groupProduct = 0;
  let groupLen = 0;
  let prevEntry = null;

  for (let i = 0; i < tape.length; i++) {
    const entry = tape[i];

    if (entry.op === 'text' || entry.value == null) {
      totals.push(totals.length > 0 ? totals[totals.length - 1] : 0);
      subProducts.push(null);
      continue;
    }

    if (entry.op === '=') {
      let displayTotal = total;
      if (groupLen > 0) {
        displayTotal = applyAdd(addOp, total, groupProduct);
      }
      totals.push(displayTotal);
      subProducts.push(null);
      continue;
    }

    if (entry.op === 'T') {
      if (groupLen > 0) {
        total = applyAdd(addOp, total, groupProduct);
        groupLen = 0;
      }
      totals.push(total);
      subProducts.push(null);
      total = 0;
      addOp = '+';
      prevEntry = entry;
      continue;
    }

    const val = entry.value ?? 0;
    if (groupLen === 0) {
      groupProduct = val;
      groupLen = 1;
    } else {
      const prevOp = prevEntry.op;
      if (prevOp === '*') {
        groupProduct *= val;
      } else if (prevOp === '/') {
        groupProduct = val !== 0 ? groupProduct / val : groupProduct;
      }
      groupLen++;
    }

    const currentTotal = applyAdd(addOp, total, groupProduct);
    totals.push(currentTotal);

    const isMultOp = entry.op === '*' || entry.op === '/';
    const prevIsMultOp = prevEntry !== null && (prevEntry.op === '*' || prevEntry.op === '/');
    if (isMultOp || prevIsMultOp) {
      subProducts.push(groupProduct);
    } else {
      subProducts.push(null);
    }

    if (entry.op === '+' || entry.op === '-') {
      total = currentTotal;
      addOp = entry.op;
      groupLen = 0;
    }

    prevEntry = entry;
  }

  return { totals, subProducts };
}

function computeRunningTotalsAdding(tape) {
  const totals = [];
  const subProducts = [];
  let total = 0;
  let pendingOp = '+';

  for (let i = 0; i < tape.length; i++) {
    const entry = tape[i];

    if (entry.op === 'text' || entry.value == null) {
      totals.push(totals.length > 0 ? totals[totals.length - 1] : 0);
      subProducts.push(null);
      continue;
    }

    if (entry.op === '=' || entry.op === 'T') {
      totals.push(total);
      subProducts.push(null);
      if (entry.op === 'T') {
        total = 0;
        pendingOp = '+';
      }
      continue;
    }

    total = applyOp(pendingOp, total, entry.value ?? 0);
    totals.push(total);
    subProducts.push(null);
    pendingOp = entry.op;
  }

  return { totals, subProducts };
}

function computeRunningTotalsPrefixAdding(tape) {
  const totals = [];
  const subProducts = [];
  let total = 0;

  for (let i = 0; i < tape.length; i++) {
    const entry = tape[i];

    if (entry.op === 'text' || entry.value == null) {
      totals.push(totals.length > 0 ? totals[totals.length - 1] : 0);
      subProducts.push(null);
      continue;
    }

    if (entry.op === '=' || entry.op === 'T') {
      totals.push(total);
      subProducts.push(null);
      if (entry.op === 'T') {
        total = 0;
      }
      continue;
    }

    total = applyOp(entry.op, total, entry.value ?? 0);
    totals.push(total);
    subProducts.push(null);
  }

  return { totals, subProducts };
}

function computeRunningTotalsPrefixArithmetic(tape) {
  const totals = [];
  const subProducts = [];
  let total = 0;
  let addOp = '+';
  let groupProduct = 0;
  let groupLen = 0;

  for (let i = 0; i < tape.length; i++) {
    const entry = tape[i];

    if (entry.op === 'text' || entry.value == null) {
      totals.push(totals.length > 0 ? totals[totals.length - 1] : 0);
      subProducts.push(null);
      continue;
    }

    if (entry.op === '=') {
      let displayTotal = total;
      if (groupLen > 0) {
        displayTotal = applyAdd(addOp, total, groupProduct);
      }
      totals.push(displayTotal);
      subProducts.push(null);
      continue;
    }

    if (entry.op === 'T') {
      if (groupLen > 0) {
        total = applyAdd(addOp, total, groupProduct);
        groupLen = 0;
      }
      totals.push(total);
      subProducts.push(null);
      total = 0;
      addOp = '+';
      continue;
    }

    const val = entry.value ?? 0;
    const entryOp = entry.op;
    const isMultOp = entryOp === '*' || entryOp === '/';

    if (isMultOp && groupLen > 0) {
      // Continue multiplicative group
      if (entryOp === '*') {
        groupProduct *= val;
      } else {
        groupProduct = val !== 0 ? groupProduct / val : groupProduct;
      }
      groupLen++;
    } else {
      // Flush previous group
      if (groupLen > 0) {
        total = applyAdd(addOp, total, groupProduct);
      }
      // Start new group with this entry's op as the additive op
      addOp = (entryOp === '+' || entryOp === '-') ? entryOp : '+';
      groupProduct = val;
      groupLen = 1;
    }

    const currentTotal = applyAdd(addOp, total, groupProduct);
    totals.push(currentTotal);

    if (isMultOp || (groupLen > 1)) {
      subProducts.push(groupProduct);
    } else {
      subProducts.push(null);
    }
  }

  return { totals, subProducts };
}

function applyOp(op, a, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b !== 0 ? a / b : a;
    default: return a + b;
  }
}

function applyAdd(op, total, value) {
  return op === '+' ? total + value : total - value;
}
