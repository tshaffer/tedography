import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type KeyboardEvent,
} from 'react';
import type { TedographyUser } from '@tedography/domain';
import { getPublicUsers } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';

const PASSCODE_LENGTH = 4;

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  background: '#1a1a2e',
  color: '#eee',
  fontFamily: 'system-ui, sans-serif',
  userSelect: 'none',
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: 2,
  marginBottom: 32,
  color: '#c9d1d9',
};

const userPickerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  marginBottom: 32,
  flexWrap: 'wrap',
  justifyContent: 'center',
};

function userBtnStyle(selected: boolean): React.CSSProperties {
  return {
    padding: '10px 22px',
    borderRadius: 8,
    border: selected ? '2px solid #58a6ff' : '2px solid #444',
    background: selected ? '#1f3a5f' : '#16213e',
    color: selected ? '#e0efff' : '#aaa',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: selected ? 600 : 400,
    transition: 'all 0.15s',
  };
}

const pinDisplayStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginBottom: 24,
};

function pinDotStyle(filled: boolean): React.CSSProperties {
  return {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid #58a6ff',
    background: filled ? '#58a6ff' : 'transparent',
    transition: 'background 0.1s',
  };
}

const keypadStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 10,
  marginBottom: 16,
};

const keyStyle: React.CSSProperties = {
  width: 68,
  height: 52,
  borderRadius: 8,
  border: '1px solid #333',
  background: '#16213e',
  color: '#ddd',
  fontSize: 20,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.1s',
};

const errorStyle: React.CSSProperties = {
  color: '#f85149',
  fontSize: 14,
  marginTop: 4,
  minHeight: 20,
};

export function LoginScreen(): ReactElement {
  const { login } = useAuth();
  const [users, setUsers] = useState<TedographyUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<TedographyUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pinRef = useRef(pin);
  pinRef.current = pin;

  useEffect(() => {
    // Load user list — the /api/auth/users endpoint requires auth,
    // so we keep a lightweight public endpoint for just user names.
    // For now we call the same endpoint; it will 401 when not authed.
    // We fall back gracefully: if the list is empty, show a manual ID input.
    getPublicUsers()
      .then(({ users: all }) => {
        setUsers(all);
        if (all.length === 1 && all[0]) {
          setSelectedUser(all[0]);
        }
      })
      .catch(() => {
        // Not yet authed — user list will be empty; we show a text input instead
        setUsers([]);
      });
  }, []);

  const appendDigit = useCallback((d: string) => {
    setError('');
    setPin((prev) => (prev.length < PASSCODE_LENGTH ? prev + d : prev));
  }, []);

  const deleteDigit = useCallback(() => {
    setError('');
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const submit = useCallback(async (userId: string, currentPin: string) => {
    if (currentPin.length < PASSCODE_LENGTH) return;
    setSubmitting(true);
    try {
      await login(userId, currentPin);
    } catch {
      setError('Incorrect passcode. Try again.');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  }, [login]);

  // Auto-submit when PIN reaches the required length
  useEffect(() => {
    if (pin.length === PASSCODE_LENGTH && selectedUser && !submitting) {
      void submit(selectedUser.id, pin);
    }
  }, [pin, selectedUser, submitting, submit]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        appendDigit(e.key);
      } else if (e.key === 'Backspace') {
        deleteDigit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [appendDigit, deleteDigit]);

  const [manualId, setManualId] = useState('');
  const activeUserId = selectedUser?.id ?? manualId;

  const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <div style={rootStyle}>
      <div style={titleStyle}>Tedography</div>

      {users.length > 0 ? (
        <div style={userPickerStyle}>
          {users.map((u) => (
            <button
              key={u.id}
              style={userBtnStyle(selectedUser?.id === u.id)}
              onClick={() => { setSelectedUser(u); setPin(''); setError(''); }}
            >
              {u.name}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <input
            placeholder="Your user ID"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid #444',
              background: '#16213e',
              color: '#eee',
              fontSize: 15,
            }}
          />
        </div>
      )}

      {activeUserId && (
        <>
          <div style={pinDisplayStyle}>
            {Array.from({ length: PASSCODE_LENGTH }).map((_, i) => (
              <div key={i} style={pinDotStyle(i < pin.length)} />
            ))}
          </div>

          <div style={keypadStyle}>
            {keypadKeys.map((k, i) => (
              <div
                key={i}
                style={{ ...keyStyle, visibility: k === '' ? 'hidden' : 'visible', opacity: submitting ? 0.5 : 1 }}
                onClick={() => {
                  if (submitting) return;
                  if (k === '⌫') deleteDigit();
                  else if (k !== '') appendDigit(k);
                }}
              >
                {k}
              </div>
            ))}
          </div>

          <div style={errorStyle}>{error}</div>
        </>
      )}
    </div>
  );
}
