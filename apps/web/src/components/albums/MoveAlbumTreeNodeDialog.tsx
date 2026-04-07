import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import type { AlbumTreeNode } from '@tedography/domain';

export const ROOT_DESTINATION = 'ROOT_DESTINATION';

type MoveDestinationId = typeof ROOT_DESTINATION | string;

type AlbumTreeNodeWithDepth = AlbumTreeNode & {
  depth: number;
};

type DestinationValidation = {
  isSelectable: boolean;
  reason: string | null;
};

interface MoveAlbumTreeNodeDialogProps {
  open: boolean;
  nodes: AlbumTreeNode[];
  nodeToMove: AlbumTreeNode | null;
  onClose: () => void;
  onMove: (destinationParentId: string | null) => Promise<void>;
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
  width: 'min(560px, 92vw)',
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
  gap: '12px'
};

const chooserPanelStyle: CSSProperties = {
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '10px',
  maxHeight: '360px',
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

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '999px',
  padding: '2px 8px',
  fontSize: '11px',
  border: '1px solid #d7d7d7',
  backgroundColor: '#fafafa',
  color: '#555'
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 18px',
  borderTop: '1px solid #ececec'
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

function getDescendantNodeIds(nodes: AlbumTreeNode[], groupId: string): Set<string> {
  const childrenByParent = new Map<string | null, AlbumTreeNode[]>();

  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  const descendantIds = new Set<string>();
  const stack = [...(childrenByParent.get(groupId) ?? [])];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    descendantIds.add(node.id);
    stack.push(...(childrenByParent.get(node.id) ?? []));
  }

  return descendantIds;
}

function getAncestorGroupIds(nodeId: string | null, nodesById: Map<string, AlbumTreeNode>): string[] {
  const ancestorGroupIds = new Set<string>();
  let currentId = nodeId;

  while (currentId) {
    const node = nodesById.get(currentId);
    if (!node) {
      break;
    }

    if (node.nodeType === 'Group') {
      ancestorGroupIds.add(node.id);
    }

    currentId = node.parentId;
  }

  return Array.from(ancestorGroupIds);
}

function getInitialExpandedGroupIds(
  nodes: AlbumTreeNode[],
  nodeToMove: AlbumTreeNode | null
): string[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const expanded = new Set<string>(
    nodes.filter((node) => node.nodeType === 'Group' && node.parentId === null).map((node) => node.id)
  );

  if (nodeToMove?.parentId) {
    for (const ancestorId of getAncestorGroupIds(nodeToMove.parentId, nodesById)) {
      expanded.add(ancestorId);
    }
  }

  return Array.from(expanded);
}

function validateDestination(
  nodeToMove: AlbumTreeNode,
  destinationId: MoveDestinationId,
  nodesById: Map<string, AlbumTreeNode>,
  nodesByParentId: Map<string | null, AlbumTreeNode[]>,
  groupDescendantIds: Set<string>
): DestinationValidation {
  const hasSiblingLabelConflict = (parentId: string | null): boolean => {
    const normalizedLabel = nodeToMove.label.trim().toLocaleLowerCase();
    return (nodesByParentId.get(parentId) ?? []).some(
      (sibling) =>
        sibling.id !== nodeToMove.id &&
        sibling.nodeType === nodeToMove.nodeType &&
        sibling.label.trim().toLocaleLowerCase() === normalizedLabel
    );
  };

  if (destinationId === ROOT_DESTINATION) {
    if (hasSiblingLabelConflict(null)) {
      return { isSelectable: false, reason: 'Sibling with same name exists' };
    }

    return nodeToMove.parentId === null
      ? { isSelectable: false, reason: 'Already top level' }
      : { isSelectable: true, reason: null };
  }

  const destinationNode = nodesById.get(destinationId);
  if (!destinationNode) {
    return { isSelectable: false, reason: 'Not found' };
  }

  if (destinationNode.nodeType === 'Album') {
    return { isSelectable: false, reason: 'Albums cannot contain children' };
  }

  if (destinationNode.id === nodeToMove.parentId) {
    return { isSelectable: false, reason: 'Already in this group' };
  }

  if (nodeToMove.nodeType === 'Group') {
    if (destinationNode.id === nodeToMove.id) {
      return { isSelectable: false, reason: 'Cannot move into itself' };
    }

    if (groupDescendantIds.has(destinationNode.id)) {
      return { isSelectable: false, reason: 'Cannot move into descendant' };
    }
  }

  if (hasSiblingLabelConflict(destinationNode.id)) {
    return { isSelectable: false, reason: 'Sibling with same name exists' };
  }

  return { isSelectable: true, reason: null };
}

export function MoveAlbumTreeNodeDialog({
  open,
  nodes,
  nodeToMove,
  onClose,
  onMove
}: MoveAlbumTreeNodeDialogProps): ReactElement | null {
  const [selectedDestinationId, setSelectedDestinationId] = useState<MoveDestinationId>(ROOT_DESTINATION);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [movePending, setMovePending] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const nodesByParentId = useMemo(() => {
    const byParent = new Map<string | null, AlbumTreeNode[]>();
    for (const node of nodes) {
      const siblings = byParent.get(node.parentId) ?? [];
      siblings.push(node);
      byParent.set(node.parentId, siblings);
    }
    return byParent;
  }, [nodes]);
  const groupDescendantIds = useMemo(
    () => (nodeToMove?.nodeType === 'Group' ? getDescendantNodeIds(nodes, nodeToMove.id) : new Set<string>()),
    [nodeToMove, nodes]
  );
  const displayNodes = useMemo(
    () => buildAlbumTreeDisplayList(nodes, expandedGroupIds),
    [expandedGroupIds, nodes]
  );

  useEffect(() => {
    if (!open || !nodeToMove) {
      return;
    }

    setSelectedDestinationId(nodeToMove.parentId ?? ROOT_DESTINATION);
    setExpandedGroupIds(getInitialExpandedGroupIds(nodes, nodeToMove));
    setMovePending(false);
    setMoveError(null);
  }, [nodeToMove, nodes, open]);

  if (!open || !nodeToMove) {
    return null;
  }

  const currentValidation = validateDestination(
    nodeToMove,
    selectedDestinationId,
    nodesById,
    nodesByParentId,
    groupDescendantIds
  );
  const moveTitle = nodeToMove.nodeType === 'Album' ? 'Move Album' : 'Move Group';

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>{moveTitle}</h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#666' }}>
            Moving: <strong>{nodeToMove.label}</strong>
          </p>
        </div>

        <div style={bodyStyle}>
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Choose the new parent destination.</p>
          <div style={chooserPanelStyle}>
            <div style={rowStyle}>
              <span style={spacerStyle} />
              <div
                style={{
                  ...destinationRowStyle,
                  ...(selectedDestinationId === ROOT_DESTINATION ? selectedDestinationRowStyle : {}),
                  ...(!validateDestination(
                    nodeToMove,
                    ROOT_DESTINATION,
                    nodesById,
                    nodesByParentId,
                    groupDescendantIds
                  ).isSelectable
                    ? disabledDestinationRowStyle
                    : {})
                }}
                onClick={() => {
                  if (
                    validateDestination(
                      nodeToMove,
                      ROOT_DESTINATION,
                      nodesById,
                      nodesByParentId,
                      groupDescendantIds
                    ).isSelectable
                  ) {
                    setSelectedDestinationId(ROOT_DESTINATION);
                  }
                }}
                title="Move to top level"
              >
                <span>Top Level</span>
                <span style={badgeStyle}>Root</span>
              </div>
            </div>
            {displayNodes.map((node) => {
              const isGroup = node.nodeType === 'Group';
              const isExpanded = expandedGroupIds.includes(node.id);
              const validation = validateDestination(
                nodeToMove,
                node.id,
                nodesById,
                nodesByParentId,
                groupDescendantIds
              );
              const isSelected = selectedDestinationId === node.id;

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
                      title={isExpanded ? 'Collapse group' : 'Expand group'}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  ) : (
                    <span style={spacerStyle} />
                  )}
                  <div
                    style={{
                      ...destinationRowStyle,
                      ...(isSelected ? selectedDestinationRowStyle : {}),
                      ...(!validation.isSelectable ? disabledDestinationRowStyle : {})
                    }}
                    onClick={() => {
                      if (validation.isSelectable) {
                        setSelectedDestinationId(node.id);
                      }
                    }}
                    title={validation.reason ?? node.label}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.label}
                    </span>
                    <span style={badgeStyle}>{node.nodeType}</span>
                    {validation.reason ? <span style={badgeStyle}>{validation.reason}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
          {moveError ? <p style={{ margin: 0, color: '#b00020', fontSize: '13px' }}>{moveError}</p> : null}
        </div>

        <div style={footerStyle}>
          <span style={{ color: '#666', fontSize: '12px' }}>
            Only group destinations and Top Level are valid. Albums cannot contain children.
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={buttonStyle} onClick={onClose} disabled={movePending}>
              Cancel
            </button>
            <button
              type="button"
              style={!movePending && currentValidation.isSelectable ? primaryButtonStyle : disabledButtonStyle}
              onClick={() => {
                if (!currentValidation.isSelectable || movePending) {
                  return;
                }

                setMovePending(true);
                setMoveError(null);
                void onMove(selectedDestinationId === ROOT_DESTINATION ? null : selectedDestinationId)
                  .catch((error: unknown) => {
                    setMoveError(error instanceof Error ? error.message : 'Failed to move node');
                  })
                  .finally(() => {
                    setMovePending(false);
                  });
              }}
              disabled={movePending || !currentValidation.isSelectable}
            >
              {movePending ? 'Moving...' : 'Move'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
