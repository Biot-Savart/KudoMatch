# Phase 15 provider proof

Rugby launch uses the direct API-Sports endpoint (`https://v1.rugby.api-sports.io`)
with the server-only `API_SPORTS_KEY`. The adapter accepts a recorded payload for
deterministic tests and accepts `RUGBY_COMPETITION_IDS` as a JSON launch-manifest
override. It refuses to invent IDs for the four competitions whose provider IDs
have not been verified.

Required verified slugs:

- `six-nations`
- `united-rugby-championship`
- `rugby-championship`
- `premiership-rugby`
- `champions-cup`

The local release gate is currently blocked because Docker/Postgres is not running
and no direct API-Sports key is present in this workspace. Configure the key and
record the sanitized `/status`, `/leagues`, `/teams`, and `/games` responses before
activating additional competitions.

