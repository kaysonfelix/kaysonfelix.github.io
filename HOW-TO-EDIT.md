# How to edit your site

Everything is done on github.com. No code needed for project updates.

## Folder layout

```
index.html          ← homepage (name, links, projects, involvement, background, experience, latest updates)
featured.json       ← which LinkedIn post the homepage shows (set it in admin.html)
admin.html          ← editor: post project log entries and edit project overviews
project.html        ← project page template (don't edit)
style.css           ← colors and fonts for the project pages and editor
site.js             ← helper code (don't edit)
.nojekyll           ← keep this; it tells GitHub to serve files as-is
projects/
  project-1/
    overview.md     ← "Project Overview" tab
    log.md          ← "Project Log" tab
    bom.xlsx        ← bill of materials spreadsheet (shown on the Overview)
    images/         ← photos for this project
```

## Edit a project's Overview page (easy way)

In admin.html, pick the project and choose **Edit project overview**. Edit the text with the
toolbar, use **Photo** to upload a picture at the cursor, check **Preview**, and press
**Save overview**. **Replace bom.xlsx** uploads a new bill of materials spreadsheet.

## Show your latest LinkedIn post on the homepage

On LinkedIn, open the post and choose **⋯ → Embed this post**, copy the code. In admin.html
choose **Homepage**, paste it, check the preview, and press **Save to homepage**. (A link to
the post works too.) It's saved in `featured.json`. LinkedIn doesn't let sites pull your
latest post automatically, so do this each time you post something you want featured.

The **Latest project log entry** box under it updates by itself.

## Post a project log update (easy way)

Open **kaysonfelix.github.io/admin.html**, sign in once, fill in the form and press
**Publish entry**. Photos are resized automatically. The entry is live in about a minute.

### Give someone posting access
1. Repo **Settings → Collaborators → Add people**, enter their GitHub username. They accept the invite.
2. They create a **classic** token (GitHub doesn't let fine-grained tokens edit someone
   else's personal repo): GitHub **Settings → Developer settings → Personal access tokens →
   Tokens (classic) → Generate new token (classic)**. Check only **public_repo**, set an
   expiration, and copy it. (You, as the owner, can use a fine-grained token instead:
   Repository access = only this repo, Contents = Read and write.)
3. They open admin.html and paste the token. It's remembered in that browser until they sign out.

Remove access any time from **Settings → Collaborators**. Every post is a commit, so the
history shows who posted what, and any change can be undone.

## Post a project log update (by editing the file)

1. Open `projects/<your-project>/log.md` on GitHub and tap the pencil icon.
2. At the top (under the grey comment), add:

   ```
   ## 2026-11-03 | Aligned the beacon and got first lock | Kayson

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
card in `index.html` (in `data-project`, `data-href` and the two button links).

## Add a new project

1. In `index.html`, find the "In planning" placeholder (`<article class="card tba">`)
   and replace it with a copy of the full project card above it. Change the folder name,
   title, status, tags and description.
2. Create `projects/<new-name>/overview.md` and `log.md` (copy them from project-1).
3. The editor (admin.html) picks up the new folder automatically.

## Project card photo

Put a photo in `media/` (e.g. `media/pat.jpg`), then in `index.html` replace
`<div class="media">photo coming soon</div>` with
`<div class="media"><img src="media/pat.jpg" alt="PAT system on the bench"></div>`.

## Add coursework

In `index.html`, find `<ul class="courses" id="courses">` and add one line per course:

```html
<li><code>PHY 2048</code><span>Physics I</span></li>
```

The first 5 show; the rest fold under "Show all". Put the most relevant courses first.

## Add a logo to the row under your name

Put the image in `media/` and add a line inside `<ul class="logos">`:

```html
<li><img src="media/solidworks.png" alt="SolidWorks" title="SolidWorks"></li>
```

## Print CV

The "Print CV" button opens the print / Save as PDF dialog. The printout is a one-page CV:
all courses show; buttons, photos and logos are hidden.

## Update the bill of materials

1. Open `bom.xlsx` in Excel (download it from the project folder on GitHub).
2. Fill in Part, Description, Qty, Unit cost and Supplier link. Total cost and the
   Total row calculate themselves. Save.
3. On GitHub, open the project folder, **Add file → Upload files**, drop in `bom.xlsx`
   (same name, it replaces the old one), and commit.

The Overview page reads the spreadsheet and shows it as a table with a download link.
Only the first sheet is shown. A `.csv` file works too: in `overview.md`, change
`{{sheet: bom.xlsx}}` to `{{sheet: bom.csv}}`. You can embed any spreadsheet this way,
in any project or log entry, with `{{sheet: filename.xlsx}}` on its own line.

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

## Gallery (left side of the homepage)

Open admin.html, sign in, choose the **Homepage** tab, scroll to **Gallery**, type a caption (optional) and press **Choose photo and post**. The photo is resized, saved in media/gallery/, and shows at the top of the gallery in about a minute. Use **Remove** next to a photo to take it off the homepage.

## Website visits (unique and total)

The site counts visits with GoatCounter (free, no cookies, no banner needed).

One-time setup:
1. Go to https://www.goatcounter.com/signup
2. For "Code" type **kaysonfelix** (your stats will live at kaysonfelix.goatcounter.com). If that code is taken, pick another and change "kaysonfelix" in the last lines of index.html and project.html, and in the "Site visits" link in admin.html.
3. Set "Site domain" to kaysonfelix.github.io, add your email and a password, and finish.

To check visits: open https://kaysonfelix.goatcounter.com (or the "Site visits →" link at the top of admin.html). "Visitors" = unique people, "Pageviews" = total visits. To keep your own checks from counting, look in its Settings for the option to ignore IP addresses and add your own.

## Profile pictures on log entries

Each collaborator: open admin.html, sign in, go to the **Homepage** tab, find **Your profile picture**, check the name matches what you put as Author on your entries, then press **Choose photo and save**. The photo is cropped to a square and shows next to your name on every log entry (homepage and project log). Without one, your initials show in a circle.
