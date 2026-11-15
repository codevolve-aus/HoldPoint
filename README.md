# HoldPoint by CodeVolve

The QA workflow between site supervisors (tablets) and the project engineer (laptop), organised the way the
project already lives in SharePoint.

**Folders:** Year › Client › Project › QA › **Project Documents** · **Completed Documents** · **Submitted Documents**,
plus a **QF Form Templates** library. Laptops keep the folder tree on the left; tablets open it from a **Folders** button.

1. **Admin** gives Google accounts a role (admin, engineer, supervisor with one region) and sets the company name and logo.
2. **Engineer** starts a project by uploading its ITP (PDF or Word). HoldPoint reads the header, every line and the QF
   forms in the reference column; the engineer checks it side by side with the original and saves it to
   **Project Documents as a draft**. Supervisors can't see a draft.
3. **Engineer** opens the draft (changes from the live revision are marked) and clicks **Approve & release**. It goes live
   for that region's supervisors; the previous revision is superseded. Updating the ITP is ongoing: QF records and
   sign-offs stay on their lines across revisions.
4. **Supervisor** opens the live ITP. It looks exactly like the ITP PDF: landscape pages, the document header block on
   every page, the 9 columns (No. · Activity / Operation · Specification · Reference Document · Acceptance Criteria ·
   Inspection By · Sign · Date · Inspection Type), one Sign / Date row per inspecting party, comments and notes, and the
   ITP sign-on page. **Sign** opens a signature pad for the person named on that row (supervisor, client representative,
   asset owner); **Date** opens the tablet's date picker. Pages fit the screen width, with zoom.
5. Each **Form QF-xx** link in the Reference Document column lists that line's records and starts a **new copy for that
   line**. The same form on different lines gets separate copies (QF-20b on line 5 and line 8 are separate records),
   numbered per project: `25-0418-QF20b-004`.
6. The QF form is **the paper form on screen**: QF-20b, QF-45c, QF-21, QF-23 and QF-30 are built to look exactly like the
   company PDFs, with inputs on every blank, tick boxes, photos in the sketch boxes and signatures on the signature
   lines. It saves as you type and works offline. Out-of-spec readings are flagged (humidity over 85 %, surface less than
   3 °C above dew point, WFT under spec, holidays not repaired, failed adhesion…).
7. **Supervisor** submits; **engineer** returns it with a note (the supervisor fixes it and resubmits as v2) or
   **approves**. Approving turns the paper form on screen into a PDF and files it in **Completed Documents**.
8. **Engineer** ticks approved forms in Completed Documents and clicks **Send to client**: HoldPoint builds one PDF pack
   with a cover sheet, files it in **Submitted Documents** and downloads it for the engineer to email.

Files in Storage use the same folders: `Projects/2026/Client/25-0418 Project/QA/Completed Documents/25-0418-QF20b-004.pdf`.
The ITP can also be downloaded as a PDF with its signatures and dates.

Crew, rostering, hours, the daily report and SharePoint sync are later phases.

---

## 1. Install on your computer (once)

- [Node.js 20 LTS or newer](https://nodejs.org)
- [VS Code](https://code.visualstudio.com) — open this folder, accept the recommended extensions
- Firebase CLI: `npm install -g firebase-tools`

## 2. Create the Firebase project (once, about 10 minutes)

In the [Firebase console](https://console.firebase.google.com):

1. **Add project** → name it, e.g. `holdpoint-demo`. Google Analytics: off.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Set the support email.
3. **Build → Firestore Database → Create database** → Production mode → region `australia-southeast1` (Sydney).
4. **Build → Storage → Get started** → Production mode → same region.
   (Storage needs the Blaze pay-as-you-go plan on new projects. MVP usage stays within the free allowance.)
5. **Project settings (gear) → General → Your apps → Web (`</>`)** → register the app → copy the config values.

## 3. Connect this code

```bash
npm install
cp .env.example .env.local      # then paste the six values from step 2.5
firebase login
firebase use --add               # pick your project
firebase deploy --only firestore:rules,storage   # security rules: role and region access
```

Allow the browser to read photos back for the PDF (Storage CORS). Edit `cors.json` with your project ID, then:

```bash
gcloud storage buckets update gs://YOUR-PROJECT-ID.firebasestorage.app --cors-file=cors.json
# or: gsutil cors set cors.json gs://YOUR-PROJECT-ID.firebasestorage.app
```

## 4. Create the first admin (once)

The app only lets in accounts that have a role. Create the first one by hand:

Firebase console → **Firestore → Start collection** → collection ID `roles`
→ document ID = **your Google email in lower case** → fields:

| field  | type   | value                 |
|--------|--------|-----------------------|
| email  | string | you@gmail.com         |
| name   | string | Your name             |
| role   | string | `admin`               |
| region | string | `All regions`         |

## 5. Run it

```bash
npm run dev
```

Open http://localhost:5173 → **Sign in with Google**.

**Demo script (three Google accounts, or test passwords for the engineer and supervisor):**

1. As **admin** → Users → add an **engineer** and a **supervisor** (region Sydney). Company → name and logo.
2. Sign in as the **engineer** on a laptop → Folders → **+ New project** → choose the ITP file → check it against the
   original → tick the box → **Save as a draft**. The draft opens: **Approve & release to Sydney supervisors**.
3. Sign in as the **supervisor** on a tablet → **Folders** → 2026 › Client › Project › QA › Project Documents →
   **Open ITP form** → **Sign** a line (draw, name, date) → tap **Form QF-45c** on a line → **+ New QF-45c for line 8** →
   fill the paper form, add a photo, sign → **Submit to engineer**.
4. **Engineer** → Home → open it → **Return to supervisor** with a note → supervisor fixes it (Home → Returned to you) and
   resubmits as v2 → engineer **Approve & file PDF**.
5. **Engineer** → Completed Documents → tick it → **Send to client** → the pack downloads and appears in Submitted Documents.
6. Upload a new ITP revision from Project Documents: it's a draft until approved; the supervisor keeps the live one.

**Projects from the previous version** (day-based forms): open the project's Project Documents as the engineer and click
**Bring it in** to make its ITP the live revision. Day-based forms from the previous version aren't carried over.

## 6. Try it on a tablet

The camera and "Add to Home Screen" need HTTPS, so deploy to Firebase Hosting:

```bash
npm run deploy        # builds and deploys hosting + rules
```

Open `https://YOUR-PROJECT-ID.web.app` on the tablet → sign in → browser menu → **Add to Home Screen**.
Add that domain in Firebase console → Authentication → Settings → **Authorized domains** if it isn't listed.

Offline: form entries and sign-offs are kept on the tablet and sync when there's signal. Photos, approvals and packs need signal.

---

## Code map

```
src/
  components/Layout.tsx, FolderTree.tsx   app shell: folder tree (laptop) / Folders drawer (tablet)
  components/ItpPaper.tsx                 the ITP as the PDF lays it out: measured pagination, Sign/Date per party, form links
  components/PaperViewer.tsx              fit-to-width viewer with zoom for the ITP and QF forms
  components/SignatureModal.tsx           on-screen signature: name, date, finger/stylus/mouse
  forms/kit.tsx                           blanks, cells, tick boxes, photo boxes, ruled lines, signature lines for paper forms
  forms/QF20b.tsx … QF30.tsx              the five QF forms, built to match the company PDFs page for page
  forms/registry.ts                       which forms HoldPoint fills, their pages and out-of-spec checks
  lib/itpParse.ts, itpRead.ts             reading an ITP PDF (pdf.js, table borders) or Word file (mammoth)
  lib/db.ts                               live data hooks, folder paths, record numbering, audit log
  lib/paperPdf.ts                         paper pages on screen → PDF (approved forms, ITP download)
  lib/pack.ts                             client pack: cover sheet + approved PDFs
  pages/                                  Home, ProjectDocs, ItpUpload, ItpView, RecordView, Completed, Submitted,
                                          Templates, AdminUsers, AdminCompany
firestore.rules / storage.rules           role and region access enforced on the server
```

**Data (Firestore):** `roles/{email}`, `settings/company`, `projects/{id}` (year, client, job, region…),
`projects/{id}/revisions/{rev}` (ITP revisions: draft, live, superseded), `projects/{id}/signoffs/{line_party}` and
`…/signoffs/signon`, `records/{id}` (one QF form copy on one ITP line: values, status, version, history, PDF path),
`packs/{id}` (what was sent to the client), `audit/{id}`.

**Storage CORS** (step 3) is needed for photos to appear in approved PDFs and for client packs to be built.

**Change a form:** each QF form is a React component in `src/forms/`. Add or revise one there and list it in
`src/forms/registry.ts`. Forms an ITP refers to that aren't listed are shown as paper only.

## Next phases

1. Sync the folders to SharePoint via Microsoft Graph (same Year › Client › Project › QA layout)
2. Email client packs from HoldPoint (a Firebase function and an email service)
3. Crew app: clock on/off, tasks, roster; supervisor hours approval and daily report

**Reading ITPs:** works on PDFs exported from Word/Excel and on .docx files. Scanned PDFs (images) can't be read;
the engineer would type the items in. Column edges come from the table borders; if a PDF has none, they're estimated
from the headings and the confirm screen warns the engineer.
