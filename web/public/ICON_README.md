This directory contains assets useful for publishing the app and generating store icons.

Files:
- `icon.svg` — a scalable vector app icon (bird, pipe, coin). Use this as the base for store icons and favicons.
- `game_screenshot.png` — placeholder name; run the capture script to produce a screenshot from the running web app.

Create PNGs (recommended sizes) from `icon.svg` using ImageMagick or svgexport:

Example (ImageMagick):
```bash
magick convert -background none web/public/icon.svg -resize 1024x1024 web/public/icon-1024.png
magick convert -background none web/public/icon.svg -resize 512x512  web/public/icon-512.png
magick convert -background none web/public/icon.svg -resize 192x192  web/public/icon-192.png
```

Capture a screenshot of the running web app's canvas using the included Puppeteer script (requires Node + puppeteer + minimist):

```bash
# from repo root
npm install puppeteer minimist --no-save
node scripts/capture_game_screenshot.js --url=http://localhost:5173 --out=web/public/game_screenshot.png
```

Once you have a 1024x1024 PNG, use that as the Android Play Store icon or export variants required by stores.
