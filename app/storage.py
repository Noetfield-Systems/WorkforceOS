"""WorkforceOS customer-owned persistent data; never a second model executor."""
from __future__ import annotations
import hashlib
import hmac
import os
import re
import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import psycopg
from psycopg.rows import dict_row

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$")
USER_ID_RE = re.compile(r"^wos_[a-f0-9]{24}$")


def uid(prefix="wos"):
    return f"{prefix}_{secrets.token_hex(12)}"


@contextmanager
def database():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not configured")
    with psycopg.connect(url, connect_timeout=8, row_factory=dict_row) as db:
        yield db


def initialize():
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS accounts (
            id text PRIMARY KEY, email text UNIQUE NOT NULL,
            passhash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS sessions (
            token_hash text PRIMARY KEY, account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            csrf_token text NOT NULL, expires_at timestamptz NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS workspaces (
            id text PRIMARY KEY, account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            name text NOT NULL, mission text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS teams (
            id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            name text NOT NULL, mission text NOT NULL, template text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS agents (
            id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            name text NOT NULL, role text NOT NULL, instructions text NOT NULL,
            monthly_budget numeric(9,2) NOT NULL DEFAULT 2,
            enabled boolean NOT NULL DEFAULT true,
            fabric_id text, sync_state text NOT NULL DEFAULT 'NOT_CONNECTED',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS wos_agents_team_idx ON agents(workspace_id,team_id)""")
        db.execute("""CREATE TABLE IF NOT EXISTS tickets (
            id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            agent_id text NOT NULL REFERENCES agents(id),
            request_id text NOT NULL, title text NOT NULL, instructions text NOT NULL,
            fabric_id text, state text NOT NULL DEFAULT 'DRAFT',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE(workspace_id,request_id)
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS feedback (
            id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            ticket_id text NOT NULL REFERENCES tickets(id),
            body text NOT NULL, fabric_revision_id text,
            state text NOT NULL DEFAULT 'NOT_DISPATCHED',
            created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS product_feedback (
            id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS activity (
            id bigserial PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            event_type text NOT NULL, subject_id text, detail text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS wos_activity_workspace_idx ON activity(workspace_id,id DESC)""")
        db.execute("""CREATE TABLE IF NOT EXISTS knowledge_documents (
            id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            title text NOT NULL, content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS wos_knowledge_workspace_idx
                      ON knowledge_documents(workspace_id,created_at DESC)""")
        db.execute("""CREATE TABLE IF NOT EXISTS task_knowledge (
            ticket_id text NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
            document_id text NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
            workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            PRIMARY KEY(ticket_id,document_id)
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS billing_subscriptions (
            workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
            stripe_customer_id text UNIQUE, stripe_subscription_id text UNIQUE,
            stripe_price_id text, plan text NOT NULL DEFAULT 'free',
            status text NOT NULL DEFAULT 'inactive',
            current_period_end timestamptz,
            updated_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS billing_webhook_events (
            event_id text PRIMARY KEY, event_type text NOT NULL,
            processed_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS team_missions (
            id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            team_id text NOT NULL REFERENCES teams(id), title text NOT NULL,
            objective text NOT NULL, request_id text NOT NULL,
            state text NOT NULL DEFAULT 'ACTIVE',
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE(workspace_id,request_id)
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS mission_steps (
            mission_id text NOT NULL REFERENCES team_missions(id) ON DELETE CASCADE,
            workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            position integer NOT NULL, agent_id text NOT NULL REFERENCES agents(id),
            title text NOT NULL, instructions text NOT NULL, ticket_id text REFERENCES tickets(id),
            PRIMARY KEY(mission_id,position)
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS mission_steps_tenant_idx
                      ON mission_steps(workspace_id,mission_id)""")
        db.execute("""CREATE TABLE IF NOT EXISTS auth_limits (
            bucket text PRIMARY KEY, count integer NOT NULL, window_start timestamptz NOT NULL
        )""")


def hashed_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return "scrypt$" + salt.hex() + "$" + digest.hex()


def password_matches(password, stored):
    try:
        name, salt_hex, digest_hex = stored.split("$", 2)
        if name != "scrypt":
            return False
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt_hex),
                                n=2**14, r=8, p=1, dklen=32)
        return hmac.compare_digest(actual, expected)
    except (ValueError, AttributeError):
        return False


def email_normalize(value):
    value = value.strip().lower()
    if not EMAIL_RE.fullmatch(value) or len(value) > 254:
        raise ValueError("Enter a valid email address")
    return value


def issue_session(db, account_id):
    raw = secrets.token_urlsafe(36)
    csrf = secrets.token_urlsafe(24)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    db.execute("INSERT INTO sessions(token_hash,account_id,csrf_token,expires_at) VALUES (%s,%s,%s,%s)",
               (token_hash, account_id, csrf, datetime.now(timezone.utc) + timedelta(days=14)))
    return raw, csrf


def account_for_session(db, raw):
    if not raw or len(raw) > 256:
        return None
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return db.execute("""SELECT s.token_hash,s.csrf_token,a.id AS account_id,a.email,
                         w.id AS workspace_id,w.name AS workspace_name,w.mission AS workspace_mission
                         FROM sessions s
                         JOIN accounts a ON a.id=s.account_id
                         JOIN workspaces w ON w.account_id=a.id
                         WHERE s.token_hash=%s AND s.expires_at>now()
                         ORDER BY w.created_at LIMIT 1""", (digest,)).fetchone()


def auth_rate_limit(db, bucket, threshold=8):
    # Database atomic limiter, shared across app replicas. No raw IP or email stored.
    now = datetime.now(timezone.utc)
    row = db.execute("""INSERT INTO auth_limits(bucket,count,window_start)
        VALUES (%s,1,%s)
        ON CONFLICT(bucket) DO UPDATE SET
            count=CASE WHEN auth_limits.window_start<%s THEN 1 ELSE auth_limits.count+1 END,
            window_start=CASE WHEN auth_limits.window_start<%s THEN %s ELSE auth_limits.window_start END
        RETURNING count""",
        (bucket,now,now-timedelta(minutes=15),now-timedelta(minutes=15),now)).fetchone()
    return row["count"] <= threshold


def event(db, workspace_id, code, target=None, detail=""):
    db.execute("""INSERT INTO activity(workspace_id,event_type,subject_id,detail)
                  VALUES (%s,%s,%s,%s)""", (workspace_id, code, target, detail[:140]))


def public_row(row, fields):
    if not row:
        return None
    return {key:(row[key].isoformat() if isinstance(row[key], datetime) else
                 float(row[key]) if key=="monthly_budget" else row[key])
            for key in fields if key in row}
