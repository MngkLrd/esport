# World Ecology

The career is one participant in a persistent esports ecosystem. The user club is not
the scheduler, market maker, tournament creator or source of new talent.

## Core rule

Advancing game time drains an ordered event queue. The scheduler only decides when
an actor gets another decision opportunity. It does not decide what the actor does.

World outcomes come from current state plus actor utility:

- clubs react to roster quality, role gaps, cash, prestige, contracts and market availability;
- players react to salary, prestige, role opportunity, age and current employment;
- tournament operators react to audience demand, sponsor liquidity, regional team supply, capital, reputation and previous event profitability;
- entry and exit are endogenous. A new entity appears only when the ecosystem exposes a viable opportunity.

All stochastic decisions use labelled deterministic RNG derived from the save seed
and semantic event identity.

## Runtime modules

### Scheduler

WorldScheduledEvent is ordered by (at, sequence, id). Current event families are
club-plan, market-clear, population-review, operator-plan, competition-start and
competition-finish.

Handlers may schedule future work or create causal cascades. Stable periods naturally
produce fewer events; market or roster pressure shortens planning intervals.

### Club agents

A club carries persistent cash, prestige, ambition, fanbase, region, roster, VRS and
form. A club plan first resolves contract pressure, then calculates role needs.
Candidate search scores fit, quality, accessibility, age and affordability. The club
can open a market offer, renew a contract, allow a player to become a free agent, or
do nothing.

There is no global random "perform one AI transfer" roll.

### Player careers

Players carry current/base/potential rating, age and role, form, morale, fatigue,
contract duration, salary, market value, current organization and career timestamps.

Retirement is a hazard model driven by age, unemployment and competitive level.
Generated players develop toward potential while young and can decline later.

New players are not created on a fixed annual spawn count. Population review measures
regional roster demand against the suitable free-player supply. Scarcity creates an
intake. A saturated market creates no intake.

### Transfer market

Offers are explicit stateful objects. Every offer contains buyer, seller, player,
fee, salary and three utility scores. A deal must clear buyer utility, player utility
and seller utility. Competing offers are resolved against one another. A transfer
therefore changes the future state of at least two clubs and one player and can create
new roster needs.

### Tournament operators

Operators are persistent agents with capital, reputation, audience, risk appetite,
production quality, region, event portfolio and loss streak.

They create events only when audience, sponsor liquidity, regional team supply and
their balance sheet make the opportunity attractive. Events consume capital, create
audience/revenue, distribute prize money, change club finances/prestige and change
VRS through actual results. Repeated losses can kill an operator.

A new operator can enter only when event demand exceeds existing capacity and sponsor
capital is sufficient. This is market entry, not a spawn timer.

### Autonomous competitions

World competitions are independent of the player's registered tournament run. Their
lifecycle is announced -> running -> complete or cancelled.

Participants are selected by team strength, prestige, region and tier fit. Results
are deterministic for a save seed but stochastic across seeds. Completion mutates
winner/runner-up VRS, prize income, club prestige, operator audience, operator capital
and causal world history.

The player's existing tournament keeps a registration snapshot, so an unrelated
world transfer cannot remove an opponent from an already registered bracket.

### Organization birth and death

A club can disappear after sustained financial distress and low prestige. Its roster
returns to the labor market.

A new club requires ecosystem team count below carrying capacity, enough suitable
free players, regional/tournament opportunity and sufficient sponsor/audience
conditions. The carrying-capacity bound is intentional. Free agents alone must never
cause unbounded organization growth.

### Economy

The current first-pass closed loop is:

audience -> sponsor liquidity -> operator events -> club income/prestige -> roster
spending -> player careers -> team quality -> event audience.

Tournament cost is paid by the operator; event revenue returns to operator capital.
Prize pools return part of ecosystem capital to clubs. Clubs also receive a bounded
sponsor-income signal and pay roster salaries.

The model deliberately clamps sponsor liquidity and limits organization entry. Those
are stability constraints, not story scripts.

## Causal ledger and news

WorldHistoryEvent is the durable semantic history. Each record has timestamp, kind,
importance, actors, title/detail, explicit causes and structured data.

The simulation writes facts. UI news consumes those facts. It must never invent a
transfer, winner, organization or tournament that does not exist in the ledger.

advanceCareerTo now advances World Ecology for every positive time jump, not only on
payroll weeks. Important events are projected into the existing Inbox/news surface.
A future Portal can rank the same ledger by importance and relevance without changing
simulation logic.

## Determinism

The replay contract is:

world trajectory = initial world + save seed + ordered user commands.

Randomness is never taken from Math.random() in World Ecology. Each decision derives
an RNG stream from the save seed plus a semantic label such as actor, event and game
time. Equal seed and equal command history must produce equal world history.

## Anti-degeneracy invariants

Long unattended simulations should preserve:

1. active teams retain at least five non-retired rosterable players;
2. retired players cannot remain on active rosters;
3. active player supply remains above active-team roster demand;
4. organization count cannot grow without carrying-capacity headroom;
5. sponsor liquidity remains bounded;
6. operators can fail, but the operator population can re-enter when event capacity is insufficient;
7. competitions continue completing without user participation;
8. VRS movement is caused by competition results, not arbitrary weekly noise;
9. transfer completion is caused by an explicit offer;
10. every newsworthy world event has a causal ledger record.

## Tests

tests/worldEcology.test.ts covers unattended tournament/market progression,
deterministic replay, endogenous team/operator entry after a forced ecosystem gap,
and a five-year unattended soak with population, competition and economic invariants.

The P0 CI suite runs these ecology tests in addition to the existing career, card,
layout and squad-planner tests.

For balancing work, extend the soak horizon to 20/50/100 years and collect yearly
snapshots of active players and median age, generated/retired players, team and
operator churn, tournaments by tier/region, transfer fees and salaries, sponsor
liquidity, club cash, VRS concentration, top-team turnover and event profitability.

Balance changes should be judged on distributions across many seeds, not on one
interesting save.
