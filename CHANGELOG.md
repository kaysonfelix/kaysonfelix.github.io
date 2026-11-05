# Site versions

Each update zip is named kaysonfelix-site-vX.Y.zip. The version shows faintly at the end of the homepage footer and at the top of admin.html, so you can check which one is live.

## v1.7 (Nov 5, 2026)
- New spreadsheet viewer for {{sheet: file.xlsx}} in project overviews: works like Excel, read-only
  - every sheet as a tab, column letters and row numbers, frozen panes
  - cell formatting (bold/italic, font sizes and colors, fills, borders, wrapped text, alignment), merged cells, column widths, row heights
  - number, currency, percent and date formats; formulas shown in the formula bar
  - click or drag to select, Shift+click, arrow keys; Sum / Average / Count of the selection
  - Find in sheet, zoom (buttons, slider, Ctrl+scroll), full screen, copy (Ctrl+C), download
- New file: sheet-viewer.js

## v1.6 (Nov 4, 2026)
- Gallery moved to its own column on the left; projects are now in the center

## v1.5 (Nov 4, 2026)
- Project Gallery is now 3 across by 2 down (6 newest photos)

## v1.4 (Nov 4, 2026)
- Project Gallery always shows 4 slots; slots without a photo are dotted boxes marked N/A

## v1.3 (Nov 4, 2026)
- "Project Gallery" under each project's buttons on the homepage: a 2x2 grid of the 4 newest photos from that project's log (N/A until there are photos); clicking a photo opens its log entry

## v1.2 (Nov 4, 2026)
- Fixed "Could not save: featured.json does not match …" in the editor (it was using an old cached copy of the file); saves now also retry once automatically if the file changed

## v1.1 (Nov 4, 2026)
- Version number in the footer and editor
- Faint "Admin" link in the homepage footer that opens the editor

## v1.0 (Nov 4, 2026)
- First code-only update zip (never contains logs, projects, gallery or settings)
- Edit and delete log entries
- Projects tab: add, edit, reorder, delete, thumbnails
- Gallery: edit captions, delete photos
- Profile pictures next to names on log entries
- Photo in the Newest Project Log box
