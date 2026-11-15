# HoldPoint by CodeVolve

MVP: the supervisor ↔ engineer quality workflow.

A Progressive Web App (installable on a phone, works offline) for the ITP-driven QA workflow:

1. **Admin** gives Google accounts a role: admin, engineer or supervisor (supervisors get one region).
2. **Engineer** uploads each project's own ITP (PDF or Word). HoldPoint reads the header, every item and the QF forms
   in the reference column; the engineer checks it side by side with the original, fixes anything, resolves forms
   that don't have a template yet, and publishes it to the project, site location and region.
   A new revision replaces it for new days only; forms already filled stay on the revision they were made under.
3. **Supervisor** (only sees their region) opens the project, reads the locked ITP, fills the QF forms the ITP asks for
   (QF-45c, QF-20b, QF-21, QF-23, QF-30) with photos and signatures, and submits them at the end of the day.
4. **Engineer** reviews each form: values are checked against the ITP specs, comments go on single fields,
   then **Approve** (builds a PDF, files it to `Approved/Region/Job Project/Site location/Date/`, adds a register line)
   or **Return** (supervisor fixes it, resubmits as v2).
5. **Engineer** can upload each QF form as the company's **fillable PDF** (*Form templates*) and map its boxes to the
   form's fields once. Approved PDFs are then that paper form, filled in and flattened, with an approval line on every page.
   Entries the paper form has no box for, out-of-spec notes and the approval record go on pages added at the end.
   Forms without a company PDF use the standard layout.

Everything else in the clickable prototype (crew, rostering, hours, daily report, Word templates) is later phases.

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

**Demo script (needs three Google accounts, or use your own for admin and two others):**

1. As **admin** → Users → add an **engineer** (All regions) and a **supervisor** (region Sydney).
2. Sign out, sign in as the **engineer** → *ITPs and projects* → **New ITP** → choose the project's ITP file →
   check the job details, items and forms against the original on the left → tick the check box → **Publish**.
3. Sign in as the **supervisor** (ideally on a phone, see step 6) → *My projects* → Pit 1 internals →
   fill QF-21 (photos, readings, signature), mark forms you don't need as *Not needed*, **Submit**.
4. Sign in as the **engineer** → *Review queue* → open the form → comment on a field → **Return**.
5. Supervisor → *Returned forms* → fix → submit again (v2).
6. Engineer → **Approve and file** → *QA records* → **Open PDF**, **Download register (CSV)**.

## 6. Try it on a phone

The camera and "Add to Home Screen" need HTTPS, so deploy to Firebase Hosting:

```bash
npm run deploy        # builds and deploys hosting + rules
```

Open `https://YOUR-PROJECT-ID.web.app` on the phone → sign in → browser menu → **Add to Home Screen**.
Add that domain in Firebase console → Authentication → Settings → **Authorized domains** if it isn't listed.

Offline: form entries are kept on the phone and sync when there's signal. Photos need signal to upload.

---

## Code map

```
src/
  lib/itpParse.ts               reads ITP header, items and QF form references (PDF text + table borders, or Word rows)
  lib/itpRead.ts                loads the uploaded PDF (pdf.js) or Word file (mammoth) in the browser
  data/templates.ts             the 5 QF form templates: fields, required, specs (ITP refs), show-if rules
  lib/checks.ts                 spec checks (min/max/allowed/minFrom, dew point margin), required fields
  lib/db.ts                     opening a day's form, header from the ITP (locked), audit log
  lib/pdf.ts                    approved PDF in the standard layout (forms without a company PDF)
  lib/pdfForm.ts                company fillable PDFs: read boxes, auto-match to fields, fill + flatten, added pages
  components/FormRenderer.tsx   renders any template: edit (supervisor) or review + comments (engineer)
  pages/admin                   users and roles
  pages/supervisor              projects in my region, day view (forms + ITP), form, returned forms
  pages/engineer                review queue, review/approve/return, QA records register,
                                ITPs and projects, ITP upload and check, form templates (company PDFs + box mapping)
firestore.rules / storage.rules role and region access enforced on the server
```

**Data (Firestore):** `roles/{email}`, `projects/{id}` (with its current ITP and every revision), `submissions/{project_date_form}`
(values, comments, version, status, history), `register/{id}` (approved files), `pdfTemplates/{formCode}`
(company fillable PDF and its box mapping), `audit/{id}`.

**Company PDF forms:** the PDF must have fillable boxes (Adobe Acrobat → *Prepare Form*). Name boxes after the fields
(e.g. `Time 1`, `Dry bulb 1`, `Moisture meter ID`, a tick box `Grease`) and most map themselves; the rest are picked
on the mapping page. *Show box names on the PDF* and *Test fill with sample data* check it before real use. Photos and
signatures go in picture boxes (Acrobat button fields) or over any box mapped to them.

**Change a form:** edit `src/data/templates.ts` (labels, options, required, specs). Bump `rev` when you do.
Moving templates into the database and editing them on an Admin page is a later phase.

## Next phases

1. File approved PDFs to SharePoint via Microsoft Graph
2. Admin: form templates and ITP-to-form mapping as data, with revisions and approval
3. Crew app: clock on/off, tasks, roster; supervisor hours approval and daily report

**Reading ITPs:** works on PDFs exported from Word/Excel and on .docx files. Scanned PDFs (images) can't be read;
the engineer would type the items in. Column edges come from the table borders; if a PDF has none, they're estimated
from the headings and the confirm screen warns the engineer.
