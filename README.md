# MUNAISZN PLAY

A free, mobile-first movie and TV discovery web app.

## What works
- Live movie and TV catalogue through TMDB API
- Trending, search, genres, sorting, title details and ratings
- Device-local watchlist
- Official YouTube trailer playback when a trailer is available
- Optional frameXTV iframe adapter (external provider; availability and rights are not guaranteed)
- Responsive dark emerald / subtle gold design

## Important playback note
This project does not host video files or provide a licensed movie library. The optional frameXTV adapter is a third-party embed and is not guaranteed to work or to have distribution rights for every title. Only use streams you own or are authorized to embed. The official trailer button uses YouTube's embed player when TMDB lists a YouTube trailer.

## Setup
1. Get a free TMDB API key: https://www.themoviedb.org/settings/api
2. Open `index.html` in a browser or publish this folder with GitHub Pages.
3. Tap the round `MP` button > paste your TMDB API key > Save and load catalogue.

The API key is stored in this browser's localStorage. Do not use a private server credential here; use a TMDB API key intended for client-side application use and follow TMDB terms.

## Publish free with GitHub Pages
1. Create a GitHub repository named `munaiszn-play`.
2. Upload `index.html`, `style.css`, `app.js`, and `README.md` to the repository root.
3. In the repository, open Settings > Pages.
4. Under Build and deployment, choose Deploy from a branch.
5. Select `main` and `/ (root)`, then Save.
6. Wait for GitHub Pages to publish your site. Open the URL shown in that Pages section.

## Limitations of this MVP
- Watchlist is saved only on the current browser/device.
- No user accounts, cloud sync, payments, admin dashboard or hosted video library.
- Full-length playback depends on an authorized external source.
- The sample TV episode route in the frameXTV adapter defaults to season 1 episode 1. It is a starting integration, not a guarantee of correct episode mapping.
