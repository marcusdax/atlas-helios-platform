# Atlas Helios UI v2 — Intelligence Command Center

Author: AI Agent Skill Profile: Front-End Design Engineer & Visual Systems Architect for ODASI Technologies Inc.

This document records the proposed visual/system redesign, architecture, and implementation roadmap for "Atlas Helios UI v2 — Intelligence Command Center". It is a direct capture of the design and engineering notes provided by the stakeholder and AI design agent.

Repository: https://github.com/marcusdax/atlas-helios-platform

---

## Executive summary

Atlas + Helios should feel less like a conventional SaaS dashboard and more like an operational intelligence system.

The current foundation is solid: React 18, Framer Motion, ECharts, Leaflet, Socket.IO, PWA support, separate Atlas/Helios contexts, and the core dashboard already has storm intelligence, property assessment, activity, forecasting and priority-property workflows.

This proposal outlines the visual identity, product architecture, engineering priorities, and a phased implementation plan to evolve the product into an AI-first operational command center.

---

## Visual identity — “ORBITAL INTELLIGENCE”

- Deep near-black/navy spatial canvas
- Cyan/ice-blue intelligence signals
- Violet secondary intelligence layer
- Controlled magenta for AI/system emphasis
- Glass-metal panels rather than generic cards
- Fine technical grid overlays
- Atmospheric radial gradients
- Data-density hierarchy
- HUD-inspired status indicators
- Animated telemetry and signal states
- More sophisticated typography using Space Grotesk + Inter
- Subtle scanline/particle effects, never gratuitous
- Stronger map visualization
- AI confidence visualization
- Risk heat fields
- Animated storm trajectories
- Property intelligence nodes

The existing UI already has dark glass cards, blue glow, animations and responsive behavior, but the implementation is currently fairly conventional: the dashboard uses standard Tailwind utility layouts and simple `bg-neutral-*` panels.

---

## Product architecture — Intelligence layers

I would evolve the interface around five intelligence layers:

ATLAS
├── Live Storm Intelligence
├── Atmospheric Risk
├── Geographic Intelligence
├── Property Exposure
└── Predictive Event Modeling

HELIOS
├── Property Vision
├── Damage Detection
├── Material Recognition
├── Severity Analysis
├── Estimate Intelligence
└── Evidence / Confidence

COMMAND
├── Leads
├── Assignments
├── Work Queue
├── Alerts
└── Operations

INTELLIGENCE
├── AI Findings
├── Predictions
├── Anomalies
├── Confidence
└── Recommendations

SYSTEM
├── Connectivity
├── Model Status
├── Data Freshness
├── API Health
└── Audit / Telemetry

This gives the application a stronger mental model than simply having pages for storms, properties, leads and estimates.

---

## Critical engineering issue

The current dashboard explicitly substitutes mock data inside `fetchDashboardData()`, including `1,247` properties, `47` high-risk properties and sample activity.

We must not merely make the mock dashboard prettier. Establish a typed data layer and make every visual state capable of representing:

LIVE → SYNCING → STALE → DEGRADED → OFFLINE

Recommended backend/data flow:

UI
 ↓
Domain hooks
 ↓
API / WebSocket gateway
 ↓
Domain services
 ↓
PostgreSQL / Redis / AI services

---

## Target dashboard (command center)

The primary screen should resemble an AI command center where the map becomes the spatial operating system. See the ASCII mockup in the original specification.

Important UI primitives to build:
- Panel
- Metric
- Signal
- Status
- AIConfidence
- RiskScore
- DataTable
- CommandAction

Map and spatial visualization should be central, with telemetry, heatmaps, trajectories, and property nodes integrated.

---

## Helios (Property Assessment) vision

Property assessment workflow should center on visual evidence and AI model outputs. Example model summary in the original spec shows breakdowns per component (roof, siding, gutters, windows) with confidence scores and actions (Inspect / Compare / Estimate).

Image processing flow: image → segmentation → detected components → damage regions → confidence → recommended Xactimate-style line items → estimate

---

## Performance & Engineering priorities

- Route-level code splitting
- Lazy-loaded maps and charts
- WebSocket lifecycle cleanup and robust reconnection/backoff
- Request cancellation and query caching
- Optimistic UI where appropriate
- Virtualized lists for properties/leads
- Efficient image handling (thumbnails, AVIF/WebP, responsive sizes)
- Skeleton states, error boundaries, offline state, stale-data indicators
- Respect `prefers-reduced-motion`
- Keyboard/focus architecture and WCAG 2.2 AA
- Core Web Vitals instrumentation and frontend telemetry
- Accessibility and visual regression testing

---

## Recommended implementation roadmap

1. Establish the new visual token system (colors, typography, spacing, elevation, motion, grid overlays)
2. Rebuild the application shell/navigation
3. Rebuild Dashboard around the live intelligence map
4. Create reusable UI primitives (Panel, Metric, Signal, Status, AIConfidence, RiskScore, DataTable, CommandAction)
5. Rework Storm Intelligence visualizations
6. Rework Helios Property Assessment around visual evidence and model outputs
7. Replace mock dashboard state with a proper typed data/query architecture
8. Harden WebSocket state management and lifecycle
9. Add loading/error/offline/degraded states
10. Add automated accessibility and performance testing
11. Add visual regression testing
12. Move through Leads → Estimates → Mobile Field → Settings

---

## Notes on pushing changes

The AI agent attempted to create a feature branch and perform writes directly to the repository but encountered a 403 `Resource not accessible by integration` error in that environment. The repository is accessible and was inspected; this document is being added to record the proposal and to provide a clear next-step artifact for collaborators.

If you want, I can also:
- Create a feature branch and open a draft pull request with initial UI token files and component scaffolding
- Create issues for the prioritized work items above
- Add a basic Storybook + visual-regression setup and a CI job scaffolding

---

## Original specification / design agent notes

(Full original content captured verbatim below.)

```
@GitHub https://github.com/marcusdax/atlas-helios-platform. **AI Agent Skill Profile: Front-End Design Engineer & Visual Systems Architect for ODASI Technologies Inc.** push the following to the repo: Yes. I inspected the live `main` branch of [\`marcusdax/atlas-helios-platform\`](https://github.com/marcusdax/atlas-helios-platform?utm_source=chatgpt.com) and I agree with the direction: **Atlas + Helios should feel less like a conventional SaaS dashboard and more like an operational intelligence system.**

The current foundation is actually solid: React 18, Framer Motion, ECharts, Leaflet, Socket.IO, PWA support, separate Atlas/Helios contexts, and the core dashboard already has storm intelligence, property assessment, activity, forecasting and priority-property workflows.

### What I would transform

**Visual identity — “ORBITAL INTELLIGENCE”**

- Deep near-black/navy spatial canvas
- Cyan/ice-blue intelligence signals
- Violet secondary intelligence layer
- Controlled magenta for AI/system emphasis
- Glass-metal panels rather than generic cards
- Fine technical grid overlays
- Atmospheric radial gradients
- Data-density hierarchy
- HUD-inspired status indicators
- Animated telemetry and signal states
- More sophisticated typography using Space Grotesk + Inter
- Subtle scanline/particle effects, never gratuitous
- Stronger map visualization
- AI confidence visualization
- Risk heat fields
- Animated storm trajectories
- Property intelligence nodes

The existing UI already has dark glass cards, blue glow, animations and responsive behavior, but the implementation is currently fairly conventional: the dashboard uses standard Tailwind utility layouts and simple `bg-neutral-*` panels.

### More importantly: I would improve the **product architecture**, not just the CSS.

I would evolve the interface around five intelligence layers:

```text
ATLAS
├── Live Storm Intelligence
├── Atmospheric Risk
├── Geographic Intelligence
├── Property Exposure
└── Predictive Event Modeling

HELIOS
├── Property Vision
├── Damage Detection
├── Material Recognition
├── Severity Analysis
├── Estimate Intelligence
└── Evidence / Confidence

COMMAND
├── Leads
├── Assignments
├── Work Queue
├── Alerts
└── Operations

INTELLIGENCE
├── AI Findings
├── Predictions
├── Anomalies
├── Confidence
└── Recommendations

SYSTEM
├── Connectivity
├── Model Status
├── Data Freshness
├── API Health
└── Audit / Telemetry
```

That gives the application a much stronger mental model than simply having pages for storms, properties, leads and estimates.

### One particularly important engineering issue

The current dashboard explicitly substitutes mock data inside `fetchDashboardData()`, including `1,247` properties, `47` high-risk properties and sample activity.

So I would **not merely make the mock dashboard prettier**.

I would establish a typed data layer:

```text
UI
 ↓
Domain hooks
 ↓
API / WebSocket gateway
 ↓
Domain services
 ↓
PostgreSQL / Redis / AI services
```

and make every visual state capable of representing:

**LIVE → SYNCING → STALE → DEGRADED → OFFLINE**

rather than assuming everything is always available.

---

## The target dashboard

I would make the primary screen resemble an **AI command center**:

```text
┌──────────────────────────────────────────────────────────────────┐
│ ATLAS / HELIOS                 LIVE ●      12:47:31 CST          │
├────────┬─────────────────────────────────────────────────────────┤
│        │  ATMOSPHERIC INTELLIGENCE                               │
│ ATLAS  │  Severe weather activity detected                       │
│ HELIOS │                                                         │
│        │     ┌────────────────────────────────────────────┐      │
│ ◉      │     │                                            │      │
│ Storms │     │             LIVE STORM MAP                │      │
│        │     │       ◉──────◉                             │      │
│ ◉      │     │    ╱             ◉                        │      │
│ Assets │     │  ◉        PROPERTY FIELD                 │      │
│        │     │                                            │      │
│ ◉      │     └────────────────────────────────────────────┘      │
│ Leads  │                                                         │
│        │  RISK       EXPOSURE       AI FINDINGS       ALERTS     │
│ ◉      │  94.2%      $8.4M          137               03        │
│ Helios │                                                         │
│        │  ───────────────────────────────────────────────────    │
│        │  PRIORITY PROPERTY QUEUE                                │
│        │  █ 1247 Oak Ridge     94%     ROOF / WIND / HAIL       │
│        │  █ 3856 Maple         87%     SIDING / ROOF             │
└────────┴─────────────────────────────────────────────────────────┘
```

The **map becomes the spatial operating system**, rather than one card among several.

### Helios should get a major visual upgrade too

The property assessment workflow should eventually become something like:

```text
PROPERTY
1247 Oak Ridge Dr

AI PROPERTY MODEL
────────────────────────

ROOF                  94%
 ├─ Hail impact       91%
 ├─ Wind displacement 87%
 └─ Missing shingles  78%

SIDING                71%
GUTTERS               63%
WINDOWS               18%

AI CONFIDENCE         93.7%

[ INSPECT ] [ COMPARE ] [ ESTIMATE ]
```

And when an image is uploaded:

**image → segmentation → detected components → damage regions → confidence → recommended Xactimate-style line items → estimate**

That becomes a genuinely differentiated product.

---

## Performance architecture

I'd also target:

- route-level code splitting
- lazy-loaded maps
- lazy-loaded charts
- WebSocket lifecycle cleanup
- request cancellation
- query caching
- optimistic UI where appropriate
- virtualized property/lead lists
- image thumbnails before full-resolution imagery
- AVIF/WebP
- responsive image sizing
- skeleton states
- error boundaries
- offline state
- stale-data indicators
- `prefers-reduced-motion`
- keyboard/focus architecture
- WCAG 2.2 AA
- Core Web Vitals instrumentation
- frontend error telemetry
- API latency telemetry

The current app already has PWA/service-worker intent and WebSocket infrastructure, so this can be evolved rather than rebuilt from scratch.

### GitHub execution

I attempted to create a feature branch and write the first visual-system changes directly into the repository, but the connected GitHub integration currently returned **403 / Resource not accessible by integration** for write operations. I therefore **did not pretend that changes were pushed**.

The repository itself is accessible and I have inspected the actual frontend structure, including `App.js`, `App.css`, `index.css`, `Dashboard.js`, the component tree, contexts, and package dependencies.

**My recommended next implementation target is** **`Atlas Helios UI v2 — Intelligence Command Center`****:

1. Establish the new visual token system.
2. Rebuild the application shell/navigation.
3. Rebuild Dashboard around the live intelligence map.
4. Create reusable futuristic `Panel`, `Metric`, `Signal`, `Status`, `AIConfidence`, `RiskScore`, `DataTable`, and `CommandAction` primitives.
5. Rework Storm Intelligence.
6. Rework Helios Property Assessment around visual evidence.
7. Replace mock dashboard state with a proper data/query architecture.
8. Harden WebSocket state management.
9. Add loading/error/offline/degraded states.
10. Add automated accessibility and performance testing.
11. Add visual regression testing.
12. Then move through Leads → Estimates → Mobile Field → Settings.

**The goal shouldn't be “make the dashboard look futuristic.” It should be:** ***make Atlas Helios feel like the operating system for property-risk intelligence.***
```

---

## Next steps I can take now

- Create a feature branch and open a draft PR with initial UI tokens and component scaffolding
- Add issues for the highest-priority engineering items (replace mock data, websocket hardening, lazy-loading map)
- Scaffold Storybook and visual-regression testing
- Add a minimal design-token file (`design/tokens.json`) and a `ThemeProvider` that exposes the token palette

If you want me to proceed with any of the above (create branch, push files, open PR, create issues), reply with which actions you'd like and I'll perform them now.
