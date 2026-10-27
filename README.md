# opengamestandards.org

The website for [Open Game Standards](https://github.com/Open-Game-Standards),
served by GitHub Pages at <https://opengamestandards.org>.

Plain static files, no build step and no third-party requests (system fonts;
the only external images are the CI badges and the video thumbnails):

| Path | What |
| --- | --- |
| `index.html` | The page |
| `assets/site.css`, `assets/site.js` | Styles (light/dark) and behaviour (theme toggle, starting-point chooser, copy buttons, the illustrative receiver console) |
| `assets/*.svg`, `assets/ogs-512.png` | Brand marks (from the org profile), favicon and social image |
| `404.html` | Not-found page |
| `CNAME` | Custom domain for GitHub Pages |
| `.nojekyll` | Serve files as-is |

Content tracks the org profile (`.github/profile/README.md`); update both together.

## Preview locally

```sh
python -m http.server 8000
# open http://localhost:8000
```

## Publishing

1. Create `Open-Game-Standards/opengamestandards.org` (public) and push `main`.
2. Repo **Settings → Pages**: Source *Deploy from a branch*, branch `main`, folder `/ (root)`.
   The custom domain is read from `CNAME`.
3. DNS at the registrar:
   - apex `opengamestandards.org`: `A` records `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153` (and optionally `AAAA` `2606:50c0:8000::153`,
     `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`)
   - `www`: `CNAME` to `open-game-standards.github.io`
4. Org **Settings → Pages → Verified domains**: verify `opengamestandards.org`
   (a `TXT` record) so no other account can claim it.
5. Once the certificate is issued, tick **Enforce HTTPS**.
