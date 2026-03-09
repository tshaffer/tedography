import { AssetEventType } from '../enums/AssetEventType';

export interface AssetEvent {
  id: string;
  assetId: string;
  eventType: AssetEventType;
  eventDateTime: string;
  payload?: Record<string, unknown>;
}
