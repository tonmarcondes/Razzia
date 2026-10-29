# Custom Branding

Optional, lives in `config/branding/`, see [Configuration](configuration.md).

You can fully rebrand the app **without touching the code** by dropping files into a `config/branding/` folder. If it is absent, the default look is used.

Create `config/branding/theme.json`:

```json
{
  "appName": "My Quiz",
  "colors": {
    "primary": "#ff9900",
    "secondary": "#1a140b",
    "correct": "#22c55e"
  },
  "answerColors": ["#e69f00", "#56b4e9", "#3dbfa0", "#cc79a7"],
  "font": {
    "family": "Rubik",
    "url": "https://fonts.googleapis.com/css2?family=Rubik:wght@300..900&display=swap"
  },
  "logo": "/branding/logo.svg",
  "favicon": "/branding/favicon.svg",
  "background": "/branding/background.png"
}
```

All fields are optional: anything you omit keeps its default value.

- `appName`: app name + browser tab title
- `colors`: CSS color tokens (at least `primary` and `secondary`). `correct` sets the color used for correct answers (checkmarks, estimation range and answer)
- `answerColors`: up to 4 answer-button colors
- `font`: a font family + an optional stylesheet URL (e.g. Google Fonts)
- `logo` / `favicon` / `background`: drop the files in `config/branding/` and reference them here

## Appearance editor

Authenticated managers can open **Configurations → Appearance** (`/manager/config#appearance`). This fork's legacy authentication still uses the manager password; individual administrator/teacher roles are not implemented yet.

The panel edits the system name, font family, logo, favicon, system/answer colors and wallpapers. Without a custom logo, a custom name is displayed as text on the entry screen. The original project attribution is retained.

- Preview changes before saving; the preview never changes the active page theme.
- **Save and apply** atomically updates `config/branding/theme.json` and reloads this manager window. New page loads use the saved appearance. Already-open windows/games keep the theme they loaded; no live update is broadcast.
- **Discard changes** restores the local draft. **Restore default appearance** asks for confirmation, then removes only `theme.json`. Uploaded assets are retained so an already-open game is not broken.
- An image can be supplied as an HTTPS URL or a local `/branding/` or `/media/` path. Uploads accept PNG, JPEG, WebP, GIF and ICO up to 5 MiB; type is detected from content. Executable SVG uploads are rejected; existing manually configured SVG logos remain supported as image references.
- Concurrent edits are checked against a SHA-256 revision. A stale save/reset returns `409 errors:branding.conflict`; reload before editing again.
- Colors support hex, named colors, color-token references and numeric RGB/HSL/OKLCH/OKLab functions. CSS declarations and executable URLs are rejected. Existing supported font/style configuration is retained when editing.
- New appearance labels are localized in English and Brazilian Portuguese. Other locales currently use English for these new controls.

Screen-specific backgrounds are optional:

```json
{
  "background": "/branding/default.png",
  "backgrounds": {
    "home": "/branding/home.png",
    "lobby": "/branding/lobby.png",
    "game": "/branding/questions.png",
    "results": "/branding/results.png"
  }
}
```

A screen-specific value overrides `background`. Without either, entry screens retain the original decorative background and game screens use the bundled image. The result wallpaper covers reveals, rankings, the podium and survey completion. Player waiting rooms use the lobby wallpaper.

### Management API

All `/api/branding` routes require a signed manager session and return no-store responses:

| Method/path                 | Contract                                                               |
| --------------------------- | ---------------------------------------------------------------------- |
| `GET /api/branding`         | `{ theme, revision }`, reading the existing file or an empty theme     |
| `PUT /api/branding`         | `{ theme, revision }`; validate and atomically replace the theme       |
| `DELETE /api/branding`      | `{ revision }`; restore defaults, returning 204                        |
| `POST /api/branding/assets` | Multipart `file`; return `{ url }` with a generated immutable filename |

Assets and the static theme are intentionally public branding material; do not upload confidential training content here. Settings never write `.env`, quizzes, or reports. For development and preview, Vite honors `CONFIG_PATH` so HTTP management and static assets use the same configuration directory as the backend.
