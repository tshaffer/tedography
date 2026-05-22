import type { MediaAsset, PrintCrop, PrintFinish, PrintJobResult, PrintOrderItem, PrintProviderInfo, PrintSize } from '@tedography/domain';

export interface ResolvedPrintItem {
  item: PrintOrderItem;
  asset: MediaAsset;
  sourceFilePath: string;
  sourceMimeType: string;
  sourceWidth: number;
  sourceHeight: number;
  resolutionWarnings: string[];
}

export interface PrintProvider {
  readonly info: PrintProviderInfo;
  exportPackage(
    resolvedItems: ResolvedPrintItem[],
    outputDir: string
  ): Promise<PrintJobResult>;
}

export { PrintSize, PrintFinish, PrintCrop, PrintOrderItem, PrintProviderInfo, PrintJobResult };
