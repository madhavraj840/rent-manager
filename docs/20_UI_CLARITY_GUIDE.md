# 20: UI Clarity Guide

| | |
|---|---|
| Version | 0.4 |
| Status | In use. Every screen must follow it. |
| Date | 2026-09-20 (0.1: 2026-09-19) |
| Extends | [09 UI/UX Specification](09_UI_UX_SPECIFICATION.md). It changes no features, data or rules; it only covers how screens explain themselves. |

## 1. Why this document exists

The owner tried the website and found it hard to understand without reading every line. Here are three real examples.

- **Meter reading.** The form had one box called "Reading", with the old value shown as small grey text above it. It didn't read as *previous reading* then *current reading*, the way an electricity bill does.
- **Where money goes.** Saving a payment or a meter bill didn't say where the entry would appear, or what it would do to the balance.
- **Hidden links.** On the Tenants list, only the tenant's name opened anything, and it looked like plain text. There was no visible way to open the property. The owner thought the page was broken.

**The goal:** a landlord who has never seen the app can look at any screen for about three seconds and answer three questions:

1. **Where am I?**
2. **What is the one thing I probably want to do here?**
3. **What will happen when I press it, and where will I see the result?**

## 2. Rules

Each rule has an ID. Code comments and reviews refer to these IDs.

### C-1: Anything that opens something looks like a link

- **Link text** is blue (primary), not grey. Grey text is for information only and is never the only way to reach a page.
- **A row that opens a page** is clickable across its whole width, not just the name. It also shows a `›` chevron on the right, so the row itself says "this opens".
- **Every name of a thing is a link to that thing**, wherever it appears. This covers the tenant name, the unit and the property. For example, on the Tenants list the property name opens the property.
- A button does an action; a link goes somewhere. Never style one as the other.

### C-2: Breadcrumbs on every page below the top level

- Every page shows its trail, for example `Properties › Green View › Flat 101`, each part a link.
- This replaces the single small grey back-link used before.
- The last part is the current page and is not a link.

### C-3: One main action per page, named with a verb and a thing

- Each page has one filled (primary) button: the most common reason to be there. On a tenancy page it is **Record payment**; on a meter page it is **Enter reading**.
- All other actions use outlined buttons.
- Labels are never shortened to one ambiguous word. "Record" becomes **Record payment** and "Reading" becomes **Enter reading**.
- Actions that change money history (void, move out) sit apart from the everyday ones.

### C-4: Forms read like the paper they replace

- **Fields are in the order the person thinks:** what was there before, what is there now, the difference, the money.
- **Values the person cannot change** (previous reading, rate, amount due now) appear as read-only boxes in the same row as the input they relate to. They are never hidden in a sentence above the form.
- **A meter reading is always shown as a pair:** **Previous reading** (value and date) next to **Current reading**. Then comes **Units used**, then the **Bill**. The same wording is used everywhere: the dialog, the enter-all-readings page and the meter history.

### C-5: Say what will happen before saving

- Every form that creates money shows a **"What happens when you save"** box just above the save button, in plain words. For example:
  - *"₹2,085 is added to Asha Rao's balance as 'Electricity 1 Aug – 1 Sep', due 6 Sep. You'll see it under Payments and charges on Flat 101."*
  - *"₹20,000 clears Rent · Sep 2026. A receipt number is given and the entry appears under Payments and charges."*
- The box updates live as the person types.
- If nothing will be billed (vacant unit, or a tenant's first reading), the box says so and says why.

### C-6: After saving, say what happened and where

- The confirmation message names the result and its place: "Payment recorded · receipt R-0042 · added to Payments and charges". Not just "Saved".
- The page the person is on updates in place, so the new row is visible straight away.

### C-7: The page order tells the story

Sections run top to bottom in the order the person needs them:

1. **Who or what this is.**
2. **The one number that matters now:** due, overdue or all paid.
3. **The main action.**
4. **The detail:** payments and charges, meters, terms, history.

Detail never appears above the summary.

### C-8: Plain words, the same word every time

| Before | Now | Where |
|---|---|---|
| Ledger | **Payments and charges** | Tenancy page |
| Record (compact button) | **Record payment** | Lists, dashboard |
| Reading (compact button) | **Enter reading** | Meter lists |
| Readings round | **Enter all readings** | Property page |
| Last reading / Reading | **Previous reading / Current reading** | Everywhere |
| Used | **Units used** | Meters |
| Tenancy | **Tenant** (the person renting), or "Asha Rao in Room 101" | Everywhere |
| New tenancy / Start tenancy | **Add tenant** | Buttons |
| Existing tenancy | **Tenant already living here** | Add tenant form |
| Past tenancies | **Past tenants** | Property page |
| Unit | **Room** (the type list still offers Flat, Shop, Bed…) | Everywhere |
| Void / VOID | **Cancel** / **CANCELLED** ("stays in the history, crossed out") | Money, readings, expenses |
| Give notice / Record notice | **Tenant is leaving** | Tenant page |
| Withdraw notice | **Not leaving any more** | Tenant page |
| On notice | **Leaving on {date}** | Banners, lists |
| Settlement / Finalize | **Final bill** / **Finish move-out** | Move-out |
| Grace days | **Days to pay** | Forms, terms |
| Opening balance | **Owed from before** | Forms, history |
| Outstanding | **Unpaid** | Dashboard, reports |
| Rent roll | **Rooms and rent** | Reports |
| Collections | **Money received** | Reports |
| Workspace | **Your account** (or the business name) | Headers, history |
| Archive / Unarchive | **Put away** / **Bring back** | Properties, rooms, tenants |
| Archived (list) | **Put away** | Tabs, sections |
| Delete (permanent) | **Delete for good** | Rooms, properties, tenants |

Code, database and spec documents keep their technical names (`tenancy`, `unit`, `void`). These words are only for what people read.

### C-9: Numbers always carry a label

- A number never stands alone. Each figure says what it is and what period it covers: "Due this month", "Overdue", "Deposit held".
- Negative balances are written as "Advance ₹x", never "−₹x".

### C-10: Empty places say what to do next

An empty list names the next step and gives the button for it, for example "No meters yet. **Add meter** to bill electricity by reading." It never says just "Nothing here".

### C-11: Simple English, and never show internal values

- Short sentences and common words. Many readers use English as a second language.
- **Never show an internal code, ID or scaled number.** Not `REPAIR`, not `b2dd…-…`, not `value milli 12000`. Show "Repair", hide the ID, and show "12 kWh".
- **Every form explains itself in its first line:** when to use it and what it changes. The "Tenant is leaving" form starts with "Use this when the tenant tells you they will leave, or you ask them to leave."
- **Error messages say what is wrong and what to do**, using the real values. Not "Move-out can't be before move-in." but "The leaving date can't be before they moved in (1 Sep 2026). Choose a later date."
- **Radio buttons and options are full phrases** ("The tenant told me", "I asked them to leave"), not single words ("Tenant", "Landlord").

### C-12: Status plus reason

A status chip is short, so the reason is shown next to it. For example: "PAID · ₹3,500 received 20 Sep", "LEAVING · on 12 Oct", "OVERDUE · 50 days".
Only a few colours are used, and each means one thing: green = fine, amber = coming up or partly paid, red = late or needs action, grey = neutral (for example a vacant room or a cancelled entry). A vacant room is not an error, so it is grey.

## 3. Shared building blocks

These live in `web/src/components/ui.tsx`, so every page gets the same behaviour.

| Block | Rule | Behaviour |
|---|---|---|
| `Crumbs` | C-2 | The breadcrumb trail. |
| `RowLink` / stretched-link rows | C-1 | The whole row is clickable, with a chevron at the end. Inner links (for example the property name) stay separately clickable. |
| `linkClass` | C-1 | The one style for links inside text: primary colour, underline on hover. |
| `Outcome` | C-5 | The "What happens when you save" box. |

## 4. Screen-by-screen fixes

| Screen | Problem the owner would hit | Fix | Rule |
|---|---|---|---|
| Tenants list | Only the name opened; the property wasn't clickable; rows didn't look clickable | Whole row opens the tenancy with a chevron; unit and property are links | C-1 |
| Tenancy page | Back-link to the property was small grey text; "Ledger" was jargon; no hint where a payment lands | Breadcrumbs; the property is named as a link in the header; the section is renamed "Payments and charges"; the payment dialog has a "What happens" box | C-1, C-2, C-5, C-8 |
| Record payment | Didn't say where the payment goes | "What happens" box names the charges it clears, any advance, the receipt, and where it will show | C-5 |
| Enter reading dialog | No clear previous/current pair; the bill appeared as a loose sentence | Previous reading (read-only) and Current reading side by side, then Units used and Bill, then the "What happens" box | C-4, C-5 |
| Enter all readings | Column names differed from the dialog | Previous reading / Current reading / Units used / Bill | C-4, C-8 |
| Meter page | Previous value not shown per row; grey back-link | Columns Date · Meter reading · Units used · Bill; breadcrumbs | C-2, C-4 |
| Meters card | "Reading" button was ambiguous | "Enter reading"; the meter name is a blue link; shows "Previous: x on date" | C-1, C-3, C-8 |
| Dashboard lists | Rows didn't look clickable; "Record" button was ambiguous | Chevron on each row; "Record payment" | C-1, C-3 |
| Properties list | Only the name was clickable | Whole row opens, with a chevron | C-1 |
| Property page | Grey back-link | Breadcrumbs | C-2 |
| All sub-pages (edit, units, move-out, new) | Grey back-link | Breadcrumbs | C-2 |

| Tenant page | "Tenancy", "Give notice" and "Void" were unclear | Plain words (C-8); the "Tenant is leaving" form explains itself and gives full-phrase options | C-8, C-11 |
| Documents card | New in 0.2 | Stretched rows that open the file; the add form has a "What happens" box; the toast names the place | C-1, C-5, C-6 |
| Expenses | No "What happens" box; the toast didn't say where; the Edit/Cancel links were hidden in the text line | "What happens" box; the toast says where; Edit and Cancel get their own column | C-3, C-5, C-6 |
| Change history | Details showed IDs, codes and scaled numbers | Plain names and real values; IDs hidden | C-11 |
| Settings (new in 0.3) | No place to keep the business name, your name or how tenants pay you | One page, three cards: Your business, How tenants pay you, Receipts and rounding; boxes that cannot change (email, currency) say why; a live box shows exactly what a reminder will carry | C-4, C-5, C-11 |
| Reminder message | Told the tenant the amount but not how to pay | The payment details from Settings are added as "You can pay by:" lines | C-11 |
| Charges added every month (new in 0.3) | A fixed maintenance or parking amount had to be typed every month | A card on the tenant page lists them with "₹500 a month"; the form says which month it starts and that the rent itself does not change; "Stop" asks for the last month | C-4, C-5, C-9 |
| Rent still to come (new in 0.3) | No way to see what will be charged next | A card listing the next 12 months with rent, each repeating charge and the total, and a line saying nothing there is charged yet | C-5, C-9, C-10 |
| Give money back (new in 0.3) | Money could only be returned during move-out | A button that names what is held ("Rent paid ahead · ₹3,000 held"), caps the amount, and says what the balance becomes | C-3, C-5, C-9 |
| Person page (new in 0.4) | A tenant only existed inside one room record; someone who had left, or never had a room, disappeared | `/tenants/{id}`: what they owe, what you hold, every room past and present, contact details, their papers, Call and WhatsApp | C-1, C-7, C-9 |
| Tenants list (new in 0.4) | Only two tabs, and a person with no room was invisible | Current / Former / Put away; a person with no room is listed as "Not in a room"; the room and the property are separate links | C-1, C-8, C-10 |
| Same person entered twice (new in 0.4) | Nothing stopped a second copy of the same tenant | Typing a phone already in the list warns "That phone number already belongs to Ramesh" with a button to use the one you have | C-5, C-12 |
| Put away and delete (new in 0.4) | Old properties, rooms and people stayed in every list for ever, and nothing could be removed | "Put away" hides it and keeps everything; "Delete for good" works only while nothing hangs off the record and asks you to type the word delete; each refusal says why and points at the other one | C-3, C-5, C-11, C-12 |
| Added by mistake (new in 0.3) | A wrong room record could only be "moved out", which was untrue | A quiet line under the tenant page offers to remove it while no money has been recorded; the form says when to use it and when to use Move out instead | C-5, C-11, C-12 |

## 5. How to check a new screen

Before a screen ships, answer yes to all seven questions:

1. Does it have breadcrumbs (unless it is a top-level page)?
2. Does it have exactly one primary button, labelled with a verb and a thing?
3. Is every name on it a visible link to that thing?
4. Does every form that creates money show "What happens when you save"?
5. Does the confirmation say what happened and where to see it?
6. Are the words the ones in the C-8 table?
7. Is it free of internal codes and IDs, and does each form say in its first line when to use it (C-11)?

## 6. Ideas to build next (from the owner's notes in `temp.txt`)

These fit the rules above and are planned. Tick them off as they ship.

- [ ] **Exception-first dashboard:** when nothing needs action, show one short "All caught up" line instead of empty boxes. Sections grow only when something exists.
- [ ] **Dashboard money shown as a sum:** Collected − Expenses = Net, with Unpaid and Overdue kept visibly different (amber vs red).
- [ ] **Relative dates next to exact ones:** "Due in 3 days · 30 Sep", "15 days overdue".
- [ ] **One date format everywhere:** "1 Sep 2026" (short form "1 Sep" inside lists).
- [ ] **Money right-aligned** in every table and summary.
- [ ] **Date presets** on Expenses, Reports and History: This month, Last month, Last 30 days, This year.
- [ ] **Move-out as a checklist** with progress (notice → final readings → dues → deposit → keys → done).
- [ ] **Property row as a portfolio line:** occupied/vacant bar, monthly rent, unpaid.
- [ ] **Search results name their type:** "Tenant · Room 101", "Room · Green View".
- [ ] **Undo** for safe, reversible actions (for example "Not leaving any more").
- [x] **Remove a room record added by mistake** instead of forcing a false move-out. *(0.3)*
- [x] **Payment details in reminders**, so the tenant can pay without asking how. *(0.3)*
- [ ] **Recent activity** on the dashboard ("since your last visit").
- [ ] **Warn about unusual amounts:** "This is much higher than the usual rent of ₹3,500. Continue?"
- [ ] **Tenant app:** separate, mobile-first and much simpler (V1).

## 7. Out of scope

- No new features, no changes to the money rules, and no new pages.
- The colours, fonts and layout grid of 09 §3 stay as they are.
