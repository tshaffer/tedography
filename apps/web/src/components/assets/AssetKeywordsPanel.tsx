import { useMemo, useState, type CSSProperties } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import type { AssetKeywordAssignmentStatus, Keyword } from '@tedography/domain';
import {
  buildKeywordMap,
  formatKeywordPathLabel,
  getKeywordPathLabels
} from '../../utilities/keywords';

type KeywordEntry = Keyword | string;

interface AssetKeywordsPanelProps {
  selectedAssetCount: number;
  displayedKeywords: Keyword[];
  allKeywords: Keyword[];
  recentKeywords: Keyword[];
  embedded?: boolean;
  keywordsLoading?: boolean;
  keywordsError?: string | null;
  updateBusy?: boolean;
  keywordAssignmentStatus?: AssetKeywordAssignmentStatus | null;
  onAddKeywords: (entries: KeywordEntry[]) => Promise<boolean>;
  onRemoveKeyword: (keyword: Keyword) => Promise<void>;
  onSetKeywordAssignmentStatus?: (status: AssetKeywordAssignmentStatus | null) => Promise<void>;
}

const panelStyle: CSSProperties = {
  border: '1px solid #d6d6d6',
  borderRadius: '10px',
  padding: '10px',
  marginBottom: '8px',
  backgroundColor: '#fff'
};

const titleStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: '8px',
  fontSize: '14px'
};

const currentKeywordsZoneStyle: CSSProperties = {
  minHeight: '28px',
  marginBottom: '8px'
};

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '5px'
};

const chipParentPathStyle: CSSProperties = {
  color: '#999',
  fontSize: '10px',
  fontWeight: 400
};

const emptyLabelStyle: CSSProperties = {
  color: '#aaa',
  fontSize: '12px'
};

const dividerStyle: CSSProperties = {
  borderTop: '1px solid #ececec',
  margin: '8px 0'
};

const addRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '6px',
  alignItems: 'stretch'
};

const addButtonStyle: CSSProperties = {
  padding: '0 12px',
  fontSize: '12px',
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

const addButtonDisabledStyle: CSSProperties = {
  ...addButtonStyle,
  opacity: 0.45,
  cursor: 'not-allowed'
};

const recentSectionStyle: CSSProperties = {
  marginTop: '8px'
};

const recentLabelStyle: CSSProperties = {
  display: 'block',
  color: '#999',
  fontSize: '11px',
  marginBottom: '5px'
};

const recentChipsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '5px'
};

const loadingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  color: '#999',
  fontSize: '12px'
};

const statusRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  marginTop: '6px'
};

const statusButtonBaseStyle: CSSProperties = {
  padding: '2px 8px',
  fontSize: '11px',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  cursor: 'pointer',
  background: '#f9fafb',
  color: '#374151'
};

const statusButtonActiveStyle: CSSProperties = {
  ...statusButtonBaseStyle,
  fontWeight: 600
};

const assetKeywordStatusColors: Record<AssetKeywordAssignmentStatus, string> = {
  'not-started': '#9ca3af',
  'in-progress': '#d97706',
  'complete': '#16a34a'
};

function normalizeKeywordLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function getKeywordEntryLabel(entry: KeywordEntry): string {
  return typeof entry === 'string' ? entry : entry.label;
}

function dedupeKeywordEntries(entries: KeywordEntry[]): KeywordEntry[] {
  const seen = new Set<string>();
  const next: KeywordEntry[] = [];

  for (const entry of entries) {
    const normalized =
      typeof entry === 'string' ? normalizeKeywordLabel(entry) : entry.normalizedLabel;
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    next.push(entry);
  }

  return next;
}

function KeywordChipLabel({
  keyword,
  keywordMap
}: {
  keyword: Keyword;
  keywordMap: Map<string, Keyword>;
}) {
  const pathLabels = getKeywordPathLabels(keyword, keywordMap);
  const leafName = pathLabels[pathLabels.length - 1] ?? keyword.label;
  const parentPath = pathLabels.slice(0, -1).join(' / ');
  return (
    <span>
      {parentPath ? <span style={chipParentPathStyle}>{parentPath} / </span> : null}
      {leafName}
    </span>
  );
}

export function AssetKeywordsPanel({
  selectedAssetCount,
  displayedKeywords,
  allKeywords,
  recentKeywords,
  embedded = false,
  keywordsLoading = false,
  keywordsError = null,
  updateBusy = false,
  keywordAssignmentStatus = null,
  onAddKeywords,
  onRemoveKeyword,
  onSetKeywordAssignmentStatus
}: AssetKeywordsPanelProps) {
  const [pendingEntries, setPendingEntries] = useState<KeywordEntry[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  const titleLabel = selectedAssetCount > 1 ? 'Common Keywords' : 'Keywords';
  const emptyStateLabel = selectedAssetCount > 1 ? 'No common keywords' : 'No keywords';
  const addButtonLabel = selectedAssetCount > 1 ? 'Add to All' : 'Add';

  const keywordMap = useMemo(() => buildKeywordMap(allKeywords), [allKeywords]);

  const visibleRecentKeywords = useMemo(
    () =>
      recentKeywords.filter(
        (keyword) => !displayedKeywords.some((d) => d.id === keyword.id)
      ),
    [displayedKeywords, recentKeywords]
  );

  const sanitizedPendingEntries = useMemo(
    () => dedupeKeywordEntries(pendingEntries),
    [pendingEntries]
  );

  const addableKeywords = useMemo(
    () => allKeywords.filter((k) => !displayedKeywords.some((d) => d.id === k.id)),
    [allKeywords, displayedKeywords]
  );

  async function handleAdd(): Promise<void> {
    if (sanitizedPendingEntries.length === 0 || selectedAssetCount === 0 || updateBusy) {
      return;
    }
    const applied = await onAddKeywords(sanitizedPendingEntries);
    if (applied) {
      setPendingEntries([]);
    }
  }

  const embeddedStyle: CSSProperties = {
    borderTop: '1px solid #efefef',
    marginTop: '10px',
    paddingTop: '10px',
  };

  const embeddedTitleStyle: CSSProperties = {
    margin: '0 0 8px',
    fontSize: '13px',
    fontWeight: 600,
  };

  if (embedded) {
    return (
      <div style={embeddedStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h4 style={{ ...embeddedTitleStyle, margin: 0 }}>{titleLabel}</h4>
          {selectedAssetCount > 0 ? (
            <button
              type="button"
              onClick={() => setAddOpen((prev) => !prev)}
              title={addOpen ? 'Close add keywords' : 'Add keywords'}
              style={{
                background: 'none',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                color: addOpen ? '#6b7280' : '#374151',
                fontSize: '14px',
                lineHeight: 1,
                padding: '1px 6px',
              }}
            >
              {addOpen ? '×' : '+'}
            </button>
          ) : null}
        </div>
        {keywordsError ? (
          <p style={{ ...emptyLabelStyle, color: '#a12622', marginBottom: '6px' }}>
            {keywordsError}
          </p>
        ) : null}
        <div style={displayedKeywords.length > 0 || keywordsLoading ? currentKeywordsZoneStyle : { marginBottom: '8px' }}>
          {keywordsLoading ? (
            <div style={loadingRowStyle}>
              <CircularProgress size={12} />
              <span>Loading...</span>
            </div>
          ) : selectedAssetCount === 0 ? (
            <span style={emptyLabelStyle}>Select a photo to view and edit keywords.</span>
          ) : displayedKeywords.length > 0 ? (
            <div style={chipRowStyle}>
              {displayedKeywords.map((keyword) => (
                <Chip
                  key={keyword.id}
                  label={<KeywordChipLabel keyword={keyword} keywordMap={keywordMap} />}
                  size="small"
                  title={formatKeywordPathLabel(keyword, keywordMap)}
                  onDelete={!updateBusy ? () => void onRemoveKeyword(keyword) : undefined}
                />
              ))}
            </div>
          ) : (
            <span style={emptyLabelStyle}>{emptyStateLabel}</span>
          )}
        </div>
        {selectedAssetCount > 0 && addOpen ? (
          <div style={{ borderTop: '1px solid #efefef', marginTop: '6px', paddingTop: '6px' }}>
            <div style={addRowStyle}>
                  <Autocomplete<KeywordEntry, true, false, true>
                    multiple
                    freeSolo
                    disabled={updateBusy}
                    options={addableKeywords}
                    value={pendingEntries}
                    onChange={(_event, value) => { setPendingEntries(dedupeKeywordEntries(value)); }}
                    getOptionLabel={(entry) =>
                      typeof entry === 'string' ? entry : formatKeywordPathLabel(entry, keywordMap)
                    }
                    isOptionEqualToValue={(option, value) =>
                      normalizeKeywordLabel(getKeywordEntryLabel(option)) ===
                      normalizeKeywordLabel(getKeywordEntryLabel(value))
                    }
                    filterSelectedOptions
                    renderOption={(props, option) => {
                      const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key?: React.Key };
                      if (typeof option === 'string') {
                        return <li key={key} {...rest}>{option}</li>;
                      }
                      const pathLabels = getKeywordPathLabels(option, keywordMap);
                      const leafName = pathLabels[pathLabels.length - 1] ?? option.label;
                      const parentPath = pathLabels.slice(0, -1).join(' / ');
                      return (
                        <li key={key} {...rest}>
                          <div style={{ lineHeight: 1.35 }}>
                            {parentPath ? <div style={{ fontSize: '11px', color: '#aaa' }}>{parentPath}</div> : null}
                            <div style={{ fontSize: '13px' }}>{leafName}</div>
                          </div>
                        </li>
                      );
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((entry, index) => {
                        const { key, ...tagProps } = getTagProps({ index });
                        if (typeof entry === 'string') {
                          return <Chip key={key} {...tagProps} label={entry} size="small" />;
                        }
                        const pathLabels = getKeywordPathLabels(entry, keywordMap);
                        const leafName = pathLabels[pathLabels.length - 1] ?? entry.label;
                        const fullPath = formatKeywordPathLabel(entry, keywordMap);
                        return (
                          <Tooltip key={key} title={fullPath} placement="top">
                            <Chip {...tagProps} label={leafName} size="small" />
                          </Tooltip>
                        );
                      })
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        placeholder="Search or type a keyword"
                        inputProps={{ ...params.inputProps, style: { fontSize: '12px' } }}
                        sx={{
                          '& .MuiInputBase-root': { paddingTop: '2px', paddingBottom: '2px' },
                          '& .MuiInputBase-input': { paddingTop: '2px', paddingBottom: '2px', fontSize: '12px' }
                        }}
                      />
                    )}
                  />
                  <button
                    style={sanitizedPendingEntries.length > 0 && !updateBusy ? addButtonStyle : addButtonDisabledStyle}
                    disabled={sanitizedPendingEntries.length === 0 || updateBusy}
                    onClick={() => void handleAdd()}
                  >
                    {updateBusy ? 'Adding…' : addButtonLabel}
                  </button>
                </div>
                {visibleRecentKeywords.length > 0 ? (
                  <div style={recentSectionStyle}>
                    <span style={recentLabelStyle}>Recently used</span>
                    <div style={recentChipsStyle}>
                      {visibleRecentKeywords.slice(0, 4).map((keyword) => (
                        <Chip
                          key={keyword.id}
                          label={<KeywordChipLabel keyword={keyword} keywordMap={keywordMap} />}
                          size="small"
                          variant="outlined"
                          title={formatKeywordPathLabel(keyword, keywordMap)}
                          clickable={!updateBusy}
                          onClick={!updateBusy ? () => void onAddKeywords([keyword]) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
          </div>
        ) : null}
        {selectedAssetCount > 0 && onSetKeywordAssignmentStatus ? (
          <div style={statusRowStyle}>
            <span style={{ fontSize: '11px', color: '#6b7280', marginRight: '2px' }}>Keywords:</span>
            {(['not-started', 'in-progress', 'complete'] as AssetKeywordAssignmentStatus[]).map((status) => {
              const isActive = keywordAssignmentStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  disabled={updateBusy}
                  style={{
                    ...(isActive ? statusButtonActiveStyle : statusButtonBaseStyle),
                    borderColor: isActive ? assetKeywordStatusColors[status] : '#d1d5db',
                    color: isActive ? assetKeywordStatusColors[status] : '#374151'
                  }}
                  title={`Mark keyword assignment as ${status}`}
                  onClick={() => void onSetKeywordAssignmentStatus(isActive ? null : status)}
                >
                  {status === 'not-started' ? 'Not started' : status === 'in-progress' ? 'In progress' : 'Complete'}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section style={panelStyle}>
      <h3 style={titleStyle}>{titleLabel}</h3>

      {keywordsError ? (
        <p style={{ ...emptyLabelStyle, color: '#a12622', marginBottom: '6px' }}>
          {keywordsError}
        </p>
      ) : null}

      {/* Keywords on this photo */}
      <div style={currentKeywordsZoneStyle}>
        {keywordsLoading ? (
          <div style={loadingRowStyle}>
            <CircularProgress size={12} />
            <span>Loading...</span>
          </div>
        ) : selectedAssetCount === 0 ? (
          <span style={emptyLabelStyle}>Select a photo to view and edit keywords.</span>
        ) : displayedKeywords.length > 0 ? (
          <div style={chipRowStyle}>
            {displayedKeywords.map((keyword) => (
              <Chip
                key={keyword.id}
                label={<KeywordChipLabel keyword={keyword} keywordMap={keywordMap} />}
                size="small"
                title={formatKeywordPathLabel(keyword, keywordMap)}
                onDelete={
                  !updateBusy ? () => void onRemoveKeyword(keyword) : undefined
                }
              />
            ))}
          </div>
        ) : (
          <span style={emptyLabelStyle}>{emptyStateLabel}</span>
        )}
      </div>

      {selectedAssetCount > 0 ? (
        <>
          <div style={dividerStyle} />

          {/* Add keyword input */}
          <div style={addRowStyle}>
            <Autocomplete<KeywordEntry, true, false, true>
              multiple
              freeSolo
              disabled={updateBusy}
              options={addableKeywords}
              value={pendingEntries}
              onChange={(_event, value) => {
                setPendingEntries(dedupeKeywordEntries(value));
              }}
              getOptionLabel={(entry) =>
                typeof entry === 'string' ? entry : formatKeywordPathLabel(entry, keywordMap)
              }
              isOptionEqualToValue={(option, value) =>
                normalizeKeywordLabel(getKeywordEntryLabel(option)) ===
                normalizeKeywordLabel(getKeywordEntryLabel(value))
              }
              filterSelectedOptions
              renderOption={(props, option) => {
                const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key?: React.Key };
                if (typeof option === 'string') {
                  return <li key={key} {...rest}>{option}</li>;
                }
                const pathLabels = getKeywordPathLabels(option, keywordMap);
                const leafName = pathLabels[pathLabels.length - 1] ?? option.label;
                const parentPath = pathLabels.slice(0, -1).join(' / ');
                return (
                  <li key={key} {...rest}>
                    <div style={{ lineHeight: 1.35 }}>
                      {parentPath ? (
                        <div style={{ fontSize: '11px', color: '#aaa' }}>{parentPath}</div>
                      ) : null}
                      <div style={{ fontSize: '13px' }}>{leafName}</div>
                    </div>
                  </li>
                );
              }}
              renderTags={(value, getTagProps) =>
                value.map((entry, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  if (typeof entry === 'string') {
                    return <Chip key={key} {...tagProps} label={entry} size="small" />;
                  }
                  const pathLabels = getKeywordPathLabels(entry, keywordMap);
                  const leafName = pathLabels[pathLabels.length - 1] ?? entry.label;
                  const fullPath = formatKeywordPathLabel(entry, keywordMap);
                  return (
                    <Tooltip key={key} title={fullPath} placement="top">
                      <Chip {...tagProps} label={leafName} size="small" />
                    </Tooltip>
                  );
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Search or type a keyword"
                  inputProps={{
                    ...params.inputProps,
                    style: { fontSize: '12px' }
                  }}
                  sx={{
                    '& .MuiInputBase-root': { paddingTop: '2px', paddingBottom: '2px' },
                    '& .MuiInputBase-input': { paddingTop: '2px', paddingBottom: '2px', fontSize: '12px' }
                  }}
                />
              )}
            />
            <button
              style={
                sanitizedPendingEntries.length > 0 && !updateBusy
                  ? addButtonStyle
                  : addButtonDisabledStyle
              }
              disabled={sanitizedPendingEntries.length === 0 || updateBusy}
              onClick={() => void handleAdd()}
            >
              {updateBusy ? 'Adding…' : addButtonLabel}
            </button>
          </div>

          {/* Recently used suggestions */}
          {visibleRecentKeywords.length > 0 ? (
            <div style={recentSectionStyle}>
              <span style={recentLabelStyle}>Recently used</span>
              <div style={recentChipsStyle}>
                {visibleRecentKeywords.map((keyword) => (
                  <Chip
                    key={keyword.id}
                    label={<KeywordChipLabel keyword={keyword} keywordMap={keywordMap} />}
                    size="small"
                    variant="outlined"
                    title={formatKeywordPathLabel(keyword, keywordMap)}
                    clickable={!updateBusy}
                    onClick={!updateBusy ? () => void onAddKeywords([keyword]) : undefined}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
