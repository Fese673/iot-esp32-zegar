interface DocumentationCodeBlockProps {
  className?: string;
  children: string;
}

function DocumentationCodeBlock({ className, children }: DocumentationCodeBlockProps) {
  const languageMatch = /language-([\w-]+)/.exec(className ?? '');
  const languageLabel = languageMatch?.[1]?.toUpperCase() ?? 'TEXT';

  return (
    <div className="docs-code-shell">
      <div className="docs-code-head mono">
        <span>{languageLabel}</span>
      </div>
      <pre className="docs-code-block">
        <code className={className ? `hljs ${className}` : 'hljs'}>{children}</code>
      </pre>
    </div>
  );
}

export default DocumentationCodeBlock;
