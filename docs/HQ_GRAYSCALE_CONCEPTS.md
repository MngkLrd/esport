# HQ grayscale architecture studies

These studies were made before styling so the home screen could be judged by information architecture instead of colour.

## A — Team-first club desk (selected)

```text
┌ CLUB DESK · WEEK 2/12 ──────────────────────────────────────────────────────────┐
│ STARTING FIVE / 75 OVR          NEXT DECISION / TRAINING MIX        CLUB PULSE │
│ portrait  alias role  form      our five  ── VS ──  opponent ?       REP 38     │
│ portrait  alias role  fatigue   plan: balanced / aggressive          CREDITS     │
│ ...                              [ PREPARE FOR MATCH ]              PAYROLL      │
│ LATEST NEWS ─────────────────────────────────────────────────────────────────── │
└─────────────────────────────────────────────────────────────────────────────────┘
```

The starting five is the persistent object. The next meaningful action stays adjacent to it; economy and news support the decision without taking equal visual weight.

## B — Match-first broadcast desk

```text
┌ MATCH CENTER · WEEK 2/12 ───────────────────────────────────────────────────────┐
│ OUR CLUB / five portraits            BO3 · TRAINING MIX            OPPONENT ?    │
│ rating / chemistry                   map plan / series level        [ START ]    │
│ LAST RESULT / map-by-map recap       WEEK FORM / trend              NEWS RAIL     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

This makes the next series extremely clear, but pushes roster and contract work into secondary navigation. It is strongest for a match-heavy product and weaker for a weekly management loop.

## C — Week-control timeline

```text
┌ WEEK 2 CONTROL ROOM ─────────────────────────────────────────────────────────────┐
│ MON roster → TUE training → WED scout → THU match → FRI payroll → SAT news      │
│ current step / warnings / costs                         [ CONTINUE WEEK ]        │
│ roster deltas and inbox events                                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

This clarifies the season cadence, but makes the team and its next match feel like events in a schedule rather than the club itself.

## Decision

Architecture A was selected. The current P0 state already has canonical roster, lineup, chemistry, economy, match and inbox data, so A exposes real values end-to-end while leaving B and C available as focused future modes. The shipped HQ uses editorial columns and rules rather than equal-weight KPI tiles.
