# Rugby Multi-Provider Data Integration Specification

## 1. Problem

No single free or low-cost rugby data provider currently provides the combination of:

- reliable historical data;
- current-season fixtures;
- completed match results;
- standings;
- broad competition coverage; and
- stable access without restrictive free-tier limitations.

API-Sports is already integrated and provides useful historical rugby data, but its free tier does not reliably expose current-season data.

TheSportsDB has also been evaluated, but its free-tier response limits make it unsuitable as the primary source for full-season match ingestion.

We therefore need a provider-agnostic rugby data layer that combines multiple sources and stores a canonical copy of the data internally.

---

# 2. Goal

Build a rugby data ingestion service that:

1. Retains API-Sports for historical data and backfills.
2. Uses SofaScore as the primary source for current fixtures, results and standings.
3. Supports additional providers such as ESPN and World Rugby as fallbacks or verification sources.
4. Normalises provider-specific data into a single internal model.
5. Stores results locally so provider APIs do not need to be queried for every application request.
6. Continues functioning when one provider is unavailable or changes its API.
7. Keeps clear provenance showing where every imported match originated.

The application consuming the rugby data must not need to know which external provider supplied the information.

---

# 3. Non-goals

The first version does not need to provide:

- second-by-second live scores;
- commentary;
- individual player statistics;
- possession or territory statistics;
- fantasy data;
- betting odds;
- video/highlights;
- detailed event timelines;
- minute-by-minute scoring events.

These can be added later without changing the core provider architecture.

---

# 4. Providers

## 4.1 API-Sports Rugby

Role:

**Historical and backfill provider**

Use for:

- historical competitions;
- historical seasons;
- historical fixtures;
- historical results;
- team metadata where useful;
- league metadata.

API-Sports should not be assumed to contain current-season data on the free plan.

Existing integration should be retained.

Provider key:

```text
api_sports
```

Priority:

```text
Historical data: HIGH
Current data: LOW
```

---

## 4.2 SofaScore

Role:

**Primary current-data provider**

Use for:

- current competitions;
- current seasons;
- upcoming fixtures;
- recently completed fixtures;
- final scores;
- standings;
- team information.

Provider key:

```text
sofascore
```

Example API structure:

```text
https://www.sofascore.com/api/v1/
```

Useful endpoint patterns include:

```text
/unique-tournament/{tournamentId}/seasons

/unique-tournament/{tournamentId}/season/{seasonId}/events/round/{round}

/unique-tournament/{tournamentId}/season/{seasonId}/standings/total

/event/{eventId}
```

SofaScore is not treated as a formally supported public API.

The implementation must therefore:

- isolate SofaScore logic inside its own provider adapter;
- validate responses before processing;
- gracefully handle schema changes;
- never expose SofaScore response structures directly to the application;
- store provider IDs separately from internal IDs.

Provider priority:

```text
Current fixtures: HIGH
Current results: HIGH
Standings: HIGH
Historical data: MEDIUM
```

---

## 4.3 ESPN

Role:

**Secondary current-data provider / fallback**

Use for:

- current fixtures where coverage exists;
- match status;
- completed scores;
- validation of SofaScore results;
- fallback when SofaScore is unavailable.

Provider key:

```text
espn
```

Typical endpoint pattern:

```text
https://site.api.espn.com/apis/site/v2/sports/rugby/{competition}/scoreboard
```

Date ranges can be used when supported.

ESPN is also an undocumented API and must therefore be isolated behind a provider adapter.

Provider priority:

```text
Current fixtures: MEDIUM
Current results: MEDIUM
Standings: MEDIUM
Historical data: LOW
```

---

## 4.4 World Rugby

Role:

**International rugby verification provider**

Potential use:

- Springbok fixtures;
- international fixtures;
- international results;
- rankings;
- international competition metadata.

Provider key:

```text
world_rugby
```

This provider should initially be treated as optional.

Before enabling it for automated match ingestion, a technical spike must validate:

- fixture endpoints;
- result endpoints;
- authentication requirements;
- response stability;
- competition coverage.

World Rugby can then be used as a higher-confidence verification source for international matches.

Provider priority if validated:

```text
International fixtures: HIGH
International results: HIGH
Club rugby: NONE
```

---

# 5. Provider strategy

Provider selection must depend on the type and age of data requested.

## Historical match

Preferred order:

```text
1. API-Sports
2. SofaScore
3. ESPN
```

## Current domestic or club match

Preferred order:

```text
1. SofaScore
2. ESPN
3. API-Sports if available
```

## Current international match

Initial:

```text
1. SofaScore
2. ESPN
3. API-Sports
```

Once the World Rugby integration has been validated:

```text
1. World Rugby
2. SofaScore
3. ESPN
4. API-Sports
```

Provider order must be configurable rather than hard-coded.

---

# 6. Architecture

External providers must never write directly into the canonical match table.

Each provider is responsible only for retrieving and normalising its own data.

Conceptually:

```text
              API-Sports
                  │
                  ▼
          ApiSportsAdapter
                  │
                  │
SofaScore ──► SofaScoreAdapter
                  │
                  │
ESPN ─────────► EspnAdapter
                  │
                  │
World Rugby ► WorldRugbyAdapter
                  │
                  ▼
        Provider Normalisation
                  │
                  ▼
        Provider Match Records
                  │
                  ▼
        Match Reconciliation
                  │
                  ▼
          Canonical Matches
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
     API/UI    Standings   Analytics
```

---

# 7. Provider interface

All providers should implement a common interface.

Example:

```typescript
interface RugbyDataProvider {
	provider: RugbyProvider;

	getCompetitions(): Promise<ProviderCompetition[]>;

	getSeasons(
		competition: ProviderCompetitionReference,
	): Promise<ProviderSeason[]>;

	getFixtures(request: FixtureRequest): Promise<ProviderMatch[]>;

	getMatch(providerMatchId: string): Promise<ProviderMatch | null>;

	getStandings?(request: StandingsRequest): Promise<ProviderStanding[]>;
}
```

Optional provider capabilities should be declared rather than assumed.

Example:

```typescript
interface ProviderCapabilities {
	historicalFixtures: boolean;
	currentFixtures: boolean;
	liveScores: boolean;
	standings: boolean;
	teams: boolean;
	rankings: boolean;
}
```

---

# 8. Canonical match model

All provider matches must be converted into a common structure.

Example:

```typescript
interface RugbyMatch {
	id: string;

	competitionId: string;
	seasonId: string;

	homeTeamId: string;
	awayTeamId: string;

	scheduledAt: Date;

	status:
		| 'scheduled'
		| 'in_progress'
		| 'completed'
		| 'postponed'
		| 'cancelled'
		| 'abandoned'
		| 'unknown';

	homeScore: number | null;
	awayScore: number | null;

	venueId?: string;

	round?: string;
	stage?: string;

	lastUpdatedAt: Date;
}
```

Provider-specific values must never be stored directly as canonical statuses.

---

# 9. Provider match storage

Provider responses should be preserved separately from canonical matches.

Suggested structure:

```text
rugby_matches
rugby_match_sources
rugby_teams
rugby_team_sources
rugby_competitions
rugby_competition_sources
rugby_seasons
rugby_standings
rugby_sync_runs
```

---

# 10. rugby_matches

Canonical match table.

Important fields:

```text
id

competition_id
season_id

home_team_id
away_team_id

scheduled_at

status

home_score
away_score

round
stage

preferred_source

created_at
updated_at
completed_at
```

---

# 11. rugby_match_sources

Stores one provider's representation of a match.

Example:

```text
id

match_id

provider

provider_match_id
provider_competition_id
provider_season_id

status

home_score
away_score

scheduled_at

provider_updated_at
last_fetched_at

raw_payload JSONB
```

Unique constraint:

```text
provider + provider_match_id
```

This allows the system to store:

```text
Match 123

├── SofaScore event 14562394
├── ESPN event 599267
└── API-Sports fixture 94833
```

while treating all three as the same rugby match internally.

---

# 12. Competition mapping

Provider IDs must not become internal competition IDs.

Example:

```text
Competition:
United Rugby Championship

Internal ID:
urc

Provider references:

API-Sports: 51
SofaScore: 419
ESPN: 270557
```

These mappings should live in the database/configuration.

Example:

```typescript
{
  competition: 'urc',
  providers: {
    apiSports: '51',
    sofaScore: '419',
    espn: '270557'
  }
}
```

Exact IDs are configuration data and should be validated before being promoted to production.

---

# 13. Team mapping

The same principle applies to teams.

Example:

```text
Internal team

Stormers
    │
    ├── API-Sports team ID
    ├── SofaScore team ID
    └── ESPN team ID
```

Provider IDs must be mapped to a canonical team.

Team names alone must not be used as permanent identifiers.

---

# 14. Automatic match reconciliation

When a provider introduces a match that does not yet have a known mapping, the system should attempt to match it against existing canonical matches.

Match confidence can use:

```text
competition
season
home team
away team
scheduled date/time
```

A strong match would be:

```text
same competition
same canonical home team
same canonical away team
scheduled time within configurable tolerance
```

Suggested time tolerance:

```text
±12 hours
```

This allows for providers representing timezone or schedule changes differently.

Once a mapping exists, provider IDs should be used rather than repeating fuzzy matching.

---

# 15. Conflict resolution

Providers will occasionally disagree.

Example:

```text
SofaScore
Stormers 31 - 27 Bulls

ESPN
Stormers 31 - 25 Bulls
```

The system must not silently overwrite one provider with another.

Instead:

```text
canonical result
provider result A
provider result B
conflict = true
```

A conflict should trigger reconciliation.

---

# 16. Source confidence

Each provider should have configurable confidence by data type.

Example:

```typescript
{
  historical: [
    'api_sports',
    'sofascore',
    'espn'
  ],

  currentClub: [
    'sofascore',
    'espn',
    'api_sports'
  ],

  international: [
    'world_rugby',
    'sofascore',
    'espn',
    'api_sports'
  ]
}
```

The first provider with valid data becomes the preferred canonical source.

Lower-priority providers can still be used to validate the result.

---

# 17. Completed match behaviour

Once a match becomes:

```text
completed
```

the system should continue checking it for a short period.

Suggested behaviour:

```text
Immediately after final:
store result

+1 hour:
verify

+6 hours:
verify

next day:
final verification
```

After that the result can be treated as effectively immutable.

This dramatically reduces external API usage.

---

# 18. Fixture synchronisation strategy

Because minute-by-minute live scoring is not required, polling should be conservative.

## More than 7 days before match

```text
Sync once per day
```

## 1–7 days before match

```text
Sync every 6 hours
```

## Match day

```text
Sync every 60 minutes
```

## From scheduled kickoff until expected completion

```text
Sync every 15–30 minutes
```

This gives reasonably fresh scores without treating the system as a live-score service.

## Match completed

Follow the completed-match verification schedule.

---

# 19. Competition synchronisation

At least once daily:

```text
current season
future fixtures
recent results
```

Standings should be refreshed:

```text
after completed matches

and

at least once daily
```

---

# 20. Historical backfill

API-Sports should be used for historical data already available through the existing integration.

Backfills should operate independently from current-match synchronisation.

Example:

```text
HistoricalBackfillJob

competition
season
provider
cursor/page
last processed match
```

Backfills must be resumable.

A failure halfway through a season should not require restarting the entire import.

---

# 21. Raw provider payloads

The original provider JSON response should be retained in `JSONB` where practical.

Reasons:

- debugging;
- schema-change investigation;
- future extraction of additional fields;
- provider comparison;
- auditability.

The application itself should never depend on the raw payload.

---

# 22. Schema validation

Every provider response must pass schema validation before being processed.

For example:

```text
HTTP 200
        │
        ▼
JSON parse
        │
        ▼
Schema validation
        │
    ┌───┴────┐
    │        │
 valid     invalid
    │        │
    ▼        ▼
 ingest    log + alert
```

This is particularly important for SofaScore and ESPN because their APIs are undocumented.

A provider changing:

```text
event.homeScore.current
```

to something unexpected must not corrupt canonical data.

---

# 23. Provider health monitoring

Track for every provider:

```text
last successful request
last failed request
response time
HTTP status
parse errors
schema errors
matches returned
rate-limit errors
```

Suggested status:

```text
HEALTHY

DEGRADED

UNAVAILABLE
```

---

# 24. Automatic fallback

If the preferred provider fails:

```text
SofaScore
    │
    X
    │
    ▼
ESPN
    │
    ▼
Canonical result
```

Fallback should happen automatically where another configured provider supports the competition.

Failures must still be logged.

---

# 25. Provider circuit breaker

Repeated provider failures should temporarily disable requests to that provider.

Example:

```text
5 failures
within
10 minutes

→ provider temporarily DEGRADED
```

The system can retry after a cooldown.

This prevents scheduled jobs from repeatedly hammering a broken or changed API.

---

# 26. Rate limiting

Each provider adapter must implement its own request limits.

Configuration example:

```typescript
providers: {
  apiSports: {
    requestsPerDay: 100
  },

  sofaScore: {
    requestsPerMinute: 10
  },

  espn: {
    requestsPerMinute: 10
  }
}
```

For undocumented providers, conservative internal limits should be used even when no official rate limit is published.

---

# 27. Caching

External sports APIs should only be accessed by synchronisation workers.

Application requests should use the internal database.

Avoid:

```text
User
  ↓
Application
  ↓
SofaScore
```

Prefer:

```text
Provider
   ↓
Sync
   ↓
Database
   ↓
Application
   ↓
User
```

This protects the application from provider outages and API changes.

---

# 28. Competition configuration

Only explicitly configured competitions should be synchronised.

Example:

```yaml
rugby:
  competitions:
    - key: currie-cup
      enabled: true
      providers:
        sofascore: '796'

    - key: urc
      enabled: true
      providers:
        sofascore: '419'
        espn: '270557'

    - key: international
      enabled: true
```

This prevents accidentally ingesting thousands of competitions.

---

# 29. Initial competition scope

Suggested first implementation:

### South African domestic

- Currie Cup

### Club

- United Rugby Championship
- Super Rugby Pacific

### International

- South Africa / Springboks
- Six Nations
- Nations Championship
- Rugby World Cup
- British & Irish Lions where applicable
- major test matches

Additional competitions can be enabled later through configuration.

---

# 30. Internal API

The application-facing API must use canonical IDs.

Suggested endpoints:

```text
GET /rugby/competitions

GET /rugby/competitions/:competitionId

GET /rugby/competitions/:competitionId/seasons

GET /rugby/competitions/:competitionId/fixtures

GET /rugby/competitions/:competitionId/results

GET /rugby/competitions/:competitionId/standings

GET /rugby/matches/:matchId

GET /rugby/teams/:teamId

GET /rugby/teams/:teamId/fixtures

GET /rugby/teams/:teamId/results
```

Filters could include:

```text
from
to
season
status
team
competition
```

---

# 31. Data provenance

Every canonical result should expose internally:

```text
preferred_source
last_verified_at
source_count
conflict
```

Example:

```json
{
	"homeScore": 31,
	"awayScore": 27,
	"status": "completed",

	"dataQuality": {
		"preferredSource": "sofascore",
		"verifiedBy": ["espn"],
		"lastVerifiedAt": "2026-09-01T14:30:00Z",
		"conflict": false
	}
}
```

The public API does not necessarily need to expose this information, but it should be available for debugging/admin purposes.

---

# 32. Admin/debug view

Provide a simple provider diagnostic view showing:

```text
Match

Canonical result

SofaScore result

ESPN result

API-Sports result

World Rugby result

Preferred source

Conflict status

Last sync

Next sync
```

This will make provider problems much easier to investigate.

---

# 33. Logging

Every sync run should record:

```text
provider
competition
season
started_at
completed_at
requests
matches_found
matches_created
matches_updated
conflicts
errors
```

---

# 34. Error handling

The following must not cause the overall sync process to fail:

- one malformed match;
- one unknown team;
- one unknown competition;
- provider timeout;
- provider HTTP error;
- provider schema change;
- missing score;
- postponed match;
- duplicate event.

Problem records should be logged and processing should continue where safe.

---

# 35. Unknown teams

If a provider returns an unmapped team:

```text
do not guess
```

Create a provider-team record and flag it:

```text
mapping_status = NEEDS_MAPPING
```

Once mapped, future imports can resolve automatically.

---

# 36. Unknown competitions

Unknown competitions should not automatically be imported.

They should be recorded as discovered provider competitions and require explicit enablement.

---

# 37. Data quality states

Matches can optionally have:

```text
UNVERIFIED

SINGLE_SOURCE

VERIFIED

CONFLICTED
```

Example:

```text
SofaScore only
→ SINGLE_SOURCE

SofaScore + ESPN agree
→ VERIFIED

SofaScore + ESPN disagree
→ CONFLICTED
```

This becomes useful if the service grows beyond a hobby application.

---

# 38. Security

Provider credentials must be stored in environment variables or the existing secret-management system.

Example:

```text
API_SPORTS_KEY
```

No API credentials may be sent to the frontend.

SofaScore and ESPN endpoints should also only be contacted server-side.

---

# 39. Provider terms / unsupported API risk

SofaScore and ESPN are not being treated as guaranteed public developer APIs.

The design must therefore assume that:

- endpoint structures may change;
- access may disappear;
- rate limits may change;
- response fields may change.

This is the main reason the provider-adapter architecture is required.

No undocumented provider should become part of the application's domain model.

---

# 40. Testing

Each provider adapter should have fixture-based tests using stored example responses.

Tests should cover:

```text
scheduled fixture

completed match

in-progress match

postponed match

cancelled match

missing score

unknown team

schema mismatch

duplicate match

provider timeout

provider conflicting score
```

Raw test fixtures should make tests independent of external provider availability.

---

# 41. Provider contract tests

A lightweight scheduled check should periodically query each provider using one known competition.

The test should verify that expected structural fields still exist.

Example:

```text
SofaScore

events[]
event.id
event.status
event.homeTeam
event.awayTeam
```

If this contract changes, raise an alert before normal ingestion begins failing silently.

---

# 42. Acceptance criteria

## P0 — Required

- API-Sports existing integration remains functional.
- Historical fixtures can be imported from API-Sports.
- SofaScore provider adapter is implemented.
- Current SofaScore fixtures can be imported.
- Completed SofaScore results can be imported.
- Provider IDs are separated from canonical IDs.
- Teams are mapped across providers.
- Competitions are mapped across providers.
- Duplicate matches from different providers resolve to one canonical match.
- Provider-specific raw payloads are retained.
- Provider schema validation is implemented.
- Sync jobs can be rerun without creating duplicates.
- Completed matches are stored locally.
- Application reads rugby data from the internal database rather than directly from external APIs.
- Provider errors do not take down the application.

## P1 — Strongly recommended

- ESPN adapter implemented.
- ESPN used as a secondary source.
- Automatic provider fallback implemented.
- Score conflicts are detected.
- Provider health monitoring implemented.
- Provider diagnostics/admin view implemented.
- Standings synchronisation implemented.
- Data-quality state implemented.
- Circuit breaker implemented.

## P2 — Later

- World Rugby match feed integration.
- Player statistics.
- Detailed match statistics.
- scoring-event timeline;
- venue metadata;
- rankings;
- automatic competition discovery;
- richer live scoring;
- notifications.

---

# 43. Rollout

## Phase 1 — Foundation

Implement:

```text
canonical data model
provider interfaces
competition mapping
team mapping
sync framework
```

No new provider integration yet.

---

## Phase 2 — SofaScore

Implement:

```text
SofaScore adapter
season retrieval
fixture retrieval
results
standings
normalisation
```

Initial competitions:

```text
Currie Cup
URC
```

Confirm current-season data is flowing correctly.

---

## Phase 3 — API-Sports reconciliation

Connect the existing API-Sports integration to the new canonical provider architecture.

Use API-Sports for:

```text
historical seasons
historical fixtures
historical results
```

Confirm SofaScore and API-Sports matches can resolve to the same canonical teams and competitions.

---

## Phase 4 — ESPN fallback

Implement ESPN as a secondary provider.

Use it initially only for configured competitions where coverage has been verified.

Enable:

```text
result verification
provider fallback
conflict detection
```

---

## Phase 5 — International provider

Investigate and validate World Rugby's available feeds.

If suitable, implement:

```text
WorldRugbyAdapter
```

and promote it to the preferred provider for international fixtures/results.

---

# 44. Definition of success

The integration is successful when the application can request:

```text
"Give me all Currie Cup matches for the current season"
```

or:

```text
"Give me the Springboks' last 10 matches"
```

without needing to know whether those matches came from:

```text
API-Sports
SofaScore
ESPN
World Rugby
```

and provider changes can be handled by changing an adapter rather than rewriting the rugby feature.

The internal rugby database becomes the source of truth for the application, while external sports APIs act only as upstream data providers.
