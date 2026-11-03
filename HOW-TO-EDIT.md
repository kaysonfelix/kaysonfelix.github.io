# How to edit your site

Everything is done on github.com. No code needed for project updates.

## Folder layout

```
index.html          ← homepage (name, links, project cards, other sections)
project.html        ← project page template (don't edit)
style.css           ← colors and fonts
site.js             ← helper code (don't edit)
.nojekyll           ← keep this; it tells GitHub to serve files as-is
projects/
  project-1/
    overview.md     ← "Overview" tab
    log.md          ← "Lab notebook" tab
    images/         ← photos for this project
  project-2/ ...
  project-3/ ...
```

## Post a lab notebook update

1. Open `projects/<your-project>/log.md` on GitHub and tap the pencil icon.
2. At the top (under the grey comment), add:

   ```
   ## 2026-11-03 | Aligned the beacon and got first lock

   What you did, what happened, what you learned.

   ![Breadboard with photodiode quad](images/2026-11-03-quad.jpg)
   ```
3. Tap **Commit changes**. The site updates in about a minute.

Newest entries go at the top. Dates must be `YYYY-MM-DD`.

## Add photos

1. Open the project's folder on GitHub (e.g. `projects/project-1`).
2. **Add file → Upload files**. To make the `images` folder the first time,
   drag in a folder named `images` that contains your photos.
3. Commit. Then reference each one in Markdown: `![Caption](images/filename.jpg)`.

Tip: resize photos to about 1600 px wide before uploading so pages load fast.
File names: lowercase, no spaces (`2026-11-03-quad.jpg`, not `IMG 4412.JPG`).

## Rename a project folder

The folder name shows up in links (`project.html?p=pat-terminal`), so pick something
short like `pat-terminal`. If you rename `project-1`, also change `project-1` in its
card in `index.html` (three places: `data-project` and the two button links).

## Add a new project

1. In `index.html`, copy one `<article class="project" ...>` block and change the folder name.
2. Create `projects/<new-name>/overview.md` and `log.md` (copy them from another project).

## Markdown cheat sheet

| Write this | Get this |
|---|---|
| `## Heading` | Section heading |
| `**bold**`, `*italic*` | **bold**, *italic* |
| `- item` | Bullet list |
| `[text](https://link.com)` | Link |
| `![caption](images/a.jpg)` | Image with caption |
| `` `code` `` | Inline code |
| Three backticks on their own lines | Code block |

## Change fonts or colors

Open `style.css`. Fonts are `--serif` and `--mono` at the top; colors are the lines
starting with `--`. If you change a font, also update the Google Fonts `<link>` line
near the top of both `index.html` and `project.html`.
