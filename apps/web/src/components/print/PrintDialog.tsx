import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import type {
  MediaAsset,
  PrintCrop,
  PrintCropMode,
  PrintFinish,
  PrintJobResult,
  PrintOrderItem,
  PrintProviderInfo,
  PrintSize,
} from '@tedography/domain';
import { computeDefaultCrop, CropEditor } from './CropEditor';
import { getPrintProviders, submitPrintJob } from '../../api/printApi';
import { getDisplayMediaUrl } from '../../utilities/mediaUrls';

export interface PrintDialogProps {
  open: boolean;
  assets: MediaAsset[];
  onClose: () => void;
}

type Step = 'provider' | 'settings' | 'crop' | 'exporting' | 'result';

const SIZES: PrintSize[] = ['4x6', '5x7', '8x10', '11x14'];
const FINISHES: PrintFinish[] = ['matte', 'lustre', 'glossy'];
const QUANTITIES = [1, 2, 3, 4, 5, 6, 8, 10];

interface PerItemSetting {
  size: PrintSize;
  finish: PrintFinish;
  quantity: number;
  cropMode: PrintCropMode;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
};

const dialogStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
  width: 700,
  maxWidth: '96vw',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  padding: '18px 22px 14px',
  borderBottom: '1px solid #e0e0e0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 600,
};

const closeButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 20,
  cursor: 'pointer',
  color: '#555',
  lineHeight: 1,
  padding: '2px 6px',
};

const bodyStyle: CSSProperties = {
  padding: '20px 22px',
  overflowY: 'auto',
  flex: 1,
};

const footerStyle: CSSProperties = {
  padding: '12px 22px',
  borderTop: '1px solid #e0e0e0',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};

const primaryButtonStyle: CSSProperties = {
  background: '#0969da',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '7px 18px',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  background: '#f0f0f0',
  color: '#333',
  border: 'none',
  borderRadius: 6,
  padding: '7px 18px',
  fontSize: 14,
  cursor: 'pointer',
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.5,
  cursor: 'default',
};

const providerCardStyle: CSSProperties = {
  border: '1px solid #d0d0d0',
  borderRadius: 8,
  padding: '12px 16px',
  cursor: 'pointer',
  marginBottom: 10,
};

const providerCardSelectedStyle: CSSProperties = {
  ...providerCardStyle,
  border: '2px solid #0969da',
  background: '#f0f7ff',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 4,
  color: '#444',
};

const selectStyle: CSSProperties = {
  width: '100%',
  fontSize: 14,
  padding: '6px 8px',
  borderRadius: 5,
  border: '1px solid #ccc',
};

const compactSelectStyle: CSSProperties = {
  fontSize: 12,
  padding: '3px 4px',
  borderRadius: 4,
  border: '1px solid #ccc',
  background: '#fff',
  cursor: 'pointer',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
  marginBottom: 14,
};

const colStyle: CSSProperties = {
  flex: 1,
};

const cropNavStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 10,
  fontSize: 14,
  color: '#444',
};

const sectionHeadingStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#555',
  marginBottom: 8,
  marginTop: 0,
};

const warningBadgeStyle: CSSProperties = {
  background: '#fff3cd',
  color: '#856404',
  borderRadius: 4,
  padding: '1px 6px',
  fontSize: 11,
  fontWeight: 500,
  flexShrink: 0,
};

const dividerStyle: CSSProperties = {
  border: 'none',
  borderTop: '1px solid #ebebeb',
  margin: '14px 0 16px',
};

function printSizeAspect(size: PrintSize, landscape: boolean): number {
  const dims: Record<PrintSize, readonly [number, number]> = {
    '4x6': [4, 6],
    '5x7': [5, 7],
    '8x10': [8, 10],
    '11x14': [11, 14],
  };
  const entry = dims[size] ?? [4, 6];
  const [s, l] = entry;
  return landscape ? l / s : s / l;
}

function isLandscape(asset: MediaAsset): boolean {
  const w = asset.width ?? 1;
  const h = asset.height ?? 1;
  return w >= h;
}

function hasResolutionWarning(asset: MediaAsset, size: PrintSize): boolean {
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  const short = Math.min(w, h);
  const long = Math.max(w, h);
  const minPx: Record<PrintSize, { short: number; long: number }> = {
    '4x6': { short: 1200, long: 1800 },
    '5x7': { short: 1500, long: 2100 },
    '8x10': { short: 2400, long: 3000 },
    '11x14': { short: 3300, long: 4200 },
  };
  const min = minPx[size] ?? { short: 0, long: 0 };
  return short < min.short || long < min.long;
}

interface AssetCropEntry {
  assetId: string;
  crop: PrintCrop;
}

function buildDefaultPerItemSettings(
  assets: MediaAsset[],
  size: PrintSize,
  finish: PrintFinish,
  quantity: number,
  cropMode: PrintCropMode
): Map<string, PerItemSetting> {
  return new Map(assets.map((a) => [a.id, { size, finish, quantity, cropMode }]));
}

export function PrintDialog({ open, assets, onClose }: PrintDialogProps): ReactElement | null {
  const [step, setStep] = useState<Step>('provider');
  const [providers, setProviders] = useState<PrintProviderInfo[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // Global defaults
  const [size, setSize] = useState<PrintSize>('8x10');
  const [finish, setFinish] = useState<PrintFinish>('lustre');
  const [quantity, setQuantity] = useState(1);
  const [cropMode, setCropMode] = useState<PrintCropMode>('fill');

  // Per-item overrides (initialized from globals when entering settings)
  const [perItemSettings, setPerItemSettings] = useState<Map<string, PerItemSetting>>(new Map());

  const [cropEntries, setCropEntries] = useState<AssetCropEntry[]>([]);
  const [cropIndex, setCropIndex] = useState(0);

  const [result, setResult] = useState<PrintJobResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Load providers when dialog opens
  useEffect(() => {
    if (!open) return;
    setStep('provider');
    setSelectedProviderId(null);
    setResult(null);
    setExportError(null);
    setProvidersError(null);
    setProvidersLoading(true);
    getPrintProviders()
      .then(({ providers: p }) => {
        setProviders(p);
        if (p.length === 1 && p[0]) setSelectedProviderId(p[0].id);
      })
      .catch((err: unknown) => {
        setProvidersError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setProvidersLoading(false));
  }, [open]);

  const rebuildCropEntries = useCallback((itemSettings: Map<string, PerItemSetting>) => {
    setCropEntries(
      assets.map((a) => {
        const itemSize = itemSettings.get(a.id)?.size ?? size;
        const landscape = isLandscape(a);
        const aspect = printSizeAspect(itemSize, landscape);
        const w = a.width ?? 1;
        const h = a.height ?? 1;
        return { assetId: a.id, crop: computeDefaultCrop(w, h, aspect) };
      })
    );
  }, [assets, size]);

  const handleGoToSettings = useCallback(() => {
    const settings = buildDefaultPerItemSettings(assets, size, finish, quantity, cropMode);
    setPerItemSettings(settings);
    rebuildCropEntries(settings);
    setStep('settings');
  }, [assets, size, finish, quantity, rebuildCropEntries]);

  // Apply a global change to all per-item settings
  const applyGlobalSize = useCallback((newSize: PrintSize) => {
    setSize(newSize);
    setPerItemSettings((prev) => {
      const next = new Map(prev);
      for (const [id, s] of next) next.set(id, { ...s, size: newSize });
      return next;
    });
    // Rebuild crops with the updated map
    setCropEntries((prevCrops) =>
      assets.map((a) => {
        const landscape = isLandscape(a);
        const aspect = printSizeAspect(newSize, landscape);
        const w = a.width ?? 1;
        const h = a.height ?? 1;
        const existing = prevCrops.find((e) => e.assetId === a.id);
        // Reset crop when size changes since aspect ratio changes
        return { assetId: a.id, crop: existing ? computeDefaultCrop(w, h, aspect) : computeDefaultCrop(w, h, aspect) };
      })
    );
  }, [assets]);

  const applyGlobalFinish = useCallback((newFinish: PrintFinish) => {
    setFinish(newFinish);
    setPerItemSettings((prev) => {
      const next = new Map(prev);
      for (const [id, s] of next) next.set(id, { ...s, finish: newFinish });
      return next;
    });
  }, []);

  const applyGlobalQuantity = useCallback((newQty: number) => {
    setQuantity(newQty);
    setPerItemSettings((prev) => {
      const next = new Map(prev);
      for (const [id, s] of next) next.set(id, { ...s, quantity: newQty });
      return next;
    });
  }, []);

  const applyGlobalCropMode = useCallback((newMode: PrintCropMode) => {
    setCropMode(newMode);
    setPerItemSettings((prev) => {
      const next = new Map(prev);
      for (const [id, s] of next) next.set(id, { ...s, cropMode: newMode });
      return next;
    });
  }, []);

  const updateItemSetting = useCallback((assetId: string, patch: Partial<PerItemSetting>) => {
    setPerItemSettings((prev) => {
      const existing = prev.get(assetId);
      if (!existing) return prev;
      const next = new Map(prev);
      const updated = { ...existing, ...patch };
      next.set(assetId, updated);
      // Rebuild crop for this asset if size changed
      if (patch.size !== undefined) {
        const asset = assets.find((a) => a.id === assetId);
        if (asset) {
          const landscape = isLandscape(asset);
          const aspect = printSizeAspect(updated.size, landscape);
          const w = asset.width ?? 1;
          const h = asset.height ?? 1;
          setCropEntries((prev) =>
            prev.map((e) => e.assetId === assetId ? { ...e, crop: computeDefaultCrop(w, h, aspect) } : e)
          );
        }
      }
      return next;
    });
  }, [assets]);

  const handleGoToCrop = useCallback(() => {
    rebuildCropEntries(perItemSettings);
    setCropIndex(0);
    setStep('crop');
  }, [perItemSettings, rebuildCropEntries]);

  const handleExport = useCallback(async () => {
    if (!selectedProviderId) return;
    setStep('exporting');
    setExportError(null);
    const cropMap = new Map(cropEntries.map((e) => [e.assetId, e.crop]));
    const items: PrintOrderItem[] = assets.map((a) => {
      const itemSetting = perItemSettings.get(a.id) ?? { size, finish, quantity, cropMode };
      const landscape = isLandscape(a);
      const aspect = printSizeAspect(itemSetting.size, landscape);
      const w = a.width ?? 1;
      const h = a.height ?? 1;
      const itemCropMode = itemSetting.cropMode;
      const base = {
        assetId: a.id,
        size: itemSetting.size,
        finish: itemSetting.finish,
        quantity: itemSetting.quantity,
        cropMode: itemCropMode,
      };
      if (itemCropMode === 'fill') {
        return { ...base, crop: cropMap.get(a.id) ?? computeDefaultCrop(w, h, aspect) };
      }
      return base;
    });
    try {
      const r = await submitPrintJob({ providerId: selectedProviderId, items });
      setResult(r);
      setStep('result');
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err));
      setStep('result');
    }
  }, [selectedProviderId, assets, size, finish, quantity, cropMode, cropEntries, perItemSettings]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) ?? null,
    [providers, selectedProviderId]
  );
  const fillAssets = useMemo(
    () => assets.filter((a) => (perItemSettings.get(a.id)?.cropMode ?? cropMode) === 'fill'),
    [assets, perItemSettings, cropMode]
  );
  const currentCropAsset = fillAssets[cropIndex] ?? null;
  const currentCropEntry = cropEntries.find((e) => e.assetId === currentCropAsset?.id);
  const currentItemSetting = currentCropAsset ? (perItemSettings.get(currentCropAsset.id) ?? { size, finish, quantity, cropMode }) : null;

  if (!open) return null;

  const availableSizes = selectedProvider?.supportedSizes ?? SIZES;
  const availableFinishes = selectedProvider?.supportedFinishes ?? FINISHES;

  function renderProvider(): ReactElement {
    return (
      <>
        <div style={bodyStyle}>
          <p style={{ margin: '0 0 14px', fontSize: 14, color: '#444' }}>
            {assets.length} photo{assets.length !== 1 ? 's' : ''} selected for printing.
          </p>
          {providersLoading && <p style={{ fontSize: 14, color: '#666' }}>Loading providers…</p>}
          {providersError && <p style={{ fontSize: 14, color: '#c00' }}>{providersError}</p>}
          {!providersLoading && providers.map((p) => (
            <div
              key={p.id}
              style={selectedProviderId === p.id ? providerCardSelectedStyle : providerCardStyle}
              onClick={() => setSelectedProviderId(p.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedProviderId(p.id)}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.label}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>{p.description}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                Sizes: {p.supportedSizes.join(', ')} &nbsp;·&nbsp; Finishes: {p.supportedFinishes.join(', ')}
              </div>
            </div>
          ))}
        </div>
        <div style={footerStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={onClose}>Cancel</button>
          <button
            type="button"
            style={selectedProviderId ? primaryButtonStyle : { ...primaryButtonStyle, ...disabledButtonStyle }}
            disabled={!selectedProviderId}
            onClick={handleGoToSettings}
          >
            Next
          </button>
        </div>
      </>
    );
  }

  function renderSettings(): ReactElement {
    return (
      <>
        <div style={bodyStyle}>
          {/* Global defaults */}
          <p style={{ ...sectionHeadingStyle, marginBottom: 10 }}>Defaults — apply to all photos</p>
          <div style={rowStyle}>
            <div style={colStyle}>
              <label style={labelStyle} htmlFor="print-size">Size</label>
              <select
                id="print-size"
                style={selectStyle}
                value={size}
                onChange={(e) => applyGlobalSize(e.target.value as PrintSize)}
              >
                {availableSizes.map((s) => (
                  <option key={s} value={s}>{s}"</option>
                ))}
              </select>
            </div>
            <div style={colStyle}>
              <label style={labelStyle} htmlFor="print-finish">Finish</label>
              <select
                id="print-finish"
                style={selectStyle}
                value={finish}
                onChange={(e) => applyGlobalFinish(e.target.value as PrintFinish)}
              >
                {availableFinishes.map((f) => (
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </div>
            <div style={colStyle}>
              <label style={labelStyle} htmlFor="print-qty">Qty</label>
              <select
                id="print-qty"
                style={selectStyle}
                value={quantity}
                onChange={(e) => applyGlobalQuantity(Number(e.target.value))}
              >
                {QUANTITIES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={rowStyle}>
            <div style={colStyle}>
              <label style={labelStyle}>Crop mode</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {(['fill', 'fit'] as PrintCropMode[]).map((mode) => {
                  const allMatch = assets.length > 0 && assets.every(
                    (a) => (perItemSettings.get(a.id)?.cropMode ?? cropMode) === mode
                  );
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => applyGlobalCropMode(mode)}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        borderRadius: 5,
                        border: allMatch ? '2px solid #0969da' : '1px solid #ccc',
                        background: allMatch ? '#f0f7ff' : '#f8f8f8',
                        fontWeight: allMatch ? 600 : 400,
                        fontSize: 13,
                        cursor: 'pointer',
                        color: allMatch ? '#0969da' : '#333',
                      }}
                    >
                      {mode === 'fill' ? 'Fill (crop)' : 'Fit (letterbox)'}
                    </button>
                  );
                })}
              </div>
              {assets.every((a) => (perItemSettings.get(a.id)?.cropMode ?? cropMode) === 'fill') && (
                <p style={{ fontSize: 12, color: '#666', marginTop: 6, marginBottom: 0 }}>
                  Fills the print area — some edges may be cropped. You can adjust each photo.
                </p>
              )}
              {assets.every((a) => (perItemSettings.get(a.id)?.cropMode ?? cropMode) === 'fit') && (
                <p style={{ fontSize: 12, color: '#666', marginTop: 6, marginBottom: 0 }}>
                  Entire photo fits — white borders added if aspect differs.
                </p>
              )}
            </div>
          </div>

          <hr style={dividerStyle} />

          {/* Per-photo overrides */}
          <p style={sectionHeadingStyle}>
            Per-photo overrides
            <span style={{ fontWeight: 400, color: '#888', marginLeft: 8 }}>
              ({assets.length} photo{assets.length !== 1 ? 's' : ''})
            </span>
          </p>

          {/* Column headers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4, borderBottom: '1px solid #e8e8e8', fontSize: 11, color: '#888', fontWeight: 500 }}>
            <div style={{ width: 36, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>Photo</div>
            <div style={{ width: 68, textAlign: 'center' }}>Size</div>
            <div style={{ width: 80, textAlign: 'center' }}>Finish</div>
            <div style={{ width: 42, textAlign: 'center' }}>Qty</div>
            <div style={{ width: 60, textAlign: 'center' }}>Crop</div>
            <div style={{ width: 52 }} />
          </div>

          <div>
            {assets.map((a) => {
              const item = perItemSettings.get(a.id) ?? { size, finish, quantity, cropMode };
              const warn = hasResolutionWarning(a, item.size);
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <img
                    src={`/api/media/thumbnail/${encodeURIComponent(a.id)}`}
                    alt={a.filename}
                    style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                    {a.filename}
                  </span>
                  <select
                    style={{ ...compactSelectStyle, width: 68 }}
                    value={item.size}
                    onChange={(e) => updateItemSetting(a.id, { size: e.target.value as PrintSize })}
                  >
                    {availableSizes.map((s) => (
                      <option key={s} value={s}>{s}"</option>
                    ))}
                  </select>
                  <select
                    style={{ ...compactSelectStyle, width: 80 }}
                    value={item.finish}
                    onChange={(e) => updateItemSetting(a.id, { finish: e.target.value as PrintFinish })}
                  >
                    {availableFinishes.map((f) => (
                      <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                    ))}
                  </select>
                  <select
                    style={{ ...compactSelectStyle, width: 42 }}
                    value={item.quantity}
                    onChange={(e) => updateItemSetting(a.id, { quantity: Number(e.target.value) })}
                  >
                    {QUANTITIES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <select
                    style={{ ...compactSelectStyle, width: 60 }}
                    value={item.cropMode}
                    onChange={(e) => updateItemSetting(a.id, { cropMode: e.target.value as PrintCropMode })}
                  >
                    <option value="fill">Fill</option>
                    <option value="fit">Fit</option>
                  </select>
                  <div style={{ width: 52, display: 'flex', justifyContent: 'flex-end' }}>
                    {warn && <span style={warningBadgeStyle}>Low res</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={footerStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={() => setStep('provider')}>Back</button>
          {fillAssets.length > 0 ? (
            <button type="button" style={primaryButtonStyle} onClick={handleGoToCrop}>
              Review crops ({fillAssets.length})
            </button>
          ) : (
            <button type="button" style={primaryButtonStyle} onClick={() => void handleExport()}>
              Export
            </button>
          )}
        </div>
      </>
    );
  }

  function renderCrop(): ReactElement {
    if (!currentCropAsset || !currentCropEntry || !currentItemSetting) {
      return (
        <>
          <div style={bodyStyle}><p>No photos to crop.</p></div>
          <div style={footerStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={() => setStep('settings')}>Back</button>
          </div>
        </>
      );
    }
    const landscape = isLandscape(currentCropAsset);
    const aspect = printSizeAspect(currentItemSetting.size, landscape);
    const srcW = currentCropAsset.width ?? 1;
    const srcH = currentCropAsset.height ?? 1;
    const imageUrl = getDisplayMediaUrl(currentCropAsset.id);

    function updateCrop(newCrop: PrintCrop): void {
      setCropEntries((prev) =>
        prev.map((e) => (e.assetId === currentCropAsset!.id ? { ...e, crop: newCrop } : e))
      );
    }

    return (
      <>
        <div style={bodyStyle}>
          <div style={cropNavStyle}>
            <button
              type="button"
              style={cropIndex === 0 ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle}
              disabled={cropIndex === 0}
              onClick={() => setCropIndex((i) => i - 1)}
            >
              ← Prev
            </button>
            <span>
              {currentCropAsset.filename} &nbsp;({cropIndex + 1} of {fillAssets.length})
              <span style={{ marginLeft: 10, fontSize: 12, color: '#888' }}>
                {currentItemSetting.size}" · {currentItemSetting.finish}
              </span>
            </span>
            <button
              type="button"
              style={cropIndex >= fillAssets.length - 1 ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle}
              disabled={cropIndex >= fillAssets.length - 1}
              onClick={() => setCropIndex((i) => i + 1)}
            >
              Next →
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 10px' }}>
            Drag to reposition · drag a corner to resize. The highlighted region will be printed at {currentItemSetting.size}".
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <CropEditor
              imageUrl={imageUrl}
              printAspect={aspect}
              sourceWidth={srcW}
              sourceHeight={srcH}
              crop={currentCropEntry.crop}
              onChange={updateCrop}
            />
          </div>
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <button
              type="button"
              style={{ ...secondaryButtonStyle, fontSize: 12 }}
              onClick={() => updateCrop(computeDefaultCrop(srcW, srcH, aspect))}
            >
              Reset to center
            </button>
          </div>
        </div>
        <div style={footerStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={() => setStep('settings')}>Back</button>
          <button type="button" style={primaryButtonStyle} onClick={() => void handleExport()}>
            Export
          </button>
        </div>
      </>
    );
  }

  function renderExporting(): ReactElement {
    return (
      <div style={bodyStyle}>
        <p style={{ fontSize: 15, color: '#444', textAlign: 'center', marginTop: 30 }}>
          Exporting print package…
        </p>
        <p style={{ fontSize: 13, color: '#888', textAlign: 'center' }}>This may take a moment.</p>
      </div>
    );
  }

  function renderResult(): ReactElement {
    if (exportError) {
      return (
        <>
          <div style={bodyStyle}>
            <p style={{ color: '#c00', fontSize: 14 }}>Export failed:</p>
            <pre style={{ background: '#fef2f2', borderRadius: 5, padding: 10, fontSize: 12, overflowX: 'auto' }}>
              {exportError}
            </pre>
          </div>
          <div style={footerStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={onClose}>Close</button>
          </div>
        </>
      );
    }
    if (!result) return <div style={bodyStyle} />;
    return (
      <>
        <div style={bodyStyle}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1a7f37', marginBottom: 10 }}>
            Print package ready!
          </p>
          <div style={{ background: '#f6f8fa', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Output folder:</div>
            <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{result.outputDir}</code>
          </div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{result.totalFiles}</div>
              <div style={{ fontSize: 12, color: '#666' }}>Files exported</div>
            </div>
            {result.warningCount > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#856404' }}>{result.warningCount}</div>
                <div style={{ fontSize: 12, color: '#856404' }}>Warnings</div>
              </div>
            )}
            {result.errorCount > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#c00' }}>{result.errorCount}</div>
                <div style={{ fontSize: 12, color: '#c00' }}>Errors</div>
              </div>
            )}
          </div>
          {result.items.some((i) => i.warnings.length > 0 || i.error) && (
            <div>
              <p style={sectionHeadingStyle}>Per-photo notes</p>
              {result.items.filter((i) => i.warnings.length > 0 || i.error).map((i) => (
                <div key={i.assetId} style={{ fontSize: 12, marginBottom: 8, padding: '6px 10px', background: i.error ? '#fef2f2' : '#fff3cd', borderRadius: 5 }}>
                  <strong>{i.filename}</strong>
                  {i.error && <div style={{ color: '#c00', marginTop: 2 }}>{i.error}</div>}
                  {i.warnings.map((w, idx) => <div key={idx} style={{ color: '#856404', marginTop: 2 }}>{w}</div>)}
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 13, color: '#555', marginTop: 14 }}>
            Upload the contents of the output folder to {selectedProvider?.label ?? 'your print lab'} to place your order.
            Open <code>order-summary.html</code> for a full preview before uploading.
          </p>
        </div>
        <div style={footerStyle}>
          <button type="button" style={primaryButtonStyle} onClick={onClose}>Done</button>
        </div>
      </>
    );
  }

  const stepTitles: Record<Step, string> = {
    provider: 'Print Photos',
    settings: 'Print Settings',
    crop: 'Adjust Crops',
    exporting: 'Exporting…',
    result: 'Export Complete',
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={dialogStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{stepTitles[step]}</h2>
          <button type="button" style={closeButtonStyle} onClick={onClose} aria-label="Close">×</button>
        </div>
        {step === 'provider' && renderProvider()}
        {step === 'settings' && renderSettings()}
        {step === 'crop' && renderCrop()}
        {step === 'exporting' && renderExporting()}
        {step === 'result' && renderResult()}
      </div>
    </div>
  );
}
