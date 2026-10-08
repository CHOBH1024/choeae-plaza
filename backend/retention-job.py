"""Scoped retention cleanup; dry-run unless --apply is explicitly provided.

Deploy/enable only after approval of permanent recurring deletion.
No credential values, names, bodies or individual visits are emitted.
"""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import sqlite3

spec = importlib.util.spec_from_file_location("retention_audit", Path(__file__).with_name("retention-audit.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def cleanup(database, apply=False, now=None, max_rows=5000):
    now = now or datetime.now(timezone.utc)
    if not isinstance(max_rows, int) or isinstance(max_rows, bool) or not 1 <= max_rows <= 5000:
        raise ValueError("INVALID_LIMIT")
    if not apply:
        return audit.retention_report(database, now)
    path = Path(database)
    if not path.is_absolute() or path.is_symlink() or not path.is_file():
        raise ValueError("INVALID_DATABASE_PATH")
    db = sqlite3.connect(path.resolve().as_uri() + "?mode=rw", uri=True, timeout=3)
    try:
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("BEGIN IMMEDIATE")
        report = audit.report_connection(db, now)
        targets = set(report["tables"])
        # Refuse unfamiliar side effects instead of cascading into other data.
        if db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'").fetchone()[0]:
            raise ValueError("TRIGGERS_REQUIRE_REVIEW")
        for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'"):
            table = row[0].replace('"', '""')
            if any(fk[2] in targets for fk in db.execute(f'PRAGMA foreign_key_list("{table}")')):
                raise ValueError("CASCADE_REQUIRES_REVIEW")
        for entry in report["tables"].values():
            if entry["invalidTimestamp"]:
                raise ValueError("INVALID_TIMESTAMPS_REQUIRE_REVIEW")
            if entry["eligible"] > max_rows:
                raise ValueError("LIMIT_REQUIRES_REVIEW")
        now_ms = int(now.timestamp() * 1000)
        deleted = {}
        for table, entry in report["tables"].items():
            scope = "site='choeae-plaza' AND " if table == "pageviews" else ""
            cursor = db.execute(
                f"DELETE FROM {table} WHERE {scope}typeof(created_at)='integer' AND created_at>0 AND created_at<=? AND created_at<?",
                (now_ms, entry["cutoffMs"]),
            )
            if cursor.rowcount != entry["eligible"]:
                raise ValueError("COUNT_CHANGED")
            deleted[table] = cursor.rowcount
        db.commit()
        return {"readOnly": False, "asOf": report["asOf"], "deleted": deleted,
                "scope": "singer_comments; pageviews.site=choeae-plaza"}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--max-rows", type=int, default=5000)
    args = parser.parse_args()
    try:
        print(json.dumps(cleanup(args.db, args.apply, max_rows=args.max_rows), separators=(",", ":")))
    except (ValueError, sqlite3.Error, OSError):
        print(json.dumps({"error": "RETENTION_JOB_FAILED"}))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
