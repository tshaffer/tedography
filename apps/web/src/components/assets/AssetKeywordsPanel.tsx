import { useMemo, useState, type CSSProperties } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import type { Keyword } from '@tedography/domain';
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
  keywordsLoading?: boolean;
  keywordsError?: string | null;
  updateBusy?: boolean;
  onAddKeywords: (entries: KeywordEntry[]) => Promise<boolean>;
  onRemoveKeyword: (keyword: Keyword) => Promise<void>;
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
  keywordsLoading = false,
  keywordsError = null,
  updateBusy = false,
  onAddKeywords,
  onRemoveKeyword
}: AssetKeywordsPanelProps) {
  const [pendingEntries, setPendingEntries] = useState<KeywordEntry[]>([]);

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
