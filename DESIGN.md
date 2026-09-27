# ESPORT AI Manager design grammar

## Direction

The product is an esports management game with broadcast and scouting surfaces. The club desk is the home: the starting five is the primary object, the tactical desk is the primary action, and finance/news are supporting signals.

## Grid and rhythm

- Desktop content maxes at 1640px with 48px page gutters; compact desktop uses 28px gutters.
- Spacing follows 4 / 8 / 12 / 16 / 24 / 32 / 48px.
- Screens use editorial columns and dividers before introducing a new container.
- 1366px is a first-class target; dense rows compress before the page becomes a card grid.

## Type

- Micro labels: 10–11px Space Mono, uppercase, used for role, week and status context.
- Secondary text: 11–13px.
- Body: 14px with 1.55 line height.
- Section titles: 20–28px.
- Page titles: 34–48px; utility screens do not use oversized display type.
- Player aliases, scores and tactical values use Space Mono for an equipment / broadcast read.

## Surfaces and colour

- Base is a dark neutral field with almost-black navigation.
- Orange is reserved for the primary action, active club state and important score.
- Cyan is reserved for information and healthy state.
- Green/yellow/red are used for result and risk context, not for general decoration.
- Cards and packs may carry their own collectible palette; management screens remain restrained.

## Borders, radius and depth

- Management surfaces use 0–2px radius and 1px dividers.
- A rectangle must group a decision or a meaningful data relationship; label/value pairs use alignment and rules instead of a card.
- Shadows are limited to modal depth. Glow belongs to a pack reveal or a rarity object only.

## Navigation and archetypes

- Club: HQ, Match, Roster.
- Collection: Packs, Scouting.
- Journal: Newsroom, AI Director, Sources.
- HQ is a team-first club desk. Match is a tactical desk. Roster is a team sheet. Player detail is a scouting dossier. Packs are a collectible product and collection is a gallery. News is a club newsroom.

## Player visuals and data

Portraits are used at a readable but compact scale. Rows show role, OVR, form, morale, fatigue and contract together. Player cards are reserved for collectible surfaces; the roster itself is not an ecommerce grid.

## Motion and accessibility

Hover and focus transitions are short (100–220ms). State transitions explain a change in the game state. `prefers-reduced-motion` disables reveal and decorative movement. Every player and tactical action remains a keyboard-focusable button; modals close with Escape.
