import { BayPhotoExportProvider } from './bayPhotoExportProvider.js';
import { WhccExportProvider } from './whccExportProvider.js';
import type { PrintProvider } from './printTypes.js';

const PROVIDERS: PrintProvider[] = [
  new BayPhotoExportProvider(),
  new WhccExportProvider(),
];

export function getProviders(): PrintProvider[] {
  return PROVIDERS;
}

export function getProviderById(id: string): PrintProvider | null {
  return PROVIDERS.find((p) => p.info.id === id) ?? null;
}
