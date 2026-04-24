import { useMemo, useState, type CSSProperties } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import type { Keyword } from '@tedography/domain';
import { buildKeywordMap, formatKeywordPathLabel } from '../../utilities/keywords';

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

const helperTextStyle: CSSProperties = {
  margin: '0 0 10px',
  color: '#666',
  fontSize: '12px',
  lineHeight: 1.4
};

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  minHeight: '32px',
  marginBottom: '10px'
};

const addControlsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '8px',
  alignItems: 'start'
};

const loadingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  color: '#666',
  fontSize: '12px',
  marginBottom: '10px'
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
  const displayModeLabel = selectedAssetCount > 1 ? 'Common Keywords' : 'Keywords';
  const helperText =
    selectedAssetCount === 0
      ? 'Select one or more photos to view and edit keywords.'
      : selectedAssetCount === 1
        ? 'Add keywords to the selected photo, or remove them from the chips below.'
        : 'Showing only keywords common to all selected photos. Add applies to all selected photos.';

  const addButtonLabel = selectedAssetCount > 1 ? 'Add to Selected' : 'Add Keyword';
  const emptyStateLabel =
    selectedAssetCount > 1 ? 'No common keywords' : 'No keywords';
  const keywordMap = useMemo(() => buildKeywordMap(allKeywords), [allKeywords]);
  const visibleRecentKeywords = useMemo(
    () =>
      recentKeywords.filter(
        (keyword) => !displayedKeywords.some((displayedKeyword) => displayedKeyword.id === keyword.id)
      ),
    [displayedKeywords, recentKeywords]
  );
  const sanitizedPendingEntries = useMemo(
    () => dedupeKeywordEntries(pendingEntries),
    [pendingEntries]
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
      <h3 style={titleStyle}>{displayModeLabel}</h3>
      <p style={helperTextStyle}>{helperText}</p>
      {keywordsLoading ? (
        <div style={loadingRowStyle}>
          <CircularProgress size={14} />
          <span>Loading keywords...</span>
        </div>
      ) : null}
      {keywordsError ? (
        <p style={{ ...helperTextStyle, color: '#a12622' }}>{keywordsError}</p>
      ) : null}
      {visibleRecentKeywords.length > 0 ? (
        <>
          <p style={{ ...helperTextStyle, marginBottom: '6px' }}>Recent Keywords</p>
          <div style={chipRowStyle}>
            {visibleRecentKeywords.map((keyword) => (
              <Chip
                key={keyword.id}
                label={formatKeywordPathLabel(keyword, keywordMap)}
                size="small"
                clickable={selectedAssetCount > 0 && !updateBusy}
                onClick={
                  selectedAssetCount > 0 && !updateBusy
                    ? () => {
                        void onAddKeywords([keyword]);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </>
      ) : null}
      <div style={chipRowStyle}>
        {displayedKeywords.length > 0 ? (
          displayedKeywords.map((keyword) => (
            <Chip
              key={keyword.id}
              label={formatKeywordPathLabel(keyword, keywordMap)}
              size="small"
              onDelete={
                selectedAssetCount > 0 && !updateBusy
                  ? () => {
                      void onRemoveKeyword(keyword);
                    }
                  : undefined
              }
            />
          ))
        ) : (
          <span style={{ color: '#666', fontSize: '12px' }}>{emptyStateLabel}</span>
        )}
      </div>
      <div style={addControlsStyle}>
        <Autocomplete<KeywordEntry, true, false, true>
          multiple
          freeSolo
          disabled={selectedAssetCount === 0 || updateBusy}
          options={allKeywords}
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
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label={selectedAssetCount > 0 ? 'Add Keywords' : 'Select assets first'}
              placeholder={selectedAssetCount > 0 ? 'Type or select keywords' : ''}
            />
          )}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={() => void handleAdd()}
          disabled={selectedAssetCount === 0 || updateBusy || sanitizedPendingEntries.length === 0}
          style={{ minWidth: '124px', height: '40px' }}
        >
          {updateBusy ? 'Working...' : addButtonLabel}
        </Button>
      </div>
    </section>
  );
}
