# Rent application: rules for every session

Before any significant task, read `PROJECT_LEARNINGS.md`. When the task is done, add what you learned to it.

## 1. Simple English everywhere

Write simple English in everything: screen text, buttons, messages, errors, docs, code comments and commit messages. The readers are landlords, tenants and developers. Many of them read English as a second language.

- Use short sentences and common words. One idea per sentence.
- A button says what it does: **verb + thing** ("Record payment", "Add tenant").
- Every number, status and button makes clear what it means without reading anything else. If it can't, add a short second line that explains it.
- Never show internal codes or IDs to a user: no `REPAIR`, no UUIDs, no `value_milli`. Show the plain word or the real value ("Repair", "12 kWh").
- Use the same word for the same thing every time. The word list is in `docs/20_UI_CLARITY_GUIDE.md` §2, rule C-8. Use those words, not your own.
  - Say **room**, not "unit". Say **tenant** or "Asha in Room 101", not "tenancy".
  - Say **cancel**, not "void". Say **unpaid**, not "outstanding". Say **days to pay**, not "grace days".
- Code identifiers (`tenancy`, `unit`, `void`) stay as they are in the database and code, to match the specs in `docs/`. The plain words are only for what people read.

## 2. Screens follow the clarity guide

Every screen or form you build or touch must follow `docs/20_UI_CLARITY_GUIDE.md` and pass its §5 checklist. Add each new screen to its §4 table. When you notice something confusing, fix it or raise it, even if it wasn't part of the task.

## 3. Security and cost

Follow `Rent_Manager_Security_Cost_Optimization_Checklist.txt`. The short version:
- Never trust the browser. Every read and write checks the workspace on the server.
- Bound every query, list, report and export.
- Validate every upload.
- Protect money writes against duplicates, and keep them atomic.
- Record every change in the audit trail.

## 4. Data safety

- Never delete or reset `web/.data`: it holds the owner's real data.
- Tests use their own database through `RENT_DATA_DIR`.

## 5. Git

- Never add a `Co-Authored-By` line to commits.
- The repository is private: https://github.com/madhavraj840/rent-manager
