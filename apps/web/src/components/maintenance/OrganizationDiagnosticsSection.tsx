import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import type { AlbumTreeNode } from '@tedography/domain';
import type {
  YearAlbumCoverageDiagnosticType,
  YearAlbumCoverageSummary
} from '@tedography/shared';
import {
  getYearAlbumCoverageAssets,
  getYearAlbumCoverageSummary
} from '../../api/organizationApi';

type RecognizedYearGroupOption = {
  id: string;
  label: string;
};

type OrganizationDiagnosticsSectionProps = {
  albumTreeNodes: AlbumTreeNode[];
  selectedTreeNodeId: string | null;
  onOpenDiagnosticAssets: (input: {
    assetIds: string[];
    scopeLabel: string;
    emptyMessage: string;
  }) => void;
};

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

const warningBadgeStyle: CSSProperties = {
  ...badgeStyle,
  borderColor: '#e1c699',
  backgroundColor: '#fff1da',
  color: '#7a4d00'
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

const summaryGridStyle: CSSProperties = {
  marginTop: '8px',
  fontSize: '12px',
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
};

const summaryCardStyle: CSSProperties = {
  border: '1px solid #ececec',
  borderRadius: '10px',
  backgroundColor: '#fafafa',
  padding: '10px',
  display: 'grid',
  gap: '4px'
};

const summaryValueStyle: CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#16202a'
};

const diagnosticsListStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  marginTop: '12px'
};

const diagnosticRowStyle: CSSProperties = {
  border: '1px solid #ececec',
  borderRadius: '10px',
  backgroundColor: '#fff',
  padding: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap'
};

function compareYearGroupOptions(left: RecognizedYearGroupOption, right: RecognizedYearGroupOption): number {
  const leftYear = Number(left.label);
  const rightYear = Number(right.label);
  if (Number.isFinite(leftYear) && Number.isFinite(rightYear) && leftYear !== rightYear) {
    return rightYear - leftYear;
  }

  return right.label.localeCompare(left.label, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function isRecognizedYearGroup(node: AlbumTreeNode): boolean {
  if (node.nodeType !== 'Group') {
    return false;
  }

  if (node.semanticKind === 'YearGroup') {
    return true;
  }

  return /^\d{4}$/.test(node.label.trim());
}

function formatRecognitionMode(mode: YearAlbumCoverageSummary['metadata']['yearGroupRecognitionMode']): string {
  return mode === 'explicit' ? 'Year group set explicitly' : 'Year group inferred from label';
}

function formatMiscellanyDetectionMode(
  summary: YearAlbumCoverageSummary,
  albumNodesById: Map<string, AlbumTreeNode>
): string {
  if (!summary.metadata.hasMiscellanyAlbum) {
    return 'No Miscellany album recognized for this year.';
  }

  if (summary.metadata.miscellanyDetectionMode === 'explicit') {
    return 'Miscellany recognized explicitly.';
  }

  const selectedMiscellanyAlbum = summary.metadata.selectedMiscellanyAlbumId
    ? albumNodesById.get(summary.metadata.selectedMiscellanyAlbumId) ?? null
    : null;
  return selectedMiscellanyAlbum
    ? `Miscellany inferred from album label "${selectedMiscellanyAlbum.label}".`
    : 'Miscellany inferred from album label.';
}

export function OrganizationDiagnosticsSection({
  albumTreeNodes,
  selectedTreeNodeId,
  onOpenDiagnosticAssets
}: OrganizationDiagnosticsSectionProps): ReactElement {
  const albumNodesById = useMemo(
    () => new Map(albumTreeNodes.map((node) => [node.id, node])),
    [albumTreeNodes]
  );
  const selectedTreeNode = selectedTreeNodeId ? albumNodesById.get(selectedTreeNodeId) ?? null : null;
  const yearGroupOptions = useMemo<RecognizedYearGroupOption[]>(
    () =>
      albumTreeNodes
        .filter(isRecognizedYearGroup)
        .map((node) => ({
          id: node.id,
          label: node.label
        }))
        .sort(compareYearGroupOptions),
    [albumTreeNodes]
  );
  const [selectedYearGroupId, setSelectedYearGroupId] = useState<string>('');
  const [summary, setSummary] = useState<YearAlbumCoverageSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [openingDiagnosticType, setOpeningDiagnosticType] =
    useState<YearAlbumCoverageDiagnosticType | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTreeNode && isRecognizedYearGroup(selectedTreeNode)) {
      setSelectedYearGroupId(selectedTreeNode.id);
      return;
    }

    setSelectedYearGroupId((previous) =>
      previous && yearGroupOptions.some((option) => option.id === previous)
        ? previous
        : yearGroupOptions[0]?.id ?? ''
    );
  }, [selectedTreeNode, yearGroupOptions]);

  useEffect(() => {
    if (!selectedYearGroupId) {
      setSummary(null);
      setSummaryError(null);
      setSummaryLoading(false);
      return;
    }

    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);

    void (async () => {
      try {
        const nextSummary = await getYearAlbumCoverageSummary(selectedYearGroupId);
        if (cancelled) {
          return;
        }

        setSummary(nextSummary);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSummary(null);
        setSummaryError(
          error instanceof Error ? error.message : 'Failed to load year album coverage summary'
        );
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedYearGroupId]);

  const selectedYearGroupOption = yearGroupOptions.find((option) => option.id === selectedYearGroupId) ?? null;
  const multipleMiscellanyLabels = useMemo(() => {
    if (!summary?.metadata.ignoredMiscellanyCandidateAlbumIds?.length) {
      return [];
    }

    return summary.metadata.ignoredMiscellanyCandidateAlbumIds.map((albumId) => {
      const album = albumNodesById.get(albumId);
      return album?.label ?? albumId;
    });
  }, [albumNodesById, summary]);

  async function handleOpenDiagnosticSet(
    diagnosticType: YearAlbumCoverageDiagnosticType,
    scopeLabel: string,
    emptyMessage: string
  ): Promise<void> {
    if (!selectedYearGroupId) {
      return;
    }

    setOpeningDiagnosticType(diagnosticType);
    setOpenError(null);

    try {
      const result = await getYearAlbumCoverageAssets(selectedYearGroupId, diagnosticType);
      onOpenDiagnosticAssets({
        assetIds: result.items.map((item) => item.mediaAssetId),
        scopeLabel,
        emptyMessage
      });
    } catch (error) {
      setOpenError(
        error instanceof Error ? error.message : 'Failed to open organization diagnostic assets'
      );
    } finally {
      setOpeningDiagnosticType(null);
    }
  }

  return (
    <section style={sectionStyle}>
      <h3 style={sectionTitleStyle}>Organization Diagnostics</h3>
      <div style={controlRowStyle}>
        <label style={{ fontSize: '12px', color: '#555' }}>
          Year group{' '}
          <select
            value={selectedYearGroupId}
            onChange={(event) => setSelectedYearGroupId(event.target.value)}
            style={{ marginLeft: '6px', padding: '4px 6px', fontSize: '12px' }}
          >
            {yearGroupOptions.length === 0 ? <option value="">No year groups found</option> : null}
            {yearGroupOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {selectedTreeNode ? (
          <span style={badgeStyle}>
            Selected tree node: {selectedTreeNode.label}
          </span>
        ) : null}
      </div>

      {!selectedTreeNode ? (
        <p style={{ ...mutedTextStyle, marginTop: '8px' }}>
          Select a year group in the album tree or choose one here to view coverage diagnostics.
        </p>
      ) : selectedTreeNode && !isRecognizedYearGroup(selectedTreeNode) ? (
        <p style={{ ...mutedTextStyle, marginTop: '8px' }}>
          The selected album-tree node is not recognized as a year group. Choose a year group here to view diagnostics.
        </p>
      ) : (
        <p style={{ ...mutedTextStyle, marginTop: '8px' }}>
          Using the currently selected year group from the album tree.
        </p>
      )}

      {summaryLoading ? (
        <p style={{ ...mutedTextStyle, marginTop: '12px' }}>Loading album coverage summary...</p>
      ) : null}
      {summaryError ? <p style={{ color: '#b00020', marginTop: '12px' }}>{summaryError}</p> : null}
      {openError ? <p style={{ color: '#b00020', marginTop: '12px' }}>{openError}</p> : null}

      {!summaryLoading && !summaryError && !summary ? (
        <p style={{ ...mutedTextStyle, marginTop: '12px' }}>
          Select a year group to view album coverage diagnostics.
        </p>
      ) : null}

      {!summaryLoading && !summaryError && summary ? (
        <>
          <div style={summaryGridStyle}>
            <div style={summaryCardStyle}>
              <div style={mutedTextStyle}>Total assets in year</div>
              <div style={summaryValueStyle}>{summary.totalAssetsInYear}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={mutedTextStyle}>In Miscellany</div>
              <div style={summaryValueStyle}>{summary.assetsInMiscellany}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={mutedTextStyle}>Only in Miscellany</div>
              <div style={summaryValueStyle}>{summary.assetsOnlyInMiscellany}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={mutedTextStyle}>Not in any specific album</div>
              <div style={summaryValueStyle}>{summary.assetsNotInAnyNonMiscellanyAlbum}</div>
            </div>
            <div style={summaryCardStyle}>
              <div style={mutedTextStyle}>In one or more specific albums</div>
              <div style={summaryValueStyle}>{summary.assetsInOneOrMoreNonMiscellanyAlbums}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
            <div style={controlRowStyle}>
              <span style={badgeStyle}>{formatRecognitionMode(summary.metadata.yearGroupRecognitionMode)}</span>
              <span style={badgeStyle}>{formatMiscellanyDetectionMode(summary, albumNodesById)}</span>
            </div>
            {!summary.metadata.hasMiscellanyAlbum ? (
              <p style={{ ...mutedTextStyle, color: '#7a4d00' }}>
                No Miscellany album is currently recognized for {summary.yearLabel}.
              </p>
            ) : null}
            {summary.metadata.multipleMiscellanyCandidatesDetected ? (
              <div style={{ display: 'grid', gap: '4px' }}>
                <span style={warningBadgeStyle}>Multiple Miscellany candidates detected</span>
                <p style={{ ...mutedTextStyle, color: '#7a4d00' }}>
                  Using the selected Miscellany candidate for diagnostics
                  {multipleMiscellanyLabels.length > 0
                    ? ` and ignoring: ${multipleMiscellanyLabels.join(', ')}.`
                    : '.'}
                </p>
              </div>
            ) : null}
          </div>

          <div style={diagnosticsListStyle}>
            <div style={diagnosticRowStyle}>
              <div>
                <strong>Only in Miscellany</strong>
                <div style={mutedTextStyle}>
                  Assets that are in Miscellany and not in any specific album.
                </div>
              </div>
              <div style={controlRowStyle}>
                <span style={badgeStyle}>{summary.assetsOnlyInMiscellany} assets</span>
                <button
                  type="button"
                  style={
                    summary.assetsOnlyInMiscellany > 0 && openingDiagnosticType === null
                      ? buttonStyle
                      : disabledButtonStyle
                  }
                  disabled={summary.assetsOnlyInMiscellany === 0 || openingDiagnosticType !== null}
                  onClick={() =>
                    void handleOpenDiagnosticSet(
                      'only-in-miscellany',
                      `${selectedYearGroupOption?.label ?? summary.yearLabel}: Only in Miscellany`,
                      'No assets are only in Miscellany for this year group.'
                    )
                  }
                >
                  {openingDiagnosticType === 'only-in-miscellany' ? 'Opening...' : 'Open Assets'}
                </button>
              </div>
            </div>

            <div style={diagnosticRowStyle}>
              <div>
                <strong>Not in any specific album</strong>
                <div style={mutedTextStyle}>
                  Assets in the year that have no non-Miscellany album coverage.
                </div>
              </div>
              <div style={controlRowStyle}>
                <span style={badgeStyle}>{summary.assetsNotInAnyNonMiscellanyAlbum} assets</span>
                <button
                  type="button"
                  style={
                    summary.assetsNotInAnyNonMiscellanyAlbum > 0 && openingDiagnosticType === null
                      ? buttonStyle
                      : disabledButtonStyle
                  }
                  disabled={
                    summary.assetsNotInAnyNonMiscellanyAlbum === 0 || openingDiagnosticType !== null
                  }
                  onClick={() =>
                    void handleOpenDiagnosticSet(
                      'not-in-any-non-miscellany',
                      `${selectedYearGroupOption?.label ?? summary.yearLabel}: Not in any specific album`,
                      'No assets are missing specific album coverage for this year group.'
                    )
                  }
                >
                  {openingDiagnosticType === 'not-in-any-non-miscellany'
                    ? 'Opening...'
                    : 'Open Assets'}
                </button>
              </div>
            </div>

            <div style={diagnosticRowStyle}>
              <div>
                <strong>In one or more specific albums</strong>
                <div style={mutedTextStyle}>
                  Assets in the year that are covered by at least one non-Miscellany album.
                </div>
              </div>
              <div style={controlRowStyle}>
                <span style={badgeStyle}>{summary.assetsInOneOrMoreNonMiscellanyAlbums} assets</span>
                <button
                  type="button"
                  style={
                    summary.assetsInOneOrMoreNonMiscellanyAlbums > 0 && openingDiagnosticType === null
                      ? buttonStyle
                      : disabledButtonStyle
                  }
                  disabled={
                    summary.assetsInOneOrMoreNonMiscellanyAlbums === 0 ||
                    openingDiagnosticType !== null
                  }
                  onClick={() =>
                    void handleOpenDiagnosticSet(
                      'in-non-miscellany',
                      `${selectedYearGroupOption?.label ?? summary.yearLabel}: In one or more specific albums`,
                      'No assets are covered by specific albums for this year group.'
                    )
                  }
                >
                  {openingDiagnosticType === 'in-non-miscellany' ? 'Opening...' : 'Open Assets'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
