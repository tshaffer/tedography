# AI Edit Queue

The AI Edit Queue lets you mark photos for later editing in ChatGPT.com. As you browse your library, you can queue individual photos with an optional natural-language prompt describing the edit you want. When you're ready, export the queue to copy the files to a folder along with a plain-text prompt sheet — then upload them manually to ChatGPT.com.

---

## Workflow

### 1. Browse and queue photos

While browsing your library or search results, select a photo you want to edit. Open the **More** menu (overflow button in the toolbar) and choose **Add to AI Queue…**.

A small dialog appears showing the photo's filename and a text field for your prompt. Type what you want done — or leave it blank if you haven't decided yet — and click **Add to Queue**.

> Examples: `make the sky more dramatic`, `convert to black and white, high contrast`, `remove the background clutter`

If you later want to change the prompt for a queued photo, select it again and choose **Edit AI Queue Prompt…** from the More menu. The dialog reopens with your existing prompt so you can revise it.

### 2. Review the queue

The **AI Edit Queue** panel appears in the left sidebar whenever there are items in the queue. Each entry shows:

- The photo's filename
- Your prompt (or *no prompt* if you left it blank)
- A **×** button to remove that photo from the queue

### 3. Export

Click **Export Queue** in the queue panel. Tedography will:

1. Copy the original file for each queued photo into the configured export folder
2. Write a `prompts.txt` file in the same folder pairing each filename with its prompt

A confirmation message shows the export path and the number of files written.

### 4. Upload to ChatGPT.com

Open the export folder in Finder, open `prompts.txt` to see your prompts, then drag each photo into ChatGPT.com and paste the corresponding prompt.

### 5. Clear the queue

Once you've processed the photos, click **Clear** in the queue panel to empty the queue and start fresh. Clearing does not delete the exported files.

---

## Setup

Add the following line to `apps/api/.env` to specify where exported files are written:

```
TEDOGRAPHY_AI_QUEUE_EXPORT_PATH=/Users/yourname/Desktop/AI-Queue
```

The folder will be created automatically if it does not exist. The Export button will show an error if this variable is not set.

---

## Notes

- **Exports overwrite**: each export run replaces the previous contents of the export folder. Process or move your files before exporting a new batch.
- **Duplicate filenames**: if two queued photos from different albums have the same filename, the second will overwrite the first in the export folder.
- **Originals are never modified**: the queue and export only work with copies of your files.
- **Prompts persist**: queue entries are stored in MongoDB, so the queue survives app restarts.
