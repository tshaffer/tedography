import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import {
  EDIT_TYPE_LABELS,
  type EditLookupMatchField,
  type EditLookupResponse,
  type EditLookupResult
} from '@tedography/domain';
import { lookupEditQueueAndHistory } from '../../api/editQueueApi';

interface EditLookupDialogProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (assetId: string, albumId: string | null) => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px', zIndex: 1300,
};

const dialogStyle: CSSProperties = {
  width: 'min(720px, 94vw)', height: 'min(80vh, 720px)',
  borderRadius: '12px', border: '1px solid #d8d8d8',
  backgroundColor: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  padding: '16px 18px 12px', borderBottom: '1px solid #ececec',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const titleStyle: CSSProperties = { margin: 0, fontSize: '16px', fontWeight: 600, color: '#1f2937' };

const closeButtonStyle: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#9ca3af', fontSize: '20px', padding: '0 2px', lineHeight: 1,
};

const searchAreaStyle: CSSProperties = {
  padding: '12px 18px 8px', display: 'flex', flexDirection: 'column', gap: '6px',
  borderBottom: '1px solid #f3f4f6',
};

const searchInputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', fontSize: '14px', padding: '8px 10px',
  border: '1px solid #93c5fd', borderRadius: '6px', outline: 'none',
};

const hintStyle: CSSProperties = { fontSize: '11px', color: '#6b7280', lineHeight: 1.4 };

const bodyStyle: CSSProperties = {
  padding: '10px 18px 14px', overflowY: 'auto', flex: '1 1 auto',
  display: 'flex', flexDirection: 'column', gap: '8px',
};

const summaryStyle: CSSProperties = { fontSize: '12px', color: '#6b7280' };

const resultStyle: CSSProperties = {
  padding: '8px 10px', borderRadius: '6px', border: '1px solid #e5e7eb',
  backgroundColor: '#fafafa', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px',
};

const resultHeaderStyle: CSSProperties = {
  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px',
};

const filenameStyle: CSSProperties = {
  fontWeight: 600, fontSize: '13px', color: '#111827', minWidth: 0,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const pathStyle: CSSProperties = { color: '#6b7280', overflowWrap: 'anywhere' };

const showButtonStyle: CSSProperties = {
  flex: '0 0 auto', padding: '2px 8px', fontSize: '11px', borderRadius: '5px',
  border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer', color: '#1a56db',
};

const queueChipStyle: CSSProperties = {
  alignSelf: 'flex-start', fontSize: '11px', fontWeight: 600, color: '#7e22ce',
  backgroundColor: '#f3e8ff', borderRadius: '10px', padding: '1px 8px',
};

const historyLineStyle: CSSProperties = { color: '#374151', overflowWrap: 'anywhere' };

const MATCH_FIELD_LABELS: Record<EditLookupMatchField, string> = {
  filename: 'filename',
  editedFilename: 'edited filename',
  folder: 'folder',
  album: 'album',
  note: 'note',
};

const SEARCH_DEBOUNCE_MS = 250;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function describeHistory(item: EditLookupResult['history'][number]): string {
  const method = item.editMethod === 'ai' ? 'AI' : item.editMethod === 'manual' ? 'manual' : null;
  const parts = [
    `Edited ${formatDate(item.processedAt)}`,
    method,
    item.status === 'failed' ? 'FAILED' : null,
    item.archived ? 'archived' : null,
  ].filter((part): part is string => part != null);
  return `${parts.join(' · ')} → ${item.editedFilename}`;
}

export function EditLookupDialog({ open, onClose, onNavigate }: EditLookupDialogProps): ReactElement | null {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<EditLookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Search as the user types, a moment after they pause. Superseded requests
  // are aborted so a slow earlier response can't overwrite a newer one.
  useEffect(() => {
    if (!open) {
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResponse(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      lookupEditQueueAndHistory(trimmed, controller.signal)
        .then((result) => {
          setResponse(result);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          setError(err instanceof Error ? err.message : 'Search failed');
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const results = response?.results ?? [];

  return (
    <div style={overlayStyle} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div style={dialogStyle} role="dialog" aria-label="Find in Edit Queue and History">
        <div style={headerStyle}>
          <h2 style={titleStyle}>Find in Edit Queue &amp; History</h2>
          <button type="button" style={closeButtonStyle} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div style={searchAreaStyle}>
          <input
            ref={inputRef}
            type="text"
            style={searchInputStyle}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filename, folder, or album — e.g. IMG_53*  or  Yosemite"
            spellCheck={false}
            autoComplete="off"
          />
          <span style={hintStyle}>
            <strong>*</strong> matches any text, <strong>?</strong> matches one character; case doesn&rsquo;t matter and
            text can match anywhere. Searches the source and edited filenames (a different extension is fine), the
            photo&rsquo;s folder, its album, and notes.
          </span>
        </div>
        <div style={bodyStyle}>
          {error ? <span style={{ ...summaryStyle, color: '#b91c1c' }}>{error}</span> : null}
          {!error && response == null && !loading ? (
            <span style={summaryStyle}>Type to search the current Edit Queue and the full Edit History.</span>
          ) : null}
          {!error && response != null ? (
            <span style={summaryStyle}>
              {loading ? 'Searching… ' : ''}
              {response.totalMatches === 0
                ? 'No photos in the Edit Queue or Edit History match.'
                : `${response.totalMatches} photo${response.totalMatches === 1 ? '' : 's'}${
                    response.truncated ? ` (showing the first ${results.length} — narrow the search)` : ''
                  }`}
            </span>
          ) : null}
          {results.map((result) => (
            <div key={result.assetId} style={resultStyle}>
              <div style={resultHeaderStyle}>
                <span style={filenameStyle} title={result.filename}>{result.filename}</span>
                {result.assetExists ? (
                  <button
                    type="button"
                    style={showButtonStyle}
                    onClick={() => onNavigate(result.assetId, result.albumId)}
                    title="Show this photo in the Library"
                  >
                    Show in Library
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>photo no longer in library</span>
                )}
              </div>
              {result.folder || result.albumPath ? (
                <div style={pathStyle}>
                  {result.folder ? <span>Folder: {result.folder}</span> : null}
                  {result.folder && result.albumPath ? <span> · </span> : null}
                  {result.albumPath ? <span>Album: {result.albumPath}</span> : null}
                </div>
              ) : null}
              {result.queue ? (
                <span style={queueChipStyle}>
                  In Edit Queue · {EDIT_TYPE_LABELS[result.queue.editType]} · added {formatDate(result.queue.createdAt)}
                  {result.queue.note ? ` · “${result.queue.note}”` : ''}
                </span>
              ) : null}
              {result.history.map((item) => (
                <div key={item.id} style={historyLineStyle}>
                  {describeHistory(item)}
                  {item.note ? ` · “${item.note}”` : ''}
                </div>
              ))}
              <span style={{ fontSize: '10px', color: '#9ca3af' }}>
                matched on {result.matchedOn.map((field) => MATCH_FIELD_LABELS[field]).join(', ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
