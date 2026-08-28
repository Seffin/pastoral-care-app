# Pastoral Care App

An offline-first mobile app for pastoral staff to track and manage all church ministry activities — completely without internet access.

---

## Features

### Operations Dashboard
A central hub with a live statistics summary and quick navigation to every module.

| Module | Purpose |
|---|---|
| 🏠 House Visits | Log pastoral visits to member homes |
| ⛪ Cottage Meetings | Track home fellowship gatherings |
| 🙏 Fasting & Prayers | Record corporate fasting prayer sessions |
| 📖 Bible Classes | Track lessons, topics, and attendance |
| 💾 Backup & Restore | Export and share all data as a portable JSON file |

### Member Management
- Add individuals or full families (per-person name, age, hospitalization status)
- Phone number and location/address per member
- Status tracking: Active, Vacation, Migrated, Moved Out
- Configurable "overdue" visit gap (default: 3 months)
- Sorted by days since last contact — longest gap first

### Visit Logging
- Date, time of day (Morning → Late Night), interaction type
- Notes, optional financial contribution
- Full visit history per member

### Activity Logging (Cottage, Fasting, Bible)
- Simple, consistent form for each module
- Attendance count, notes, contribution tracking
- List view sorted by most recent

### Backup & Restore (Shareable)
- Export the entire database as a structured JSON file
- Share via WhatsApp, Email, or save to Files
- Restore from a previously exported JSON
- Cloud-sync-ready data model (`synced` flag on every record)

### UI
- Premium light and dark mode with indigo brand palette
- Activity-specific colour tints per module
- Text-driven approach — no image dependencies

---

## Data Model

```
members          — Individual or family records
visits           — Pastoral visit logs linked to members
cottage_meetings — Home fellowship meeting logs
fasting_prayers  — Corporate fasting prayer logs
bible_classes    — Bible study session logs
settings         — App-wide configuration (gap months, theme)
```

Every table includes:
- `created_at` / `updated_at` timestamps
- `synced INTEGER DEFAULT 0` — ready for future cloud sync

---

## Architecture

- **Database**: SQLite via `react-native-sqlite-storage` (offline-first, no network needed)
- **Navigation**: React Navigation Native Stack
- **Theming**: Centralized `theme.ts` — all colours in one place
- **Export format**: Version-stamped JSON document for forward compatibility

---

## Build & Run

```bash
cd mobile
npm install

# Development (USB debugging)
npm run android

# Production build
npm run android -- --mode Release
```

**USB Build Steps:**
1. Connect your Android phone via USB
2. Enable USB Debugging on the phone
3. Tap "Allow" when prompted
4. Run the build command above
