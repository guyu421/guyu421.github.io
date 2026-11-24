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

# 8-10 轮是加赛轮次（只打前几台决名次），不属于正赛，导出时跳过
SKIP_ROUNDS = {8, 9, 10}

# Glicko-2 参数：初始分 1500、初始 RD 350、初始波动率 0.06、系统常数 tau 0.5
G2_SCALE = 400.0 / math.log(10)  # 精确值 ≈ 173.7178
G2_RATING = 1500.0
G2_RD = 350.0
G2_SIGMA = 0.06
G2_TAU = 0.5

# 轮空 / 弃权在数据库里统一记 "+-"、"-+"、"--"，不写 "-:-" 这种带冒号的写法
RESULT_ALIAS = {
    "-:-": "--",
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
    """等级分与偏差统一保留两位小数（正好是整数也写 .00）。"""
    return round(float(value), 2)


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
    """按比赛日分评级周期，逐日计算 Glicko-2。

    返回 ({姓名: (分, RD)}, {姓名: [(日期, 分, RD), ...]})，
    第二个是每期结束后的快照，用于棋手详情页的等级分曲线。
    """
    periods = {}
    for g in games_out:
        if g["second"] == BYE_NAME:
            continue
        s = POINTS.get(str(g["result"]))
        if s is None:
            continue
        periods.setdefault(str(g["date"]), []).append((g["first"], g["second"], s))

    mu, phi, sigma = {}, {}, {}
    history = {}

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

        for name in mu:
            history.setdefault(name, []).append(
                (date, G2_RATING + G2_SCALE * mu[name], G2_SCALE * phi[name])
            )

    final = {n: (G2_RATING + G2_SCALE * mu[n], G2_SCALE * phi[n]) for n in mu}
    return final, history


def rating_at(history, name, date):
    """取某棋手在 date（含）之前最后一次评级的 (分, RD)，没有记录时用初始值。"""
    rows = history.get(name) or []
    hit = None
    for row_date, value, rd in rows:
        if row_date <= date:
            hit = (value, rd)
        else:
            break
    return hit or (G2_RATING, G2_RD)




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
    skipped = 0
    for g in games:
        # 8-10 轮是加赛（只打前几台决名次），不属于正赛，直接跳过
        if g["round"] in SKIP_ROUNDS:
            skipped += 1
            continue
        second = "" if g["second_id"] is None else name.get(g["second_id"], "")
        result = normalize_result(g["result"])
        if second in ("+", ""):
            second = BYE_NAME
        if second == BYE_NAME:
            result = "+-"
        games_out.append({
            "game_id": 0,  # 导出时按最终顺序重排成从 1 开始的整数
            "date": g["date"],
            "rule": g["rule"],
            "first": name.get(g["first_id"], ""),
            "second": second,
            "result": result,
            "tournament_id": g["tournament_id"],
            "tournament": tour_name.get(g["tournament_id"], ""),
            "round": g["round"],
            "board": g["board"],
        })
    # 同一赛事、同一天、同一轮同一台只应有一局，多出来的按重复数据丢掉
    games_out.sort(key=lambda r: (r["date"], r["tournament_id"], r["round"], r["board"]))
    unique = {}
    for g in games_out:
        unique.setdefault((g["date"], g["tournament_id"], g["round"], g["board"]), g)
    games_out = list(unique.values())

    # 同一天先按赛事分块（同一赛事的对局连在一起，不与其他赛事穿插），
    # 赛事内轮次从新到旧、台次从小到大
    games_out.sort(key=lambda r: (-int(str(r["date"]).replace("-", "") or 0),
                                  r["tournament_id"], -r["round"], r["board"]))
    for index, g in enumerate(sorted(games_out, key=lambda r: (
            r["date"], r["tournament_id"], r["round"], r["board"])), 1):
        g["game_id"] = index
    if skipped:
        print("跳过加赛轮次对局 %d 条" % skipped)

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

    ratings, history = compute_ratings(games_out)

    players_out = []
    for p in players:
        if str(p["name"]).strip() in (BYE_NAME, "+"):
            continue
        mine = [g for g in games_out if g["first"] == p["name"] or g["second"] == p["name"]]
        tours_of_mine = mine_tours.get(p["player_id"], set())
        # 只有加赛记录（已被跳过）或根本没上场的棋手不进榜单
        if not mine:
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

    return games_out, tours_out, players_out, history


# 对局结果在详情页上的中文写法与配色类名
# 真正下过的对局；轮空、弃权、双弃单独分类，不计胜负也不计入等级分
PLAYER_RESULT = {
    "1": ("胜", "win"),
    "0": ("负", "loss"),
    "0.5": ("和", "draw"),
}


def classify_result(is_first, result, opponent):
    """把一局归到 胜/负/和/轮空/本人弃权/对手弃权/双弃。

    "-+" 表示假先方弃权、假后方得 +，"+-" 反之，"--" 为双方弃权。
    """
    if result in PLAYER_RESULT:
        return ("played",) + PLAYER_RESULT[result]
    if opponent == BYE_NAME:
        return ("bye", "轮空", "skip")
    if result == "--":
        return ("double", "双弃", "skip")
    if (is_first and result == "-+") or ((not is_first) and result == "+-"):
        return ("self", "弃权", "skip")
    return ("opp", "对手弃权", "skip")


def build_details(games_out, players_out, history):
    """每位棋手一份详情：基本信息 + 等级分曲线 + 按赛事分组的对局明细。"""
    player_id = {p["name"]: p["player_id"] for p in players_out}
    details = {}

    for p in players_out:
        name = p["name"]
        pid = p["player_id"]
        mine = [g for g in games_out if g["first"] == name or g["second"] == name]

        wins = draws = losses = 0
        byes = self_skips = opp_skips = double_skips = 0
        groups = {}
        for g in mine:
            is_first = g["first"] == name
            opponent = g["second"] if is_first else g["first"]
            result = str(g["result"])

            kind, label, klass = classify_result(is_first, result, opponent)

            if klass == "win":
                wins += 1
            elif klass == "draw":
                draws += 1
            elif klass == "loss":
                losses += 1
            elif kind == "bye":
                byes += 1
            elif kind == "self":
                self_skips += 1
            elif kind == "opp":
                opp_skips += 1
            else:
                double_skips += 1

            opp_rating = None if opponent == BYE_NAME else _display(
                rating_at(history, opponent, g["date"])[0]
            )
            group = groups.setdefault(g["tournament_id"], {
                "tournament_id": g["tournament_id"],
                "tournament": g["tournament"],
                "end_date": g["date"],
                "games": [],
            })
            if g["date"] > group["end_date"]:
                group["end_date"] = g["date"]
            group["games"].append({
                "date": g["date"],
                "round": g["round"],
                "board": g["board"],
                "color": "假先" if is_first else "假后",
                "result": label,
                "class": klass,
                "kind": kind,
                "opponent": opponent,
                "opponent_id": player_id.get(opponent),
                "opponent_rating": opp_rating,
            })

        groups = sorted(groups.values(), key=lambda r: r["end_date"], reverse=True)
        for group in groups:
            group["games"].sort(key=lambda r: (r["round"], r["board"]))
            group["rating"] = _display(rating_at(history, name, group["end_date"])[0])

        curve = [[d, _display(v), _display(rd)] for d, v, rd in history.get(name, [])]
        peak = max(history.get(name, [("", p["rating"], 0)]), key=lambda r: r[1])

        details[pid] = {
            "player_id": pid,
            "name": name,
            "rank": p["rank"],
            "rating": p["rating"],
            "rd": p["rd"],
            "tournaments": p["tournaments"],
            "games": len(mine),
            "wins": wins,
            "draws": draws,
            "losses": losses,
            "byes": byes,
            "self_skips": self_skips,
            "opp_skips": opp_skips,
            "double_skips": double_skips,
            "top_rating": _display(peak[1]),
            "top_date": peak[0],
            "history": curve,
            "results": groups,
        }

    return details


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
    games_out, tours_out, players_out, history = build(games, players, tours, members)
    os.makedirs(DATA, exist_ok=True)
    dump(games_out, "games.json")
    dump(tours_out, "tournaments.json")
    dump(players_out, "players.json")

    # 棋手详情：data/player/<player_id>.json，一人一份，详情页只读自己那份
    details = build_details(games_out, players_out, history)
    player_dir = os.path.join(DATA, "player")
    os.makedirs(player_dir, exist_ok=True)
    keep = set()
    for pid, detail in details.items():
        dump(detail, os.path.join("player", "%d.json" % pid))
        keep.add("%d.json" % pid)
    for old in os.listdir(player_dir):
        if old.endswith(".json") and old not in keep:
            os.remove(os.path.join(player_dir, old))

    print("games", len(games_out), "tournaments", len(tours_out),
          "players", len(players_out), "player pages", len(details))
    return 0


if __name__ == "__main__":
    sys.exit(main())
