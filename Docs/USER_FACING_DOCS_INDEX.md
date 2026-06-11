# Tedography User-Facing Docs Index

Documentation that describes how Tedography works from a user perspective.

---

**[AI_EDIT_QUEUE.md](AI_EDIT_QUEUE.md)** — Documents the AI Edit Queue feature, which lets you mark photos for AI-assisted editing using natural-language prompts, send the queue to the Gemini API, and have Tedography save the edited results to a configured output folder automatically. Also covers the manual Export Queue option for workflows where files and prompts are copied to a folder for uploading to an external service.

**[DUPLICATE_UI.md](DUPLICATE_UI.md)** — Describes the two main duplicate review surfaces in Tedography (the main app and the separate duplicate-review web app), explaining what each screen does, how they relate to each other, and what the visible duplicate states mean.

**[EDIT_QUEUE.md](EDIT_QUEUE.md)** — Documents the Edit Queue workflow for exporting original photos to an external folder, editing them in any tool, and importing the edited results back into Tedography. Covers setup, the export and import steps, and how imported files inherit metadata (album memberships, keywords, location, capture date) from their sources.

**[KEYWORDS_USAGE_GUIDE.md](KEYWORDS_USAGE_GUIDE.md)** — A user-facing guide explaining how keywords work in Tedography, covering what they are for, how to create and organize them into a hierarchy, how to rename them, and how to assign them to photos.

**[MULTIUSER_CHANGES.md](MULTIUSER_CHANGES.md)** — Documents the user-visible changes introduced by the multi-user RBAC implementation, organized by audience (admin vs. regular user). Includes a feature permission reference showing which operations are restricted to which roles.

**[PEOPLE_BROWSE.md](PEOPLE_BROWSE.md)** — Describes the dedicated People browse page at `/people`, its purpose as a proper browse surface for all known people, and how it fits into the overall People feature set without requiring the full Person Detail experience.

**[PEOPLE_ENROLLMENT.md](PEOPLE_ENROLLMENT.md)** — Explains the enrollment and face-example management system for improving recognition quality over time, distinguishing between confirmed detections, reference face examples, and the enrollment workflow that links them to a `Person` record.

**[PEOPLE_MAINTENANCE.md](PEOPLE_MAINTENANCE.md)** — Describes the People Maintenance tools for keeping person data accurate over time, including a scoped maintenance workflow that lets you work through a targeted subset of the archive rather than reprocessing the entire library.

**[PEOPLE_RECOGNITION_RUN_SUMMARY.md](PEOPLE_RECOGNITION_RUN_SUMMARY.md)** — Documents the People Recognition Run Summary dialog that appears automatically after running face recognition, explaining when it opens, what breakdown it shows (detections, matches, skips), and what direct review actions it surfaces.

**[PEOPLE_REVIEW_UI.md](PEOPLE_REVIEW_UI.md)** — Describes the people-review workbench at `/people/review`, an admin-like surface for validating face detections and confirming or rejecting matches. Explains its scope as an early-phase validation tool before a fuller person-management experience is added.

**[PEOPLE_SEARCH.md](PEOPLE_SEARCH.md)** — Explains the People section in Tedography Search, covering the two concepts it supports: filtering by confirmed people metadata (derived `mediaAsset.people`) and filtering by unresolved face-review state. Documents how the two concepts differ and when each is useful.

**[PEOPLE_USAGE_GUIDE.md](PEOPLE_USAGE_GUIDE.md)** — A user-facing reference guide explaining what the People features are for, how face detection and recognition flow into confirmed people metadata on assets, and how to use People in day-to-day browsing and searching.

**[PERSON_DETAIL.md](PERSON_DETAIL.md)** — Documents the Person Detail page at `/people/:personId`, which gives each person a dedicated home in Tedography showing their confirmed photo appearances and face examples. Explains its scope as an early-phase page before a full person-management system is built.

**[SELECTION_ORDERING.md](SELECTION_ORDERING.md)** — Documents how selection order is established and maintained in the web app: single click sets `[assetId]`, Cmd/Ctrl-click appends to the end. Covers how this affects loupe and slideshow navigation where order determines which asset is "first."

**[SMART_ALBUM_ORDER.md](SMART_ALBUM_ORDER.md)** — Describes Tedography's hybrid album-ordering model, where assets with a usable `captureDateTime` sort chronologically and assets without one can be manually ordered within an album using custom ordering modes (`Custom`, `Name`, `NumericThenName`).

**[tedography_slideshow_features.md](tedography_slideshow_features.md)** — A feature spec for the slideshow mode in Tedography, covering playback controls (play/pause, next/prev, skip, adjustable speed, loop toggle), transitions, and additional features added after the initial spec.
