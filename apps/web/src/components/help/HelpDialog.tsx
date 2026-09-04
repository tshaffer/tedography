import {
  useMemo,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type LiHTMLAttributes,
  type TableHTMLAttributes,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { helpTopics, helpCategoryOrder, type HelpTopic } from '@tedography/shared';
import { askHelpQuestion, type HelpAskResult } from '../../api/helpApi';

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1200,
};

const dialogStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  width: 'min(1100px, 96vw)',
  height: 'min(88vh, 760px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: '16px',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '12px',
};

const closeButtonStyle: CSSProperties = {
  backgroundColor: '#f4f4f4',
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '6px 10px',
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  gap: '16px',
  overflow: 'hidden',
};

const sidebarStyle: CSSProperties = {
  width: '230px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const searchInputStyle: CSSProperties = {
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  padding: '6px 8px',
  fontSize: '12px',
  marginBottom: '10px',
};

const topicListStyle: CSSProperties = {
  overflowY: 'auto',
  minHeight: 0,
};

const categoryLabelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  margin: '12px 0 4px',
};

const topicItemStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: '6px',
  padding: '6px 8px',
  fontSize: '13px',
  cursor: 'pointer',
  color: '#333',
};

const topicItemSelectedStyle: CSSProperties = {
  ...topicItemStyle,
  backgroundColor: '#eef3fb',
  color: '#1a5cc8',
  fontWeight: 600,
};

const mainStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  paddingRight: '4px',
};

const askRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '12px',
};

const askInputStyle: CSSProperties = {
  flex: 1,
  border: '1px solid #c8c8c8',
  borderRadius: '6px',
  padding: '8px 10px',
  fontSize: '13px',
};

const askButtonStyle: CSSProperties = {
  backgroundColor: '#1a5cc8',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  padding: '8px 14px',
};

const askButtonDisabledStyle: CSSProperties = {
  ...askButtonStyle,
  backgroundColor: '#a9c1e8',
  cursor: 'default',
};

const answerBoxStyle: CSSProperties = {
  backgroundColor: '#f6f9fe',
  border: '1px solid #dbe7fa',
  borderRadius: '8px',
  padding: '12px',
  marginBottom: '16px',
  fontSize: '13px',
  lineHeight: 1.5,
};

const citationChipStyle: CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#fff',
  border: '1px solid #c8d8f2',
  borderRadius: '999px',
  padding: '2px 10px',
  fontSize: '11px',
  cursor: 'pointer',
  color: '#1a5cc8',
  marginRight: '6px',
  marginTop: '8px',
};

const errorTextStyle: CSSProperties = {
  color: '#b3261e',
  fontSize: '12px',
  marginBottom: '12px',
};

const articleTitleStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: '17px',
};

const markdownComponents = {
  h1: (props: HTMLAttributes<HTMLHeadingElement>) => <h3 style={{ fontSize: '15px', marginTop: '16px' }} {...props} />,
  h2: (props: HTMLAttributes<HTMLHeadingElement>) => <h3 style={{ fontSize: '15px', marginTop: '16px' }} {...props} />,
  h3: (props: HTMLAttributes<HTMLHeadingElement>) => <h4 style={{ fontSize: '14px', marginTop: '14px' }} {...props} />,
  p: (props: HTMLAttributes<HTMLParagraphElement>) => <p style={{ fontSize: '13px', lineHeight: 1.6, margin: '8px 0' }} {...props} />,
  ul: (props: HTMLAttributes<HTMLUListElement>) => <ul style={{ fontSize: '13px', lineHeight: 1.6, paddingLeft: '20px' }} {...props} />,
  li: (props: LiHTMLAttributes<HTMLLIElement>) => <li style={{ margin: '2px 0' }} {...props} />,
  code: (props: HTMLAttributes<HTMLElement>) => (
    <code style={{ backgroundColor: '#f0f0f0', borderRadius: '4px', padding: '1px 5px', fontSize: '12px' }} {...props} />
  ),
  table: (props: TableHTMLAttributes<HTMLTableElement>) => (
    <table style={{ borderCollapse: 'collapse', fontSize: '12px', margin: '8px 0', width: '100%' }} {...props} />
  ),
  th: (props: ThHTMLAttributes<HTMLTableCellElement>) => (
    <th style={{ border: '1px solid #ddd', padding: '4px 8px', textAlign: 'left', backgroundColor: '#f7f7f7' }} {...props} />
  ),
  td: (props: TdHTMLAttributes<HTMLTableCellElement>) => (
    <td style={{ border: '1px solid #ddd', padding: '4px 8px', textAlign: 'left' }} {...props} />
  ),
};

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set, the dialog opens directly to this topic instead of the default. */
  initialSlug?: string | null;
}

function topicMatchesQuery(topic: HelpTopic, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    topic.title.toLowerCase().includes(q) ||
    topic.keywords.some((keyword) => keyword.toLowerCase().includes(q))
  );
}

export function HelpDialog({ open, onClose, initialSlug }: HelpDialogProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug ?? helpTopics[0]?.slug ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [askQuery, setAskQuery] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [askResult, setAskResult] = useState<HelpAskResult | null>(null);

  const filteredTopics = useMemo(
    () => helpTopics.filter((topic) => topicMatchesQuery(topic, searchQuery)),
    [searchQuery]
  );

  const groupedTopics = useMemo(() => {
    const byCategory = new Map<string, HelpTopic[]>();
    for (const topic of filteredTopics) {
      const list = byCategory.get(topic.category) ?? [];
      list.push(topic);
      byCategory.set(topic.category, list);
    }
    for (const list of byCategory.values()) {
      list.sort((a, b) => a.order - b.order);
    }
    return helpCategoryOrder
      .filter((category) => byCategory.has(category))
      .map((category) => ({ category, topics: byCategory.get(category) ?? [] }));
  }, [filteredTopics]);

  const selectedTopic = helpTopics.find((topic) => topic.slug === selectedSlug) ?? null;

  async function handleAsk(): Promise<void> {
    const question = askQuery.trim();
    if (!question) return;
    setAskLoading(true);
    setAskError(null);
    try {
      const result = await askHelpQuestion(question);
      setAskResult(result);
    } catch (error) {
      setAskError(error instanceof Error ? error.message : 'Failed to get an answer');
    } finally {
      setAskLoading(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <section style={dialogStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>Help</h2>
          <button type="button" style={closeButtonStyle} onClick={onClose}>
            Close
          </button>
        </div>
        <div style={bodyStyle}>
          <div style={sidebarStyle}>
            <input
              type="text"
              placeholder="Filter topics…"
              style={searchInputStyle}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <div style={topicListStyle}>
              {groupedTopics.map(({ category, topics }) => (
                <div key={category}>
                  <div style={categoryLabelStyle}>{category}</div>
                  {topics.map((topic) => (
                    <button
                      key={topic.slug}
                      type="button"
                      style={topic.slug === selectedSlug ? topicItemSelectedStyle : topicItemStyle}
                      onClick={() => setSelectedSlug(topic.slug)}
                    >
                      {topic.title}
                    </button>
                  ))}
                </div>
              ))}
              {groupedTopics.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#888' }}>No topics match "{searchQuery}".</p>
              ) : null}
            </div>
          </div>
          <div style={mainStyle}>
            <div style={askRowStyle}>
              <input
                type="text"
                placeholder="Ask a question about Tedography…"
                style={askInputStyle}
                value={askQuery}
                onChange={(event) => setAskQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleAsk();
                }}
              />
              <button
                type="button"
                style={askLoading ? askButtonDisabledStyle : askButtonStyle}
                disabled={askLoading}
                onClick={() => void handleAsk()}
              >
                {askLoading ? 'Asking…' : 'Ask'}
              </button>
            </div>
            {askError ? <p style={errorTextStyle}>{askError}</p> : null}
            {askResult ? (
              <div style={answerBoxStyle}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {askResult.answer}
                </ReactMarkdown>
                {askResult.citations.length > 0 ? (
                  <div>
                    {askResult.citations.map((citation) => (
                      <button
                        key={citation.slug}
                        type="button"
                        style={citationChipStyle}
                        onClick={() => setSelectedSlug(citation.slug)}
                      >
                        {citation.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {selectedTopic ? (
              <article>
                <h3 style={articleTitleStyle}>{selectedTopic.title}</h3>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {selectedTopic.body}
                </ReactMarkdown>
              </article>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
