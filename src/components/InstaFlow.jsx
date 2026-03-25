import { useState, useEffect } from "react";

const API = "https://api.anthropic.com/v1/messages";
const PROXY = (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#07070F",
  card: "#0F0F1C",
  cardHover: "#141428",
  border: "rgba(255,255,255,0.07)",
  borderHi: "rgba(255,255,255,0.14)",
  text: "#EEEEFF",
  muted: "#6666AA",
  grad: "linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)",
  ig1: "#F58529", ig2: "#DD2A7B", ig3: "#8134AF",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function fetchMeta(url) {
  try {
    const r = await fetch(PROXY(url), { signal: AbortSignal.timeout(9000) });
    if (!r.ok) throw new Error();
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const g = (p, n) =>
      doc.querySelector(`meta[property="${p}"]`)?.getAttribute("content") ||
      doc.querySelector(`meta[name="${n || p}"]`)?.getAttribute("content") || "";
    return {
      title: g("og:title") || doc.title || new URL(url).hostname,
      description: g("og:description", "description"),
      image: g("og:image"),
      siteName: g("og:site_name") || new URL(url).hostname,
    };
  } catch {
    try {
      return { title: new URL(url).hostname, description: "", image: "", siteName: new URL(url).hostname };
    } catch {
      return { title: url, description: "", image: "", siteName: url };
    }
  }
}

async function generatePostsAPI(source) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are an Instagram growth expert. Generate exactly 6 Instagram post ideas for:
Type: ${source.type}
URL: ${source.url}
Title: ${source.title}
Description: ${source.description}

Return ONLY a valid JSON array, no markdown, no explanation:
[{"caption":"engaging 150-200 char caption, 1-2 emojis max","hashtags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"],"visualStyle":"brief image direction","postType":"single|carousel|reel","angle":"Tutorial|Product|Tip|Story|BTS|Promo"}]`
      }]
    })
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return []; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const PLATFORMS = {
  blog: { icon: "📝", label: "Blog / Website" },
  etsy: { icon: "🛍️", label: "Etsy Store" },
  shopify: { icon: "🏪", label: "Shopify Store" },
  youtube: { icon: "▶️", label: "YouTube" },
  upload: { icon: "📤", label: "Custom Upload" },
};

const POST_COLORS = [
  "linear-gradient(135deg,#F58529,#DD2A7B)",
  "linear-gradient(135deg,#DD2A7B,#8134AF)",
  "linear-gradient(135deg,#8134AF,#405DE6)",
  "linear-gradient(135deg,#405DE6,#DD2A7B)",
  "linear-gradient(135deg,#833ab4,#fd1d1d)",
  "linear-gradient(135deg,#F58529,#8134AF)",
];

function GradSpan({ children, style = {} }) {
  return (
    <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", ...style }}>
      {children}
    </span>
  );
}

function Badge({ type }) {
  const map = {
    single: { bg: "rgba(245,133,41,.15)", c: "#F58529" },
    carousel: { bg: "rgba(221,42,123,.15)", c: "#DD2A7B" },
    reel: { bg: "rgba(129,52,175,.15)", c: "#8134AF" },
  };
  const s = map[type] || map.single;
  return (
    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", background: s.bg, color: s.c }}>
      {type}
    </span>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 14, height: 14,
      border: `2px solid rgba(255,255,255,.15)`,
      borderTopColor: T.ig2, borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

function PostCard({ post, ogImage, scheduled, onSchedule }) {
  const [hov, setHov] = useState(false);
  const grad = POST_COLORS[post.index % POST_COLORS.length];
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.card, borderRadius: 16,
        border: `1px solid ${hov ? T.borderHi : T.border}`,
        overflow: "hidden",
        transform: hov ? "translateY(-3px)" : "none",
        transition: "transform .2s, border-color .2s",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Square image */}
      <div style={{ aspectRatio: "1", position: "relative", background: ogImage ? `url(${ogImage}) center/cover` : grad, display: "flex", alignItems: "flex-end" }}>
        {ogImage && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,transparent 40%,rgba(0,0,0,.65))" }} />}
        <div style={{ position: "absolute", top: 10, right: 10 }}><Badge type={post.postType} /></div>
        {scheduled && <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,200,100,.9)", color: "#fff", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>✓ QUEUED</div>}
        {!ogImage && (
          <div style={{ position: "relative", zIndex: 1, padding: "10px 12px", fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,.92)", fontFamily: "Syne,sans-serif", lineHeight: 1.2 }}>
            {post.angle}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: T.text, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", flex: 1 }}>
          {post.caption}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {post.hashtags.slice(0, 4).map(h => (
            <span key={h} style={{ fontSize: 10.5, color: T.ig2, background: "rgba(221,42,123,.1)", padding: "2px 8px", borderRadius: 20 }}>#{h}</span>
          ))}
          {post.hashtags.length > 4 && <span style={{ fontSize: 10.5, color: T.muted }}>+{post.hashtags.length - 4}</span>}
        </div>
        <button
          onClick={onSchedule}
          style={{
            padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
            background: scheduled ? "rgba(0,200,100,.12)" : T.grad,
            color: scheduled ? "#00C864" : "#fff",
            fontSize: 12, fontWeight: 600, transition: "opacity .15s",
          }}
        >
          {scheduled ? "✓ Scheduled" : "Add to Schedule"}
        </button>
      </div>
    </div>
  );
}

function NavItem({ id, icon, label, badge, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", padding: "11px 20px",
        background: active ? "rgba(221,42,123,.12)" : hov ? "rgba(255,255,255,.03)" : "none",
        border: "none", borderLeft: `3px solid ${active ? T.ig2 : "transparent"}`,
        color: active ? T.text : T.muted,
        display: "flex", alignItems: "center", gap: 10,
        cursor: "pointer", fontSize: 13.5, fontWeight: active ? 600 : 400,
        textAlign: "left", transition: "all .15s",
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge ? (
        <span style={{ background: T.grad, color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20 }}>{badge}</span>
      ) : null}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function InstaFlow() {
  const [view, setView] = useState("sources");
  const [sources, setSources] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [urlInput, setUrlInput] = useState("");
  const [srcType, setSrcType] = useState("blog");
  const [loadingId, setLoadingId] = useState(null);
  const [urlError, setUrlError] = useState("");

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}} * { box-sizing: border-box; }`;
    document.head.appendChild(style);
  }, []);

  const addSource = async () => {
    let url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith("http")) url = "https://" + url;
    try { new URL(url); } catch { setUrlError("Invalid URL"); return; }
    setUrlError("");

    const id = Date.now().toString();
    setSources(p => [...p, { id, type: srcType, url, title: url, description: "", image: "", status: "fetching" }]);
    setUrlInput("");

    const meta = await fetchMeta(url);
    setSources(p => p.map(s => s.id === id ? { ...s, ...meta, status: "ready" } : s));
  };

  const removeSource = (id) => {
    setSources(p => p.filter(s => s.id !== id));
    setAllPosts(p => p.filter(post => post.sourceId !== id));
  };

  const generateForSource = async (source) => {
    setLoadingId(source.id);
    setSources(p => p.map(s => s.id === source.id ? { ...s, status: "generating" } : s));
    try {
      const raw = await generatePostsAPI(source);
      const posts = raw.map((p, i) => ({
        ...p,
        id: `${source.id}-${Date.now()}-${i}`,
        sourceId: source.id,
        index: i,
        ogImage: source.image || "",
      }));
      setAllPosts(p => [...p.filter(x => x.sourceId !== source.id), ...posts]);
      setSources(p => p.map(s => s.id === source.id ? { ...s, status: "done" } : s));
      setView("posts");
    } catch (e) {
      setSources(p => p.map(s => s.id === source.id ? { ...s, status: "ready" } : s));
    }
    setLoadingId(null);
  };

  const toggleSchedule = (id) =>
    setScheduled(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const exportCSV = () => {
    const scheduled_posts = allPosts.filter(p => scheduled.includes(p.id));
    if (!scheduled_posts.length) { alert("Schedule some posts first!"); return; }
    const rows = [
      ["Caption", "Hashtags", "Post Type", "Visual Style", "Source URL"],
      ...scheduled_posts.map(p => [
        `"${(p.caption || "").replace(/"/g, '""')}"`,
        `"${p.hashtags.map(h => "#" + h).join(" ")}"`,
        p.postType,
        `"${(p.visualStyle || "").replace(/"/g, '""')}"`,
        sources.find(s => s.id === p.sourceId)?.url || "",
      ])
    ].map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([rows], { type: "text/csv" })),
      download: "instaflow_schedule.csv",
    });
    a.click();
  };

  // Distribute scheduled posts across the next 7 days
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const scheduledPosts = allPosts.filter(p => scheduled.includes(p.id));
  const postsByDay = DAYS.map((_, i) => {
    const chunk = Math.ceil(scheduledPosts.length / 7) || 1;
    return scheduledPosts.slice(i * chunk, i * chunk + chunk);
  });

  const NAV = [
    { id: "sources", icon: "⚡", label: "Sources" },
    { id: "posts", icon: "🖼", label: "Posts", badge: allPosts.length || null },
    { id: "schedule", icon: "📅", label: "Schedule", badge: scheduled.length || null },
    { id: "export", icon: "⬇️", label: "Export" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, fontFamily: "'DM Sans', system-ui, sans-serif", color: T.text, overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 220, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: "0 20px 26px" }}>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "Syne,sans-serif" }}>
            <GradSpan>InstaFlow</GradSpan>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2, letterSpacing: ".04em" }}>Instagram Automation</div>
        </div>

        <nav style={{ flex: 1 }}>
          {NAV.map(n => <NavItem key={n.id} {...n} active={view === n.id} onClick={() => setView(n.id)} />)}
        </nav>

        {/* Account connect stub */}
        <div style={{ padding: "0 14px" }}>
          <div style={{ padding: "14px", background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, cursor: "pointer" }}
            onClick={() => setView("export")}>
            <div style={{ fontSize: 10, color: T.muted, marginBottom: 3, letterSpacing: ".06em", textTransform: "uppercase" }}>Instagram</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,100,100,.6)", display: "inline-block" }} />
              Not connected
            </div>
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, overflow: "auto", padding: "32px 36px" }}>

        {/* ══ SOURCES ══ */}
        {view === "sources" && (
          <div style={{ animation: "fadein .25s ease" }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontFamily: "Syne,sans-serif", fontWeight: 700 }}>Content Sources</h1>
              <p style={{ margin: "6px 0 0", color: T.muted, fontSize: 14 }}>
                Connect your websites, stores, or channels — AI turns them into Instagram posts
              </p>
            </div>

            {/* Add source card */}
            <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, padding: "20px 22px", marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", color: T.muted, marginBottom: 14, textTransform: "uppercase" }}>Add New Source</div>

              {/* Platform pills */}
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
                {Object.entries(PLATFORMS).map(([key, { icon, label }]) => (
                  <button key={key} onClick={() => setSrcType(key)} style={{
                    padding: "7px 13px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 500,
                    border: `1px solid ${srcType === key ? T.ig2 : T.border}`,
                    background: srcType === key ? "rgba(221,42,123,.14)" : "transparent",
                    color: srcType === key ? T.ig2 : T.muted,
                    transition: "all .15s",
                  }}>{icon} {label}</button>
                ))}
              </div>

              {/* URL input row */}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    value={urlInput}
                    onChange={e => { setUrlInput(e.target.value); setUrlError(""); }}
                    onKeyDown={e => e.key === "Enter" && addSource()}
                    placeholder={`Paste your ${PLATFORMS[srcType].label.toLowerCase()} URL...`}
                    style={{
                      width: "100%", padding: "12px 16px", borderRadius: 10,
                      border: `1px solid ${urlError ? "rgba(255,80,80,.5)" : T.border}`,
                      background: T.bg, color: T.text, fontSize: 13.5, outline: "none",
                    }}
                  />
                  {urlError && <div style={{ position: "absolute", bottom: -18, left: 4, fontSize: 11, color: "#FF6060" }}>{urlError}</div>}
                </div>
                <button onClick={addSource} style={{
                  padding: "12px 22px", borderRadius: 10, border: "none",
                  background: T.grad, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}>Add Source</button>
              </div>
            </div>

            {/* Sources list */}
            {sources.length === 0 ? (
              <div style={{ textAlign: "center", padding: "70px 20px", border: `1px dashed ${T.border}`, borderRadius: 16 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📲</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No sources yet</div>
                <div style={{ fontSize: 13, color: T.muted }}>Paste a URL above — blog, store, or YouTube channel</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sources.map(src => (
                  <div key={src.id} style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, padding: "15px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 50, height: 50, borderRadius: 10, flexShrink: 0,
                      background: src.image ? `url(${src.image}) center/cover` : T.grad,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                    }}>
                      {!src.image && PLATFORMS[src.type]?.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>
                        {src.title !== src.url ? src.title : new URL(src.url).hostname}
                      </div>
                      <div style={{ fontSize: 11.5, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {src.url}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {src.status === "fetching" && <><Spinner /><span style={{ fontSize: 12, color: T.muted }}>Fetching…</span></>}
                      {src.status === "generating" && <><Spinner /><span style={{ fontSize: 12, color: T.ig1 }}>Generating…</span></>}
                      {src.status === "done" && (
                        <button onClick={() => generateForSource(src)} disabled={!!loadingId} style={{
                          padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.border}`,
                          background: "transparent", color: T.muted, fontSize: 12, cursor: "pointer",
                        }}>↻ Regen</button>
                      )}
                      {src.status === "ready" && (
                        <button onClick={() => generateForSource(src)} disabled={!!loadingId} style={{
                          padding: "8px 18px", borderRadius: 8, border: "none",
                          background: T.grad, color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                        }}>✨ Generate Posts</button>
                      )}
                      <button onClick={() => removeSource(src.id)} style={{
                        width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`,
                        background: "transparent", color: T.muted, fontSize: 14, cursor: "pointer",
                      }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ POSTS ══ */}
        {view === "posts" && (
          <div style={{ animation: "fadein .25s ease" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 26, fontFamily: "Syne,sans-serif", fontWeight: 700 }}>Generated Posts</h1>
                <p style={{ margin: "6px 0 0", color: T.muted, fontSize: 14 }}>
                  {allPosts.length} posts ready · <span style={{ color: "#00C864" }}>{scheduled.length} scheduled</span>
                </p>
              </div>
              {scheduled.length > 0 && (
                <button onClick={() => setView("schedule")} style={{
                  padding: "10px 20px", borderRadius: 10, border: "none",
                  background: T.grad, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>View Schedule →</button>
              )}
            </div>

            {allPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "90px 20px", color: T.muted }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>✨</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>No posts generated yet</div>
                <div style={{ fontSize: 13, marginBottom: 24 }}>Add a source and click Generate Posts</div>
                <button onClick={() => setView("sources")} style={{
                  padding: "11px 26px", borderRadius: 10, border: "none",
                  background: T.grad, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>← Add a Source</button>
              </div>
            ) : (
              <>
                {/* Group by source */}
                {sources.filter(s => allPosts.some(p => p.sourceId === s.id)).map(src => (
                  <div key={src.id} style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: src.image ? `url(${src.image}) center/cover` : T.grad,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
                      }}>
                        {!src.image && PLATFORMS[src.type]?.icon}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{src.title !== src.url ? src.title : new URL(src.url).hostname}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>{allPosts.filter(p => p.sourceId === src.id).length} posts</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                      {allPosts.filter(p => p.sourceId === src.id).map(post => (
                        <PostCard key={post.id} post={post} ogImage={post.ogImage}
                          scheduled={scheduled.includes(post.id)}
                          onSchedule={() => toggleSchedule(post.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ══ SCHEDULE ══ */}
        {view === "schedule" && (
          <div style={{ animation: "fadein .25s ease" }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontFamily: "Syne,sans-serif", fontWeight: 700 }}>Schedule</h1>
              <p style={{ margin: "6px 0 0", color: T.muted, fontSize: 14 }}>
                {scheduled.length} posts queued for the next 7 days
              </p>
            </div>

            {scheduled.length === 0 ? (
              <div style={{ textAlign: "center", padding: "90px 20px", color: T.muted }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>📅</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>Nothing scheduled yet</div>
                <div style={{ fontSize: 13, marginBottom: 24 }}>Go to Posts and click "Add to Schedule"</div>
                <button onClick={() => setView("posts")} style={{
                  padding: "11px 26px", borderRadius: 10, border: "none",
                  background: T.grad, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Browse Posts</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DAYS.map((day, i) => {
                  const today = new Date();
                  const d = new Date(today); d.setDate(today.getDate() + i);
                  const dayPosts = postsByDay[i] || [];
                  const TIMES = ["9:00 AM", "12:30 PM", "3:00 PM", "6:00 PM", "8:00 PM"];
                  return (
                    <div key={day} style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                      <div style={{
                        padding: "12px 18px", display: "flex", alignItems: "center", gap: 12,
                        borderBottom: dayPosts.length ? `1px solid ${T.border}` : "none",
                        background: i === 0 ? "rgba(221,42,123,.06)" : "transparent",
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, width: 32 }}>{day}</div>
                        <div style={{ fontSize: 12, color: T.muted }}>
                          {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {i === 0 && <span style={{ marginLeft: 8, fontSize: 10, color: T.ig2, fontWeight: 700 }}>TODAY</span>}
                        </div>
                        {dayPosts.length > 0 && (
                          <span style={{ background: "rgba(0,200,100,.13)", color: "#00C864", fontSize: 10.5, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
                            {dayPosts.length} post{dayPosts.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {dayPosts.length === 0 && <span style={{ fontSize: 11.5, color: T.muted, opacity: .5 }}>No posts</span>}
                      </div>

                      {dayPosts.length > 0 && (
                        <div style={{ padding: "10px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                          {dayPosts.map((post, j) => (
                            <div key={post.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ fontSize: 11.5, color: T.muted, width: 64, flexShrink: 0 }}>{TIMES[j % TIMES.length]}</div>
                              <div style={{
                                width: 34, height: 34, borderRadius: 6, flexShrink: 0,
                                background: post.ogImage ? `url(${post.ogImage}) center/cover` : POST_COLORS[post.index % POST_COLORS.length],
                              }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {post.caption}
                                </div>
                              </div>
                              <Badge type={post.postType} />
                              <button onClick={() => toggleSchedule(post.id)} style={{
                                width: 26, height: 26, borderRadius: 6, border: `1px solid ${T.border}`,
                                background: "transparent", color: T.muted, fontSize: 12, cursor: "pointer", flexShrink: 0,
                              }}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ EXPORT ══ */}
        {view === "export" && (
          <div style={{ animation: "fadein .25s ease" }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontFamily: "Syne,sans-serif", fontWeight: 700 }}>Export & Publish</h1>
              <p style={{ margin: "6px 0 0", color: T.muted, fontSize: 14 }}>
                Download your schedule or connect Instagram for direct posting
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* CSV */}
              <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, padding: "28px 26px" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>📄</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Syne,sans-serif", marginBottom: 8 }}>Export CSV</div>
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 22 }}>
                  Download {scheduled.length} scheduled posts. Import into Later, Buffer, Hootsuite, or Meta Business Suite.
                </div>
                <button onClick={exportCSV} style={{
                  width: "100%", padding: "13px", borderRadius: 10, border: "none",
                  background: T.grad, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                }}>
                  ↓ Download CSV {scheduled.length > 0 && `(${scheduled.length} posts)`}
                </button>
              </div>

              {/* Instagram Direct */}
              <div style={{ background: T.card, borderRadius: 16, border: `1px solid rgba(221,42,123,.3)`, padding: "28px 26px" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>📲</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Syne,sans-serif", marginBottom: 8 }}>Direct Publish</div>
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 22 }}>
                  Connect an Instagram Business or Creator account via Meta Graph API for fully automated publishing.
                </div>
                <button style={{
                  width: "100%", padding: "13px", borderRadius: 10,
                  border: `1px solid rgba(221,42,123,.4)`,
                  background: "rgba(221,42,123,.1)", color: T.ig2,
                  fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                }}>Connect Meta Account →</button>
              </div>
            </div>

            {/* Stats bar */}
            <div style={{
              background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
              padding: "22px 30px", display: "flex", gap: 48,
            }}>
              {[
                { label: "Sources", value: sources.length },
                { label: "Posts Generated", value: allPosts.length },
                { label: "Scheduled", value: scheduled.length },
                { label: "Days Covered", value: Math.min(7, Math.ceil(scheduled.length / Math.max(1, Math.ceil(scheduled.length / 7)))) },
              ].map(s => (
                <div key={s.label}>
                  <div style={{
                    fontSize: 32, fontWeight: 800, fontFamily: "Syne,sans-serif",
                    background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Instagram API note */}
            <div style={{ marginTop: 16, background: "rgba(221,42,123,.06)", borderRadius: 12, border: `1px solid rgba(221,42,123,.15)`, padding: "14px 18px" }}>
              <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>
                <strong style={{ color: T.text }}>ℹ️ Instagram API notes:</strong> Direct posting requires a Facebook Business Page linked to an Instagram Business/Creator account.
                Meta Graph API supports scheduling feed posts and carousels — Reels require additional setup.
                Free-tier API allows up to 25 posts/day per account.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
