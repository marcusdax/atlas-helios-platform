import { Card, CardHeader, Button } from '../components/ui';

export default function SparkTab() {
  const vanguardTiers = [
    {
      tier: 'TIER 01 · GROUND SCOUT',
      title: '4-Slope Perimeter Capture',
      floor: '$15.00 Guaranteed Floor',
      payoutRange: '$15 – $45 / mission',
      accent: '#315C26',
      borderClass: 'border-t-[#315C26]',
      tasks: [
        '4-slope ground & eave photo protocol',
        'Hardware GPS + inclinometer pitch lock',
        'Role ends strictly at photo upload (no roof climbing required)',
      ],
    },
    {
      tier: 'TIER 02 · PART-107 PILOT',
      title: 'Aerial Ortho & Nadir Survey',
      floor: '$45.00 Guaranteed Floor',
      payoutRange: '$45 – $125 / mission',
      accent: '#0F2244',
      borderClass: 'border-t-[#0F2244]',
      tasks: [
        'Automated 4-slope + nadir drone flight path',
        'Sub-centimeter hail chalk-square verification',
        'On-device SHA-256 frame provenance hashing',
      ],
    },
    {
      tier: 'TIER 03 · LEAD INSPECTOR',
      title: 'Forensic Haig-Standard Attestation',
      floor: '$95.00 Guaranteed Floor',
      payoutRange: '$95 – $225 / mission',
      accent: '#8C2F22',
      borderClass: 'border-t-[#8C2F22]',
      tasks: [
        '10x10 ft test square hail fracture count',
        'Collateral soft-metal & spatter documentation',
        'Direct promotion of Estimate to Tier-3 Field-Captured',
      ],
    },
  ];

  return (
    <div className="space-y-6 text-[#17231D]">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#17231D]/15 pb-4">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#315C26]">
            FOLIO 04 · AUCTUM VANGUARD FIELD NETWORK ($15.00 MINIMUM FLOOR)
          </p>
          <h2 className="mt-1 font-display text-3xl text-[#17231D]">
            Auctum Vanguard — <em>Field Capture Bounties</em>
          </h2>
          <p className="mt-1 text-sm text-[#4A554E]">
            Strictly scoped 4-slope photo capture missions · $15.00 guaranteed minimum floor per mission · Role ends at
            upload
          </p>
        </div>
        <span className="border border-[#315C26] bg-[#315C26] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F1F2EA]">
          GUARANTEED FLOOR: $15.00 MIN / MISSION
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {vanguardTiers.map((t) => (
          <Card key={t.tier} className={`border-t-4 ${t.borderClass}`}>
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ borderColor: t.accent, color: t.accent }}
                >
                  {t.tier}
                </span>
                <span className="font-mono text-sm font-bold text-[#17231D]">{t.payoutRange}</span>
              </div>
              <h3 className="font-display text-xl font-semibold text-[#17231D]">{t.title}</h3>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#315C26]">{t.floor}</p>

              <div className="mt-4 space-y-2 border-t border-[#17231D]/15 pt-3">
                {t.tasks.map((tk) => (
                  <div key={tk} className="flex items-start gap-2 text-xs text-[#4A554E]">
                    <span className="font-mono font-bold" style={{ color: t.accent }}>
                      ▸
                    </span>
                    <span>{tk}</span>
                  </div>
                ))}
              </div>
              <Button className="mt-5 w-full" variant="primary">
                Dispatch {t.tier.split('·')[0].trim()} Bounty →
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Vanguard Field Doctrine — Strictly Scoped Evidence Capture"
          subtitle="Scouts never negotiate claims or write estimates; their role ends at uploading hardware-signed 4-slope photos."
        />
        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[
              {
                step: '01 · CLAIM BOUNTY',
                metric: '$15.00+ Escrow Locked',
                desc: 'Contractor locks mission bounty in escrow ($15.00 floor enforced).',
              },
              {
                step: '02 · 4-SLOPE CAPTURE',
                metric: 'North · East · South · West',
                desc: 'Scout captures 4 perimeter slope photos with GPS & inclinometer pitch.',
              },
              {
                step: '03 · SHA-256 UPLOAD',
                metric: 'Role Ends at Upload',
                desc: 'Photos hash into the Estimate provenance chain and promote Tier-3 evidence.',
              },
              {
                step: '04 · INSTANT PAYOUT',
                metric: 'Escrow Released',
                desc: 'Upon hash verification, escrow releases directly to the scout wallet.',
              },
            ].map((c) => (
              <div key={c.step} className="border border-[#17231D]/20 bg-[#FAF9F4] p-4">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8C2F22]">
                  {c.step}
                </div>
                <div className="mt-1 font-display text-base font-semibold text-[#17231D]">{c.metric}</div>
                <div className="mt-1 text-xs leading-relaxed text-[#4A554E]">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
