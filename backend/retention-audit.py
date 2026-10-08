"""Read-only retention eligibility report. Does not implement deletion.

Chosen policy: comments one UTC calendar year; pageviews 30 days.
No comment bodies/names, account data, or individual analytics are printed.
"""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3


def cutoffs(now):
    if now.tzinfo is None:
        raise ValueError("UTC_REQUIRED")
    now = now.astimezone(timezone.utc)
    # Calendar year, not silently 365 days; leap day becomes February 28.
    try:
        year_ago = now.replace(year=now.year - 1)
    except ValueError:
        year_ago = now.replace(year=now.year - 1, day=28)
    return {"singer_comments": int(year_ago.timestamp() * 1000),
            "pageviews": int((now - timedelta(days=30)).timestamp() * 1000)}


def retention_report(database, now=None):
    now = now or datetime.now(timezone.utc)
    path = Path(database)
    if not path.is_absolute() or path.is_symlink() or not path.is_file():
        raise ValueError("INVALID_DATABASE_PATH")
    db = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=3)
    try:
        db.execute("PRAGMA query_only=ON")
        # A single read snapshot makes both counts mutually consistent.
        db.execute("BEGIN")
        return report_connection(db, now)
    finally:
        db.close()


def report_connection(db, now):
    """Caller owns the transaction; fixed tables/scope shared with the cleanup job."""
    limits = cutoffs(now)
    now_ms = int(now.timestamp() * 1000)
    report = {"readOnly": True, "asOf": now.astimezone(timezone.utc).isoformat(), "tables": {}}
    for table, limit in limits.items():
        schema = db.execute("SELECT type FROM sqlite_master WHERE name=?", (table,)).fetchone()
        if schema != ("table",):
            raise ValueError("INVALID_RETENTION_TABLE")
        valid = "typeof(created_at)='integer' AND created_at>0 AND created_at<=?"
        # The shared database holds other POMYJO sites: fixed production scope only.
        scope = "site='choeae-plaza' AND " if table == "pageviews" else ""
        eligible = db.execute(f"SELECT COUNT(*) FROM {table} WHERE {scope}{valid} AND created_at<?", (now_ms, limit)).fetchone()[0]
        total = db.execute(f"SELECT COUNT(*) FROM {table}" + (" WHERE site='choeae-plaza'" if scope else "")).fetchone()[0]
        invalid = db.execute(f"SELECT COUNT(*) FROM {table} WHERE {scope}(NOT ({valid}) OR created_at IS NULL)", (now_ms,)).fetchone()[0]
        report["tables"][table] = {"eligible": eligible, "total": total, "invalidTimestamp": invalid, "cutoffMs": limit,
                                   "scope": "site=choeae-plaza" if scope else "singer_comments"}
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(retention_report(args.db), separators=(",", ":")))
    except (ValueError, sqlite3.Error, OSError):
        print(json.dumps({"error": "RETENTION_AUDIT_FAILED"}))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
