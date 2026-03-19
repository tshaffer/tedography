const nibbleBitCount = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function hammingDistance(left: string, right: string): number {
  if (left.length !== right.length) {
    throw new Error('Hash strings must have the same length.');
  }

  let distance = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftNibble = Number.parseInt(left.charAt(index), 16);
    const rightNibble = Number.parseInt(right.charAt(index), 16);

    if (Number.isNaN(leftNibble) || Number.isNaN(rightNibble)) {
      throw new Error('Hash strings must be hexadecimal.');
    }

    const bitCount = nibbleBitCount[leftNibble ^ rightNibble];
    if (bitCount === undefined) {
      throw new Error('Failed to compute nibble bit count.');
    }

    distance += bitCount;
  }

  return distance;
}
