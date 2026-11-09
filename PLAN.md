# Pay Forecast PWA — Plan

A small offline web app (installable on iPhone) for a nurse paid biweekly: enter shifts, see the
projected net pay for each pay date. It replaces a Google Sheet; there is no sync.

## Principles

- **Simple:** three tabs, no accounts, no server.
- **Accurate:** payroll rules are ported from a sheet that was checked line by line against real pay stubs,
  and the tax calculation uses CRA's published payroll formulas (T4127), not a calibrated constant.
- **Private:** all personal data (rates, tax claims, shifts, pay history) lives only on the device.
  **Nothing personal is ever committed to this public repo.** Personal values are loaded through a
  one-time import file that stays outside git.

## Screens

### 1. Schedule
- Shifts grouped by pay period, each showing its pay date.
- Add/edit: date, type (Day, Evening, Night, Sick, Stat Holiday, Vacation, Orientation, Personal Leave,
  Floater Stat, Unpaid), hours (defaults to the usual shift length), Straight or OT.
- Each shift shows its base, evening, night, weekend and stat hours and its stat premium.

### 2. Pay
- One card per pay date: gross, deductions, net pay.
- Tap for the stub-style breakdown: earnings lines; before-tax deductions (union dues, LAPP);
  taxes (income tax, CPP, CPP2, EI); after-tax deductions (TFSA, benefit premiums); running YTD.
- Pays whose tax-year rates are not all confirmed are labelled **Estimate**.
- Totals per tax year.

### 3. Setup (the sheet's Rates + Setup tabs)
- **Pay and premiums:** base rate, evening/night/weekend premiums, OT multiplier, stat premium
  multipliers (standard and 2.0x days), evening-premium hours per day shift, Friday-day weekend hours,
  night-shift hours before midnight.
- **Deductions:** union dues % + levy, LAPP rates, TFSA employee/employer %, benefit premiums and
  taxable employer benefits.
- **Tax years (one set per year):** CPP rate/exemption/YMPE/YAMPE/maximums, CPP2, EI, federal and
  Alberta brackets, TD1 claim amounts, Canada employment amount. Each value can be marked confirmed.
- **Pay periods:** generated biweekly from an anchor; pay date and benefit-pay flag editable per period.
- **Stat holidays:** list of dates, each standard or 2.0x.
- **Opening YTD:** CPP, CPP2, EI and pensionable earnings at the start of the first forecast period.
- **Backup:** export / import everything as one JSON file.

## Pay rules (ported from the verified sheet)

- Base-rate hours (regular, sick, stats, leave, orientation, vacation) at the base rate; OT at the OT
  multiplier, not pensionable.
- Day shift: evening premium on a fixed number of hours; evening shift: every hour; night shift: night
  differential on every hour.
- Weekend premium: all hours of Sat/Sun shifts and Friday nights; a fixed number of hours of Friday
  day shifts.
- Stat pay only for hours that fall on the stat date (night shifts split at midnight); premium
  multiplier depends on the holiday.
- Union dues: % of gross + flat levy. LAPP: two rates split at YMPE / pays per year, on base-rate pay.
- TFSA: employee and employer % of base-rate pay; employer part is a taxable benefit.
- Benefit pays: premiums after tax plus taxable employer-paid benefits.
- CPP: rate x (pensionable earnings - exemption per pay), to the annual maximum.
  **CPP2: 4% of year-to-date pensionable earnings above the YMPE**, to the annual maximum.
- EI: rate x insurable earnings, to the annual maximum.
- Income tax: CRA T4127 — annualise (taxable income - CPP enhancement - CPP2), federal and Alberta
  brackets, minus K1 (TD1 claims), K2 (CPP/EI credits; annual maximums once maxed), K4 (Canada
  employment amount).
- Tax year is decided by the **pay date**; YTD totals reset each tax year.
- Money is handled in integer cents; each line is rounded the way payroll rounds it.

## Accuracy tests

1. **Public tests (in repo):** synthetic cases worked by hand, CRA's published examples, and edge
   cases: stat night shifts (on and before the stat), 2.0x stats, Friday day shifts, weekend OT,
   CPP/CPP2/EI maxing out mid-pay, a pay in a new tax year.
2. **Private stub check (local only, git-ignored fixture):** real pay stubs must reproduce to the cent
   line by line.

## Tech

Vite + TypeScript + Preact, `vite-plugin-pwa` (installable, offline), IndexedDB for storage,
Vitest for tests. Hosted on GitHub Pages.

## Build order

1. Scaffold the project and confirm it builds.
2. Calculation engine + tests (done only when the private stub check matches to the cent).
3. Storage + backup (export/import).
4. Setup screen, then Schedule, then Pay.
5. PWA: icons, manifest, offline; iPhone "Add to Home Screen" check.
6. Private import file built from the current sheet; check forecasts match the sheet.
7. Deploy to GitHub Pages and install on the phone.

## Open items

- 2027 rates: EI and YMPE/YAMPE are published; CPP rate/maximums, federal/Alberta 2027 amounts
  and LAPP/benefit changes are pending. The Jan 2027 pay shows as an Estimate until confirmed.
- Opening pensionable earnings for CPP2 at the start of the first forecast period (from the last
  stub before it).
