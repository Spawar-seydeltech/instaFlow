import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// 🤖 AI API — ENDPOINT CONFIG
// ─────────────────────────────────────────────────────────────────────────────
// The Anthropic Messages API endpoint. Authentication is handled automatically
// when running inside Claude Artifacts — no API key needed in that context.
// If you deploy this outside Claude Artifacts, add your key:
//   headers: { "x-api-key": "YOUR_KEY", "anthropic-version": "2023-06-01", ... }
const AI_API_ENDPOINT = "https://api.anthropic.com/v1/messages";

// CORS proxy — required when calling the API from a browser directly.
// In a Node/Next.js backend you can call AI_API_ENDPOINT directly instead.
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

// ─── Responsive hook ──────────────────────────────────────────────────────────
// Returns the current window width and a boolean `isMobile` flag.
// All layout decisions (sidebar vs bottom-nav, grid columns, padding) use this.
function useWindowSize() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return { width, isMobile: width < 768 };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Fetches Open Graph metadata (title, description, image) from a URL
// via the CORS proxy. Used to enrich each content source card.
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

// ─────────────────────────────────────────────────────────────────────────────
// 🤖 AI API — CORE POST GENERATION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
// This is the primary AI call. It takes one content source (URL + metadata)
// and asks Claude to generate 6 ready-to-post Instagram ideas.
//
// HOW TO CUSTOMISE:
//   • Change `model` to "claude-opus-4-20250514" for higher quality output,
//     or "claude-haiku-4-5-20251001" for faster / cheaper generation.
//   • Increase `max_tokens` if captions are getting cut off.
//   • Edit the `content` string (the prompt) to change tone, language,
//     number of posts, hashtag count, or post types returned.
//   • Add a `system` field for a persistent persona, e.g.:
//       system: "You are a luxury-brand Instagram strategist..."
// ─────────────────────────────────────────────────────────────────────────────
async function generatePostsAPI(source) {
  const res = await fetch(AI_API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({

      // 🤖 AI API — MODEL SELECTION
      // Switch model here. Sonnet = balanced speed/quality (recommended default).
      model: "claude-sonnet-4-20250514",

      // 🤖 AI API — MAX OUTPUT TOKENS
      // 1000 tokens is enough for 6 posts. Raise to 2000 if you want 12 posts.
      max_tokens: 1000,

      // 🤖 AI API — OPTIONAL SYSTEM PROMPT
      // Uncomment and customise to give Claude a persistent persona/voice:
      // system: "You are an expert Instagram growth strategist specialising in e-commerce. Always write in an energetic, Gen-Z-friendly tone.",

      messages: [{
        role: "user",

        // 🤖 AI API — USER PROMPT
        // This is the instruction Claude receives. Edit freely:
        //   • Change "6" to generate more or fewer posts.
        //   • Add brand voice notes, e.g. "The brand tone is playful and sarcastic."
        //   • Change the JSON schema to add fields like "suggestedTime" or "cta".
        content: `You are an Instagram growth expert. Generate exactly 6 Instagram post ideas for:
Type: ${source.type}
URL: ${source.url}
Title: ${source.title}
Description: ${source.description}

Return ONLY a valid JSON array, no markdown, no explanation:
[{"caption":"engaging 150-200 char caption, 1-2 emojis max","hashtags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"],"visualStyle":"brief image direction","postType":"single|carousel|reel","angle":"Tutorial|Product|Tip|Story|BTS|Promo"}]`,
      }],
    }),
  });

  // 🤖 AI API — RESPONSE PARSING
  // Claude returns: { content: [{ type: "text", text: "..." }] }
  // We extract the text block and parse it as JSON.
  // If parsing fails (malformed output), we return an empty array gracefully.
  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🤖 AI API — OPTIONAL: PER-CARD CAPTION REGENERATION
// ─────────────────────────────────────────────────────────────────────────────
// Add this call inside PostCard (or a modal) when the user wants to tweak a
// single caption without regenerating all 6 posts.
//
// async function regenerateCaptionAPI(post, userFeedback) {
//   const res = await fetch(AI_API_ENDPOINT, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       model: "claude-sonnet-4-20250514",
//       max_tokens: 300,
//       messages: [{
//         role: "user",
//         content: `Rewrite this Instagram caption.
// Original: "${post.caption}"
// Hashtags: ${post.hashtags.join(", ")}
// User feedback: "${userFeedback}"
// Return ONLY the new caption text, no explanation.`,
//       }],
//     }),
//   });
//   const data = await res.json();
//   return data.content?.[0]?.text?.trim() || post.caption;
// }

// ─────────────────────────────────────────────────────────────────────────────
// 🤖 AI API — OPTIONAL: SMART HASHTAG BOOSTER
// ─────────────────────────────────────────────────────────────────────────────
// Call this to expand a post's hashtag set to 30 niche-targeted tags.
//
// async function boostHashtagsAPI(post) {
//   const res = await fetch(AI_API_ENDPOINT, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       model: "claude-haiku-4-5-20251001", // Haiku is fast enough for this
//       max_tokens: 200,
//       messages: [{
//         role: "user",
//         content: `Generate 30 Instagram hashtags for this post: "${post.caption}"
// Mix: 5 broad (1M+ posts), 15 medium (100K-1M), 10 niche (<100K).
// Return ONLY a JSON array of strings, no # prefix, no explanation.`,
//       }],
//     }),
//   });
//   const data = await res.json();
//   try { return JSON.parse(data.content?.[0]?.text || "[]"); }
//   catch { return post.hashtags; }
// }

// ─── Static data ──────────────────────────────────────────────────────────────
const PLATFORMS = {
  blog:     { icon: "📝", label: "Blog / Website" },
  etsy:     { icon: "🛍️", label: "Etsy Store" },
  shopify:  { icon: "🏪", label: "Shopify Store" },
  youtube:  { icon: "▶️", label: "YouTube" },
  upload:   { icon: "📤", label: "Custom Upload" },
};

const POST_COLORS = [
  "linear-gradient(135deg,#F58529,#DD2A7B)",
  "linear-gradient(135deg,#DD2A7B,#8134AF)",
  "linear-gradient(135deg,#8134AF,#405DE6)",
  "linear-gradient(135deg,#405DE6,#DD2A7B)",
  "linear-gradient(135deg,#833ab4,#fd1d1d)",
  "linear-gradient(135deg,#F58529,#8134AF)",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["9:00 AM", "12:30 PM", "3:00 PM", "6:00 PM", "8:00 PM"];

// ─── Micro-components ─────────────────────────────────────────────────────────
function GradSpan({ children, style = {} }) {
  return (
    <span style={{
      background: T.grad,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      ...style,
    }}>
      {children}
    </span>
  );
}

function Badge({ type }) {
  const map = {
    single:   { bg: "rgba(245,133,41,.15)",  c: "#F58529" },
    carousel: { bg: "rgba(221,42,123,.15)",  c: "#DD2A7B" },
    reel:     { bg: "rgba(129,52,175,.15)",  c: "#8134AF" },
  };
  const s = map[type] || map.single;
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 20, fontSize: 10,
      fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
      background: s.bg, color: s.c,
    }}>
      {type}
    </span>
  );
}

function Spinner({ size = 14 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `2px solid rgba(255,255,255,.15)`,
      borderTopColor: T.ig2, borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────
// Renders a single generated Instagram post.
// The "Add to Schedule" button wires up to toggleSchedule() in the parent.
//
// 🤖 AI API HOOK — add a "✏️ Rewrite" button here that calls regenerateCaptionAPI()
// and updates allPosts state with the new caption for this specific post ID.
function PostCard({ post, ogImage, scheduled, onSchedule }) {
  const [hov, setHov] = useState(false);
  const grad = POST_COLORS[post.index % POST_COLORS.length];

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.card,
        borderRadius: 16,
        border: `1px solid ${hov ? T.borderHi : T.border}`,
        overflow: "hidden",
        transform: hov ? "translateY(-3px)" : "none",
        transition: "transform .2s, border-color .2s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Square thumbnail — uses OG image if available, else gradient */}
      <div style={{
        aspectRatio: "1",
        position: "relative",
        background: ogImage ? `url(${ogImage}) center/cover` : grad,
        display: "flex",
        alignItems: "flex-end",
      }}>
        {ogImage && (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,transparent 40%,rgba(0,0,0,.65))" }} />
        )}
        <div style={{ position: "absolute", top: 10, right: 10 }}>
          <Badge type={post.postType} />
        </div>
        {scheduled && (
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(0,200,100,.9)", color: "#fff",
            borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700,
          }}>
            ✓ QUEUED
          </div>
        )}
        {!ogImage && (
          <div style={{
            position: "relative", zIndex: 1,
            padding: "10px 12px", fontSize: 18, fontWeight: 800,
            color: "rgba(255,255,255,.92)", fontFamily: "Syne,sans-serif", lineHeight: 1.2,
          }}>
            {post.angle}
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{
          margin: 0, fontSize: 12.5, color: T.text, lineHeight: 1.55,
          display: "-webkit-box", WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical", overflow: "hidden", flex: 1,
        }}>
          {post.caption}
        </p>

        {/* Hashtag preview — shows first 4, then a +N count */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {post.hashtags.slice(0, 4).map(h => (
            <span key={h} style={{
              fontSize: 10.5, color: T.ig2,
              background: "rgba(221,42,123,.1)", padding: "2px 8px", borderRadius: 20,
            }}>
              #{h}
            </span>
          ))}
          {post.hashtags.length > 4 && (
            <span style={{ fontSize: 10.5, color: T.muted }}>+{post.hashtags.length - 4}</span>
          )}
        </div>

        {/* Schedule toggle */}
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

// ─── NavItem (Sidebar) ────────────────────────────────────────────────────────
function NavItem({ icon, label, badge, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", padding: "11px 20px",
        background: active ? "rgba(221,42,123,.12)" : hov ? "rgba(255,255,255,.03)" : "none",
        border: "none",
        borderLeft: `3px solid ${active ? T.ig2 : "transparent"}`,
        color: active ? T.text : T.muted,
        display: "flex", alignItems: "center", gap: 10,
        cursor: "pointer", fontSize: 13.5,
        fontWeight: active ? 600 : 400,
        textAlign: "left", transition: "all .15s",
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge ? (
        <span style={{
          background: T.grad, color: "#fff",
          fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
        }}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}

// ─── MobileTabBar ─────────────────────────────────────────────────────────────
// Bottom navigation shown on screens < 768 px.
// Replaces the left sidebar so the full width is available for content.
function MobileTabBar({ NAV, view, setView }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: T.card,
      borderTop: `1px solid ${T.border}`,
      display: "flex",
      paddingBottom: "env(safe-area-inset-bottom, 0px)", // iOS safe area
    }}>
      {NAV.map(n => {
        const active = view === n.id;
        return (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            style={{
              flex: 1, padding: "10px 4px 8px",
              background: "none", border: "none",
              color: active ? T.ig2 : T.muted,
              cursor: "pointer",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 3,
              transition: "color .15s",
              position: "relative",
            }}
          >
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, letterSpacing: ".02em" }}>
              {n.label}
            </span>
            {n.badge ? (
              <span style={{
                position: "absolute", top: 6, right: "calc(50% - 14px)",
                background: T.grad, color: "#fff",
                fontSize: 9, fontWeight: 700,
                padding: "1px 5px", borderRadius: 20, minWidth: 16, textAlign: "center",
              }}>
                {n.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function InstaFlow() {
  const { isMobile } = useWindowSize();

  // ── App State ──
  const [view, setView]         = useState("sources");
  const [sources, setSources]   = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [urlInput, setUrlInput] = useState("");
  const [srcType, setSrcType]   = useState("blog");
  const [loadingId, setLoadingId] = useState(null);
  const [urlError, setUrlError] = useState("");

  // Inject global fonts + keyframe animations once on mount
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent = `
      @keyframes spin    { to { transform: rotate(360deg) } }
      @keyframes fadein  { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
      * { box-sizing: border-box; }
      input::placeholder { color: #6666AA; }
      ::-webkit-scrollbar { width: 4px; background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 4px; }
    `;
    document.head.appendChild(style);
  }, []);

  // ── Add a content source ──
  const addSource = async () => {
    let url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith("http")) url = "https://" + url;
    try { new URL(url); } catch { setUrlError("Invalid URL"); return; }
    setUrlError("");

    const id = Date.now().toString();
    setSources(p => [...p, { id, type: srcType, url, title: url, description: "", image: "", status: "fetching" }]);
    setUrlInput("");

    // Fetch OG metadata in the background, then update the source card
    const meta = await fetchMeta(url);
    setSources(p => p.map(s => s.id === id ? { ...s, ...meta, status: "ready" } : s));
  };

  const removeSource = (id) => {
    setSources(p => p.filter(s => s.id !== id));
    setAllPosts(p => p.filter(post => post.sourceId !== id));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 🤖 AI API — GENERATE POSTS FOR A SOURCE
  // ─────────────────────────────────────────────────────────────────────────
  // Called when the user clicks "✨ Generate Posts" on a source card.
  // Sets the source status to "generating", calls the AI, then transitions
  // to the Posts view automatically once results arrive.
  //
  // To add retry logic, wrap the generatePostsAPI call in a loop:
  //   let attempts = 0;
  //   while (attempts < 3) { try { raw = await generatePostsAPI(source); break; } catch { attempts++; } }
  const generateForSource = useCallback(async (source) => {
    setLoadingId(source.id);
    setSources(p => p.map(s => s.id === source.id ? { ...s, status: "generating" } : s));

    try {
      // 🤖 AI API CALL — see generatePostsAPI() above for full documentation
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
    } catch {
      // Reset to "ready" so the user can retry
      setSources(p => p.map(s => s.id === source.id ? { ...s, status: "ready" } : s));
    }

    setLoadingId(null);
  }, []);

  const toggleSchedule = (id) =>
    setScheduled(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  // ── Export scheduled posts as CSV ──
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

  // Distribute scheduled posts evenly across the next 7 days
  const scheduledPosts = allPosts.filter(p => scheduled.includes(p.id));
  const postsByDay = DAYS.map((_, i) => {
    const chunk = Math.ceil(scheduledPosts.length / 7) || 1;
    return scheduledPosts.slice(i * chunk, i * chunk + chunk);
  });

  const NAV = [
    { id: "sources",  icon: "⚡",  label: "Sources"  },
    { id: "posts",    icon: "🖼",  label: "Posts",    badge: allPosts.length || null },
    { id: "schedule", icon: "📅",  label: "Schedule", badge: scheduled.length || null },
    { id: "export",   icon: "⬇️", label: "Export"   },
  ];

  // ── Responsive layout values ──
  const mainPadding  = isMobile ? "20px 16px 90px" : "32px 36px";  // 90px bottom = clears mobile tab bar
  const sidebarWidth = 220;

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: T.bg,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: T.text,
      overflow: "hidden",
    }}>

      {/* ── Sidebar (desktop only) ── */}
      {!isMobile && (
        <div style={{
          width: sidebarWidth,
          borderRight: `1px solid ${T.border}`,
          display: "flex",
          flexDirection: "column",
          padding: "24px 0",
          flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{ padding: "0 20px 26px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "Syne,sans-serif" }}>
              <GradSpan>InstaFlow</GradSpan>
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2, letterSpacing: ".04em" }}>
              Instagram Automation
            </div>
          </div>

          <nav style={{ flex: 1 }}>
            {NAV.map(n => (
              <NavItem key={n.id} {...n} active={view === n.id} onClick={() => setView(n.id)} />
            ))}
          </nav>

          {/* Instagram connection status (stub — wire to Meta OAuth) */}
          <div style={{ padding: "0 14px" }}>
            <div
              style={{
                padding: "14px", background: T.card,
                borderRadius: 12, border: `1px solid ${T.border}`, cursor: "pointer",
              }}
              onClick={() => setView("export")}
            >
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 3, letterSpacing: ".06em", textTransform: "uppercase" }}>
                Instagram
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,100,100,.6)", display: "inline-block" }} />
                Not connected
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content area ── */}
      <div style={{ flex: 1, overflow: "auto", padding: mainPadding }}>

        {/* Mobile header — shown instead of sidebar logo */}
        {isMobile && (
          <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "Syne,sans-serif" }}>
              <GradSpan>InstaFlow</GradSpan>
            </div>
            <div style={{
              fontSize: 11, color: T.muted,
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 20, padding: "4px 10px",
            }}>
              {allPosts.length} posts
            </div>
          </div>
        )}

        {/* ══ SOURCES VIEW ══ */}
        {view === "sources" && (
          <div style={{ animation: "fadein .25s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 26, fontFamily: "Syne,sans-serif", fontWeight: 700 }}>
                Content Sources
              </h1>
              <p style={{ margin: "6px 0 0", color: T.muted, fontSize: 14 }}>
                Connect your websites, stores, or channels — AI turns them into Instagram posts
              </p>
            </div>

            {/* Add source card */}
            <div style={{
              background: T.card, borderRadius: 16,
              border: `1px solid ${T.border}`, padding: "20px 18px", marginBottom: 22,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", color: T.muted, marginBottom: 14, textTransform: "uppercase" }}>
                Add New Source
              </div>

              {/* Platform pills */}
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
                {Object.entries(PLATFORMS).map(([key, { icon, label }]) => (
                  <button
                    key={key}
                    onClick={() => setSrcType(key)}
                    style={{
                      padding: "7px 12px", borderRadius: 20, cursor: "pointer",
                      fontSize: isMobile ? 11 : 12, fontWeight: 500,
                      border: `1px solid ${srcType === key ? T.ig2 : T.border}`,
                      background: srcType === key ? "rgba(221,42,123,.14)" : "transparent",
                      color: srcType === key ? T.ig2 : T.muted,
                      transition: "all .15s",
                    }}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {/* URL input — stacks vertically on mobile */}
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10 }}>
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
                  {urlError && (
                    <div style={{ position: "absolute", bottom: -18, left: 4, fontSize: 11, color: "#FF6060" }}>
                      {urlError}
                    </div>
                  )}
                </div>
                <button
                  onClick={addSource}
                  style={{
                    padding: isMobile ? "13px" : "12px 22px",
                    borderRadius: 10, border: "none",
                    background: T.grad, color: "#fff",
                    fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Add Source
                </button>
              </div>
            </div>

            {/* Sources list */}
            {sources.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 20px",
                border: `1px dashed ${T.border}`, borderRadius: 16,
              }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📲</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No sources yet</div>
                <div style={{ fontSize: 13, color: T.muted }}>Paste a URL above — blog, store, or YouTube channel</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sources.map(src => (
                  <div
                    key={src.id}
                    style={{
                      background: T.card, borderRadius: 14,
                      border: `1px solid ${T.border}`,
                      padding: "15px 16px",
                      display: "flex",
                      alignItems: isMobile ? "flex-start" : "center",
                      flexDirection: isMobile ? "column" : "row",
                      gap: 14,
                    }}
                  >
                    {/* Source row — top section (icon + title + url) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: 10, flexShrink: 0,
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
                      {/* Remove button always visible */}
                      <button
                        onClick={() => removeSource(src.id)}
                        style={{
                          width: 30, height: 30, borderRadius: 8,
                          border: `1px solid ${T.border}`,
                          background: "transparent", color: T.muted,
                          fontSize: 14, cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Action buttons — stretch full-width on mobile */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: isMobile ? "100%" : "auto",
                    }}>
                      {src.status === "fetching" && (
                        <><Spinner /><span style={{ fontSize: 12, color: T.muted }}>Fetching…</span></>
                      )}
                      {src.status === "generating" && (
                        <><Spinner /><span style={{ fontSize: 12, color: T.ig1 }}>Generating…</span></>
                      )}
                      {src.status === "done" && (
                        <button
                          onClick={() => generateForSource(src)}
                          disabled={!!loadingId}
                          style={{
                            padding: "8px 14px", borderRadius: 8,
                            border: `1px solid ${T.border}`,
                            background: "transparent", color: T.muted,
                            fontSize: 12, cursor: "pointer",
                            flex: isMobile ? 1 : "none",
                          }}
                        >
                          ↻ Regen
                        </button>
                      )}
                      {src.status === "ready" && (
                        // 🤖 AI API — triggers generateForSource → generatePostsAPI
                        <button
                          onClick={() => generateForSource(src)}
                          disabled={!!loadingId}
                          style={{
                            padding: "8px 18px", borderRadius: 8, border: "none",
                            background: T.grad, color: "#fff",
                            fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                            flex: isMobile ? 1 : "none",
                          }}
                        >
                          ✨ Generate Posts
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ POSTS VIEW ══ */}
        {view === "posts" && (
          <div style={{ animation: "fadein .25s ease" }}>
            <div style={{
              display: "flex", alignItems: "flex-start",
              justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12,
            }}>
              <div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 26, fontFamily: "Syne,sans-serif", fontWeight: 700 }}>
                  Generated Posts
                </h1>
                <p style={{ margin: "6px 0 0", color: T.muted, fontSize: 14 }}>
                  {allPosts.length} posts ready · <span style={{ color: "#00C864" }}>{scheduled.length} scheduled</span>
                </p>
              </div>
              {scheduled.length > 0 && (
                <button
                  onClick={() => setView("schedule")}
                  style={{
                    padding: "10px 20px", borderRadius: 10, border: "none",
                    background: T.grad, color: "#fff",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  View Schedule →
                </button>
              )}
            </div>

            {allPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 20px", color: T.muted }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>✨</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>No posts generated yet</div>
                <div style={{ fontSize: 13, marginBottom: 24 }}>Add a source and click Generate Posts</div>
                <button
                  onClick={() => setView("sources")}
                  style={{
                    padding: "11px 26px", borderRadius: 10, border: "none",
                    background: T.grad, color: "#fff",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  ← Add a Source
                </button>
              </div>
            ) : (
              <>
                {/* Group post cards by their source */}
                {sources.filter(s => allPosts.some(p => p.sourceId === s.id)).map(src => (
                  <div key={src.id} style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: src.image ? `url(${src.image}) center/cover` : T.grad,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, flexShrink: 0,
                      }}>
                        {!src.image && PLATFORMS[src.type]?.icon}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {src.title !== src.url ? src.title : new URL(src.url).hostname}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted }}>
                        {allPosts.filter(p => p.sourceId === src.id).length} posts
                      </div>
                    </div>

                    {/*
                     * Responsive post grid:
                     *   Mobile  (<768px)  → 2 columns  (minmax 150px)
                     *   Tablet  (768-1024)→ 3 columns  (minmax 180px)
                     *   Desktop (>1024px) → 4+ columns (minmax 200px)
                     */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "repeat(auto-fill, minmax(150px, 1fr))"
                        : "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: isMobile ? 10 : 14,
                    }}>
                      {allPosts.filter(p => p.sourceId === src.id).map(post => (
                        <PostCard
                          key={post.id}
                          post={post}
                          ogImage={post.ogImage}
                          scheduled={scheduled.includes(post.id)}
                          onSchedule={() => toggleSchedule(post.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ══ SCHEDULE VIEW ══ */}
        {view === "schedule" && (
          <div style={{ animation: "fadein .25s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 26, fontFamily: "Syne,sans-serif", fontWeight: 700 }}>
                Schedule
              </h1>
              <p style={{ margin: "6px 0 0", color: T.muted, fontSize: 14 }}>
                {scheduled.length} posts queued for the next 7 days
              </p>
            </div>

            {scheduled.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 20px", color: T.muted }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>📅</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>Nothing scheduled yet</div>
                <div style={{ fontSize: 13, marginBottom: 24 }}>Go to Posts and click "Add to Schedule"</div>
                <button
                  onClick={() => setView("posts")}
                  style={{
                    padding: "11px 26px", borderRadius: 10, border: "none",
                    background: T.grad, color: "#fff",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Browse Posts
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DAYS.map((day, i) => {
                  const today = new Date();
                  const d = new Date(today); d.setDate(today.getDate() + i);
                  const dayPosts = postsByDay[i] || [];

                  return (
                    <div
                      key={day}
                      style={{
                        background: T.card, borderRadius: 14,
                        border: `1px solid ${T.border}`, overflow: "hidden",
                      }}
                    >
                      {/* Day header */}
                      <div style={{
                        padding: "12px 16px",
                        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                        borderBottom: dayPosts.length ? `1px solid ${T.border}` : "none",
                        background: i === 0 ? "rgba(221,42,123,.06)" : "transparent",
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, width: 30 }}>{day}</div>
                        <div style={{ fontSize: 12, color: T.muted }}>
                          {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {i === 0 && (
                            <span style={{ marginLeft: 8, fontSize: 10, color: T.ig2, fontWeight: 700 }}>TODAY</span>
                          )}
                        </div>
                        {dayPosts.length > 0 ? (
                          <span style={{
                            background: "rgba(0,200,100,.13)", color: "#00C864",
                            fontSize: 10.5, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                          }}>
                            {dayPosts.length} post{dayPosts.length > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11.5, color: T.muted, opacity: .5 }}>No posts</span>
                        )}
                      </div>

                      {/* Day post rows */}
                      {dayPosts.length > 0 && (
                        <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                          {dayPosts.map((post, j) => (
                            <div
                              key={post.id}
                              style={{
                                display: "flex", alignItems: "center", gap: 10,
                                flexWrap: isMobile ? "wrap" : "nowrap",
                              }}
                            >
                              <div style={{ fontSize: 11.5, color: T.muted, width: 60, flexShrink: 0 }}>
                                {TIMES[j % TIMES.length]}
                              </div>
                              <div style={{
                                width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                                background: post.ogImage
                                  ? `url(${post.ogImage}) center/cover`
                                  : POST_COLORS[post.index % POST_COLORS.length],
                              }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: 12, color: T.text,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                  {post.caption}
                                </div>
                              </div>
                              <Badge type={post.postType} />
                              <button
                                onClick={() => toggleSchedule(post.id)}
                                style={{
                                  width: 26, height: 26, borderRadius: 6,
                                  border: `1px solid ${T.border}`,
                                  background: "transparent", color: T.muted,
                                  fontSize: 12, cursor: "pointer", flexShrink: 0,
                                }}
                              >
                                ×
                              </button>
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

        {/* ══ EXPORT VIEW ══ */}
        {view === "export" && (
          <div style={{ animation: "fadein .25s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 26, fontFamily: "Syne,sans-serif", fontWeight: 700 }}>
                Export & Publish
              </h1>
              <p style={{ margin: "6px 0 0", color: T.muted, fontSize: 14 }}>
                Download your schedule or connect Instagram for direct posting
              </p>
            </div>

            {/*
             * Responsive export grid:
             *   Mobile  → single column
             *   Desktop → two columns
             */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 16, marginBottom: 16,
            }}>
              {/* CSV Download */}
              <div style={{
                background: T.card, borderRadius: 16,
                border: `1px solid ${T.border}`, padding: "24px 22px",
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Syne,sans-serif", marginBottom: 8 }}>
                  Export CSV
                </div>
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 20 }}>
                  Download {scheduled.length} scheduled posts. Import into Later, Buffer, Hootsuite, or Meta Business Suite.
                </div>
                <button
                  onClick={exportCSV}
                  style={{
                    width: "100%", padding: "13px", borderRadius: 10, border: "none",
                    background: T.grad, color: "#fff",
                    fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  ↓ Download CSV {scheduled.length > 0 && `(${scheduled.length} posts)`}
                </button>
              </div>

              {/* Direct Publish (stub — wire to Meta Graph API) */}
              <div style={{
                background: T.card, borderRadius: 16,
                border: `1px solid rgba(221,42,123,.3)`, padding: "24px 22px",
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📲</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Syne,sans-serif", marginBottom: 8 }}>
                  Direct Publish
                </div>
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 20 }}>
                  Connect an Instagram Business or Creator account via Meta Graph API for fully automated publishing.
                </div>
                <button style={{
                  width: "100%", padding: "13px", borderRadius: 10,
                  border: `1px solid rgba(221,42,123,.4)`,
                  background: "rgba(221,42,123,.1)", color: T.ig2,
                  fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                }}>
                  Connect Meta Account →
                </button>
              </div>
            </div>

            {/*
             * Stats bar — wraps on mobile instead of using a fixed gap.
             * Responsive: flex-wrap + flex: 1 1 auto on each stat.
             */}
            <div style={{
              background: T.card, borderRadius: 16,
              border: `1px solid ${T.border}`,
              padding: isMobile ? "18px 20px" : "22px 30px",
              display: "flex", flexWrap: "wrap", gap: isMobile ? 20 : 48,
              marginBottom: 16,
            }}>
              {[
                { label: "Sources",        value: sources.length },
                { label: "Posts Generated",value: allPosts.length },
                { label: "Scheduled",      value: scheduled.length },
                { label: "Days Covered",   value: Math.min(7, Math.ceil(scheduled.length / Math.max(1, Math.ceil(scheduled.length / 7)))) },
              ].map(s => (
                <div key={s.label} style={{ flex: "1 1 auto" }}>
                  <div style={{
                    fontSize: isMobile ? 26 : 32, fontWeight: 800, fontFamily: "Syne,sans-serif",
                    background: T.grad,
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Instagram API info note */}
            <div style={{
              background: "rgba(221,42,123,.06)", borderRadius: 12,
              border: `1px solid rgba(221,42,123,.15)`, padding: "14px 18px",
            }}>
              <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>
                <strong style={{ color: T.text }}>ℹ️ Instagram API notes:</strong>{" "}
                Direct posting requires a Facebook Business Page linked to an Instagram Business/Creator account.
                Meta Graph API supports scheduling feed posts and carousels — Reels require additional setup.
                Free-tier API allows up to 25 posts/day per account.
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Mobile bottom tab bar (replaces sidebar on small screens) ── */}
      {isMobile && <MobileTabBar NAV={NAV} view={view} setView={setView} />}
    </div>
  );
}
