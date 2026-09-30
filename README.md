# LEGO Collection

[Open Johnson Lee’s LEGO Collection](https://johnson-lee-v0.github.io/LEGO-Collection/).

Explore three LEGO vehicle sets through interactive 3D reconstructions, numbered build steps and parts inventories. Original instruction pages open on LEGO.com. Progress saves in the visitor’s browser, and CAD data loads only when a set opens.

| Set | Published pieces | Build steps |
| --- | ---: | ---: |
| Lamborghini Sián FKP 37 · 42115 | 3,696 | 1,084 |
| Bugatti Chiron · 42083 | 3,599 | 970 |
| Porsche 911 Turbo · 10295 | 1,458 | 366 |

Open a set and click the highlighted pieces, **Build step**, or press Space. **Undo last step**, chapter building and camera controls help inspect the assembly. **Finished preview** shows the completed model without changing progress. **Official instructions** links to the corresponding PDF page; **Parts list** shows element IDs, quantities and source links.

Progress is stored in this browser. It does not sync across devices, and clearing site storage clears progress. This static site has no account or backend service.

## Development and deployment

Use Node.js 24 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm start
```

Open `http://127.0.0.1:4173/LEGO-Collection/`. GitHub Actions tests the source, builds `dist/`, and deploys it to GitHub Pages. `pnpm dev` runs development on port 5173. `./run.sh` builds and starts the preview when Node.js is on PATH.

The default public base is `/LEGO-Collection/`. Use `COLLECTION_BASE=/` for an independent origin. App navigation, CAD resources and exported inventories honor the base. Set links use query strings, so direct links and refreshes work on static hosting.

## Sources and scope

This public release includes only the three vehicle reconstructions whose retained source model headers specify redistribution under CCAL version 2.0. Original author credits, source hashes and LDraw library licenses remain with each model. Gallery previews are rendered from those models. No mirrored LEGO instruction-page artwork, part-illustration artwork, private photograph or unrelated local project data is included.

These reconstructions map part identities and quantities to the official instruction steps. Repeated identical pieces follow reconstructed placement order within matched assemblies. Animated joining is illustrative; the app does not simulate clutch forces, drivetrain behavior or certify a physical build.

- **Sián:** 3,696 modeled pieces across 1,084 steps; printed and published totals agree.
- **Chiron:** 3,590 modeled pieces, a 3,598-piece printed inventory and a 3,599-piece published count. Unassigned supplied pieces remain explicit.
- **Porsche:** 1,363 pieces in the selected Turbo build; 95 of the 1,458 supplied pieces are unused. The Targa route is excluded.

LEGO and vehicle marks belong to their respective owners. This independent collection is not endorsed by them.

## Model records

- [Sián credits](public/official/42115/MODEL-CREDITS.md) · [provenance](public/official/42115/model-provenance.json)
- [Chiron credits](public/official/42083/MODEL-CREDITS.md) · [provenance](public/official/42083/model-provenance.json)
- [Porsche credits](public/official/10295/MODEL-CREDITS.md) · [provenance](public/official/10295/model-provenance.json)

Tests cover inventory reconciliation, CAD loading and binding, unique part assignment, joining actions, camera visibility, browser-local progress, source links and static project paths.
