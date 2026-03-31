#!/usr/bin/env python3
"""
Small helper to count keys under devices/device1/history using admin SDK.
Usage:
  - set FIREBASE_CREDS to path-of-service-account.json (or pass path as first arg)
  - set FIREBASE_DATABASE_URL if different from default
  - run: python check_history.py
"""
import os
import sys

from firebase_admin import credentials, initialize_app, db

cred_path = os.getenv('FIREBASE_CREDS') or (sys.argv[1] if len(sys.argv) > 1 else None)
if not cred_path:
    print('ERROR: set FIREBASE_CREDS env var or pass path to service account as first arg')
    sys.exit(2)

db_url = os.getenv('FIREBASE_DATABASE_URL') or 'https://iot-esp32-zegar-default-rtdb.europe-west1.firebasedatabase.app'

try:
    cred = credentials.Certificate(cred_path)
    initialize_app(cred, {'databaseURL': db_url})
except Exception as e:
    print('ERROR initializing firebase admin:', e)
    sys.exit(3)

ref = db.reference('devices/device1/history')
try:
    # Try to fetch a large window (limit to last 10000 keys) to count existing entries
    snap = ref.order_by_key().limit_to_last(10000).get()
except Exception as e:
    print('ERROR reading from RTDB:', e)
    sys.exit(4)

if not snap:
    print('No entries found or read access denied (returned None/empty).')
    sys.exit(0)

keys = list(snap.keys())
print('Loaded keys count:', len(keys))
print('Sample keys (first 10):')
for k in keys[:10]:
    print(' -', k)

# attempt to inspect timestamps of first/last entries if possible
try:
    # get first key and last key
    first_key = keys[0]
    last_key = keys[-1]
    first_val = snap[first_key]
    last_val = snap[last_key]
    def extract_ts(v):
        if not v:
            return None
        if isinstance(v, dict):
            return v.get('ts') or v.get('device_ts')
        return None
    print('\nTimestamps:')
    print(' first:', extract_ts(first_val))
    print(' last :', extract_ts(last_val))
except Exception:
    pass
