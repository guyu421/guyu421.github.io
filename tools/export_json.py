#!/usr/bin/env python3
"""把 db/ 目录下的四张 parquet 表导出成站点用的 data/*.json。

用法：
    python tools/export_json.py                 # 读仓库内 db/
    python tools/export_json.py --parquet dir   # 读指定目录
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
DATA = os.path.join(SITE, "data")
DB = os.path.join(SITE, "db")

BYE_NAME = "轮空"


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


def build(games, players, tours, members):
    name = {p["player_id"]: p["name"] for p in players}
    tour_name = {t["tournament_id"]: t["name"] for t in tours}

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
    # 同一天先按赛事分块（同一赛事的对局连在一起，不与其他赛事穿插），
    # 赛事内轮次从新到旧、台次从小到大
    games_out.sort(key=lambda r: (-int(str(r["date"]).replace("-", "") or 0),
                                  r["tournament_id"], -r["round"], r["board"]))

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
    ap.add_argument("--parquet", default=DB, help="parquet 目录，默认仓库内 db/")
    args = ap.parse_args()

    if not os.path.isdir(args.parquet):
        print("找不到 parquet 目录：%s" % args.parquet, file=sys.stderr)
        return 1

    games, players, tours, members = read_parquet(args.parquet)
    games_out, tours_out, players_out = build(games, players, tours, members)
    os.makedirs(DATA, exist_ok=True)
    dump(games_out, "games.json")
    dump(tours_out, "tournaments.json")
    dump(players_out, "players.json")
    print("games", len(games_out), "tournaments", len(tours_out), "players", len(players_out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
