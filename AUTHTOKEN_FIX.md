Done. I added an app version control system stored in MongoDB.

New files:

models/AppVersion.js — Mongoose model with version, isActive, forceUpdate, minSupportedVersion, releaseNotes, platform fields
routes/app-version.js — API endpoints:
GET /api/app-version/check?platform=ios&version=1.2.0 — public; returns whether an update is available, force update flag, release notes, and min supported version
GET /api/app-version — auth; list all versions
POST /api/app-version — auth; create new version (auto-deactivates others for the same platform)
PUT /api/app-version/:id — auth; update version
DELETE /api/app-version/:id — auth; delete version
scripts/seed-app-version.js — Seeds the initial version from APP_VERSION in .env
Updated files:

server.js:230,240 — Registered the route
scripts/create-indexes.js — Added AppVersion to index sync
.env — Added APP_VERSION=1.0.0
package.json — Added "seed-version": "node scripts/seed-app-version.js" script
Run npm run seed-version to
