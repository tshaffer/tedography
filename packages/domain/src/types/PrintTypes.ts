export type PrintSize = '4x6' | '5x7' | '8x10' | '11x14';
export type PrintFinish = 'matte' | 'lustre' | 'glossy';
export type PrintCropMode = 'fit' | 'fill';

export interface PrintCrop {
  x: number;      // 0.0–1.0, left edge of crop relative to source image width
  y: number;      // 0.0–1.0, top edge of crop relative to source image height
  width: number;  // 0.0–1.0, crop width relative to source image width
  height: number; // 0.0–1.0, crop height relative to source image height
}

export interface PrintOrderItem {
  assetId: string;
  size: PrintSize;
  finish: PrintFinish;
  quantity: number;
  cropMode: PrintCropMode;
  crop?: PrintCrop;
}

export interface PrintJobRequest {
  providerId: string;
  items: PrintOrderItem[];
}

export interface PrintProviderInfo {
  id: string;
  label: string;
  description: string;
  supportedSizes: PrintSize[];
  supportedFinishes: PrintFinish[];
}

export interface PrintItemResult {
  assetId: string;
  filename: string;
  exportedFiles: string[];
  previewFile: string | null;
  warnings: string[];
  error?: string | undefined;
}

export interface PrintJobResult {
  outputDir: string;
  items: PrintItemResult[];
  totalFiles: number;
  warningCount: number;
  errorCount: number;
}

export const PRINT_SIZE_DIMENSIONS: Record<PrintSize, { shortInches: number; longInches: number }> = {
  '4x6':  { shortInches: 4,  longInches: 6  },
  '5x7':  { shortInches: 5,  longInches: 7  },
  '8x10': { shortInches: 8,  longInches: 10 },
  '11x14':{ shortInches: 11, longInches: 14 },
};

export const MIN_RESOLUTION_PX: Record<PrintSize, { short: number; long: number }> = {
  '4x6':  { short: 1200, long: 1800 },
  '5x7':  { short: 1500, long: 2100 },
  '8x10': { short: 2400, long: 3000 },
  '11x14':{ short: 3300, long: 4200 },
};
