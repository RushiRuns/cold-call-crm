# Cold Call CRM v2 — Deployment Guide

## What's Included
- **13-column Apollo lead structure** (First Name, Last Name, Company LinkedIn, Personal LinkedIn, Company Name, Website, Work Email, Phone, City, Company Address, Service Description, Company Phone, Remark)
- **Duplicate detection** on First Name + Last Name + Personal LinkedIn
- **Admin-only pipeline export** to Excel with all remarks
- **Running remark history** — every call note appended, never overwritten
- **Expandable lead cards** with full details + remark timeline
- **Role-based access** — Admin sees everything, employees see only their data

## Quick Start
```bash
cd cold-call-crm
npm install
npm start
# Open http://localhost:3000
```

## Logins
| Role     | Username   | Password       |
|----------|------------|----------------|
| Admin    | admin      | admin123       |
| Admin    | nishant    | nishant123     |
| Employee | manishini  | manishini123   |
| Employee | aalima     | aalima123      |
| Employee | bharat     | bharat123      |

## Deploy Live

### Railway.app (Free, Recommended)
1. Push to GitHub
2. railway.app → New Project → Deploy from GitHub
3. Get your URL → Share with team

### Render.com (Free)
1. render.com → New Web Service → Connect GitHub
2. Build: `npm install` | Start: `npm start`

## Data
All data stored in `data.db` (SQLite). Copy this file to backup everything.
