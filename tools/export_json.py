#!/usr/bin/env python3
"""把 Oracle Cloud 数据库（或 REST 接口）里的四张表导出成站点用的 data/*.json。

用法（本地）：
    python tools/export_json.py --parquet ../tmp_src/out
    ORACLE_USER=... ORACLE_PASSWORD=... ORACLE_DSN=... python tools/export_json.py
    RENJU_API_BASE=https://xxx.oraclecloudapps.com/ords/xxx/renju python tools/export_json.py

数据源优先级：--parquet 目录 > Oracle 直连 > REST 接口。
"""

import argparse
import base64
import json
import os
import sys
import tempfile
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
DATA = os.path.join(SITE, "data")

BYE_NAME = "轮空"

SQL = {
    "games": """
        SELECT id, game_id, TO_CHAR("DATE", 'YYYY-MM-DD') AS game_date, rule,
               first_id, second_id, result, tournament_id,
               "ROUND" AS rnd, board, game_no
        FROM renju_prematch
    """,
    "tournament": "SELECT tournament_id, name FROM tournament",
    "player": "SELECT player_id, name FROM player",
    "tournament_player": "SELECT tournament_id, player_id, internal_id FROM tournament_player",
}


def read_parquet(folder):
    import pandas as pd

    g = pd.read_parquet(os.path.join(folder, "renju_prematch.parquet"))
    p = pd.read_parquet(os.path.join(folder, "player.parquet"))
    t = pd.read_parquet(os.path.join(folder, "tournament.parquet"))
    tp = pd.read_parquet(os.path.join(folder, "tournament_player.parquet"))

    games = []
    for r in g.itertuples(index=False):
        games.append({
            "id": int(r.id),
            "game_id": r.game_id,
            "date": str(r.date)[:10],
            "rule": r.rule,
            "first_id": None if pd.isna(r.first_id) else int(r.first_id),
            "second_id": None if pd.isna(r.second_id) else int(r.second_id),
            "result": r.result,
            "tournament_id": int(r.tournament_id),
            "round": int(r.round),
            "board": int(r.board),
            "game_no": int(r.game_no),
        })
    players = [{"player_id": int(r.player_id), "name": r.name} for r in p.itertuples(index=False)]
    tours = [{"tournament_id": int(r.tournament_id), "name": r.name} for r in t.itertuples(index=False)]
    members = [{"tournament_id": int(r.tournament_id), "player_id": int(r.player_id)}
               for r in tp.itertuples(index=False)]
    return games, players, tours, members


def read_oracle():
    import oracledb

    wallet_b64 = os.environ.get("ORACLE_WALLET_B64", "")
    user = os.environ["ORACLE_USER"]
    password = os.environ["ORACLE_PASSWORD"]
    dsn = os.environ.get("ORACLE_DSN", "")

    params = {"user": user, "password": password}
    if wallet_b64:
        wallet_dir = os.path.join(tempfile.mkdtemp(), "wallet")
        os.makedirs(wallet_dir, exist_ok=True)
        for name, blob in json.loads(base64.b64decode(wallet_b64)).items():
            with open(os.path.join(wallet_dir, name), "wb") as fh:
                fh.write(base64.b64decode(blob))
        os.environ["TNS_ADMIN"] = wallet_dir
        params["config_dir"] = wallet_dir
        params["wallet_location"] = wallet_dir
        if os.environ.get("ORACLE_WALLET_PASSWORD"):
            params["wallet_password"] = os.environ["ORACLE_WALLET_PASSWORD"]
        dsn = dsn or os.environ.get("ORACLE_ALIAS", "")
    if dsn:
        params["dsn"] = dsn

    con = oracledb.connect(**params)
    cur = con.cursor()
    cur.execute(SQL["games"])
    games = []
    for row in cur:
        games.append({
            "id": int(row[0]),
            "game_id": row[1],
            "date": str(row[2])[:10],
            "rule": row[3],
            "first_id": None if row[4] is None else int(row[4]),
            "second_id": None if row[5] is None else int(row[5]),
            "result": row[6],
            "tournament_id": int(row[7]),
            "round": int(row[8]),
            "board": int(row[9]),
            "game_no": int(row[10]),
        })
    cur.execute(SQL["player"])
    players = [{"player_id": int(r[0]), "name": r[1]} for r in cur]
    cur.execute(SQL["tournament"])
    tours = [{"tournament_id": int(r[0]), "name": r[1]} for r in cur]
    cur.execute(SQL["tournament_player"])
    members = [{"tournament_id": int(r[0]), "player_id": int(r[1])} for r in cur]
    cur.close()
    con.close()
    return games, players, tours, members


def read_rest():
    base = os.environ["RENJU_API_BASE"].rstrip("/")
    token = os.environ.get("RENJU_TOKEN", "")

    def get(path):
        req = urllib.request.Request(base + "/" + path, headers={"Accept": "application/json"})
        if token:
            req.add_header("Authorization", "Bearer " + token)
        with urllib.request.urlopen(req, timeout=60) as res:
            payload = json.loads(res.read().decode("utf-8"))
        for key in ("items", "rows", "data", "results", "response"):
            if isinstance(payload, dict) and isinstance(payload.get(key), list):
                return payload[key]
        return payload if isinstance(payload, list) else []

    games = []
    for r in get("games"):
        games.append({
            "id": int(r["id"]),
            "game_id": r["game_id"],
            "date": str(r.get("date") or r.get("game_date") or "")[:10],
            "rule": r.get("rule"),
            "first_id": None if r.get("first_id") in (None, "") else int(r["first_id"]),
            "second_id": None if r.get("second_id") in (None, "") else int(r["second_id"]),
            "result": r.get("result"),
            "tournament_id": int(r["tournament_id"]),
            "round": int(r["round"]),
            "board": int(r["board"]),
            "game_no": int(r.get("game_no") or 1),
        })
    players = [{"player_id": int(r["player_id"]), "name": r["name"]} for r in get("players")]
    tours = [{"tournament_id": int(r["tournament_id"]), "name": r["name"]} for r in get("tournaments")]
    members = [{"tournament_id": int(r["tournament_id"]), "player_id": int(r["player_id"])}
               for r in get("tournament_players")]
    return games, players, tours, members


def build(games, players, tours, members):
    name = {p["player_id"]: p["name"] for p in players}
    tour_name = {t["tournament_id"]: t["name"] for t in tours}
    bye_id = next((p["player_id"] for p in players if str(p["name"]).strip() in ("轮空", "+")), None)

    games_out = []
    for g in games:
        second = "" if g["second_id"] is None else name.get(g["second_id"], "")
        result = g["result"]
        if second in ("+", ""):
            second = BYE_NAME
        if second == BYE_NAME:
            result = "+-"
        games_out.append({
            "id": g["id"],
            "game_id": g["game_id"],
            "date": g["date"],
            "rule": g["rule"],
            "first": name.get(g["first_id"], ""),
            "second": second,
            "result": result,
            "tournament_id": g["tournament_id"],
            "tournament": tour_name.get(g["tournament_id"], ""),
            "round": g["round"],
            "board": g["board"],
            "game_no": g["game_no"],
        })
    games_out.sort(key=lambda r: (r["date"], r["round"], -r["board"]), reverse=True)

    by_tour = {}
    for g in games_out:
        by_tour.setdefault(g["tournament_id"], []).append(g)
    tour_players = {}
    mine_tours = {}
    for m in members:
        tour_players[m["tournament_id"]] = tour_players.get(m["tournament_id"], 0) + 1
        mine_tours.setdefault(m["player_id"], set()).add(m["tournament_id"])

    tours_out = []
    for tid, rows in by_tour.items():
        dates = [r["date"] for r in rows]
        tours_out.append({
            "tournament_id": tid,
            "name": tour_name.get(tid, ""),
            "start_date": min(dates),
            "end_date": max(dates),
            "players": tour_players.get(tid, 0),
            "games": len(rows),
        })
    tours_out.sort(key=lambda r: r["start_date"], reverse=True)

    players_out = []
    for p in players:
        if str(p["name"]).strip() in (BYE_NAME, "+"):
            continue
        mine = [g for g in games_out if g["first"] == p["name"] or g["second"] == p["name"]]
        tours_of_mine = mine_tours.get(p["player_id"], set())
        if not mine and not tours_of_mine:
            continue
        players_out.append({
            "player_id": p["player_id"],
            "name": p["name"],
            "tournaments": len(tours_of_mine),
            "games": len(mine),
        })
    players_out.sort(key=lambda r: (-r["games"], -r["tournaments"], r["name"]))
    return games_out, tours_out, players_out


def dump(obj, name, compact=True):
    path = os.path.join(DATA, name)
    with open(path, "w", encoding="utf-8") as fh:
        if compact:
            json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, fh, ensure_ascii=False, indent=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--parquet", help="从本地 parquet 目录导出（离线测试用）")
    args = ap.parse_args()

    if args.parquet:
        games, players, tours, members = read_parquet(args.parquet)
    elif os.environ.get("ORACLE_USER"):
        games, players, tours, members = read_oracle()
    elif os.environ.get("RENJU_API_BASE"):
        games, players, tours, members = read_rest()
    else:
        print("未配置数据源（ORACLE_* 或 RENJU_API_BASE），本次跳过")
        return 0

    games_out, tours_out, players_out = build(games, players, tours, members)
    os.makedirs(DATA, exist_ok=True)
    dump(games_out, "games.json")
    dump(tours_out, "tournaments.json")
    dump(players_out, "players.json")
    print("games", len(games_out), "tournaments", len(tours_out), "players", len(players_out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
