import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import type { AlbumTreeNode } from '@tedography/domain';
import { buildAlbumTreeDisplayList } from '../../utilities/albumTree';

export const ROOT_DESTINATION = 'ROOT_DESTINATION';

type MoveDestinationId = typeof ROOT_DESTINATION | string;

type DestinationValidation = {
  isSelectable: boolean;
  reason: string | null;
};

type MovePositionOption = {
  index: number;
  label: string;
};

interface MoveAlbumTreeNodeDialogProps {
  open: boolean;
  nodes: AlbumTreeNode[];
  nodeToMove: AlbumTreeNode | null;
  onClose: () => void;
  onMove: (input: { destinationParentId: string | null; targetIndex: number }) => Promise<void>;
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

function compareAlbumTreeNodeNames(left: AlbumTreeNode, right: AlbumTreeNode): number {
  const labelComparison = left.label.localeCompare(right.label, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
  if (labelComparison !== 0) {
    return labelComparison;
  }

  return left.id.localeCompare(right.id);
}

function compareAlbumTreeNodeTypes(left: AlbumTreeNode, right: AlbumTreeNode): number {
  if (left.nodeType === right.nodeType) {
    return 0;
  }

  return left.nodeType === 'Group' ? -1 : 1;
}

function compareAlbumTreeNodesByCustomBucketOrder(left: AlbumTreeNode, right: AlbumTreeNode): number {
  const nodeTypeComparison = compareAlbumTreeNodeTypes(left, right);
  if (nodeTypeComparison !== 0) {
    return nodeTypeComparison;
  }

  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return compareAlbumTreeNodeNames(left, right);
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

function getInitialExpandedGroupIds(nodes: AlbumTreeNode[], destinationNode: AlbumTreeNode | null): string[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  return Array.from(new Set(getAncestorGroupIds(nodesById, destinationNode)));
}

function getOrderedSameTypeSiblings(
  nodes: AlbumTreeNode[],
  parentId: string | null,
  nodeType: AlbumTreeNode['nodeType'],
  excludeNodeId?: string
): AlbumTreeNode[] {
  return nodes
    .filter(
      (candidate) =>
        candidate.parentId === parentId &&
        candidate.nodeType === nodeType &&
        candidate.id !== excludeNodeId
    )
    .sort(compareAlbumTreeNodesByCustomBucketOrder);
}

function getCurrentSiblingIndex(nodes: AlbumTreeNode[], nodeToMove: AlbumTreeNode): number {
  return getOrderedSameTypeSiblings(nodes, nodeToMove.parentId, nodeToMove.nodeType).findIndex(
    (candidate) => candidate.id === nodeToMove.id
  );
}

function buildPositionOptions(siblings: AlbumTreeNode[]): MovePositionOption[] {
  if (siblings.length === 0) {
    return [{ index: 0, label: '1. Only item' }];
  }

  return [
    { index: 0, label: '1. Beginning' },
    ...siblings.map((sibling, index) => ({
      index: index + 1,
      label: `${index + 2}. After ${sibling.label}`
    }))
  ];
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

    return { isSelectable: true, reason: null };
  }

  const destinationNode = nodesById.get(destinationId);
  if (!destinationNode) {
    return { isSelectable: false, reason: 'Not found' };
  }

  if (destinationNode.nodeType === 'Album') {
    return { isSelectable: false, reason: 'Albums cannot contain children' };
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
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
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
  const currentSiblingIndex = useMemo(
    () => (nodeToMove ? getCurrentSiblingIndex(nodes, nodeToMove) : -1),
    [nodeToMove, nodes]
  );
  const selectedDestinationParentId =
    selectedDestinationId === ROOT_DESTINATION ? null : selectedDestinationId;
  const positionOptions = useMemo(() => {
    if (!nodeToMove) {
      return [];
    }

    return buildPositionOptions(
      getOrderedSameTypeSiblings(nodes, selectedDestinationParentId, nodeToMove.nodeType, nodeToMove.id)
    );
  }, [nodeToMove, nodes, selectedDestinationParentId]);

  useEffect(() => {
    if (!open || !nodeToMove) {
      return;
    }

    const initialDestinationId = nodeToMove.parentId ?? ROOT_DESTINATION;
    const initialDestinationNode = nodeToMove.parentId ? nodesById.get(nodeToMove.parentId) ?? null : null;

    setSelectedDestinationId(initialDestinationId);
    setSelectedTargetIndex(Math.max(0, getCurrentSiblingIndex(nodes, nodeToMove)));
    setExpandedGroupIds(getInitialExpandedGroupIds(nodes, initialDestinationNode));
    setMovePending(false);
    setMoveError(null);
  }, [nodeToMove, nodes, nodesById, open]);

  useEffect(() => {
    if (!nodeToMove) {
      return;
    }

    const nextIndex =
      selectedDestinationParentId === nodeToMove.parentId
        ? Math.max(0, currentSiblingIndex)
        : positionOptions.length - 1;
    const clampedIndex = positionOptions.some((option) => option.index === selectedTargetIndex)
      ? selectedTargetIndex
      : Math.max(0, nextIndex);

    if (clampedIndex !== selectedTargetIndex) {
      setSelectedTargetIndex(clampedIndex);
    }
  }, [currentSiblingIndex, nodeToMove, positionOptions, selectedDestinationParentId, selectedTargetIndex]);

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
  const isNoOp =
    currentValidation.isSelectable &&
    selectedDestinationParentId === nodeToMove.parentId &&
    selectedTargetIndex === currentSiblingIndex;
  const moveTitle = nodeToMove.nodeType === 'Album' ? 'Move Album' : 'Move Group';
  const siblingTypeLabel = nodeToMove.nodeType === 'Album' ? 'albums' : 'groups';
  const selectDestination = (destinationId: MoveDestinationId): void => {
    const destinationParentId = destinationId === ROOT_DESTINATION ? null : destinationId;
    const nextIndex =
      destinationParentId === nodeToMove.parentId
        ? Math.max(0, currentSiblingIndex)
        : getOrderedSameTypeSiblings(nodes, destinationParentId, nodeToMove.nodeType, nodeToMove.id).length;

    setSelectedDestinationId(destinationId);
    setSelectedTargetIndex(nextIndex);
  };

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
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
            Choose the destination parent and where this {nodeToMove.nodeType.toLocaleLowerCase()} should appear
            among sibling {siblingTypeLabel}.
          </p>
          <div style={chooserPanelStyle}>
            <div style={rowStyle}>
              <span style={spacerStyle} />
              <button
                type="button"
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
                disabled={
                  !validateDestination(
                    nodeToMove,
                    ROOT_DESTINATION,
                    nodesById,
                    nodesByParentId,
                    groupDescendantIds
                  ).isSelectable
                }
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
                    selectDestination(ROOT_DESTINATION);
                  }
                }}
                title="Move to top level"
              >
                <span>Top Level</span>
                <span style={badgeStyle}>Root</span>
              </button>
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
                  <button
                    type="button"
                    style={{
                      ...destinationRowStyle,
                      ...(isSelected ? selectedDestinationRowStyle : {}),
                      ...(!validation.isSelectable ? disabledDestinationRowStyle : {})
                    }}
                    disabled={!validation.isSelectable}
                    onClick={() => {
                      if (validation.isSelectable) {
                        selectDestination(node.id);
                      }
                    }}
                    title={validation.reason ?? node.label}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.label}
                    </span>
                    <span style={badgeStyle}>{node.nodeType}</span>
                    {validation.reason ? <span style={badgeStyle}>{validation.reason}</span> : null}
                  </button>
                </div>
              );
            })}
          </div>

          <label style={fieldLabelStyle}>
            <span>Position</span>
            <select
              value={String(selectedTargetIndex)}
              onChange={(event) => setSelectedTargetIndex(Number(event.target.value))}
              style={inputStyle}
              disabled={!currentValidation.isSelectable || movePending || positionOptions.length === 0}
            >
              {positionOptions.map((option) => (
                <option key={option.index} value={String(option.index)}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {moveError ? <p style={{ margin: 0, color: '#b00020', fontSize: '13px' }}>{moveError}</p> : null}
        </div>

        <div style={footerStyle}>
          <span style={{ color: '#666', fontSize: '12px' }}>
            Groups and albums are ordered separately. Position applies within sibling {siblingTypeLabel} only.
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={buttonStyle} onClick={onClose} disabled={movePending}>
              Cancel
            </button>
            <button
              type="button"
              style={
                !movePending && currentValidation.isSelectable && !isNoOp
                  ? primaryButtonStyle
                  : disabledButtonStyle
              }
              onClick={() => {
                if (!currentValidation.isSelectable || movePending || isNoOp) {
                  return;
                }

                setMovePending(true);
                setMoveError(null);
                void onMove({
                  destinationParentId: selectedDestinationParentId,
                  targetIndex: selectedTargetIndex
                })
                  .catch((error: unknown) => {
                    setMoveError(error instanceof Error ? error.message : 'Failed to move node');
                  })
                  .finally(() => {
                    setMovePending(false);
                  });
              }}
              disabled={movePending || !currentValidation.isSelectable || isNoOp}
            >
              {movePending ? 'Moving...' : 'Move'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
