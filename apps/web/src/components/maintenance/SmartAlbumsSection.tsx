import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PhotoState, type Keyword, type SmartAlbum, type SmartAlbumFilterSpec } from '@tedography/domain';
import { listKeywords } from '../../api/keywordApi';
import {
  deleteSmartAlbum,
  listSmartAlbums,
  updateSmartAlbum
} from '../../api/smartAlbumApi';
import { buildKeywordMap, formatKeywordPathLabel } from '../../utilities/keywords';

const sectionStyle: CSSProperties = {
  borderTop: '1px solid #efefef',
  paddingTop: '12px',
  marginTop: '12px'
};

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '14px'
};

const mutedTextStyle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  color: '#666'
};

const panelStyle: CSSProperties = {
  border: '1px solid #d8d8d8',
  borderRadius: '10px',
  backgroundColor: '#fff',
  display: 'grid',
  gap: '12px',
  padding: '12px'
};

const bodyStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 0.9fr)',
  gap: '12px',
  minHeight: 0
};

const listStyle: CSSProperties = {
  border: '1px solid #ececec',
  borderRadius: '8px',
  minHeight: '220px',
  maxHeight: '360px',
  overflow: 'auto',
  display: 'grid',
  gap: '6px',
  padding: '10px'
};

const listButtonStyle: CSSProperties = {
  border: '1px solid transparent',
  borderRadius: '8px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  padding: '8px 10px',
  textAlign: 'left',
  display: 'grid',
  gap: '4px'
};

const selectedListButtonStyle: CSSProperties = {
  ...listButtonStyle,
  backgroundColor: '#eef4ff',
  borderColor: '#c7dafd'
};

const detailPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  border: '1px solid #ececec',
  borderRadius: '8px',
  padding: '10px'
};

const inputStyle: CSSProperties = {
  minWidth: 0,
  width: '100%',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #c8c8c8',
  fontSize: '13px'
};

const buttonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px'
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

const controlRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap'
};

type YearGroupOption = {
  id: string;
  label: string;
};

interface SmartAlbumsSectionProps {
  open: boolean;
  yearGroups: YearGroupOption[];
  onOpenSmartAlbum?: ((smartAlbum: SmartAlbum) => void) | undefined;
  onSmartAlbumsChanged?: (() => void) | undefined;
}

function formatSmartAlbumFilterSummary(input: {
  filterSpec: SmartAlbumFilterSpec;
  keywordMap: Map<string, Keyword>;
  yearGroupById: Map<string, YearGroupOption>;
}): string {
  const parts: string[] = [];

  if (input.filterSpec.keywordId) {
    const keyword = input.keywordMap.get(input.filterSpec.keywordId);
    parts.push(keyword ? formatKeywordPathLabel(keyword, input.keywordMap) : `Keyword ${input.filterSpec.keywordId}`);
  }

  if (input.filterSpec.photoState) {
    parts.push(input.filterSpec.photoState);
  }

  if (input.filterSpec.yearGroupId) {
    const yearGroup = input.yearGroupById.get(input.filterSpec.yearGroupId);
    parts.push(yearGroup ? yearGroup.label : `Year ${input.filterSpec.yearGroupId}`);
  }

  return parts.join(' · ');
}

export function SmartAlbumsSection({
  open,
  yearGroups,
  onOpenSmartAlbum,
  onSmartAlbumsChanged
}: SmartAlbumsSectionProps) {
  const [smartAlbums, setSmartAlbums] = useState<SmartAlbum[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSmartAlbumId, setSelectedSmartAlbumId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [keywordId, setKeywordId] = useState('__none__');
  const [photoState, setPhotoState] = useState('__none__');
  const [yearGroupId, setYearGroupId] = useState('__none__');
  const [actionBusy, setActionBusy] = useState<null | 'save' | 'delete'>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshData(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const [smartAlbumResponse, keywordResponse] = await Promise.all([listSmartAlbums(), listKeywords()]);
      setSmartAlbums(smartAlbumResponse.items);
      setKeywords(keywordResponse.items);
      setSelectedSmartAlbumId((current) =>
        current && smartAlbumResponse.items.some((item) => item.id === current) ? current : smartAlbumResponse.items[0]?.id ?? null
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to load Smart Albums');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    void refreshData();
  }, [open]);

  const keywordMap = useMemo(() => buildKeywordMap(keywords), [keywords]);
  const yearGroupById = useMemo(
    () => new Map(yearGroups.map((group) => [group.id, group])),
    [yearGroups]
  );
  const selectedSmartAlbum = useMemo(
    () => (selectedSmartAlbumId ? smartAlbums.find((item) => item.id === selectedSmartAlbumId) ?? null : null),
    [selectedSmartAlbumId, smartAlbums]
  );

  useEffect(() => {
    setNotice(null);
    if (!selectedSmartAlbum) {
      setLabel('');
      setKeywordId('__none__');
      setPhotoState('__none__');
      setYearGroupId('__none__');
      return;
    }

    setLabel(selectedSmartAlbum.label);
    setKeywordId(selectedSmartAlbum.filterSpec.keywordId ?? '__none__');
    setPhotoState(selectedSmartAlbum.filterSpec.photoState ?? '__none__');
    setYearGroupId(selectedSmartAlbum.filterSpec.yearGroupId ?? '__none__');
  }, [selectedSmartAlbum]);

  function buildFilterSpecFromForm(): SmartAlbumFilterSpec {
    return {
      keywordId: keywordId === '__none__' ? null : keywordId,
      photoState: photoState === '__none__' ? null : (photoState as PhotoState),
      yearGroupId: yearGroupId === '__none__' ? null : yearGroupId
    };
  }

  async function handleSave(): Promise<void> {
    if (!selectedSmartAlbum) {
      return;
    }

    const trimmedLabel = label.trim().replace(/\s+/g, ' ');
    if (trimmedLabel.length === 0) {
      setError('Label is required.');
      return;
    }

    setActionBusy('save');
    setError(null);
    setNotice(null);

    try {
      const response = await updateSmartAlbum(selectedSmartAlbum.id, {
        label: trimmedLabel,
        filterSpec: buildFilterSpecFromForm()
      });
      setSmartAlbums((previous) =>
        previous
          .map((item) => (item.id === response.item.id ? response.item : item))
          .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }))
      );
      setSelectedSmartAlbumId(response.item.id);
      setNotice(`Updated Smart Album "${response.item.label}".`);
      onSmartAlbumsChanged?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update Smart Album');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!selectedSmartAlbum) {
      return;
    }

    if (!window.confirm(`Delete Smart Album "${selectedSmartAlbum.label}"?`)) {
      return;
    }

    setActionBusy('delete');
    setError(null);
    setNotice(null);

    try {
      await deleteSmartAlbum(selectedSmartAlbum.id);
      setSmartAlbums((previous) => previous.filter((item) => item.id !== selectedSmartAlbum.id));
      setSelectedSmartAlbumId((previous) => (previous === selectedSmartAlbum.id ? null : previous));
      setNotice(`Deleted Smart Album "${selectedSmartAlbum.label}".`);
      onSmartAlbumsChanged?.();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete Smart Album');
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <section style={sectionStyle}>
      <h3 style={sectionTitleStyle}>Smart Albums</h3>
      <p style={mutedTextStyle}>
        Smart Albums are saved searches. They stay separate from manual albums and reopen in Search with their saved filters.
      </p>
      <div style={panelStyle}>
        <div style={bodyStyle}>
          <div style={listStyle}>
            {loading ? <p style={mutedTextStyle}>Loading Smart Albums...</p> : null}
            {!loading && smartAlbums.length === 0 ? (
              <p style={mutedTextStyle}>No Smart Albums exist yet. Save one from Search.</p>
            ) : null}
            {!loading
              ? smartAlbums.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    style={selectedSmartAlbumId === item.id ? selectedListButtonStyle : listButtonStyle}
                    onClick={() => setSelectedSmartAlbumId(item.id)}
                    title={item.label}
                  >
                    <strong>{item.label}</strong>
                    <span style={{ ...mutedTextStyle, margin: 0 }}>
                      {formatSmartAlbumFilterSummary({
                        filterSpec: item.filterSpec,
                        keywordMap,
                        yearGroupById
                      })}
                    </span>
                  </button>
                ))
              : null}
          </div>
          <div style={detailPanelStyle}>
            {selectedSmartAlbum ? (
              <>
                <div>
                  <strong>{selectedSmartAlbum.label}</strong>
                  <p style={{ ...mutedTextStyle, marginTop: '4px' }}>
                    Edit this saved search or open it in Search.
                  </p>
                </div>
                <label style={{ display: 'grid', gap: '4px' }}>
                  Label
                  <input
                    type="text"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    style={inputStyle}
                    placeholder="Smart Album label"
                  />
                </label>
                <label style={{ display: 'grid', gap: '4px' }}>
                  Keyword
                  <select
                    value={keywordId}
                    onChange={(event) => setKeywordId(event.target.value)}
                    style={inputStyle}
                  >
                    <option value="__none__">None</option>
                    {keywords.map((keyword) => (
                      <option key={keyword.id} value={keyword.id}>
                        {formatKeywordPathLabel(keyword, keywordMap)}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: '4px' }}>
                  Photo State
                  <select
                    value={photoState}
                    onChange={(event) => setPhotoState(event.target.value)}
                    style={inputStyle}
                  >
                    <option value="__none__">Any</option>
                    {Object.values(PhotoState).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: '4px' }}>
                  Year Group
                  <select
                    value={yearGroupId}
                    onChange={(event) => setYearGroupId(event.target.value)}
                    style={inputStyle}
                  >
                    <option value="__none__">Any</option>
                    {yearGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={controlRowStyle}>
                  <button
                    type="button"
                    style={actionBusy === null ? buttonStyle : disabledButtonStyle}
                    disabled={actionBusy !== null}
                    onClick={() => void handleSave()}
                  >
                    {actionBusy === 'save' ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    style={actionBusy === null ? buttonStyle : disabledButtonStyle}
                    disabled={actionBusy !== null}
                    onClick={() => onOpenSmartAlbum?.(selectedSmartAlbum)}
                  >
                    Open in Search
                  </button>
                  <button
                    type="button"
                    style={actionBusy === null ? buttonStyle : disabledButtonStyle}
                    disabled={actionBusy !== null}
                    onClick={() => void handleDelete()}
                  >
                    {actionBusy === 'delete' ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </>
            ) : (
              <p style={mutedTextStyle}>Select a Smart Album to edit or open it.</p>
            )}
            {notice ? <p style={{ color: '#2f6f3e', margin: 0, fontSize: '12px' }}>{notice}</p> : null}
            {error ? <p style={{ color: '#b00020', margin: 0, fontSize: '12px' }}>{error}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
