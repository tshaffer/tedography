# AI Edit Queue

The AI Edit Queue lets you mark photos for AI-assisted editing. As you browse your library, you can queue individual photos with a natural-language prompt describing the edit you want. When you're ready, send the queue directly to the Gemini API — Tedography handles the upload and saves the edited results to your configured output folder automatically.

An Export Queue option is also available for manual workflows where you want to copy files and prompts to a folder for uploading to an external service yourself.

---

## Workflow

### 1. Browse and queue photos

While browsing your library or search results, select a photo you want to edit. Open the **More** menu (overflow button in the toolbar) and choose **Add to AI Queue…**.

A dialog appears showing the photo's filename and a text field for your prompt. Type what you want done — or leave it blank — and click **Add to Queue**.

> Examples: `make the sky more dramatic`, `convert to black and white, high contrast`, `remove the background clutter`

If you want to change the prompt for a queued photo, select it again and choose **Edit AI Queue Prompt…** from the More menu. The dialog reopens with your existing prompt so you can revise it.

### 2. Review the queue

The **AI Edit Queue** panel appears in the left sidebar whenever there are items in the queue. Each entry shows:

- The photo's filename
- Your prompt (or *no prompt* if you left it blank)
- A **×** button to remove that photo from the queue

### 3. Process with Gemini

Click **Process with Gemini** in the queue panel. Tedography will process the **first entry in the queue**:

1. Read the photo from disk and base64-encode it
2. Send the image and prompt to the Gemini API (`gemini-2.5-flash-preview-05-20`)
3. Save the returned edited image as `<original-filename>_gemini.jpg` in the configured output folder

When processing completes, the panel shows whether it succeeded or failed. If it failed, the error message is displayed. Click **Process with Gemini** again to process the next entry in the queue.

HEIC/HEIF originals are automatically converted — Tedography sends the JPEG display version to Gemini rather than the raw HEIC file.

### 4. Review the results

Open the configured output folder in Finder to review the Gemini-edited versions alongside the originals. The original files are never modified.

### 5. Export Queue (manual alternative)

Click **Export Queue** to copy the original files and a `prompts.txt` file to the output folder without calling the API. Use this if you want to upload to an external AI service manually.

### 6. Clear the queue

Click **Clear** to empty the queue and start fresh. Clearing does not delete any output files.

---

## Setup

Add the following two variables to `apps/api/.env`:

```
GOOGLE_API_KEY=your-google-api-key-here
TEDOGRAPHY_AI_QUEUE_EXPORT_PATH=/Users/yourname/Desktop/AI-Queue
```

| Variable | Purpose |
|---|---|
| `GOOGLE_API_KEY` | Gemini API key from Google AI Studio. Required for Process with Gemini. |
| `TEDOGRAPHY_AI_QUEUE_EXPORT_PATH` | Folder where Gemini output files (and manual exports) are saved. Created automatically if it does not exist. Required for both Process and Export. |

---

## Architecture

### Backend

| File | Purpose |
|---|---|
| `apps/api/src/import/aiImageEditService.ts` | Calls the Gemini API. Reads the source image, encodes it, sends it with the prompt, and writes the returned image to disk. |
| `apps/api/src/routes/aiQueueRoutes.ts` | HTTP routes: `GET /api/ai-queue`, `POST /api/ai-queue`, `DELETE /api/ai-queue`, `DELETE /api/ai-queue/:assetId`, `POST /api/ai-queue/process`, `POST /api/ai-queue/export` |
| `apps/api/src/repositories/aiQueueRepository.ts` | MongoDB CRUD for queue entries. |
| `apps/api/src/models/aiEditQueueEntryModel.ts` | Mongoose schema for the `aiEditQueue` collection. |
| `apps/api/src/config.ts` | Reads `GOOGLE_API_KEY` and `TEDOGRAPHY_AI_QUEUE_EXPORT_PATH` from `.env`. |

### Frontend

| File | Purpose |
|---|---|
| `apps/web/src/api/aiQueueApi.ts` | Typed fetch wrappers: `getAiQueue`, `addToAiQueue`, `removeFromAiQueue`, `clearAiQueue`, `exportAiQueue`, `processAiQueueWithGemini` |
| `apps/web/src/components/aiQueue/AiQueueDialog.tsx` | Modal dialog showing the queue with Process, Export, and Clear actions. |
| `apps/web/src/components/aiQueue/AddToAiQueueDialog.tsx` | Dialog for setting or editing the prompt for a single photo. |
| `apps/web/src/App.tsx` | State management (`aiQueueEntries`, `aiQueueProcessing`, notices/errors) and handlers wired to both the side panel and the dialog. |

### Gemini integration

`POST /api/ai-queue/process` processes only the **first queue entry** and calls `editImageWithGemini()` for it. The function:

1. Resolves the source file path — display JPEG for HEIC originals, original file otherwise
2. Reads the file and encodes it as base64
3. Constructs a `Content[]` payload with the prompt as text and the image as `inlineData`
4. Calls `genAI.models.generateContent()` with `responseModalities: ['IMAGE']`
5. Extracts the `inlineData` blob from the first candidate's parts and writes it to disk

The SDK used is `@google/genai` v2 (`GoogleGenAI` class, `models.generateContent` method).

---

## Notes

- **Originals are never modified.** Gemini output is always saved as a new file.
- **Output filenames**: `photo.jpg` → `photo_gemini.jpg`. If two queued photos from different folders share the same filename, the second will overwrite the first in the output folder.
- **One at a time.** Each click of **Process with Gemini** sends only the first queued entry. Click again to process the next.
- **Prompts persist.** Queue entries are stored in MongoDB and survive app restarts.
- **Partial failures.** If some images fail and others succeed, the panel reports both counts and shows the first error. Successfully processed images are still saved.
- **Model.** The current model is `gemini-2.5-flash-preview-05-20`. To change it, update the model string in `apps/api/src/import/aiImageEditService.ts`.
