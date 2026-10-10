import json
import sqlite3
import sys

statements = []
pending = ""
for line in sys.stdin:
    pending += line
    if sqlite3.complete_statement(pending):
        statements.append(pending.strip())
        pending = ""
if pending.strip():
    raise SystemExit("Incomplete SQL statement")
json.dump(statements, sys.stdout)
