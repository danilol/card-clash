-- Up Migration
CREATE TABLE matches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_one_nickname TEXT NOT NULL,
  player_two_nickname TEXT NOT NULL,
  winner_nickname TEXT NOT NULL,
  end_reason TEXT NOT NULL,
  rounds_played INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_created_at ON matches (created_at DESC);

-- Down Migration
DROP TABLE matches;
