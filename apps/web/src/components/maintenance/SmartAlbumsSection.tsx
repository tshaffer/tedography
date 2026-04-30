import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PhotoState, type Keyword, type Person, type SmartAlbum, type SmartAlbumFilterSpec } from '@tedography/domain';
import type { SearchCaptureDateAvailabilityMode } from '@tedography/domain';
import { listKeywords } from '../../api/keywordApi';
import { listPeople } from '../../api/peoplePipelineApi';
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

const smartAlbumBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  border: '1px solid #cfc6ef',
  borderRadius: '999px',
  backgroundColor: '#f3f0ff',
  color: '#4f3792',
  padding: '2px 8px',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.03em'
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
  padding: '10px',
  overflowY: 'auto',
  maxHeight: '480px'
};

const inputStyle: CSSProperties = {
  minWidth: 0,
  width: '100%',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #c8c8c8',
  fontSize: '13px'
};

const multiSelectStyle: CSSProperties = {
  ...inputStyle,
  height: '90px',
  padding: '4px 6px'
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

const fieldGroupStyle: CSSProperties = {
  borderTop: '1px solid #f0f0f0',
  paddingTop: '8px',
  display: 'grid',
  gap: '10px'
};

const fieldGroupTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '11px',
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.04em'
};

const labelRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '6px',
  marginBottom: '4px',
  fontSize: '13px'
};

const matchModeToggleStyle: CSSProperties = {
  display: 'flex',
  border: '1px solid #c8c8c8',
  borderRadius: '4px',
  overflow: 'hidden',
  fontSize: '11px'
};

const matchModeButtonActiveStyle: CSSProperties = {
  padding: '2px 8px',
  backgroundColor: '#5c6bc0',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: '11px'
};

const matchModeButtonInactiveStyle: CSSProperties = {
  padding: '2px 8px',
  backgroundColor: 'transparent',
  color: '#555',
  border: 'none',
  cursor: 'pointer',
  fontSize: '11px'
};

const dateRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px'
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
  personById: Map<string, Person>;
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

  if (input.filterSpec.peopleIds && input.filterSpec.peopleIds.length > 0) {
    const names = input.filterSpec.peopleIds.map((id) => {
      const person = input.personById.get(id);
      return person ? person.displayName : id;
    });
    const mode = input.filterSpec.peopleMatchMode === 'All' ? 'All of' : 'Any of';
    parts.push(`${mode}: ${names.join(', ')}`);
  }

  if (input.filterSpec.excludedPeopleIds && input.filterSpec.excludedPeopleIds.length > 0) {
    parts.push(`Excl. ${input.filterSpec.excludedPeopleIds.length} ${input.filterSpec.excludedPeopleIds.length === 1 ? 'person' : 'people'}`);
  }

  if (input.filterSpec.hasNoPeople) {
    parts.push('No people');
  }

  const from = input.filterSpec.captureDateFrom;
  const to = input.filterSpec.captureDateTo;
  if (from && to) {
    parts.push(`${from} – ${to}`);
  } else if (from) {
    parts.push(`From ${from}`);
  } else if (to) {
    parts.push(`To ${to}`);
  }

  if (input.filterSpec.captureDateAvailability && input.filterSpec.captureDateAvailability !== 'datedOnly') {
    const label = input.filterSpec.captureDateAvailability === 'undatedOnly' ? 'Undated only' : 'Dated or undated';
    parts.push(label);
  }

  return parts.join(' · ');
}

function getMultiSelectValues(event: React.ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions).map((opt) => opt.value);
}

export function SmartAlbumsSection({
  open,
  yearGroups,
  onOpenSmartAlbum,
  onSmartAlbumsChanged
}: SmartAlbumsSectionProps) {
  const [smartAlbums, setSmartAlbums] = useState<SmartAlbum[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSmartAlbumId, setSelectedSmartAlbumId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [keywordId, setKeywordId] = useState('__none__');
  const [photoState, setPhotoState] = useState('__none__');
  const [yearGroupId, setYearGroupId] = useState('__none__');
  const [peopleIds, setPeopleIds] = useState<string[]>([]);
  const [peopleMatchMode, setPeopleMatchMode] = useState<'Any' | 'All'>('Any');
  const [excludedPeopleIds, setExcludedPeopleIds] = useState<string[]>([]);
  const [hasNoPeople, setHasNoPeople] = useState(false);
  const [captureDateFrom, setCaptureDateFrom] = useState('');
  const [captureDateTo, setCaptureDateTo] = useState('');
  const [captureDateAvailability, setCaptureDateAvailability] = useState<'' | SearchCaptureDateAvailabilityMode>('');
  const [actionBusy, setActionBusy] = useState<null | 'save' | 'delete'>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshData(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const [smartAlbumResponse, keywordResponse, peopleResponse] = await Promise.all([
        listSmartAlbums(),
        listKeywords(),
        listPeople()
      ]);
      setSmartAlbums(smartAlbumResponse.items);
      setKeywords(keywordResponse.items);
      setPeople(peopleResponse.items ?? []);
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
  const personById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people]
  );
  const visiblePeople = useMemo(
    () => people.filter((p) => !p.isHidden && !p.isArchived),
    [people]
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
      setPeopleIds([]);
      setPeopleMatchMode('Any');
      setExcludedPeopleIds([]);
      setHasNoPeople(false);
      setCaptureDateFrom('');
      setCaptureDateTo('');
      setCaptureDateAvailability('');
      return;
    }

    const spec = selectedSmartAlbum.filterSpec;
    setLabel(selectedSmartAlbum.label);
    setKeywordId(spec.keywordId ?? '__none__');
    setPhotoState(spec.photoState ?? '__none__');
    setYearGroupId(spec.yearGroupId ?? '__none__');
    setPeopleIds(spec.peopleIds ?? []);
    setPeopleMatchMode(spec.peopleMatchMode === 'All' ? 'All' : 'Any');
    setExcludedPeopleIds(spec.excludedPeopleIds ?? []);
    setHasNoPeople(spec.hasNoPeople === true);
    setCaptureDateFrom(spec.captureDateFrom ?? '');
    setCaptureDateTo(spec.captureDateTo ?? '');
    setCaptureDateAvailability(
      (spec.captureDateAvailability as SearchCaptureDateAvailabilityMode | null | undefined) ?? ''
    );
  }, [selectedSmartAlbum]);

  function buildFilterSpecFromForm(): SmartAlbumFilterSpec {
    return {
      keywordId: keywordId === '__none__' ? null : keywordId,
      photoState: photoState === '__none__' ? null : (photoState as PhotoState),
      yearGroupId: yearGroupId === '__none__' ? null : yearGroupId,
      peopleIds: peopleIds.length > 0 ? peopleIds : null,
      peopleMatchMode: peopleIds.length > 0 ? peopleMatchMode : null,
      excludedPeopleIds: excludedPeopleIds.length > 0 ? excludedPeopleIds : null,
      hasNoPeople: hasNoPeople || null,
      captureDateFrom: captureDateFrom.trim() || null,
      captureDateTo: captureDateTo.trim() || null,
      captureDateAvailability: captureDateAvailability || null
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
                    <span style={smartAlbumBadgeStyle}>Saved filters</span>
                    <strong>{item.label}</strong>
                    <span style={{ ...mutedTextStyle, margin: 0 }}>
                      {formatSmartAlbumFilterSummary({
                        filterSpec: item.filterSpec,
                        keywordMap,
                        yearGroupById,
                        personById
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
                  <span style={smartAlbumBadgeStyle}>Smart Album</span>
                  <div style={{ marginTop: '6px' }}>
                    <strong>{selectedSmartAlbum.label}</strong>
                  </div>
                  <p style={{ ...mutedTextStyle, marginTop: '4px' }}>
                    Edit these saved filters or open them in Search. This is separate from manual albums.
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

                {/* Keyword / Photo State / Year Group */}
                <div style={fieldGroupStyle}>
                  <p style={fieldGroupTitleStyle}>Content Filters</p>
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
                </div>

                {/* People Filters */}
                <div style={fieldGroupStyle}>
                  <p style={fieldGroupTitleStyle}>People Filters</p>
                  <div>
                    <div style={labelRowStyle}>
                      <span>Include People</span>
                      <div style={matchModeToggleStyle}>
                        <button
                          type="button"
                          style={peopleMatchMode === 'Any' ? matchModeButtonActiveStyle : matchModeButtonInactiveStyle}
                          onClick={() => setPeopleMatchMode('Any')}
                        >
                          Any
                        </button>
                        <button
                          type="button"
                          style={peopleMatchMode === 'All' ? matchModeButtonActiveStyle : matchModeButtonInactiveStyle}
                          onClick={() => setPeopleMatchMode('All')}
                        >
                          All
                        </button>
                      </div>
                    </div>
                    <select
                      multiple
                      value={peopleIds}
                      onChange={(event) => setPeopleIds(getMultiSelectValues(event))}
                      style={multiSelectStyle}
                    >
                      {visiblePeople.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.displayName}
                        </option>
                      ))}
                    </select>
                    <p style={{ ...mutedTextStyle, marginTop: '3px' }}>Hold Cmd/Ctrl to select multiple</p>
                  </div>
                  <div>
                    <div style={{ ...labelRowStyle, marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px' }}>Exclude People</span>
                    </div>
                    <select
                      multiple
                      value={excludedPeopleIds}
                      onChange={(event) => setExcludedPeopleIds(getMultiSelectValues(event))}
                      style={multiSelectStyle}
                    >
                      {visiblePeople.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={hasNoPeople}
                      onChange={(event) => setHasNoPeople(event.target.checked)}
                    />
                    Has no people
                  </label>
                </div>

                {/* Date Filters */}
                <div style={fieldGroupStyle}>
                  <p style={fieldGroupTitleStyle}>Date Filters</p>
                  <div style={dateRowStyle}>
                    <label style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ fontSize: '13px' }}>From</span>
                      <input
                        type="date"
                        value={captureDateFrom}
                        onChange={(event) => setCaptureDateFrom(event.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '4px' }}>
                      <span style={{ fontSize: '13px' }}>To</span>
                      <input
                        type="date"
                        value={captureDateTo}
                        onChange={(event) => setCaptureDateTo(event.target.value)}
                        style={inputStyle}
                      />
                    </label>
                  </div>
                  <label style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '13px' }}>Date Availability</span>
                    <select
                      value={captureDateAvailability}
                      onChange={(event) => setCaptureDateAvailability(event.target.value as '' | SearchCaptureDateAvailabilityMode)}
                      style={inputStyle}
                    >
                      <option value="">Any</option>
                      <option value="datedOnly">Dated only</option>
                      <option value="datedOrUndated">Dated or undated</option>
                      <option value="undatedOnly">Undated only</option>
                    </select>
                  </label>
                </div>

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
                    Open Saved Filters in Search
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
