import type { ReactElement } from 'react';

export function App(): ReactElement {
  return (
    <main style={{ fontFamily: 'Arial, sans-serif', padding: '24px' }}>
      <h1>Duplicate Review</h1>
      <p>Near-duplicate review UI is intentionally separate from the main Tedography app.</p>
      <p>Phase 1 only provides descriptor extraction and CLI groundwork.</p>
    </main>
  );
}
