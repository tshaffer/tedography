export interface HelpAskCitation {
  slug: string;
  title: string;
}

export interface HelpAskResult {
  answer: string;
  citations: HelpAskCitation[];
}

export async function askHelpQuestion(question: string): Promise<HelpAskResult> {
  const response = await fetch('/api/help/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return (await response.json()) as HelpAskResult;
}
