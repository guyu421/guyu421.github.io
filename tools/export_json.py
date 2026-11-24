#!/usr/bin/env python3
"""把 db/ 目录下的四张 parquet 表导出成站点用的 data/*.json。

用法：
    python tools/export_json.py                 # 读仓库内 db/
    python tools/export_json.py --parquet dir   # 读指定目录
"""

import argparse
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
DATA = os.path.join(SITE, "data")
DB = os.path.join(SITE, "db")

BYE_NAME = "轮空"

# Glicko-2 参数：初始分 1500、初始 RD 350、初始波动率 0.06、系统常数 tau 0.5
G2_SCALE = 173.7178
G2_RATING = 1500.0
G2_RD = 350.0
G2_SIGMA = 0.06
G2_TAU = 0.5

# 轮空 / 弃权在数据库里统一记 "+-"、"-+"、"--"，不写 "-:-" 这种带冒号的写法
RESULT_ALIAS = {
    "-:-": "--",
    "---": "--",
    "--:--": "--",
    "-:+": "-+",
    "+:-": "+-",
}

# 只统计真正下过的对局：轮空（+-）与弃权（-+、--）不计入等级分
POINTS = {"1": 1.0, "0": 0.0, "0.5": 0.5}


def normalize_result(value):
    if value is None:
        return value
    text = str(value).strip()
    text = text.replace("：", ":").replace("−", "-").replace("－", "-").replace("＋", "+")
    return RESULT_ALIAS.get(text, text)


def _display(value):
    """等级分与偏差统一保留一位小数（正好是整数也写 .0）。"""
    return round(float(value), 1)


def _g(phi):
    return 1.0 / math.sqrt(1.0 + 3.0 * phi * phi / (math.pi ** 2))


def _expect(mu, mu_j, phi_j):
    return 1.0 / (1.0 + math.exp(-_g(phi_j) * (mu - mu_j)))


def _volatility(phi, sigma, v, delta, tau=G2_TAU, eps=1e-6):
    a = math.log(sigma * sigma)

    def f(x):
        ex = math.exp(x)
        d2 = phi * phi + v + ex
        return (ex * (delta * delta - phi * phi - v - ex)) / (2.0 * d2 * d2) - (x - a) / (tau * tau)

    A = a
    if delta * delta > phi * phi + v:
        B = math.log(delta * delta - phi * phi - v)
    else:
        k = 1
        while f(a - k * tau) < 0:
            k += 1
        B = a - k * tau
    fa, fb = f(A), f(B)
    while abs(B - A) > eps:
        C = A + (A - B) * fa / (fb - fa)
        fc = f(C)
        if fc * fb <= 0:
            A, fa = B, fb
        else:
            fa = fa / 2.0
        B, fb = C, fc
    return math.exp(A / 2.0)


def compute_ratings(games_out):
    """按比赛日分评级周期，逐日计算 Glicko-2，返回 {姓名: (分, RD)}。"""
    periods = {}
    for g in games_out:
        if g["second"] == BYE_NAME:
            continue
        s = POINTS.get(str(g["result"]))
        if s is None:
            continue
        periods.setdefault(str(g["date"]), []).append((g["first"], g["second"], s))

    mu, phi, sigma = {}, {}, {}

    for date in sorted(periods):
        # 周期之间 RD 随波动率增长
        for name in mu:
            phi[name] = math.sqrt(phi[name] ** 2 + sigma[name] ** 2)

        pairs = periods[date]
        for a, b, _ in pairs:
            for name in (a, b):
                if name not in mu:
                    mu[name] = 0.0
                    phi[name] = G2_RD / G2_SCALE
                    sigma[name] = G2_SIGMA

        # 同一周期内合并该棋手所有对局，一次性更新
        met = {}
        for a, b, s in pairs:
            met.setdefault(a, []).append((b, s))
            met.setdefault(b, []).append((a, 1.0 - s))

        updated = {}
        for name, rows in met.items():
            v_sum = 0.0
            d_sum = 0.0
            for opp, s in rows:
                gv = _g(phi[opp])
                e = _expect(mu[name], mu[opp], phi[opp])
                v_sum += gv * gv * e * (1.0 - e)
                d_sum += gv * (s - e)
            if v_sum <= 0:
                continue
            v = 1.0 / v_sum
            delta = v * d_sum
            sig = _volatility(phi[name], sigma[name], v, delta)
            phi_star = math.sqrt(phi[name] ** 2 + sig ** 2)
            phi_new = 1.0 / math.sqrt(1.0 / (phi_star ** 2) + 1.0 / v)
            mu_new = mu[name] + phi_new ** 2 * d_sum
            updated[name] = (mu_new, phi_new, sig)

        for name, (m, p, s) in updated.items():
            mu[name], phi[name], sigma[name] = m, p, s

    return {n: (G2_RATING + G2_SCALE * mu[n], G2_SCALE * phi[n]) for n in mu}



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
        result = normalize_result(g["result"])
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

    ratings = compute_ratings(games_out)

    players_out = []
    for p in players:
        if str(p["name"]).strip() in (BYE_NAME, "+"):
            continue
        mine = [g for g in games_out if g["first"] == p["name"] or g["second"] == p["name"]]
        tours_of_mine = mine_tours.get(p["player_id"], set())
        if not mine and not tours_of_mine:
            continue
        rating, rd = ratings.get(p["name"], (G2_RATING, G2_RD))
        players_out.append({
            "player_id": p["player_id"],
            "rank": 0,
            "name": p["name"],
            "rating": _display(rating),
            "rd": _display(rd),
            "tournaments": len(tours_of_mine),
            "games": len(mine),
            "_rating": rating,
        })

    # 名次：按未取整的等级分排序，逐名递增，不因取整而并列
    players_out.sort(key=lambda r: (-r["_rating"], -r["games"], r["name"]))
    for index, row in enumerate(players_out, 1):
        row["rank"] = index
        del row["_rating"]

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
