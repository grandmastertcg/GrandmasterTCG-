"use client";

import { useEffect, useMemo, useState } from "react";
import { CONDITIONS, GAMES, demoCatalog, gameHue, gbp, type Product } from "@/lib/catalog";
import { commissionForLine } from "@/lib/commission";
import { supabase } from "@/lib/supabase-browser";

type SortKey = "price-asc" | "price-desc" | "name" | "stock";

export default function Home() {
  const [products, setProducts] = useState<Product[]>(demoCatalog);
  const [source, setSource] = useState<"sample" | "live">("sample");
  const [q, setQ] = useState("");
  const [game, setGame] = useState<string>("All games");
  const [condition, setCondition] = useState<string>("Any condition");
  const [rarity, setRarity] = useState("Any rarity");
  const [maxPounds, setMaxPounds] = useState("");
  const [sort, setSort] = useState<SortKey>("price-asc");
  const [view, setView] = useState<"list" | "grid">("list");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [basketOpen, setBasketOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [accountLabel, setAccountLabel] = useState("Sign in");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") setNotice("Payment received. A confirmation will follow by email.");
    if (params.get("checkout") === "cancelled") setNotice("Checkout was cancelled. Your basket is unchanged.");
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAccountLabel(accountLabelFor(data.session?.user)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountLabel(accountLabelFor(session?.user));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetch("/api/products")
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data.products)) {
          setProducts(data.products);
          setSource("live");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedId(null);
        setBasketOpen(false);
        setFiltersOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rarities = useMemo(() => {
    const values = new Set(products.map((product) => product.rarity).filter((value): value is string => Boolean(value)));
    return ["Any rarity", ...Array.from(values).sort()];
  }, [products]);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    const maxPence = maxPounds.trim() === "" || Number.isNaN(Number(maxPounds))
      ? Infinity
      : Math.round(Number(maxPounds) * 100);

    const list = products.filter((product) => {
      if (product.stock <= 0) return false;
      if (game !== "All games" && product.game !== game) return false;
      if (condition === "Graded" && !product.grader) return false;
      if (condition !== "Any condition" && condition !== "Graded" && product.condition !== condition) return false;
      if (rarity !== "Any rarity" && (product.rarity || "Unspecified") !== rarity) return false;
      if (product.price_pence > maxPence) return false;
      if (!query) return true;
      const haystack = [product.name, product.set_name, product.card_number, product.rarity, product.game, product.finish]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    return list.sort((a, b) => {
      if (sort === "price-desc") return b.price_pence - a.price_pence;
      if (sort === "name") return a.name.localeCompare(b.name) || a.price_pence - b.price_pence;
      if (sort === "stock") return b.stock - a.stock;
      return a.price_pence - b.price_pence;
    });
  }, [products, q, game, condition, rarity, maxPounds, sort]);

  const selected = products.find((product) => product.id === selectedId) ?? null;
  const copies = selected
    ? products
        .filter((product) => product.stock > 0 && product.name === selected.name && product.game === selected.game)
        .sort((a, b) => a.price_pence - b.price_pence)
    : [];

  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const total = products.reduce((sum, product) => sum + (cart[product.id] || 0) * product.price_pence, 0);
  const fee = products.reduce((sum, product) => sum + commissionForLine(product.price_pence, cart[product.id] || 0), 0);
  const cheapest = visible.length ? Math.min(...visible.map((product) => product.price_pence)) : 0;
  const picks = products
    .filter((product) => product.stock > 0 && product.price_pence <= 500 && (game === "All games" || product.game === game))
    .sort((a, b) => a.price_pence - b.price_pence)
    .slice(0, 4);

  function otherCopies(product: Product) {
    return products.filter((item) => item.id !== product.id && item.stock > 0 && item.name === product.name && item.game === product.game).length;
  }

  function add(product: Product) {
    setCart((current) => ({
      ...current,
      [product.id]: Math.min((current[product.id] || 0) + 1, product.stock)
    }));
    setNotice(`${product.name} added to basket`);
  }

  function setQty(product: Product, quantity: number) {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[product.id];
      else next[product.id] = Math.min(quantity, product.stock);
      return next;
    });
  }

  function resetFilters() {
    setQ("");
    setGame("All games");
    setCondition("Any condition");
    setRarity("Any rarity");
    setMaxPounds("");
    setSort("price-asc");
  }

  async function checkout() {
    setBusy(true);
    setNotice("");
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        window.location.href = "/login";
        return;
      }
      const items = Object.entries(cart)
        .filter(([, quantity]) => quantity > 0)
        .map(([product_id, quantity]) => ({ product_id, quantity }));
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ items })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout could not be started.");
      if (data.url) window.location.href = data.url;
      else throw new Error("Payment service is not configured yet.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Checkout error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="market">
      <header className="mk-top">
        <div className="mk-shell mk-nav">
          <a className="mk-logo" href="/">
            <span>G</span>
            Grandmaster<b>TCG</b>
          </a>
          <label className="mk-search">
            <span className="sr">Search the market</span>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search cards, sets or collector numbers"
            />
          </label>
          <div className="mk-nav-actions">
            <a className="mk-account" href={accountLabel === "Sign in" ? "/login" : "/account"}>{accountLabel}</a>
            <button className="mk-basket-btn" onClick={() => { setBasketOpen(true); setSelectedId(null); }}>
              Basket
              <strong>{count}</strong>
            </button>
          </div>
        </div>
        <div className="mk-shell mk-games" role="tablist" aria-label="Games">
          {GAMES.map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={game === item}
              className={game === item ? "is-on" : ""}
              onClick={() => setGame(item)}
            >
              {item === "Magic: The Gathering" ? "Magic" : item}
            </button>
          ))}
        </div>
      </header>

      <main className="mk-shell mk-main">
        {source === "sample" && (
          <p className="mk-banner">Sample market data is on display. Live stock from your catalogue replaces it automatically, and sample cards cannot be purchased.</p>
        )}
        {notice && <p className="mk-notice" role="status">{notice}</p>}

        <section className="mk-hero">
          <div>
            <p className="mk-kicker">UK singles desk</p>
            <h1>Every listing priced. Every condition visible.</h1>
            <p>Search one row per copy, with the condition, price and seller written out. Create a free account to buy from the market or list cards of your own.</p>
          </div>
          <dl className="mk-stats">
            <div><dt>Listings</dt><dd>{products.filter((product) => product.stock > 0).length}</dd></div>
            <div><dt>Showing</dt><dd>{visible.length}</dd></div>
            <div><dt>From</dt><dd>{visible.length ? gbp(cheapest) : "—"}</dd></div>
          </dl>
        </section>

        {!q && picks.length > 0 && (
          <section className="mk-picks" aria-label="Low price picks">
            <h2>Under £5</h2>
            <div>
              {picks.map((product) => (
                <button key={product.id} onClick={() => setSelectedId(product.id)}>
                  <CardFace product={product} />
                  <span>
                    <strong>{product.name}</strong>
                    <em>{product.condition}</em>
                  </span>
                  <b>{gbp(product.price_pence)}</b>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mk-layout">
          <aside className={filtersOpen ? "mk-filters is-open" : "mk-filters"}>
            <div className="mk-filter-head">
              <h2>Filters</h2>
              <button onClick={resetFilters}>Reset</button>
            </div>
            <label>
              Condition
              <select value={condition} onChange={(event) => setCondition(event.target.value)}>
                {CONDITIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Rarity
              <select value={rarity} onChange={(event) => setRarity(event.target.value)}>
                {rarities.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Max price (£)
              <input
                inputMode="decimal"
                value={maxPounds}
                placeholder="Any"
                onChange={(event) => setMaxPounds(event.target.value)}
              />
            </label>
            <ul className="mk-promise">
              <li>Condition written in full, not a code</li>
              <li>Price is the price. No seller fees to decode</li>
              <li>UK delivery at checkout</li>
            </ul>
          </aside>

          <section className="mk-results" id="market">
            <div className="mk-toolbar">
              <div>
                <h2>{game === "All games" ? "All singles" : game}</h2>
                <p>{visible.length} listing{visible.length === 1 ? "" : "s"}</p>
              </div>
              <div className="mk-toolbar-actions">
                <button className="mk-text-btn" onClick={() => setFiltersOpen((open) => !open)}>
                  {filtersOpen ? "Hide filters" : "Filters"}
                </button>
                <label>
                  <span className="sr">Sort</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                    <option value="name">Name</option>
                    <option value="stock">Most in stock</option>
                  </select>
                </label>
                <div className="mk-view" role="group" aria-label="Layout">
                  <button className={view === "list" ? "is-on" : ""} onClick={() => setView("list")}>List</button>
                  <button className={view === "grid" ? "is-on" : ""} onClick={() => setView("grid")}>Cards</button>
                </div>
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="mk-empty">
                <p>No listings match those filters.</p>
                <button onClick={resetFilters}>Clear filters</button>
              </div>
            ) : view === "list" ? (
              <div className="mk-table" role="table">
                <div className="mk-row mk-head" role="row">
                  <span>Card</span><span>Set</span><span>Condition</span><span>Stock</span><span>Price</span><span />
                </div>
                {visible.map((product) => (
                  <article
                    key={product.id}
                    className={selectedId === product.id ? "mk-row is-on" : "mk-row"}
                    tabIndex={0}
                    onClick={() => { setSelectedId(product.id); setBasketOpen(false); }}
                    onKeyDown={(event) => { if (event.key === "Enter") { setSelectedId(product.id); setBasketOpen(false); } }}
                  >
                    <div className="mk-identity">
                      <CardFace product={product} />
                      <div>
                        <strong>{product.name}</strong>
                        <small className="mk-sub">{[product.rarity, product.finish, product.language].filter(Boolean).join(" · ") || product.game}</small>
                        <small>Sold by {product.seller_name || "GrandmasterTCG"}</small>
                        <small className="mk-mobile-meta">{product.condition}</small>
                        {otherCopies(product) > 0 && <em>{otherCopies(product)} other {otherCopies(product) === 1 ? "copy" : "copies"}</em>}
                      </div>
                    </div>
                    <div className="mk-set">
                      <span>{product.set_name || "Set not listed"}</span>
                      <small>{product.card_number || product.game}</small>
                    </div>
                    <div className={`mk-cond cond-${product.condition.split(" ")[0].toLowerCase()}`}>
                      {product.condition}
                      {product.cert_number && <small>Cert {product.cert_number}</small>}
                    </div>
                    <div>{product.stock === 1 ? "1 left" : `${product.stock} in stock`}</div>
                    <div className="mk-price">{gbp(product.price_pence)}</div>
                    <button
                      className="mk-add"
                      onClick={(event) => { event.stopPropagation(); add(product); }}
                    >
                      Add
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mk-grid">
                {visible.map((product) => (
                  <article key={product.id} className="mk-card" tabIndex={0} onClick={() => setSelectedId(product.id)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedId(product.id); }}>
                    <CardFace product={product} large />
                    <p className="mk-game">{product.game}</p>
                    <h3>{product.name}</h3>
                    <p>{product.set_name || "Set not listed"} · {product.condition}</p>
                    <div>
                      <strong>{gbp(product.price_pence)}</strong>
                      <button className="mk-add" onClick={(event) => { event.stopPropagation(); add(product); }}>Add</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mk-steps">
          <h2>How buying works</h2>
          <ol>
            <li><strong>Search the card.</strong> Filter by game, condition, rarity and the most you want to pay.</li>
            <li><strong>Read the copy.</strong> Each row is one listing, so a played copy never hides behind a near mint price.</li>
            <li><strong>Check out in GBP.</strong> Stripe takes payment and collects a UK shipping address.</li>
          </ol>
        </section>
      </main>

      <footer className="mk-foot">
        <div className="mk-shell">
          <strong>GrandmasterTCG</strong>
          <span>Independent UK trading-card retailer. Game names and card names are trademarks of their owners.</span>
          <a href="/terms">Terms and conditions</a>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>

      {selected && (
        <div className="mk-scrim" onClick={() => setSelectedId(null)}>
          <aside className="mk-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={selected.name}>
            <button className="mk-close" onClick={() => setSelectedId(null)}>Close</button>
            <CardSides product={selected} />
            <p className="mk-game">{selected.game}</p>
            <h2>{selected.name}</h2>
            <p className="mk-meta">
              {[selected.set_name, selected.card_number, selected.rarity, selected.finish, selected.language].filter(Boolean).join(" · ")}
            </p>
            <p className="mk-meta">Sold by {selected.seller_name || "GrandmasterTCG"}</p>
            {selected.description && <p>{selected.description}</p>}
            <div className="mk-offer">
              <div>
                <span>{selected.condition}{selected.cert_number ? ` · Cert ${selected.cert_number}` : ""}</span>
                <strong>{gbp(selected.price_pence)}</strong>
                <small>{selected.stock === 1 ? "Only 1 in stock" : `${selected.stock} available`}</small>
              </div>
              <button className="mk-add" onClick={() => add(selected)}>Add to basket</button>
            </div>
            {copies.length > 1 && (
              <div className="mk-copies">
                <h3>All copies of this card</h3>
                {copies.map((copy) => (
                  <button key={copy.id} className={copy.id === selected.id ? "is-on" : ""} onClick={() => setSelectedId(copy.id)}>
                    <span>{copy.condition}</span>
                    <span>{copy.stock} in stock</span>
                    <b>{gbp(copy.price_pence)}</b>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}

      {basketOpen && (
        <div className="mk-scrim" onClick={() => setBasketOpen(false)}>
          <aside className="mk-drawer mk-basket" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Basket">
            <button className="mk-close" onClick={() => setBasketOpen(false)}>Close</button>
            <h2>Basket</h2>
            {count === 0 ? (
              <p>Your basket is empty. Add a listing to get started.</p>
            ) : (
              <>
                <ul>
                  {products.filter((product) => cart[product.id]).map((product) => (
                    <li key={product.id}>
                      <div>
                        <strong>{product.name}</strong>
                        <small>{product.condition} · {gbp(product.price_pence)}</small>
                      </div>
                      <div className="mk-qty">
                        <button onClick={() => setQty(product, (cart[product.id] || 0) - 1)} aria-label={`Remove one ${product.name}`}>−</button>
                        <span>{cart[product.id]}</span>
                        <button onClick={() => setQty(product, (cart[product.id] || 0) + 1)} aria-label={`Add another ${product.name}`}>+</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mk-total"><span>{count} item{count === 1 ? "" : "s"}</span><strong>{gbp(total)}</strong></p>
                <p className="mk-fine">GrandmasterTCG keeps {gbp(fee)} from this sale. That is 2% of each card, and never more than £100 per card. The seller also pays the card processing fee. Sellers are paid by Stripe only after you confirm the tracked parcel arrived.</p>
                <button className="mk-checkout" disabled={busy} onClick={checkout}>
                  {busy ? "Starting checkout…" : "Secure checkout"}
                </button>
                <p className="mk-fine">Sign in to check out. Stripe collects the UK shipping address. Sample listings cannot be purchased.</p>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function accountLabelFor(user?: { email?: string | null; user_metadata?: { display_name?: string } }) {
  const name = user?.user_metadata?.display_name?.trim();
  if (name) return name;
  if (user?.email) return user.email.split("@")[0];
  return "Sign in";
}

function CardSides({ product }: { product: Product }) {
  if (!product.image_url && !product.back_image_url) return <CardFace product={product} large />;
  return (
    <div className="mk-sides">
      <figure>
        {product.image_url ? <img className="mk-face is-large" src={product.image_url} alt="" /> : <CardFace product={product} large />}
        <figcaption>Front</figcaption>
      </figure>
      {product.back_image_url && (
        <figure>
          <img className="mk-face is-large" src={product.back_image_url} alt="" />
          <figcaption>Back</figcaption>
        </figure>
      )}
    </div>
  );
}

function CardFace({ product, large = false }: { product: Product; large?: boolean }) {
  if (product.image_url) {
    return <img className={large ? "mk-face is-large" : "mk-face"} src={product.image_url} alt="" />;
  }
  return (
    <span className={`mk-face is-${gameHue(product.game)}${large ? " is-large" : ""}`} aria-hidden>
      <i>{product.game.slice(0, 2)}</i>
      <b>{product.card_number || "Single"}</b>
    </span>
  );
}
