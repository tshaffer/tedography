import { Router } from 'express';
import type { ImportApiErrorResponse } from '@tedography/domain';
import type { YearAlbumCoverageDiagnosticType } from '@tedography/shared';
import { log } from '../logger.js';
import {
  getYearAlbumCoverageAssets,
  getYearAlbumCoverageSummary,
  YearAlbumCoverageNotFoundError,
  YearAlbumCoverageValidationError
} from '../organization/yearAlbumCoverageService.js';

const validDiagnosticTypes: YearAlbumCoverageDiagnosticType[] = [
  'only-in-miscellany',
  'not-in-any-non-miscellany',
  'in-non-miscellany'
];

function parseDiagnosticType(value: unknown): YearAlbumCoverageDiagnosticType | null {
  if (
    value === 'only-in-miscellany' ||
    value === 'not-in-any-non-miscellany' ||
    value === 'in-non-miscellany'
  ) {
    return value;
  }

  return null;
}

export const organizationRoutes: Router = Router();

organizationRoutes.get('/year-groups/:yearGroupId/coverage-summary', async (req, res) => {
  try {
    res.json(await getYearAlbumCoverageSummary(req.params.yearGroupId.trim()));
  } catch (error) {
    if (error instanceof YearAlbumCoverageNotFoundError) {
      res.status(404).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    if (error instanceof YearAlbumCoverageValidationError) {
      res.status(400).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    log.error('Failed to load year album coverage summary', error);
    res.status(500).json({ error: 'Failed to load year album coverage summary' } satisfies ImportApiErrorResponse);
  }
});

organizationRoutes.get('/year-groups/:yearGroupId/coverage-assets', async (req, res) => {
  const diagnosticType = parseDiagnosticType(req.query.diagnosticType);
  if (!diagnosticType) {
    res.status(400).json({
      error: `diagnosticType must be one of: ${validDiagnosticTypes.join(', ')}`
    } satisfies ImportApiErrorResponse);
    return;
  }

  try {
    res.json(await getYearAlbumCoverageAssets(req.params.yearGroupId.trim(), diagnosticType));
  } catch (error) {
    if (error instanceof YearAlbumCoverageNotFoundError) {
      res.status(404).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    if (error instanceof YearAlbumCoverageValidationError) {
      res.status(400).json({ error: error.message } satisfies ImportApiErrorResponse);
      return;
    }

    log.error('Failed to load year album coverage assets', error);
    res.status(500).json({ error: 'Failed to load year album coverage assets' } satisfies ImportApiErrorResponse);
  }
});
