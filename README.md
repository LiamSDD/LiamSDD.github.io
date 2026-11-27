# liamsdd.github.io

Portfolio of LiamSDD, Applied AI Engineer and Claude Code specialist. Live at https://liamsdd.github.io.

Plain HTML, CSS and a little JavaScript, served by GitHub Pages from `main`. No build step, no trackers, no cookies.

## Editing

| Change | File |
| --- | --- |
| Contact link, email line, booking link, hero numbers (French under `fr`) | `data/site.json` |
| Interface copy: hero, headings, buttons, footer | `data/i18n/en.json`, `data/i18n/fr.json` |
| Project text, role, stack, key numbers, links (French under each project's `fr`) | `data/projects.json` |
| Videos and posters per project | `data/media.json` (files in `media/`) |
| Case studies and articles (empty `href` = hidden) | `data/writing.json` |
| Layout and styles | `index.html`, `css/site.css`, `js/app.js` |

English is the default. French shows for browsers set to French, after a choice in the EN · FR switcher, or with `?lang=fr` (for example https://liamsdd.github.io/?lang=fr).

Project pages live at `work/<id>/index.html` and render from the same data files.

Preview locally with `python3 -m http.server` from this folder, then open http://localhost:8000.
