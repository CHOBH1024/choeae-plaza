"""Read-only, bounded existence check for an operator-approved comment request.

Never dumps comment bodies/names, creates a database, or deletes data.
Run on the server with its existing Python 3; this is not a public endpoint.
"""
import argparse
import json
from pathlib import Path
import re
import sqlite3


def inspect_comments(database, raw_ids):
    if not isinstance(raw_ids, str) or not re.fullmatch(r"[1-9][0-9]*(?:,[1-9][0-9]*){0,49}", raw_ids):
        raise ValueError("INVALID_IDS")
    ids = [int(value) for value in raw_ids.split(",")]
    if len(set(ids)) != len(ids) or any(value > 9007199254740991 for value in ids):
        raise ValueError("INVALID_IDS")
    path = Path(database)
    if not path.is_absolute() or path.is_symlink() or not path.is_file():
        raise ValueError("INVALID_DATABASE_PATH")
    connection = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=3)
    try:
        connection.execute("PRAGMA query_only=ON")
        table = connection.execute(
            "SELECT type FROM sqlite_master WHERE name=?", ("singer_comments",)
        ).fetchone()
        if table != ("table",):
            raise ValueError("INVALID_COMMENT_TABLE")
        slots = ",".join("?" for _ in ids)
        found = {row[0] for row in connection.execute(
            "SELECT id FROM singer_comments WHERE id IN (" + slots + ")", ids
        )}
        return {"readOnly": True, "requested": len(ids), "found": len(found),
                "missingIds": [value for value in ids if value not in found]}
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True)
    parser.add_argument("--ids", required=True, help="1–50 distinct positive numeric IDs")
    args = parser.parse_args()
    try:
        print(json.dumps(inspect_comments(args.db, args.ids), separators=(",", ":")))
    except (ValueError, sqlite3.Error, OSError):
        # Do not print paths, database content, SQL errors or request input.
        print(json.dumps({"error": "COMMENT_AUDIT_FAILED"}))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
