#!/usr/bin/env python3
"""
Dimomat — Supabase Free Tier Monitor
Checks usage across DB, storage, tables, and edge functions.
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# ─── CONFIG — lee desde .env o variables de entorno ────────────────────────────
def _load_env():
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    os.environ.setdefault(key.strip(), val.strip())

_load_env()

PROJECT_REF    = os.environ.get("SUPABASE_PROJECT_REF", "")
SUPABASE_URL   = f"https://{PROJECT_REF}.supabase.co"
MGMT_TOKEN     = os.environ.get("SUPABASE_MGMT_TOKEN", "")
SERVICE_KEY    = os.environ.get("SUPABASE_SERVICE_KEY", "")
STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "bolis-images")

if not all([PROJECT_REF, MGMT_TOKEN, SERVICE_KEY]):
    print("Error: faltan variables de entorno. Crea scripts/.env con:")
    print("  SUPABASE_PROJECT_REF=...")
    print("  SUPABASE_MGMT_TOKEN=...")
    print("  SUPABASE_SERVICE_KEY=...")
    sys.exit(1)

# ─── FREE TIER LIMITS ───────────────────────────────────────────────────────────
LIMITS = {
    "database_mb":        500,      # 500 MB
    "storage_mb":         1024,     # 1 GB
    "edge_invocations":   500_000,  # per month
    "auth_users":         50_000,
    "realtime_messages":  2_000_000,# per month
}

# ─── THRESHOLDS ────────────────────────────────────────────────────────────────
WARN  = 70   # yellow
CRIT  = 90   # red

# ─── COLORS ────────────────────────────────────────────────────────────────────
class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    GREEN  = "\033[32m"
    YELLOW = "\033[33m"
    RED    = "\033[31m"
    CYAN   = "\033[36m"
    WHITE  = "\033[97m"
    GRAY   = "\033[90m"
    BG_RED = "\033[41m"

def color_pct(pct):
    if pct >= CRIT:  return C.RED
    if pct >= WARN:  return C.YELLOW
    return C.GREEN

def progress_bar(pct, width=30):
    filled = int(width * pct / 100)
    bar = "█" * filled + "░" * (width - filled)
    col = color_pct(pct)
    return f"{col}{bar}{C.RESET}"

def fmt_mb(mb):
    if mb >= 1024: return f"{mb/1024:.2f} GB"
    if mb >= 1:    return f"{mb:.2f} MB"
    return f"{mb*1024:.0f} KB"

# ─── HTTP HELPERS ───────────────────────────────────────────────────────────────
def get(url, headers):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read()), r.headers
    except urllib.error.HTTPError as e:
        return None, None

def post(url, headers, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read()), r.headers
    except urllib.error.HTTPError:
        return None, None

def delete(url, headers, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read()), r.headers
    except urllib.error.HTTPError:
        return None, None

def head_count(table):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=count"
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Prefer": "count=exact",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            cr = r.headers.get("content-range", "0/0")
            total = cr.split("/")[-1]
            return int(total) if total.isdigit() else 0
    except Exception:
        return 0

# ─── CHECKS ─────────────────────────────────────────────────────────────────────
def check_storage():
    url = f"{SUPABASE_URL}/storage/v1/object/list/{STORAGE_BUCKET}"
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    data, _ = post(url, headers, {"prefix": "", "limit": 1000, "offset": 0})
    if not data:
        return None, 0, []

    total_bytes = sum(f.get("metadata", {}).get("size", 0) for f in data)
    total_mb = total_bytes / 1024 / 1024
    files = [(f["name"], f.get("metadata", {}).get("size", 0)) for f in data]
    return total_mb, len(files), files

def check_tables():
    tables = ["orders", "flavors", "categories"]
    return {t: head_count(t) for t in tables}

def check_edge_functions():
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/functions"
    headers = {"Authorization": f"Bearer {MGMT_TOKEN}"}
    data, _ = get(url, headers)
    if not data:
        return []
    return [{"name": f["name"], "status": f.get("status", "?")} for f in data]

def check_db_size():
    """Estimate DB size via pg_relation_size of main tables."""
    # Supabase doesn't expose pg_database_size via REST directly,
    # but we can estimate from table row counts and known schema.
    # For a more accurate reading, visit Dashboard > Reports > Database.
    # Here we return a conservative estimate.
    orders_count = head_count("orders")
    flavors_count = head_count("flavors")
    # Rough estimate: orders ~2KB each (JSONB items), flavors ~500B
    estimated_bytes = (orders_count * 2048) + (flavors_count * 512) + (1024 * 1024 * 7)  # +7MB overhead
    return estimated_bytes / 1024 / 1024

def check_auth_users():
    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/users?page=1&per_page=1"
    headers = {"Authorization": f"Bearer {MGMT_TOKEN}"}
    data, _ = get(url, headers)
    if data and isinstance(data, dict):
        return data.get("total", 1)
    return 1  # at least 1 admin

# ─── DISPLAY ────────────────────────────────────────────────────────────────────
def section(title):
    print(f"\n{C.CYAN}{C.BOLD}{'─'*54}{C.RESET}")
    print(f"{C.CYAN}{C.BOLD}  {title}{C.RESET}")
    print(f"{C.CYAN}{'─'*54}{C.RESET}")

def metric(label, used, limit, unit="", extra=""):
    pct = min((used / limit) * 100, 100) if limit else 0
    col = color_pct(pct)
    bar = progress_bar(pct)
    label_pad = f"{label:<28}"
    status = f"{col}{C.BOLD}{pct:5.1f}%{C.RESET}"
    print(f"  {C.WHITE}{label_pad}{C.RESET} {bar} {status}")
    print(f"  {C.GRAY}{'':28} {used:.1f}{unit} / {limit}{unit}{f'  {extra}' if extra else ''}{C.RESET}")

def info_row(label, value, note=""):
    print(f"  {C.WHITE}{label:<28}{C.RESET} {C.BOLD}{value}{C.RESET}  {C.GRAY}{note}{C.RESET}")

# ─── MAIN ────────────────────────────────────────────────────────────────────────
def main():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print(f"\n{C.BOLD}{C.WHITE}{'═'*54}{C.RESET}")
    print(f"{C.BOLD}{C.WHITE}  🧊 Dimomat — Supabase Free Tier Monitor{C.RESET}")
    print(f"{C.BOLD}{C.WHITE}  {now}{C.RESET}")
    print(f"{C.BOLD}{C.WHITE}{'═'*54}{C.RESET}")

    # Storage
    section("📦 Storage")
    storage_mb, file_count, files = check_storage()
    if storage_mb is not None:
        metric("Total storage", storage_mb, LIMITS["storage_mb"], " MB")
        info_row("Files in bucket", str(file_count), "")
        if files:
            largest = sorted(files, key=lambda x: x[1], reverse=True)[:3]
            print(f"\n  {C.GRAY}  Top 3 largest files:{C.RESET}")
            for name, size in largest:
                short = name[:40] + "…" if len(name) > 40 else name
                print(f"  {C.GRAY}    {short:<44} {fmt_mb(size/1024/1024)}{C.RESET}")
    else:
        print(f"  {C.RED}  Could not fetch storage data{C.RESET}")

    # Database
    section("🗄️  Database")
    db_mb = check_db_size()
    metric("Database size (est.)", db_mb, LIMITS["database_mb"], " MB",
           "exact value in Dashboard > Reports")

    # Tables
    section("📋 Table Row Counts")
    tables = check_tables()
    for table, count in tables.items():
        info_row(f"  {table}", f"{count:,} rows", "")

    # Edge Functions
    section("⚡ Edge Functions")
    functions = check_edge_functions()
    if functions:
        for fn in functions:
            status_col = C.GREEN if fn["status"] == "ACTIVE" else C.YELLOW
            info_row(f"  {fn['name']}", f"{status_col}{fn['status']}{C.RESET}", "")
    print(f"\n  {C.GRAY}  Invocations this month: check Dashboard > Edge Functions{C.RESET}")
    print(f"  {C.GRAY}  Free limit: {LIMITS['edge_invocations']:,} / month{C.RESET}")

    # Auth
    section("👤 Auth Users")
    auth_users = check_auth_users()
    metric("Auth users", auth_users, LIMITS["auth_users"])

    # Summary
    section("📊 Summary")
    checks = [
        ("Storage",  (storage_mb or 0) / LIMITS["storage_mb"] * 100),
        ("Database", db_mb / LIMITS["database_mb"] * 100),
        ("Auth",     auth_users / LIMITS["auth_users"] * 100),
    ]
    any_warn = any(pct >= WARN for _, pct in checks)
    any_crit = any(pct >= CRIT for _, pct in checks)

    if any_crit:
        print(f"\n  {C.RED}{C.BOLD}  ⚠️  CRITICAL: One or more resources above {CRIT}%!{C.RESET}")
    elif any_warn:
        print(f"\n  {C.YELLOW}{C.BOLD}  ⚠️  WARNING: One or more resources above {WARN}%{C.RESET}")
    else:
        print(f"\n  {C.GREEN}{C.BOLD}  ✅  All resources well within free tier limits{C.RESET}")

    for label, pct in checks:
        col = color_pct(pct)
        print(f"  {C.GRAY}    {label:<14}{col}{pct:.1f}%{C.RESET}")

    print(f"\n  {C.GRAY}  Full usage dashboard: https://supabase.com/dashboard/project/{PROJECT_REF}/reports{C.RESET}")
    print(f"\n{C.BOLD}{'═'*54}{C.RESET}\n")

if __name__ == "__main__":
    main()
