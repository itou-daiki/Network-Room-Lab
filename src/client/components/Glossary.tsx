import { useMemo, useState } from "react";

import { NETWORK_GLOSSARY, glossaryTerm } from "../../shared/glossary";

export function ContextTerms({ ids, title = "この場面の用語" }: { ids: string[]; title?: string }) {
  const terms = ids.map(glossaryTerm).filter((term) => term !== undefined);
  if (terms.length === 0) return null;

  return (
    <aside className="context-terms" aria-label={title}>
      <div className="context-terms-heading"><span>?</span><b>{title}</b><small>用語を押すと説明が開きます</small></div>
      <div className="context-term-list">
        {terms.map((term) => (
          <details key={term.id} className="context-term">
            <summary>{term.label}{term.reading && <small>（{term.reading}）</small>}</summary>
            <p><b>{term.short}</b>{term.detail}</p>
            <span>例：{term.example}</span>
          </details>
        ))}
      </div>
    </aside>
  );
}

export function GlossaryPanel() {
  const [query, setQuery] = useState("");
  const terms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return NETWORK_GLOSSARY;
    return NETWORK_GLOSSARY.filter((term) =>
      [term.label, term.reading, term.short, term.detail, term.example, term.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [query]);

  return (
    <section className="panel glossary-panel" aria-labelledby="glossary-title">
      <div className="panel-heading glossary-heading">
        <div><p className="panel-kicker">分からない言葉をその場で確認</p><h2 id="glossary-title">やさしいネットワーク用語集</h2></div>
        <label><span className="sr-only">用語を検索</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：DNS、出口、暗号化" /></label>
      </div>
      <p className="glossary-guide">暗記するための一覧ではありません。操作中に分からない言葉が出たとき、意味と具体例を確かめるために使います。</p>
      <div className="glossary-grid">
        {terms.map((term) => (
          <details key={term.id} className="glossary-card">
            <summary><span>{term.category}</span><b>{term.label}</b>{term.reading && <small>{term.reading}</small>}</summary>
            <div><b>{term.short}</b><p>{term.detail}</p><small>具体例：{term.example}</small></div>
          </details>
        ))}
        {terms.length === 0 && <p className="empty-state">該当する用語がありません。別の言葉で検索してください。</p>}
      </div>
    </section>
  );
}
