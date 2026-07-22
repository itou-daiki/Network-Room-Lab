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
            <div className="context-term-body">
              {term.fullName && <div className="term-explanation formal-name"><span>正式名称・略語の元</span><p><b>{term.fullName}</b></p></div>}
              <div className="term-explanation"><span>まず覚える意味</span><p><b>{term.short}</b></p></div>
              <div className="term-explanation"><span>何のために使い、どう動くか</span><p>{term.detail}</p></div>
              <div className="term-explanation example"><span>この実習での具体例</span><p>{term.example}</p></div>
            </div>
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
      [term.label, term.reading, term.fullName, term.short, term.detail, term.example, term.category]
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
      <p className="glossary-guide">暗記するための一覧ではありません。用語を開くと、正式名称、まず覚える意味、使う目的と動き、この実習での具体例の順に確認できます。</p>
      <div className="glossary-grid">
        {terms.map((term) => (
          <details key={term.id} className="glossary-card">
            <summary><span>{term.category}</span><b>{term.label}</b>{term.reading && <small>{term.reading}</small>}</summary>
            <div className="glossary-card-body">
              {term.fullName && <div className="term-explanation formal-name"><span>正式名称・略語の元</span><p><b>{term.fullName}</b></p></div>}
              <div className="term-explanation"><span>まず覚える意味</span><p><b>{term.short}</b></p></div>
              <div className="term-explanation"><span>何のために使い、どう動くか</span><p>{term.detail}</p></div>
              <div className="term-explanation example"><span>この実習での具体例</span><p>{term.example}</p></div>
            </div>
          </details>
        ))}
        {terms.length === 0 && <p className="empty-state">該当する用語がありません。別の言葉で検索してください。</p>}
      </div>
    </section>
  );
}
