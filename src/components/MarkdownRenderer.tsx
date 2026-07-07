import React from 'react';
import { Copy, Check, Code, Download } from 'lucide-react';
import katex from 'katex';

interface MarkdownRendererProps {
  content: string;
}

const LANGUAGE_EXTENSIONS: { [key: string]: string } = {
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  html: 'html',
  css: 'css',
  json: 'json',
  python: 'py',
  py: 'py',
  cpp: 'cpp',
  c: 'c',
  java: 'java',
  kotlin: 'kt',
  kt: 'kt',
  rust: 'rs',
  rs: 'rs',
  go: 'go',
  php: 'php',
  ruby: 'rb',
  rb: 'rb',
  swift: 'swift',
  shell: 'sh',
  sh: 'sh',
  bash: 'sh',
  sql: 'sql',
  markdown: 'md',
  md: 'md',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml'
};

const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (text: string, language: string) => {
    const ext = LANGUAGE_EXTENSIONS[language.toLowerCase()] || 'txt';
    const filename = `code_snippet.${ext}`;
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Simple and extremely reliable regex-based markdown parser
  const renderMessageContent = () => {
    if (!content) return null;

    // Split content by code blocks: ```[lang] [code] ```
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      // If it is a code block
      if (part.startsWith('```') && part.endsWith('```')) {
        const codeBlock = part.slice(3, -3);
        const match = codeBlock.match(/^([a-zA-Z0-9+#-]+)?\n([\s\S]*)$/);
        const language = match ? match[1] || 'code' : 'code';
        const codeText = match ? match[2] : codeBlock;
        const blockId = `code-${index}`;

        return (
          <div key={blockId} className="my-4 rounded-xl overflow-hidden nm-inset-sm bg-slate-900 border border-slate-800 text-slate-100 max-w-full">
            <div className="flex justify-between items-center px-4 py-2.5 bg-slate-950/75 border-b border-slate-800/50">
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-blue-400" />
                {language}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                   onClick={() => handleDownload(codeText.trim(), language)}
                  className="p-1 px-2.5 rounded-md text-xs font-mono font-medium hover:bg-slate-800 hover:text-white transition-all duration-300 flex items-center gap-1.5 text-slate-400"
                  title={`Download code as .${LANGUAGE_EXTENSIONS[language.toLowerCase()] || 'txt'}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Download</span>
                </button>
                <button
                  onClick={() => handleCopy(codeText.trim(), blockId)}
                  className="p-1 px-2.5 rounded-md text-xs font-mono font-medium hover:bg-slate-800 hover:text-white transition-all duration-300 flex items-center gap-1.5 text-slate-400"
                  title="Copy code to clipboard"
                >
                  {copiedId === blockId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 text-[11px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed text-slate-200">
              <code>{codeText.trim()}</code>
            </pre>
          </div>
        );
      }

      // If it is regular text, parse display math first, then regular lines
      const subParts = part.split(/(\$\$[\s\S]*?\$\$)/g);

      return (
        <React.Fragment key={index}>
          {subParts.map((subPart, subIndex) => {
            // If it is a display math block
            if (subPart.startsWith('$$') && subPart.endsWith('$$')) {
              const mathText = subPart.slice(2, -2).trim();
              try {
                const html = katex.renderToString(mathText, {
                  displayMode: true,
                  throwOnError: false
                });
                return (
                  <div 
                    key={`display-math-${index}-${subIndex}`} 
                    dangerouslySetInnerHTML={{ __html: html }} 
                    className="my-4 overflow-x-auto max-w-full py-3 bg-slate-50/50 rounded-xl border border-slate-100/50 px-4 text-center flex justify-center"
                  />
                );
              } catch (err) {
                return (
                  <pre key={`display-math-err-${index}-${subIndex}`} className="my-4 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs overflow-x-auto">
                    {subPart}
                  </pre>
                );
              }
            }

            // Otherwise, it is regular markdown text, split by lines
            const lines = subPart.split('\n');
            return (
              <div key={`lines-${index}-${subIndex}`} className="space-y-2">
                {lines.map((line, lineIdx) => {
                  const trimmed = line.trim();
                  
                  // Empty line
                  if (trimmed === '') {
                    return <div key={lineIdx} className="h-2" />;
                  }

                  // Headers
                  if (trimmed.startsWith('#')) {
                    const depth = (trimmed.match(/^#+/) || ['#'])[0].length;
                    const text = trimmed.replace(/^#+\s*/, '');
                    const sizeClass = depth === 1 ? 'text-xl font-bold mt-4 mb-2' 
                                    : depth === 2 ? 'text-lg font-bold mt-3 mb-1.5'
                                    : 'text-base font-bold mt-2.5 mb-1';
                    return (
                      <h4 key={lineIdx} className={`${sizeClass} text-slate-800 font-display tracking-tight`}>
                        {parseInlineFormatting(text)}
                      </h4>
                    );
                  }

                  // Bullet list
                  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    const text = trimmed.slice(2);
                    return (
                      <ul key={lineIdx} className="list-disc pl-5 my-1 space-y-1 text-slate-600 leading-relaxed text-sm">
                        <li>{parseInlineFormatting(text)}</li>
                      </ul>
                    );
                  }

                  // Numbered list
                  if (/^\d+\.\s/.test(trimmed)) {
                    const match = trimmed.match(/^(\d+)\.\s(.*)$/);
                    const num = match ? match[1] : '1';
                    const text = match ? match[2] : trimmed;
                    return (
                      <ol key={lineIdx} className="list-decimal pl-5 my-1 space-y-1 text-slate-600 leading-relaxed text-sm">
                        <li value={parseInt(num)}>{parseInlineFormatting(text)}</li>
                      </ol>
                    );
                  }

                  // Regular paragraph
                  return (
                    <p key={lineIdx} className="text-slate-600 text-sm leading-relaxed">
                      {parseInlineFormatting(line)}
                    </p>
                  );
                })}
              </div>
            );
          })}
        </React.Fragment>
      );
    });
  };

  return <div className="space-y-2 max-w-full overflow-hidden break-words">{renderMessageContent()}</div>;
});

export default MarkdownRenderer;

/**
 * Parses inline formatting like **bold** and `code` into React nodes.
 */
function parseInlineFormatting(text: string): React.ReactNode[] {
  if (!text) return [];

  // 1. Split by inline code first
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.flatMap((codePart, idx) => {
    // If inline code
    if (codePart.startsWith('`') && codePart.endsWith('`')) {
      return (
        <code key={`code-${idx}`} className="px-1.5 py-0.5 bg-slate-100 text-[#ea580c] rounded-md font-mono text-[12px] border border-slate-200/50">
          {codePart.slice(1, -1)}
        </code>
      );
    }

    // 2. Split by inline math: $math$
    const mathParts = codePart.split(/(\$[^\$\s](?:[^\$]*?[^\$\s])?\$)/g);

    return mathParts.flatMap((mathPart, mIdx) => {
      if (mathPart.startsWith('$') && mathPart.endsWith('$')) {
        const formula = mathPart.slice(1, -1);
        try {
          const html = katex.renderToString(formula, {
            displayMode: false,
            throwOnError: false
          });
          return (
            <span 
              key={`math-${idx}-${mIdx}`} 
              dangerouslySetInnerHTML={{ __html: html }} 
              className="inline-block align-middle mx-0.5"
            />
          );
        } catch (err) {
          return <span key={`math-err-${idx}-${mIdx}`} className="text-rose-500 font-mono text-xs">{mathPart}</span>;
        }
      }

      // 3. Split by bold text: **text**
      const boldParts = mathPart.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith('**') && bPart.endsWith('**')) {
          return (
            <strong key={`bold-${idx}-${mIdx}-${bIdx}`} className="font-bold text-slate-900">
              {bPart.slice(2, -2)}
            </strong>
          );
        }
        return bPart;
      });
    });
  });
}
