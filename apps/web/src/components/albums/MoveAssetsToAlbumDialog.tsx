import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import type { AlbumTreeNode } from '@tedography/domain';

interface MoveAssetsToAlbumDialogProps {
  open: boolean;
  albums: AlbumTreeNode[];
  sourceAlbum: AlbumTreeNode | null;
  selectedAssetCount: number;
  onClose: () => void;
  onMove: (input: { destinationAlbumId: string; keepInSourceAlbum: boolean }) => Promise<void>;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1300
};

const dialogStyle: CSSProperties = {
  width: 'min(520px, 92vw)',
  maxHeight: 'min(720px, 90vh)',
  borderRadius: '12px',
  border: '1px solid #d8d8d8',
  backgroundColor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const headerStyle: CSSProperties = {
  padding: '16px 18px 12px',
  borderBottom: '1px solid #ececec'
};

const bodyStyle: CSSProperties = {
  padding: '16px 18px',
  overflow: 'auto',
  display: 'grid',
  gap: '14px'
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 18px',
  borderTop: '1px solid #ececec'
};

const fieldLabelStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  fontSize: '13px',
  color: '#444'
};

const inputStyle: CSSProperties = {
  border: '1px solid #c8c8c8',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px',
  backgroundColor: '#fff'
};

const chooserPanelStyle: CSSProperties = {
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '10px',
  maxHeight: '320px',
  overflow: 'auto',
  backgroundColor: '#fbfbfb'
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: '30px'
};

const expandButtonStyle: CSSProperties = {
  width: '24px',
  height: '24px',
  border: '1px solid #d0d0d0',
  borderRadius: '6px',
  backgroundColor: '#f7f7f7',
  cursor: 'pointer',
  padding: 0,
  fontSize: '12px'
};

const spacerStyle: CSSProperties = {
  width: '24px',
  height: '24px'
};

const destinationRowStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  border: 'none',
  borderRadius: '8px',
  backgroundColor: 'transparent',
  padding: '6px 8px',
  textAlign: 'left',
  fontSize: '13px',
  userSelect: 'none'
};

const selectedDestinationRowStyle: CSSProperties = {
  backgroundColor: '#eef4ff',
  boxShadow: 'inset 0 0 0 1px #c7dafd'
};

const disabledDestinationRowStyle: CSSProperties = {
  color: '#999',
  cursor: 'not-allowed'
};

type AlbumTreeNodeWithDepth = AlbumTreeNode & {
  depth: number;
};

const lastMoveTargetAlbumStorageKey = 'tedography.moveAssetsToAlbum.lastTargetAlbumId';

const checkboxRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  color: '#444'
};

const buttonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px'
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#1f6feb',
  borderColor: '#1f6feb',
  color: '#fff'
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.55,
  cursor: 'not-allowed'
};

function buildAlbumPathLabel(album: AlbumTreeNode, nodesById: Map<string, AlbumTreeNode>): string {
  const labels: string[] = [album.label];
  let currentParentId = album.parentId;

  while (currentParentId) {
    const currentNode = nodesById.get(currentParentId);
    if (!currentNode) {
      break;
    }

    labels.unshift(currentNode.label);
    currentParentId = currentNode.parentId;
  }

  return labels.join(' / ');
}

function buildAlbumTreeDisplayList(
  nodes: AlbumTreeNode[],
  expandedGroupIds: string[]
): AlbumTreeNodeWithDepth[] {
  const expandedSet = new Set(expandedGroupIds);
  const childrenByParent = new Map<string | null, AlbumTreeNode[]>();

  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.label.localeCompare(right.label);
    });
  }

  const ordered: AlbumTreeNodeWithDepth[] = [];

  function appendChildren(parentId: string | null, depth: number): void {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      ordered.push({ ...child, depth });
      if (child.nodeType === 'Group' && expandedSet.has(child.id)) {
        appendChildren(child.id, depth + 1);
      }
    }
  }

  appendChildren(null, 0);
  return ordered;
}

function getAncestorGroupIds(nodesById: Map<string, AlbumTreeNode>, node: AlbumTreeNode | null): string[] {
  const expanded: string[] = [];
  let currentParentId = node?.parentId ?? null;

  while (currentParentId) {
    const currentNode = nodesById.get(currentParentId);
    if (!currentNode) {
      break;
    }

    if (currentNode.nodeType === 'Group') {
      expanded.push(currentNode.id);
    }

    currentParentId = currentNode.parentId;
  }

  return expanded;
}

function getInitialExpandedGroupIds(nodes: AlbumTreeNode[], destinationAlbum: AlbumTreeNode | null): string[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const expanded = new Set<string>();

  for (const groupId of getAncestorGroupIds(nodesById, destinationAlbum)) {
    expanded.add(groupId);
  }

  return Array.from(expanded);
}

export function MoveAssetsToAlbumDialog({
  open,
  albums,
  sourceAlbum,
  selectedAssetCount,
  onClose,
  onMove
}: MoveAssetsToAlbumDialogProps): ReactElement | null {
  const [destinationAlbumId, setDestinationAlbumId] = useState('');
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [keepInSourceAlbum, setKeepInSourceAlbum] = useState(false);
  const [movePending, setMovePending] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const nodesById = useMemo(() => new Map(albums.map((album) => [album.id, album])), [albums]);
  const destinationAlbums = useMemo(
    () => albums.filter((album) => album.id !== sourceAlbum?.id),
    [albums, sourceAlbum]
  );
  const displayNodes = useMemo(
    () => buildAlbumTreeDisplayList(albums, expandedGroupIds),
    [albums, expandedGroupIds]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const storedDestinationAlbumId = window.localStorage.getItem(lastMoveTargetAlbumStorageKey) ?? '';
    const initialDestinationAlbum =
      destinationAlbums.find((album) => album.id === storedDestinationAlbumId) ?? destinationAlbums[0] ?? null;

    setDestinationAlbumId(initialDestinationAlbum?.id ?? '');
    setExpandedGroupIds(getInitialExpandedGroupIds(albums, initialDestinationAlbum));
    setKeepInSourceAlbum(false);
    setMovePending(false);
    setMoveError(null);
  }, [albums, destinationAlbums, open]);

  if (!open || !sourceAlbum) {
    return null;
  }

  const canMove = destinationAlbumId.length > 0 && !movePending;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>Move Assets To Album</h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#666' }}>
            Move {selectedAssetCount} selected {selectedAssetCount === 1 ? 'asset' : 'assets'} from{' '}
            <strong>{sourceAlbum.label}</strong>.
          </p>
        </div>

        <div style={bodyStyle}>
          <label style={fieldLabelStyle}>
            <span>From album</span>
            <input type="text" value={buildAlbumPathLabel(sourceAlbum, nodesById)} readOnly style={inputStyle} />
          </label>

          <div style={fieldLabelStyle}>
            <span>To album</span>
            <div style={chooserPanelStyle}>
              {destinationAlbums.length === 0 ? (
                <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>No other albums available.</p>
              ) : (
                displayNodes.map((node) => {
                  const isGroup = node.nodeType === 'Group';
                  const isExpanded = expandedGroupIds.includes(node.id);
                  const isSelectable = node.nodeType === 'Album' && node.id !== sourceAlbum.id;
                  const isSelected = destinationAlbumId === node.id;

                  return (
                    <div key={node.id} style={{ ...rowStyle, marginLeft: `${node.depth * 18}px` }}>
                      {isGroup ? (
                        <button
                          type="button"
                          style={expandButtonStyle}
                          onClick={() =>
                            setExpandedGroupIds((previous) =>
                              previous.includes(node.id)
                                ? previous.filter((id) => id !== node.id)
                                : [...previous, node.id]
                            )
                          }
                          aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
                        >
                          {isExpanded ? '▾' : '▸'}
                        </button>
                      ) : (
                        <span style={spacerStyle} />
                      )}
                      <button
                        type="button"
                        style={{
                          ...destinationRowStyle,
                          ...(isSelected ? selectedDestinationRowStyle : {}),
                          ...(!isSelectable ? disabledDestinationRowStyle : {})
                        }}
                        disabled={!isSelectable}
                        onClick={() => {
                          if (isSelectable) {
                            setDestinationAlbumId(node.id);
                          }
                        }}
                        title={buildAlbumPathLabel(node, nodesById)}
                      >
                        <span>{node.label}</span>
                        <span style={{ color: '#64748b', fontSize: '11px' }}>
                          {isGroup ? 'Group' : 'Album'}
                        </span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={keepInSourceAlbum}
              onChange={(event) => setKeepInSourceAlbum(event.target.checked)}
            />
            <span>Keep assets in source album too</span>
          </label>

          {moveError ? <p style={{ margin: 0, color: '#b00020', fontSize: '12px' }}>{moveError}</p> : null}
        </div>

        <div style={footerStyle}>
          <button type="button" style={movePending ? disabledButtonStyle : buttonStyle} disabled={movePending} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={canMove ? primaryButtonStyle : disabledButtonStyle}
            disabled={!canMove}
            onClick={() => {
              setMovePending(true);
              setMoveError(null);
              void onMove({
                destinationAlbumId,
                keepInSourceAlbum
              })
                .then(() => {
                  window.localStorage.setItem(lastMoveTargetAlbumStorageKey, destinationAlbumId);
                  onClose();
                })
                .catch((error: unknown) => {
                  setMoveError(error instanceof Error ? error.message : 'Failed to move assets');
                })
                .finally(() => {
                  setMovePending(false);
                });
            }}
          >
            {movePending ? 'Moving...' : 'Move Assets'}
          </button>
        </div>
      </section>
    </div>
  );
}
