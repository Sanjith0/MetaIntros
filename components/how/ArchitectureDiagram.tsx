/**
 * The architecture as one picture: what each piece sees, and where code
 * decides. Drawn by hand in SVG (no libraries, no images). Four columns:
 * phones, formation and pair talk, the agents, and the code spine.
 */

const C = {
  ink: "#050505",
  ink2: "#65676b",
  line: "#ced0d4",
  code: "#0866ff",
  codeBg: "#ebf5ff",
  agent: "#6d28d9",
  agentBg: "#f3efff",
  private: "#d21f3c",
  card: "#ffffff",
};

function Box({ x, y, w, h, title, lines, tone = "neutral", id }: { x: number; y: number; w: number; h: number; title: string; lines: string[]; tone?: "neutral" | "code" | "agent"; id: string }) {
  const stroke = tone === "code" ? C.code : tone === "agent" ? C.agent : C.line;
  const fill = tone === "code" ? C.codeBg : tone === "agent" ? C.agentBg : C.card;
  return (
    <g data-box={id}>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={fill} stroke={stroke} strokeWidth={tone === "neutral" ? 1.5 : 2} />
      <text x={x + 14} y={y + 26} fontSize={15} fontWeight={700} fill={C.ink}>
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={i} x={x + 14} y={y + 47 + i * 18} fontSize={12.5} fill={C.ink2}>
          {l}
        </text>
      ))}
    </g>
  );
}

function Arrow({ d, dashed = false }: { d: string; dashed?: boolean }) {
  return <path d={d} fill="none" stroke={C.ink2} strokeWidth={1.8} strokeDasharray={dashed ? "6 5" : undefined} markerEnd="url(#arrow)" />;
}

function Label({ x, y, children, anchor = "middle" }: { x: number; y: number; children: string; anchor?: "middle" | "start" }) {
  return (
    <text x={x} y={y} fontSize={11.5} fill={C.ink2} textAnchor={anchor}>
      {children}
    </text>
  );
}

export function ArchitectureDiagram() {
  const agents = ["Maya", "Dev", "Ana", "Kai", "Zoe"];
  return (
    <svg viewBox="0 0 1060 650" role="img" aria-labelledby="arch-title arch-desc" className="h-auto w-full" data-testid="architecture-diagram">
      <title id="arch-title">How Party Queue works</title>
      <desc id="arch-desc">
        Each phone's sentence becomes a private brief. Code forms a party of five. Five agents, each seeing only its own brief and the public table, settle a plan; code judges and verifies every
        turn; pair talk writes lines only from approved facts. Code locks the plan and the event bus tells all five phones.
      </desc>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={C.ink2} />
        </marker>
      </defs>

      {/* Column A: phones */}
      <Box id="phones" x={20} y={50} w={190} h={110} title="Five phones" lines={["One sentence each:", "“chill, out by eleven,", " under $20, no drinking”"]} />
      <Arrow d="M115,160 L115,198" />
      <Box id="brief" x={20} y={200} w={190} h={130} title="Brief · on your phone" lines={["Private rules", "Preferences", "Lines you approve", "Facts you approve"]} />

      {/* Column B: formation and pair talk */}
      <Arrow d="M210,265 L248,265" />
      <Box id="formation" x={250} y={200} w={200} h={130} tone="code" title="Formation · code" lines={["Same place or whole night", "Shared window · 5 people", "Mutual friend or small Group", "Blocks · 18+ · women-only"]} />
      <Arrow d="M350,330 L350,428" dashed />
      <Box id="pairs" x={250} y={430} w={200} h={110} tone="agent" title="Pair talk" lines={["The model picks fact ids;", "code writes the sentence:", "openers, door cards"]} />

      {/* Column C: the agents */}
      <Arrow d="M450,265 L488,265" />
      <rect x={490} y={40} width={250} height={410} rx={16} fill="none" stroke={C.agent} strokeWidth={1.5} strokeDasharray="6 5" />
      <text x={505} y={66} fontSize={15} fontWeight={700} fill={C.agent}>
        Table talk · up to 3 rounds
      </text>
      {agents.map((a, i) => (
        <g key={a} data-box={`agent-${a}`}>
          <rect x={505} y={80 + i * 72} width={220} height={58} rx={10} fill={C.agentBg} stroke={C.agent} strokeWidth={1.5} />
          <text x={520} y={104 + i * 72} fontSize={14} fontWeight={700} fill={C.ink}>
            {a}'s agent
          </text>
          <text x={520} y={124 + i * 72} fontSize={12} fill={C.ink2}>
            sees {a}'s brief + the table
          </text>
        </g>
      ))}
      <text x={490} y={478} fontSize={12.5} fontWeight={700} fill={C.private}>
        A broken rule reaches the table only as
      </text>
      <text x={490} y={496} fontSize={12.5} fontWeight={700} fill={C.private}>
        “Plan · unavailable”: no reason, no name.
      </text>

      {/* Column D: the code spine */}
      <Arrow d="M740,110 L798,110" />
      <Label x={769} y={102}>
        verdicts
      </Label>
      <Box id="judge" x={800} y={50} w={240} h={130} tone="code" title="Judge · code" lines={["Hard rules after every turn", "Public venue only", "Five signatures, or the best", "valid plan · Lock now"]} />
      <Arrow d="M740,250 L798,250" />
      <Label x={769} y={242}>
        lines
      </Label>
      <Box id="verifier" x={800} y={200} w={240} h={110} tone="code" title="Verifier · code" lines={["Public lines only from", "approved lines or neutral", "phrases; anything else blocked"]} />
      <Arrow d="M920,180 L920,198" />
      <Arrow d="M920,310 L920,348" />
      <Box id="lock" x={800} y={350} w={240} h={90} tone="code" title="Lock · code" lines={["RSVP for all five", "Chat: plan pinned, openers"]} />
      <Arrow d="M450,522 L765,522 L765,400 L798,400" />
      <Arrow d="M920,440 L920,488" />
      <Box id="bus" x={800} y={490} w={240} h={110} title="Event bus" lines={["Every event has an audience;", "each phone hears only its own.", "MATCH FOUND × 5"]} />

      {/* Back to every phone, around the outside */}
      <Arrow d="M1040,545 L1052,545 L1052,18 L115,18 L115,48" dashed />
      <Label x={580} y={13}>
        MATCH FOUND · chat · cards · back to every phone
      </Label>

      {/* Legend */}
      <g transform="translate(20,380)">
        <rect width={14} height={14} rx={3} fill={C.codeBg} stroke={C.code} strokeWidth={2} />
        <text x={22} y={12} fontSize={12} fill={C.ink2}>
          Code decides
        </text>
        <rect y={24} width={14} height={14} rx={3} fill={C.agentBg} stroke={C.agent} strokeWidth={2} />
        <text x={22} y={36} fontSize={12} fill={C.ink2}>
          Model calls (one per agent)
        </text>
        <text y={66} fontSize={12} fill={C.private} fontWeight={700}>
          Private rules stay inside
        </text>
        <text y={82} fontSize={12} fill={C.private} fontWeight={700}>
          their owner's agent
        </text>
      </g>
    </svg>
  );
}
