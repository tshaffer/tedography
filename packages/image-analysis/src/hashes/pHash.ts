import { normalizeImage } from '../normalize/normalizeImage.js';

function buildDctMatrix(size: number): number[][] {
  const matrix: number[][] = [];

  for (let row = 0; row < size; row += 1) {
    const currentRow: number[] = [];
    const coefficient = row === 0 ? Math.sqrt(1 / size) : Math.sqrt(2 / size);

    for (let column = 0; column < size; column += 1) {
      currentRow.push(
        coefficient * Math.cos(((2 * column + 1) * row * Math.PI) / (2 * size))
      );
    }

    matrix.push(currentRow);
  }

  return matrix;
}

function getMatrixValue(matrix: number[][], row: number, column: number): number {
  const rowValues = matrix[row];
  const value = rowValues?.[column];
  if (value === undefined) {
    throw new Error(`Matrix value missing at row ${String(row)}, column ${String(column)}.`);
  }

  return value;
}

function multiplyMatrices(left: number[][], right: number[][]): number[][] {
  const result: number[][] = [];

  for (let row = 0; row < left.length; row += 1) {
    const currentRow: number[] = [];

    const rightColumnCount = right[0]?.length ?? 0;
    for (let column = 0; column < rightColumnCount; column += 1) {
      let sum = 0;

      for (let index = 0; index < right.length; index += 1) {
        sum += getMatrixValue(left, row, index) * getMatrixValue(right, index, column);
      }

      currentRow.push(sum);
    }

    result.push(currentRow);
  }

  return result;
}

function transposeMatrix(matrix: number[][]): number[][] {
  const result: number[][] = [];

  const columnCount = matrix[0]?.length ?? 0;
  for (let column = 0; column < columnCount; column += 1) {
    const row: number[] = [];
    for (let index = 0; index < matrix.length; index += 1) {
      row.push(getMatrixValue(matrix, index, column));
    }
    result.push(row);
  }

  return result;
}

function toHexFromBits(bits: string): string {
  let hex = '';
  for (let index = 0; index < bits.length; index += 4) {
    hex += Number.parseInt(bits.slice(index, index + 4), 2).toString(16);
  }
  return hex;
}

export async function computePHash(filePath: string): Promise<string> {
  const normalized = await normalizeImage(filePath, 32, 32);
  const pixelMatrix: number[][] = [];

  for (let row = 0; row < normalized.height; row += 1) {
    const currentRow: number[] = [];
    for (let column = 0; column < normalized.width; column += 1) {
      const pixel = normalized.pixels[row * normalized.width + column];
      if (pixel === undefined) {
        throw new Error('Normalized pixel data was incomplete while computing pHash.');
      }
      currentRow.push(pixel);
    }
    pixelMatrix.push(currentRow);
  }

  const dctMatrix = buildDctMatrix(32);
  const dct = multiplyMatrices(multiplyMatrices(dctMatrix, pixelMatrix), transposeMatrix(dctMatrix));
  const lowFrequencyValues: number[] = [];

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      if (row === 0 && column === 0) {
        continue;
      }

      lowFrequencyValues.push(getMatrixValue(dct, row, column));
    }
  }

  const sortedValues = [...lowFrequencyValues].sort((left, right) => left - right);
  const median = sortedValues[Math.floor(sortedValues.length / 2)] ?? 0;
  const bits = lowFrequencyValues.map((value) => (value > median ? '1' : '0')).join('');

  return toHexFromBits(bits);
}
