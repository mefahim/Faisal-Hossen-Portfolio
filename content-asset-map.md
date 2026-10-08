# Asset / Content Mapping — Phase 1 + Phase 2 Evidence

## Phase 1 source

Source folder: Google Drive folder `1vihzAxjEUOomS-fbwNgvArCR6t2cQxW3`

| Drive file | Local evidence | Managed path | Visual description | Intended placement |
| --- | --- | --- | --- | --- |
| `file_00000000868082088f57b80c2f5ffabf.jpg` | `drive_asset_01.jpg` | `public/assets/faisal-workbench.jpg` (managed backup: `/manus-storage/drive_asset_01_4f7dc037.jpg`) | Full-body outdoor portrait in a navy shirt with warm bokeh | Home Workbench portrait |
| `file_00000000de5882089fc57902d9705297.png` | `drive_asset_02.png` | Supplied and inspected; not used in the current interface | Full-body beach portrait at sunset, phone in hand | Available for future identity-led placement |
| `file_000000007728820885bd77589e8b2335.png` | `public/assets/about/portrait-smile.png` | Local project asset | Front-facing smiling beach portrait in black shirt | Contact visual |
| `file_00000000a03c8208ae82c81b6aa09756.png` | `drive_asset_04.png` | Supplied and inspected; not used in the current interface | Back-facing beach/sunset portrait | Available for future identity-led placement |
| `file_0000000092b48208bcfcc53a652ade1d.png` | `public/assets/about/portrait-profile.png` | Local project asset | Close portrait on light background in black jacket | About profile visual |

## Phase 2 source

Source folder: Google Drive folder `1CUIGAx67rFEd8ThLkvTDmEXFbC8KWoBq`

| Project | Source Google Doc | Extracted source file | Supplied visual | Local path | Intended placement |
| --- | --- | --- | --- | --- | --- |
| Peoria Hardwood Floors | `1RUIR-lbyiRjGV8dAzbHEZJ9qr9FrKyugr3EnkQn5X78` | `content/project1-doc.json` | `1Ssg9XlfB2atTLnmFxCY4GWHW86DgTnCW` | `public/assets/projects/peoria-hardwood-floors.png` | Home Selected Work, `/work`, `/work/peoria-hardwood-floors` |
| Nicola | `1clLJSCUDlsYAeKiNL3GyE7u1ayTs7UpfXaRrSg8obR8` | `content/project2-doc.json` | `1e0eLXP6DKDE6DSPay7vYk-XPoJaSWC3c` | `public/assets/projects/nicola.png` | Home Selected Work, `/work`, `/work/nicola` |
| AI Flooring Visualizer | `1P9FUZdI2Kob-uTDKq8uyvTh7dHtsiMni04lZyFhUruk` | `content/project3-doc.json` | `1B_73JGG6m_nQrqfdCb5WOQkjVDYGZcRf` | `public/assets/projects/ai-flooring-visualizer.png` | Home Selected Work, `/work`, `/work/ai-flooring-visualizer` |

## Evidence boundaries

- The Phase 2 project documents contain descriptions, roles, implementation details, technology, and in two cases explicit live website URLs.
- Peoria live URL: `https://peoriahardwoodfloors.com`.
- Nicola live URL: `https://faisalhossen.com/nicolav1/`.
- No public live URL was supplied for AI Flooring Visualizer.
- The project image assets are supplied visual representations; do not infer unsupported metrics or outcomes from them.
- Do not use any portrait as evidence of a client engagement or project outcome.
- Do not generate a lookalike of Faisal Hossen or alter identity characteristics.
- Missing verified contact email/social URLs and performance data remain explicit limitations.

## Phase 2 implementation placements

- `public/assets/projects/peoria-hardwood-floors.png` → Home Selected Work, `/work`, and `/work/peoria-hardwood-floors` hero visual.
- `public/assets/projects/nicola.png` → Home Selected Work, `/work`, and `/work/nicola` hero visual.
- `public/assets/projects/ai-flooring-visualizer.png` → Home Selected Work, `/work`, and `/work/ai-flooring-visualizer` hero visual.
- `public/assets/faisal-workbench.jpg` → Home Workbench identity visual only; it is not presented as client or project proof.
- `public/assets/about/portrait-profile.png` → `/about` profile visual, used unchanged.
- `public/assets/about/portrait-smile.png` → `/contact` human context visual, used unchanged.

The project data module at `content/projects.ts` is the reusable implementation layer for the three extracted source documents. The Contact page intentionally has no email, social URL, submission form, or backend because no verified contact method was supplied.
