import { useState, createContext, useContext } from "react";

// ─── Color Vision Palettes ──────────────────────────
// Each palette remaps the base theme colors to remain
// distinguishable under that type of CVD, while staying
// true to the Columbus/Cummins spirit.

const PALETTES = {
  default: {
    label: "Default",
    desc: "Full color palette",
    colors: {
      "cummins-red": "#9B2335",
      "cummins-red-deep": "#6E1423",
      "irwin-stone": "#D4C5A9",
      "irwin-sand": "#E8DCC8",
      "mcm-mustard": "#B8872E",
      "mcm-amber": "#D4A843",
      "girard-teal": "#1F5C5C",
      "girard-teal-light": "#2D7A7A",
      "engine-graphite": "#1E1E20",
      "engine-steel": "#3C3C3E",
      "civic-concrete": "#767068",
      "civic-warm": "#C4BAA8",
      "saarinen-cream": "#FAF5EB",
      "saarinen-linen": "#F2EBD9",
      "girard-olive": "#4A5A3A",
    },
  },
  deuteranopia: {
    label: "Deuteranopia",
    desc: "Red-green (most common, ~6% of males)",
    colors: {
      // Red → deep warm brown (distinct from mustard gold)
      "cummins-red": "#7B3B1A",
      "cummins-red-deep": "#5A2810",
      "irwin-stone": "#D4C5A9",
      "irwin-sand": "#E8DCC8",
      // Mustard → brighter gold to separate from brown
      "mcm-mustard": "#C49000",
      "mcm-amber": "#D4A843",
      // Teal → deep blue (separates from red/green axis)
      "girard-teal": "#1A4B7A",
      "girard-teal-light": "#2A6699",
      "engine-graphite": "#1E1E20",
      "engine-steel": "#3C3C3E",
      "civic-concrete": "#767068",
      "civic-warm": "#C4BAA8",
      "saarinen-cream": "#FAF5EB",
      "saarinen-linen": "#F2EBD9",
      // Olive → slate blue-gray (off the red-green axis)
      "girard-olive": "#3E4F6A",
    },
  },
  protanopia: {
    label: "Protanopia",
    desc: "Red-blind (~2% of males)",
    colors: {
      // Red → dark umber (warm but not reliant on red channel)
      "cummins-red": "#6B4020",
      "cummins-red-deep": "#4A2C14",
      "irwin-stone": "#D4C5A9",
      "irwin-sand": "#E8DCC8",
      // Mustard → vivid amber-gold
      "mcm-mustard": "#C08C00",
      "mcm-amber": "#D4A843",
      // Teal → strong blue
      "girard-teal": "#1B4A78",
      "girard-teal-light": "#286198",
      "engine-graphite": "#1E1E20",
      "engine-steel": "#3C3C3E",
      "civic-concrete": "#767068",
      "civic-warm": "#C4BAA8",
      "saarinen-cream": "#FAF5EB",
      "saarinen-linen": "#F2EBD9",
      // Olive → cool slate
      "girard-olive": "#3C4E68",
    },
  },
  tritanopia: {
    label: "Tritanopia",
    desc: "Blue-yellow blind (~0.01%)",
    colors: {
      // Red stays — tritanopes see red fine
      "cummins-red": "#9B2335",
      "cummins-red-deep": "#6E1423",
      "irwin-stone": "#D4C5A9",
      "irwin-sand": "#E8DCC8",
      // Mustard → warm rose-tan (off the blue-yellow axis)
      "mcm-mustard": "#A86848",
      "mcm-amber": "#C08868",
      // Teal → deep magenta-plum (replaces blue component)
      "girard-teal": "#5C2A5C",
      "girard-teal-light": "#7A3D7A",
      "engine-graphite": "#1E1E20",
      "engine-steel": "#3C3C3E",
      "civic-concrete": "#767068",
      "civic-warm": "#C4BAA8",
      "saarinen-cream": "#FAF5EB",
      "saarinen-linen": "#F2EBD9",
      // Olive → warm brown-rose
      "girard-olive": "#5C3E3A",
    },
  },
  highContrast: {
    label: "High Contrast",
    desc: "Maximum differentiation, bolder boundaries",
    colors: {
      "cummins-red": "#8B0000",
      "cummins-red-deep": "#5C0000",
      "irwin-stone": "#D4C5A9",
      "irwin-sand": "#E0D5BC",
      "mcm-mustard": "#996600",
      "mcm-amber": "#CC9933",
      "girard-teal": "#004040",
      "girard-teal-light": "#006060",
      "engine-graphite": "#0A0A0A",
      "engine-steel": "#2A2A2A",
      "civic-concrete": "#5C5650",
      "civic-warm": "#C4BAA8",
      "saarinen-cream": "#FFFFFF",
      "saarinen-linen": "#F5F0E4",
      "girard-olive": "#2A3A1A",
    },
  },
};

const FONTS = {
  display: "'Outfit', 'Helvetica Neue', sans-serif",
  heading: "'DM Sans', 'Helvetica Neue', sans-serif",
  body: "'Atkinson Hyperlegible', 'Verdana', sans-serif",
  mono: "'IBM Plex Mono', 'Courier New', monospace",
};

// ─── Palette Context ────────────────────────────────
const PaletteCtx = createContext();
function usePalette() {
  return useContext(PaletteCtx);
}

// ─── WCAG Helpers ───────────────────────────────────
function sRGBtoLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const r = sRGBtoLinear(parseInt(hex.slice(1, 3), 16) / 255);
  const g = sRGBtoLinear(parseInt(hex.slice(3, 5), 16) / 255);
  const b = sRGBtoLinear(parseInt(hex.slice(5, 7), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function wcagGrade(ratio) {
  if (ratio >= 7) return { label: "AAA", bg: "#1F5C5C" };
  if (ratio >= 4.5) return { label: "AA", bg: "#4A5A3A" };
  if (ratio >= 3) return { label: "AA 18+", bg: "#B8872E" };
  return { label: "Fail", bg: "#9B2335" };
}
function isLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55;
}

// ─── Components ─────────────────────────────────────

function Swatch({ name, colorKey, subtitle }) {
  const { colors } = usePalette();
  const hex = colors[colorKey];
  const cream = colors["saarinen-cream"];
  const ratio = contrastRatio(hex, cream);
  const grade = wcagGrade(ratio);
  const light = isLight(hex);

  return (
    <div
      style={{
        background: hex,
        minHeight: 100,
        borderRadius: 4,
        position: "relative",
        overflow: "hidden",
        transition: "background 0.35s ease",
        border: light ? `1px solid ${colors["civic-concrete"]}30` : "1px solid transparent",
      }}
      role="img"
      aria-label={`${name}: ${hex}, ${ratio.toFixed(1)} to 1 contrast on cream, ${grade.label}`}
    >
      <div className="absolute inset-0 flex flex-col justify-end p-3">
        <span
          style={{
            fontFamily: FONTS.heading,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: light ? "#1E1E20" : "#FAF5EB",
          }}
        >
          {name}
        </span>
        <div className="flex items-center gap-2 mt-1">
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: light ? "#3C3C3E" : "#C4BAA8",
            }}
          >
            {hex}
          </span>
          <span
            style={{
              fontFamily: FONTS.heading,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.04em",
              padding: "2px 6px",
              borderRadius: 3,
              background: light ? "#1E1E2015" : "#FAF5EB18",
              color: light ? "#1E1E20" : "#FAF5EB",
            }}
          >
            {ratio.toFixed(1)}:1 {grade.label}
          </span>
        </div>
        {subtitle && (
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 10,
              fontStyle: "italic",
              color: light ? "#767068" : "#A8A095",
              marginTop: 2,
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ number, title }) {
  const { colors } = usePalette();
  return (
    <div className="flex items-baseline gap-3 mb-5 mt-12">
      <span
        style={{ fontFamily: FONTS.mono, fontSize: 12, color: colors["cummins-red"], fontWeight: 500, transition: "color 0.35s" }}
        aria-hidden="true"
      >
        {number}
      </span>
      <h2
        style={{
          fontFamily: FONTS.heading,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: colors["engine-graphite"],
          margin: 0,
          transition: "color 0.35s",
        }}
      >
        {title}
      </h2>
      <div
        className="flex-1"
        style={{ height: 1, background: `linear-gradient(90deg, ${colors["civic-concrete"]}, transparent)`, marginLeft: 12 }}
        aria-hidden="true"
      />
    </div>
  );
}

function GirardStrip() {
  const { colors } = usePalette();
  const keys = ["cummins-red", "mcm-mustard", "girard-teal", "girard-olive", "cummins-red-deep", "mcm-amber", "girard-teal-light", "civic-concrete"];
  return (
    <div className="flex" style={{ height: 40, borderRadius: 3, overflow: "hidden" }} role="img" aria-label="Decorative color strip">
      {keys.map((k, i) => (
        <div key={i} style={{ flex: 1, background: colors[k], transition: "background 0.35s ease" }} />
      ))}
    </div>
  );
}

function SampleButton({ label, variant = "primary" }) {
  const { colors } = usePalette();
  const variants = {
    primary: { bg: colors["cummins-red"], text: "#FAF5EB" },
    secondary: { bg: "transparent", text: colors["engine-graphite"], border: `1.5px solid ${colors["engine-graphite"]}` },
    accent: { bg: colors["mcm-mustard"], text: "#FAF5EB" },
    teal: { bg: colors["girard-teal"], text: "#FAF5EB" },
  };
  const s = variants[variant];
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: FONTS.heading,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "12px 28px",
        minHeight: 44,
        borderRadius: 3,
        background: s.bg,
        color: s.text,
        border: s.border || "none",
        cursor: "pointer",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-1px)" : "none",
        boxShadow: hovered ? "0 4px 14px rgba(0,0,0,0.13)" : "none",
        opacity: hovered ? 0.9 : 1,
      }}
    >
      {label}
    </button>
  );
}

function SampleCard() {
  const { colors } = usePalette();
  return (
    <article
      style={{
        background: colors["saarinen-cream"],
        border: `1px solid ${colors["irwin-sand"]}`,
        borderRadius: 4,
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(30,30,32,0.08)",
        maxWidth: 340,
        transition: "all 0.35s ease",
      }}
    >
      <div
        style={{
          height: 6,
          background: `linear-gradient(90deg, ${colors["cummins-red"]} 0%, ${colors["cummins-red"]} 40%, ${colors["mcm-mustard"]} 40%, ${colors["mcm-mustard"]} 60%, ${colors["girard-teal"]} 60%, ${colors["girard-teal"]} 80%, ${colors["girard-olive"]} 80%)`,
          transition: "background 0.35s ease",
        }}
        aria-hidden="true"
      />
      <div className="p-5">
        <span style={{ fontFamily: FONTS.heading, fontSize: 11, color: colors["cummins-red"], letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, transition: "color 0.35s" }}>
          Architecture
        </span>
        <h3 style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 600, color: colors["engine-graphite"], margin: "6px 0 10px", lineHeight: 1.25, transition: "color 0.35s" }}>
          North Christian Church
        </h3>
        <p style={{ fontFamily: FONTS.body, fontSize: 15, lineHeight: 1.65, color: colors["engine-steel"], margin: 0, transition: "color 0.35s" }}>
          Eero Saarinen's final masterpiece, completed posthumously in 1964. A hexagonal sanctuary beneath a soaring spire.
        </p>
        <div style={{ height: 1, background: colors["irwin-sand"], margin: "16px 0", transition: "background 0.35s" }} aria-hidden="true" />
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          style={{
            fontFamily: FONTS.heading,
            fontSize: 13,
            fontWeight: 600,
            color: colors["girard-teal"],
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            minHeight: 44,
            transition: "color 0.35s",
          }}
        >
          Explore <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

function TypeSpecimen({ family, name, sample, size = 32, weight = 400 }) {
  const { colors } = usePalette();
  return (
    <div className="mb-6">
      <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: colors["civic-concrete"], letterSpacing: "0.08em", textTransform: "uppercase", transition: "color 0.35s" }}>
        {name}
      </span>
      <div style={{ fontFamily: family, fontSize: size, fontWeight: weight, color: colors["engine-graphite"], lineHeight: 1.25, marginTop: 6, transition: "color 0.35s" }}>
        {sample}
      </div>
    </div>
  );
}

// ─── Vision Mode Selector ───────────────────────────
function VisionSelector({ mode, onChange }) {
  const { colors } = usePalette();
  const modes = Object.entries(PALETTES);

  return (
    <div
      style={{
        background: colors["saarinen-linen"],
        borderRadius: 6,
        padding: "16px 20px",
        marginBottom: 8,
        border: `1px solid ${colors["irwin-sand"]}`,
        transition: "all 0.35s ease",
      }}
      role="radiogroup"
      aria-label="Color vision mode"
    >
      <span
        style={{
          fontFamily: FONTS.heading,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: colors["engine-steel"],
          display: "block",
          marginBottom: 12,
          transition: "color 0.35s",
        }}
      >
        Color Vision Mode
      </span>
      <div className="flex flex-wrap gap-2">
        {modes.map(([key, palette]) => {
          const active = mode === key;
          return (
            <button
              key={key}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(key)}
              style={{
                fontFamily: FONTS.heading,
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                padding: "8px 16px",
                minHeight: 44,
                borderRadius: 4,
                border: active ? `2px solid ${colors["cummins-red"]}` : `1.5px solid ${colors["civic-concrete"]}50`,
                background: active ? colors["saarinen-cream"] : "transparent",
                color: active ? colors["cummins-red"] : colors["engine-steel"],
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: active ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {palette.label}
            </button>
          );
        })}
      </div>
      <p
        style={{
          fontFamily: FONTS.body,
          fontSize: 13,
          color: colors["civic-concrete"],
          marginTop: 10,
          marginBottom: 0,
          lineHeight: 1.5,
          transition: "color 0.35s",
        }}
      >
        {PALETTES[mode].desc}
      </p>
    </div>
  );
}

// ─── Comparison Grid ────────────────────────────────
function ComparisonGrid() {
  const keys = ["cummins-red", "mcm-mustard", "girard-teal", "girard-olive", "cummins-red-deep", "girard-teal-light"];
  const labels = { "cummins-red": "Red", "mcm-mustard": "Mustard", "girard-teal": "Teal", "girard-olive": "Olive", "cummins-red-deep": "Deep Red", "girard-teal-light": "Teal Lt" };
  const modes = Object.keys(PALETTES);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONTS.heading, fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px 10px", color: PALETTES.default.colors["engine-steel"], fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: `1px solid ${PALETTES.default.colors["irwin-sand"]}` }}>
              Token
            </th>
            {modes.map((m) => (
              <th key={m} style={{ textAlign: "center", padding: "8px 6px", color: PALETTES.default.colors["engine-steel"], fontWeight: 600, letterSpacing: "0.04em", fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${PALETTES.default.colors["irwin-sand"]}` }}>
                {PALETTES[m].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <td style={{ padding: "8px 10px", fontFamily: FONTS.mono, fontSize: 11, color: PALETTES.default.colors["engine-graphite"] }}>
                {labels[k]}
              </td>
              {modes.map((m) => {
                const hex = PALETTES[m].colors[k];
                const ratio = contrastRatio(hex, PALETTES[m].colors["saarinen-cream"]);
                return (
                  <td key={m} style={{ padding: "6px", textAlign: "center" }}>
                    <div className="flex items-center justify-center gap-2">
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 4,
                          background: hex,
                          border: isLight(hex) ? "1px solid #00000015" : "none",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontFamily: FONTS.mono, fontSize: 9.5, color: PALETTES.default.colors["civic-concrete"], whiteSpace: "nowrap" }}>
                        {ratio.toFixed(1)}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Implementation Guide ───────────────────────────
function ImplementationGuide() {
  const { colors } = usePalette();
  const code = `// Option 1: CSS class on <html> or <body>
// Toggle class: .cvd-deuteranopia, .cvd-protanopia, etc.

:root { --color-primary: #9B2335; }

.cvd-deuteranopia { --color-primary: #7B3B1A; }
.cvd-protanopia   { --color-primary: #6B4020; }
.cvd-tritanopia   { --color-primary: #9B2335; }
.cvd-high-contrast { --color-primary: #8B0000; }

// Option 2: React context (like this demo)
// Wrap app in <PaletteProvider mode="deuteranopia">

// Option 3: prefers-contrast media query
@media (prefers-contrast: more) {
  :root {
    --color-primary: #8B0000;
    --color-bg: #FFFFFF;
    --color-text: #0A0A0A;
  }
}`;

  return (
    <pre
      style={{
        fontFamily: FONTS.mono,
        fontSize: 12,
        lineHeight: 1.7,
        color: colors["saarinen-cream"],
        background: colors["engine-graphite"],
        padding: "20px 24px",
        borderRadius: 4,
        overflow: "auto",
        whiteSpace: "pre-wrap",
        border: `1px solid ${colors["engine-steel"]}`,
        transition: "all 0.35s ease",
      }}
      tabIndex={0}
      role="region"
      aria-label="Implementation code"
    >
      {code}
    </pre>
  );
}

// ─── Main ───────────────────────────────────────────
export default function ColumbusThemeV3() {
  const [tab, setTab] = useState("preview");
  const [visionMode, setVisionMode] = useState("default");
  const palette = PALETTES[visionMode];

  const tabs = [
    { id: "preview", label: "Theme Preview" },
    { id: "compare", label: "CVD Comparison" },
    { id: "implement", label: "Implementation" },
  ];

  return (
    <PaletteCtx.Provider value={palette}>
      <div
        style={{
          background: palette.colors["saarinen-cream"],
          minHeight: "100vh",
          fontFamily: FONTS.body,
          transition: "background 0.35s ease",
        }}
      >
        {/* Hero */}
        <header
          style={{
            background: palette.colors["engine-graphite"],
            padding: "36px 32px 28px",
            position: "relative",
            overflow: "hidden",
            transition: "background 0.35s ease",
          }}
        >
          <div
            style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, background: `radial-gradient(circle at top right, ${palette.colors["cummins-red"]}22, transparent 70%)`, transition: "background 0.35s" }}
            aria-hidden="true"
          />
          <div
            style={{ position: "absolute", bottom: -30, left: 60, width: 120, height: 120, border: `1.5px solid ${palette.colors["mcm-mustard"]}33`, borderRadius: "50%", transition: "border-color 0.35s" }}
            aria-hidden="true"
          />
          <span style={{ fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: palette.colors["mcm-amber"], transition: "color 0.35s" }}>
            Design System · v3 · Colorblind Modes
          </span>
          <h1 style={{ fontFamily: FONTS.display, fontSize: 38, fontWeight: 600, color: palette.colors["saarinen-cream"], margin: "8px 0 6px", lineHeight: 1.15, transition: "color 0.35s" }}>
            Columbus, Indiana
          </h1>
          <p style={{ fontFamily: FONTS.body, fontSize: 16, color: "#C4BAA8", margin: 0, maxWidth: 500, lineHeight: 1.6 }}>
            Cummins iron and Saarinen curves — now with adaptive palettes for every type of color vision.
          </p>
          <div className="mt-5">
            <GirardStrip />
          </div>
        </header>

        {/* Vision Selector — always visible */}
        <div style={{ padding: "16px 32px 0", maxWidth: 740 }}>
          <VisionSelector mode={visionMode} onChange={setVisionMode} />
        </div>

        {/* Tab bar */}
        <nav
          role="tablist"
          className="flex gap-0"
          style={{ borderBottom: `1px solid ${palette.colors["irwin-sand"]}`, background: palette.colors["saarinen-linen"], transition: "all 0.35s", margin: "0 32px", borderRadius: "4px 4px 0 0" }}
          aria-label="Theme sections"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontFamily: FONTS.heading,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "14px 22px",
                minHeight: 44,
                border: "none",
                background: "none",
                cursor: "pointer",
                color: tab === t.id ? palette.colors["cummins-red"] : palette.colors["engine-steel"],
                borderBottom: tab === t.id ? `2px solid ${palette.colors["cummins-red"]}` : "2px solid transparent",
                transition: "all 0.25s ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main style={{ padding: "0 32px 48px", maxWidth: 740 }}>

          {/* PREVIEW TAB */}
          <div role="tabpanel" hidden={tab !== "preview"}>
            <SectionHeader number="01" title="Color Palette" />
            <p style={{ fontFamily: FONTS.body, fontSize: 14, color: palette.colors["engine-steel"], fontStyle: "italic", lineHeight: 1.6, marginBottom: 16, transition: "color 0.35s" }}>
              Switch vision modes above — every swatch updates in place with live contrast ratios. Toggle between modes to see how the palette adapts.
            </p>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}>
              <Swatch name="Cummins Red" colorKey="cummins-red" subtitle="Primary" />
              <Swatch name="Deep Red" colorKey="cummins-red-deep" subtitle="Hover / dark" />
              <Swatch name="MCM Mustard" colorKey="mcm-mustard" subtitle="Accent" />
              <Swatch name="Amber" colorKey="mcm-amber" subtitle="Decorative" />
              <Swatch name="Girard Teal" colorKey="girard-teal" subtitle="Secondary" />
              <Swatch name="Teal Light" colorKey="girard-teal-light" subtitle="Hover" />
              <Swatch name="Girard Olive" colorKey="girard-olive" subtitle="Earth" />
              <Swatch name="Graphite" colorKey="engine-graphite" subtitle="Text primary" />
              <Swatch name="Steel" colorKey="engine-steel" subtitle="Text secondary" />
              <Swatch name="Concrete" colorKey="civic-concrete" subtitle="Text muted" />
              <Swatch name="Irwin Stone" colorKey="irwin-stone" subtitle="Surface" />
              <Swatch name="Irwin Sand" colorKey="irwin-sand" subtitle="Surface light" />
              <Swatch name="Linen" colorKey="saarinen-linen" subtitle="BG alt" />
              <Swatch name="Cream" colorKey="saarinen-cream" subtitle="Background" />
            </div>

            <SectionHeader number="02" title="Typography" />
            <TypeSpecimen family={FONTS.display} name="Display — Outfit" sample="Columbus, Indiana" size={38} weight={600} />
            <TypeSpecimen family={FONTS.heading} name="Heading — DM Sans" sample="ENGINEERED FOR TOMORROW" size={22} weight={700} />
            <TypeSpecimen family={FONTS.body} name="Body — Atkinson Hyperlegible" sample="Where modernist ambition meets Midwestern resolve — Columbus has more architectural significance per capita than anywhere in the nation." size={16} />
            <TypeSpecimen family={FONTS.mono} name="Mono — IBM Plex Mono" sample="--color-primary: #9B2335;" size={14} />

            <SectionHeader number="03" title="Buttons" />
            <div className="flex flex-wrap gap-3 items-center">
              <SampleButton label="Primary" variant="primary" />
              <SampleButton label="Secondary" variant="secondary" />
              <SampleButton label="Accent" variant="accent" />
              <SampleButton label="Teal" variant="teal" />
            </div>

            <SectionHeader number="04" title="Card" />
            <SampleCard />
          </div>

          {/* COMPARISON TAB */}
          <div role="tabpanel" hidden={tab !== "compare"}>
            <SectionHeader number="A" title="Side-by-Side Comparison" />
            <p style={{ fontFamily: FONTS.body, fontSize: 14, color: palette.colors["engine-steel"], lineHeight: 1.6, marginBottom: 20, transition: "color 0.35s" }}>
              How each accent color maps across all five vision modes. Numbers show contrast ratio against the cream background.
            </p>
            <ComparisonGrid />

            <SectionHeader number="B" title="Design Rationale" />
            <div style={{ display: "grid", gap: 12 }}>
              {[
                { mode: "Deuteranopia / Protanopia", note: "Red shifts to warm brown, teal shifts to blue — these sit on opposite ends of the yellow-blue axis that deuteranopes and protanopes can still perceive. Olive shifts to slate to avoid the red-green confusion zone entirely." },
                { mode: "Tritanopia", note: "Red stays (tritanopes see red clearly). Teal shifts to plum/magenta and mustard shifts to warm rose — moving both off the blue-yellow axis that tritanopes can't distinguish." },
                { mode: "High Contrast", note: "All chromatic colors pushed to maximum saturation and depth. Background goes pure white, text goes near-black. Intended for low-vision users and bright ambient conditions." },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "14px 18px",
                    background: i % 2 === 0 ? palette.colors["saarinen-linen"] : "transparent",
                    borderRadius: 4,
                    transition: "background 0.35s",
                  }}
                >
                  <strong style={{ fontFamily: FONTS.heading, fontSize: 14, color: palette.colors["engine-graphite"], display: "block", marginBottom: 4, transition: "color 0.35s" }}>
                    {item.mode}
                  </strong>
                  <span style={{ fontFamily: FONTS.body, fontSize: 13.5, color: palette.colors["engine-steel"], lineHeight: 1.6, transition: "color 0.35s" }}>
                    {item.note}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* IMPLEMENTATION TAB */}
          <div role="tabpanel" hidden={tab !== "implement"}>
            <SectionHeader number="I" title="Implementation Approaches" />
            <p style={{ fontFamily: FONTS.body, fontSize: 14, color: palette.colors["engine-steel"], lineHeight: 1.6, marginBottom: 20, transition: "color 0.35s" }}>
              Three ways to wire up colorblind modes — CSS class toggle, React context, or automatic via <code style={{ fontFamily: FONTS.mono, fontSize: 12, background: palette.colors["saarinen-linen"], padding: "2px 6px", borderRadius: 3 }}>prefers-contrast</code>.
            </p>
            <ImplementationGuide />

            <SectionHeader number="II" title="Recommendations" />
            <div
              style={{
                background: palette.colors["saarinen-linen"],
                borderLeft: `3px solid ${palette.colors["girard-teal"]}`,
                padding: "16px 20px",
                borderRadius: "0 4px 4px 0",
                transition: "all 0.35s",
              }}
            >
              <ul style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 1.8, color: palette.colors["engine-steel"], margin: 0, paddingLeft: 18, transition: "color 0.35s" }}>
                <li><strong style={{ color: palette.colors["engine-graphite"] }}>Don't rely on color alone</strong> — pair every color signal with an icon, label, pattern, or shape.</li>
                <li><strong style={{ color: palette.colors["engine-graphite"] }}>Store preference</strong> — persist the user's CVD mode choice. Respect <code style={{ fontFamily: FONTS.mono, fontSize: 12 }}>prefers-contrast: more</code> as a signal to auto-enable high-contrast mode.</li>
                <li><strong style={{ color: palette.colors["engine-graphite"] }}>Test with simulators</strong> — Chrome DevTools → Rendering → Emulate vision deficiencies. Also try Stark or Sim Daltonism.</li>
                <li><strong style={{ color: palette.colors["engine-graphite"] }}>Keep it in settings, not buried</strong> — surface the toggle in the main UI, not three menus deep.</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </PaletteCtx.Provider>
  );
}
