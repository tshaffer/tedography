import { AssetEventType } from '../enums/AssetEventType.js';

export interface AssetEvent {
  id: string;
  assetId: string;
  eventType: AssetEventType;
  eventDateTime: string;
  payload?: Record<string, unknown>;
}
