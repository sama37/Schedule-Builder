# Class Schedule Builder

## File Structure

```
index.html   ← The skeleton: loads CSS and JS, provides the #root element
styles.css   ← ALL visual styles (colors, layout, spacing, typography)
app.js       ← ALL logic, data, and DOM rendering
```

The three files have one job each. This is standard web development practice:
- HTML = **structure** (what's on the page)
- CSS  = **presentation** (how it looks)
- JS   = **behavior** (what it does)

---

## Running locally

Just open `index.html` in your browser. No build step or server needed.

---

## Adding to your Webflow portfolio

Webflow doesn't let you upload raw JS/CSS files directly, but there are
two solid approaches:

---

### Option A — Embed in a Webflow page (easiest)

1. **Host your files for free on GitHub Pages:**
   - Create a free GitHub account at github.com
   - Create a new repository (e.g., `schedule-builder`)
   - Upload all three files (`index.html`, `styles.css`, `app.js`)
   - Go to Settings → Pages → Source: "main" branch → Save
   - Your app will be live at `https://YOUR-USERNAME.github.io/schedule-builder/`

2. **Link to it from Webflow:**
   - In Webflow, add a Button or Link element on your portfolio page
   - Set the URL to your GitHub Pages link
   - Open in a new tab — done!

   This is the cleanest option. Visitors click a button on your portfolio
   and the app opens in a new tab.

---

### Option B — Embed inline inside a Webflow page

If you want the app to live *inside* your Webflow page:

1. In Webflow, drag an **Embed** element onto your page
2. Paste the entire contents of `styles.css` inside a `<style>` tag
3. Paste the entire contents of `app.js` inside a `<script>` tag
4. Add `<div id="root"></div><div id="err"></div>` between them

Like this:
```html
<style>
  /* ...paste contents of styles.css here... */
</style>

<div id="root"></div>
<div id="err"></div>

<script>
  /* ...paste contents of app.js here... */
</script>
```

Note: Webflow's embed has size limits on free plans, so Option A is
recommended for larger apps like this one.

---

## What to learn next

Now that you have three separate files, here are good next topics:

- **CSS**: Flexbox and Grid (used a lot in styles.css)
- **JS**: How `document.createElement` builds the UI in app.js
- **JS**: The `state` object — this is how the app remembers your data
- **JS**: `localStorage` — how data survives a page refresh
- **General**: What a "build tool" like Vite does (bundles files like these
  into one optimized file for production)
