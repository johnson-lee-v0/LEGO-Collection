# LEGO® Collection

[Open Johnson Lee’s Brick Collection](https://johnson-lee-v0.github.io/LEGO-Collection/).

Explore three attributed community CAD reconstructions with rotation, zoom, preset camera views, preview-image export and model-derived parts inventories. The original LEGO® booklets open on LEGO.com.

**This is a model viewer, not a build guide.** It does not certify physical connections, mechanisms, completeness or safety. Use the original booklets for physical assembly.

| Set | Modeled physical pieces | Published set pieces |
| --- | ---: | ---: |
| Lamborghini Sián FKP 37 · 42115 | 3,696 | 3,696 |
| Bugatti Chiron · 42083 | 3,590 | 3,599 |
| Porsche 911 Turbo · 10295 | 1,363 | 1,458 |

Model inventories count the digital reconstructions, not necessarily the full box contents. Porsche includes the Turbo only; the Targa route is excluded. Stickers and some printed details may be absent.

## Public release scope

The public viewer no longer includes the full booklet-derived instruction sequences, per-step callouts, instruction-synchronized builder, or progress-saving controls. Those datasets and their generated downloads have been removed from the current public source and production output. Original local files were preserved separately before removal; Git history was not rewritten. Previously saved browser progress is left untouched, but is not used by the viewer.

No mirrored instruction-page artwork, part-illustration artwork or private photograph is included. Original booklet links, individual factual set details and documented model corrections remain. CAD geometry and retained notices stay intact. Three complete, unused LDCad snapping-metadata blocks marked for non-commercial use were omitted from the distributed Chiron files, with the upstream and redistributed source hashes recorded separately in its provenance.

## Privacy and third-party requests

The application has no accounts, analytics, tracking cookies or application backend. It does not read or save visitor progress. Fonts are supplied by the visitor’s operating system; the site makes no Google Fonts request. Site resources are served by GitHub Pages. Opening an external source link visits that provider’s site.

[Public privacy, credits and licenses](public/about.html) · [Software dependency notices](public/THIRD-PARTY-NOTICES.txt)

## License and sources

Original application code is licensed under the [MIT License](LICENSE), copyright 2026 Johnson Lee. The standard MIT text is unchanged. Third-party software retains its own licenses; full applicable notices ship with the website.

The MIT license does not relicense the bundled LDraw models, part geometry, generated model data or previews derived from them, catalog crosswalks, or third-party artwork/data. These retain their existing terms and author notices, including CCAL version 2.0 (CC BY 2.0) and CC BY 4.0 where specified. See model credits, embedded headers, `ldraw/CAreadme.txt`, `ldraw/CAlicense.txt`, and the linked CC BY 4.0 legal text.

Catalog part/color/element crosswalk data is from [Rebrickable Downloads](https://rebrickable.com/downloads/), which permits reuse with source acknowledgment. Retained crosswalk provenance records identify the downloaded CSVs, dates and hashes. Rebrickable data is not covered by the application’s MIT license. The visible model inventory is counted from the attributed CAD instances.

- [Sián credits — Jens Brühl (jb70)](public/official/42115/MODEL-CREDITS.md) · [provenance](public/official/42115/model-provenance.json)
- [Chiron credits — Philippe Hurbain (Philo)](public/official/42083/MODEL-CREDITS.md) · [provenance](public/official/42083/model-provenance.json)
- [Porsche credits — Ulrich Röder (UR)](public/official/10295/MODEL-CREDITS.md) · [provenance](public/official/10295/model-provenance.json)

LEGO® is a trademark of the LEGO Group of companies, which does not sponsor, authorize or endorse this site. Lamborghini, Bugatti and Porsche marks belong to their respective owners; no affiliation or endorsement is claimed. No official LEGO logo is used. The LDraw “Official Model Repository” name describes community reconstructions of official sets, not LEGO endorsement.

## Development and deployment

Use Node.js 24 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm start
```

Open `http://127.0.0.1:4173/LEGO-Collection/`. GitHub Actions tests the source, builds `dist/`, and deploys to GitHub Pages. `pnpm dev` uses port 5173. The default public base is `/LEGO-Collection/`; use `COLLECTION_BASE=/` for an independent origin. Direct model links use query strings and work on static hosting.

Checks cover CAD loading and instance binding without external requests, inventory totals, source hashes, geometry preservation, camera behavior, release exclusions and required public notices.
