# TEDOGRAPHY_ARCHITECTURE.md

Author: Ted Shaffer Project: Tedography Root directory:
/Users/tedshaffer/Documents/Projects/tedography

Tedography is a redesign of **Shafferography**, a personal photo
management system focused on photo curation, organization, and long‑term
archival viewing.

This document captures the **product philosophy, UI model, domain model,
and system architecture** for Tedography.

This document is intended to be a **living specification** and will
evolve as the system is implemented.

------------------------------------------------------------------------

# 1. Product Vision

Tedography is a personal photo management system designed for:

-   efficient photo curation
-   high‑quality photo viewing
-   long‑term archive management
-   flexible organization
-   future AI‑assisted search and filtering

The system is optimized for a **single‑user photographer managing a
personal archive**.

Tedography should make it easy to:

Import → Review → Select / Pending / Reject → Organize → Enjoy viewing
later → Optionally publish/export.

------------------------------------------------------------------------

# 2. Core Product Principles

## 2.1 Curation First

Tedography prioritizes **deciding which photos to keep**.

The primary workflow is:

Import → Review → Select / Pending / Reject

The system should allow reviewing large sets of images **quickly and
comfortably**.

------------------------------------------------------------------------

## 2.2 Rich Viewing Capabilities

Tedography must support both:

1.  **Decision‑making viewing**
2.  **Long‑term enjoyment viewing**

Viewing modes should include:

-   Grid
-   Loupe
-   Survey
-   Fullscreen

Loupe and Fullscreen modes must support **rapid A/B comparison** using
arrow keys.

------------------------------------------------------------------------

## 2.3 Local Archive Ownership

Tedography assumes photos live in **locally controlled storage**.

The system should:

-   work with local drives
-   understand multiple storage locations
-   maintain archival integrity

Tedography does **not rely on cloud storage** as the canonical source.

------------------------------------------------------------------------

## 2.4 Flexible Organization

Photos can belong to multiple albums.

Album hierarchy is supported.

Key rule:

Assets only live in **leaf albums**.

Parent albums exist only for structure.

------------------------------------------------------------------------

## 2.5 Extensible Metadata

Tedography should support metadata including:

-   EXIF capture metadata
-   location metadata
-   people metadata
-   publication records
-   storage records

The system must leave room for **future AI‑generated metadata**.

------------------------------------------------------------------------

# 3. Review Workflow

Review is the core workflow.

Imported photos begin in state:

Unreviewed

Photos transition between:

-   Unreviewed
-   Pending
-   Select
-   Reject

Definitions:

Unreviewed --- newly imported photos not yet reviewed

Pending --- photos requiring later decision

Select --- keeper photos

Reject --- photos not retained in the archive

Reject photos should be **hidden by default but recoverable**.

------------------------------------------------------------------------

## Pending Groups

Pending photos can optionally belong to **Pending Groups**.

Example:

-   London undecided
-   Paris undecided

This allows returning later to specific subsets of difficult decisions.

------------------------------------------------------------------------

# 4. Viewing Modes

Tedography supports four viewing modes.

## Grid

Used for scanning and multi‑selection.

## Loupe

Used for single‑image viewing and rapid A/B comparison.

## Survey

Used for comparing multiple images simultaneously.

## Fullscreen

Used for immersive viewing and final evaluation.

Fullscreen supports:

← → navigation\
Delete key rejection\
Rapid comparison

------------------------------------------------------------------------

# 5. UI Navigation Model

Tedography v1 includes five primary areas:

-   Review
-   Library
-   Albums
-   Search
-   Maintenance

People metadata exists in the domain model but does not yet require a
top‑level UI area.

------------------------------------------------------------------------

## Review

The Review area is optimized for curation.

Default scope:

photoState in (Unreviewed, Pending)

Optional toggle allows including **Selected photos as reference** during
review.

------------------------------------------------------------------------

## Library

The Library area is optimized for browsing kept photos.

Default scope:

photoState = Select

------------------------------------------------------------------------

## Albums

Albums provide hierarchical organization.

Users can select one or more leaf albums to display assets.

Results can appear:

-   merged
-   grouped by album

------------------------------------------------------------------------

## Search

Search supports structured filtering including:

-   photo state
-   album
-   people
-   capture date
-   publication status

Future versions may support natural‑language search.

------------------------------------------------------------------------

## Maintenance

Maintenance contains operational tools including:

-   import status
-   storage health
-   integrity checks
-   repair tools

Maintenance tools should **not clutter normal workflows**.

------------------------------------------------------------------------

# 6. Domain Model

Core entities include:

MediaAsset\
Album\
PendingGroup\
Person\
PublicationRecord\
StorageInstance\
AssetEvent

------------------------------------------------------------------------

## MediaAsset

Represents a photo or video.

Key properties include:

-   id
-   contentHash
-   mediaType
-   captureDateTime
-   photoState
-   pendingGroupId
-   albumIds\[\]
-   peopleIds\[\]

Additional metadata may include camera, lens, ISO, aperture, shutter
speed, and dimensions.

------------------------------------------------------------------------

## Album

Represents an organizational node in the album tree.

Fields:

-   id
-   name
-   parentAlbumId

Albums are hierarchical but assets only belong to **leaf albums**.

------------------------------------------------------------------------

## PendingGroup

Represents a named group of pending photos.

Fields:

-   id
-   name
-   createdAt

------------------------------------------------------------------------

## Person

Represents a person appearing in photos.

Fields:

-   id
-   name

People metadata may originate from:

-   Google Photos recognition
-   future recognition systems
-   manual tagging

------------------------------------------------------------------------

## PublicationRecord

Tracks exports to external services.

Fields:

-   service
-   serviceMediaId
-   exportDateTime
-   status

Example service:

Google Photos

------------------------------------------------------------------------

## StorageInstance

Represents a copy of the asset in a storage location.

Fields:

-   role
-   path
-   verifiedAt

Storage roles may include:

Primary\
Backup\
ImportSource\
Quarantine

------------------------------------------------------------------------

## AssetEvent

Represents important lifecycle events such as:

-   import
-   review changes
-   publication
-   reimport
-   integrity repair

Events support long‑term auditing of archive history.

------------------------------------------------------------------------

# 7. System Architecture

Tedography is built as a **pnpm monorepo**.

Repository structure:

tedography/

apps/ web/ api/

packages/ domain/ shared/ media-metadata/ import-pipeline/

docs/ scripts/

------------------------------------------------------------------------

## apps/web

React frontend.

Technologies:

React\
Redux Toolkit\
Material UI\
TypeScript

Responsibilities:

-   Review UI
-   Library UI
-   Album UI
-   Search UI
-   Metadata panel
-   Viewer modes

------------------------------------------------------------------------

## apps/api

Express backend.

Responsibilities:

-   REST API
-   MongoDB access
-   asset queries
-   review state transitions
-   import pipeline orchestration

------------------------------------------------------------------------

## packages/domain

Defines the **core domain model**.

Contains:

-   entity definitions
-   enums
-   shared types
-   search specifications

This package is the long‑term heart of the system.

------------------------------------------------------------------------

## packages/media-metadata

Handles:

-   EXIF extraction
-   image metadata parsing
-   dimension detection
-   MIME type detection

------------------------------------------------------------------------

## packages/import-pipeline

Handles:

-   file hashing
-   duplicate detection
-   metadata extraction
-   asset creation
-   reimport logic

------------------------------------------------------------------------

# 8. Persistence

Tedography uses MongoDB.

Primary collections:

-   mediaAssets
-   albums
-   people
-   pendingGroups
-   publicationRecords
-   storageInstances
-   assetEvents

------------------------------------------------------------------------

# 9. Media Storage

Tedography assumes local media storage accessible to the backend.

Frontend should access media through **backend‑generated URLs**, not raw
filesystem paths.

This improves portability and security.

------------------------------------------------------------------------

# 10. Future Capabilities

Future enhancements may include:

-   AI‑based search
-   face recognition pipelines
-   slideshow presentation mode
-   advanced annotation
-   video editing support

The architecture is designed to accommodate these features without major
redesign.
