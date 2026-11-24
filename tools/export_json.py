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
from datetime import date as _date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
WORKSPACE = os.path.dirname(SITE)
WHR_SRC = os.path.join(WORKSPACE, "tmp_src", "whr_src")
if os.path.isdir(WHR_SRC) and WHR_SRC not in sys.path:
    sys.path.insert(0, WHR_SRC)

import whr
PREDICT_DIR = (
    os.path.join(HERE, "renju_predict")
    if os.path.isdir(os.path.join(HERE, "renju_predict"))
    else os.path.join(WORKSPACE, "renju_predict")
)
DATA = os.path.join(SITE, "data")
DB = os.path.join(SITE, "db")

BYE_NAME = "轮空"

# WHR（Whole-History Rating）参数，与 rating.renju.net（wind23/whr_renju）保持一致：
#   w2            每日等级分漂移的方差（Elo²/天），连棋用 19.3
#   virtual_games 棋手首日先记两盘虚拟和棋，作为先验
# WHR 算出的分数以 0 为中心，平移一个偏置才是通常看到的等级分
WHR_W2 = 19.3
WHR_VIRTUAL_GAMES = 2
WHR_BIAS = 1900.0
# 完全没有下过棋（只有轮空/弃权）时的兜底偏差
WHR_PRIOR_RD = 350.0
EPOCH = _date(1970, 1, 1)

# 轮空 / 弃权在数据库里统一记 "+-"、"-+"、"--"，不写 "-:-" 这种带冒号的写法
RESULT_ALIAS = {
    "-:-": "--",
    "-:+": "-+",
    "+:-": "+-",
}

# 库里 result 记的是假先方视角：1 假先胜、0 假先负、0.5 和棋
# 轮空（+-）与弃权（-+、+-、--）不计入等级分
WINNER = {"1": "B", "0": "W", "0.5": "D"}

# 记分写法：页面上原样显示库里填的结果
SCORE_TEXT = {
    "1": "1:0",
    "0": "0:1",
    "0.5": "\u00bd://u00bd",
    "+-": "+:-",
    "-+": "-:+",
    "--": "-:-",
}


def score_text(value):
    """把库里的结果码换成记分写法（认不出来就原样返回）。"""
    text = str(normalize_result(value))
    return SCORE_TEXT.get(text, text)


def normalize_result(value):
    if value is None:
        return value
    text = str(value).strip()
    text = text.replace("：", ":").replace("−", "-").replace("－", "-").replace("＋", "+")
    return RESULT_ALIAS.get(text, text)


def _display(value):
    """等级分与偏差统一保留两位小数（正好是整数也写 .00）。"""
    return round(float(value), 2)


def _day_of(date_text):
    """日期换成 WHR 用的天序号（1970-01-01 起算的天数）。"""
    y, m, d = (int(x) for x in str(date_text)[:10].split("-"))
    return (_date(y, m, d) - EPOCH).days


def compute_ratings(games_out):
    """用 WHR（Whole-History Rating，wind23/whr_renju）算等级分。

    每局按自己的比赛日参与求解，全历史一次算完（不是逐日递推），
    参数沿用 rating.renju.net 的连珠评分。返回
    ({姓名: (分, 偏差)}, {姓名: [(日期, 分, 偏差), ...]})，
    后者是该棋手每个比赛日的当日快照，供详情页曲线与对手分查询使用。
    """
    trainable = []
    for g in games_out:
        if g["second"] == BYE_NAME or g["first"] == g["second"]:
            continue
        winner = WINNER.get(str(g["result"]))
        if winner is None:
            continue
        trainable.append([g["first"], g["second"], winner, _day_of(g["date"])])
    trainable.sort(key=lambda r: r[3])
    if not trainable:
        return {}, {}

    base = whr.Base(config={"w2": WHR_W2, "virtual_games": WHR_VIRTUAL_GAMES})
    base.create_games(trainable)
    base.iterate_until_converge(verbose=False)

    final_day = max(row[3] for row in trainable)
    series = {}
    for name, rows in base.get_ordered_ratings():
        series[name] = [
            ((EPOCH + timedelta(days=int(day))).isoformat(), elo + WHR_BIAS, float(std))
            for day, elo, std in rows
        ]

    # 榜单上显示的是最后一次比赛的分，偏差则按「距最后一次比赛多少天」放大
    final = {}
    for name, points in series.items():
        last_date, last_rating, last_rd = points[-1]
        gap = max(final_day - _day_of(last_date), 0)
        final[name] = (last_rating, math.sqrt(WHR_W2 * gap + last_rd * last_rd))
    return final, series


def rating_at(series, name, date):
    """取某棋手在 date（含）之前的最后一次评级 (分, 偏差)，没下过棋就给先验。"""
    rows = series.get(name) or []
    hit = None
    for row_date, value, rd in rows:
        if row_date <= date:
            hit = (value, rd)
        else:
            break
    return hit or (WHR_BIAS, WHR_PRIOR_RD)


def compute_match_predictions(games_out, pid_of):
    """用对局之前最近的现有 LightGBM 模型与赛前 Glicko-2 等级分为每盘对局计算胜平负概率。

    仅使用该对局日期之前、或同赛事轮次更小的有效对局（不含轮空和弃权）更新 Glicko-2；
    若该对局日期之前没有任何可用模型，则返回 (None, None, None) 不显示分析。
    """
    models_root = os.path.join(PREDICT_DIR, "models")
    if not os.path.isdir(models_root):
        return {}

    if PREDICT_DIR not in sys.path:
        sys.path.insert(0, PREDICT_DIR)
    from pathlib import Path
    from glicko2 import Glicko2Tracker
    from predict import load_cutoff_bundle, predict_from_ratings

    # 加载所有可用模型，按 cutoff_date_exclusive 从新到旧排序
    available_models = []
    for entry in os.listdir(models_root):
        mdir = os.path.join(models_root, entry)
        if os.path.isdir(mdir) and os.path.isfile(os.path.join(mdir, "model.txt")):
            booster, metadata = load_cutoff_bundle(Path(mdir))
            available_models.append((metadata["cutoff_date_exclusive"], entry, booster, metadata))
    available_models.sort(key=lambda item: item[0], reverse=True)
    if not available_models:
        return {}

    def pick_model(game_date):
        for cutoff_excl, _key, booster, metadata in available_models:
            if game_date >= cutoff_excl:
                return booster, metadata
        return None, None

    score_map = {"1": 1.0, "0.5": 0.5, "0": 0.0}

    ordered = sorted(
        games_out,
        key=lambda g: (g["date"], g["tournament_id"], g["round"], g["board"], g["game_id"]),
    )
    tracker = Glicko2Tracker()
    preds = {}

    i = 0
    n = len(ordered)
    while i < n:
        key = (ordered[i]["date"], ordered[i]["tournament_id"], ordered[i]["round"])
        j = i
        while j < n and (ordered[j]["date"], ordered[j]["tournament_id"], ordered[j]["round"]) == key:
            j += 1

        # 先用本轮之前的 Glicko-2 预测本轮所有非轮空对局
        period_updates = []
        for g in ordered[i:j]:
            fid = pid_of.get(g["first"])
            sid = pid_of.get(g["second"])
            is_bye = g["first"] == BYE_NAME or g["second"] == BYE_NAME or fid is None or sid is None
            booster, metadata = pick_model(g["date"])
            if is_bye or booster is None or g["rule"] not in metadata["rule_map"]:
                preds[g["game_id"]] = (None, None, None)
            else:
                p1 = tracker.get(fid)
                p2 = tracker.get(sid)
                p = predict_from_ratings(booster, metadata, g["rule"], p1.rating, p2.rating, p1.rd, p2.rd)
                preds[g["game_id"]] = (
                    round(p["假先胜率"] * 100, 1),
                    round(p["和棋率"] * 100, 1),
                    round(p["假后胜率"] * 100, 1),
                )

            # 轮空或弃权不计入 Glicko-2 等级分
            if not is_bye and str(g["result"]) in score_map:
                period_updates.append((fid, sid, score_map[str(g["result"])]))

        if period_updates:
            tracker.apply_period(period_updates)
        i = j

    return preds


def read_parquet(folder):
    import pandas as pd

    g = pd.read_parquet(os.path.join(folder, "match.parquet"))
    p = pd.read_parquet(os.path.join(folder, "player.parquet"))
    t = pd.read_parquet(os.path.join(folder, "tournament.parquet"))
    tp = pd.read_parquet(os.path.join(folder, "tournament_player.parquet"))

    games = []
    for r in g.to_dict("records"):
        def _clean_str(val):
            if val is None or pd.isna(val):
                return None
            s = str(val).strip()
            return s if s else None

        games.append({
            "game_id": int(r["game_id"]),
            "date": str(r["date"])[:10],
            "rule": r["rule"],
            "first_id": None if pd.isna(r["first_id"]) else int(r["first_id"]),
            "second_id": None if pd.isna(r["second_id"]) else int(r["second_id"]),
            "result": r["result"],
            "tournament_id": int(r["tournament_id"]),
            "round": int(r["round"]),
            "board": int(r["board"]),
            "swap": _clean_str(r.get("swap")),
            "5a": _clean_str(r.get("5a")),
            "moves": _clean_str(r.get("moves")),
        })
    players = [{"player_id": int(r.player_id), "name": r.name} for r in p.itertuples(index=False)]
    tours = [{"tournament_id": int(r.tournament_id), "name": r.name} for r in t.itertuples(index=False)]
    members = [{"tournament_id": int(r.tournament_id), "player_id": int(r.player_id)}
               for r in tp.itertuples(index=False)]
    return games, players, tours, members


def load_team_db(folder):
    import pandas as pd

    team_path = os.path.join(folder, "team.parquet")
    tm_path = os.path.join(folder, "team_match.parquet")
    if not (os.path.exists(team_path) and os.path.exists(tm_path)):
        return [], []
    t_df = pd.read_parquet(team_path)
    tm_df = pd.read_parquet(tm_path)
    teams = []
    for r in t_df.to_dict("records"):
        teams.append({
            "tournament_id": int(r["tournament_id"]),
            "team_id": int(r["team_id"]),
            "team_no": int(r["team_no"]),
            "name": str(r["name"]),
            "board1_id": int(r["board1_id"]),
            "board2_id": int(r["board2_id"]),
            "board3_id": int(r["board3_id"]),
        })
    team_matches = []
    for r in tm_df.to_dict("records"):
        def _opt_int(val):
            return None if val is None or pd.isna(val) else int(val)
        team_matches.append({
            "team_match_id": int(r["team_match_id"]),
            "tournament_id": int(r["tournament_id"]),
            "date": str(r["date"])[:10],
            "round": int(r["round"]),
            "match_board": int(r["match_board"]),
            "rule": str(r["rule"]),
            "team_a_id": int(r["team_a_id"]),
            "team_b_id": int(r["team_b_id"]),
            "team_a_name": str(r["team_a_name"]),
            "team_b_name": str(r["team_b_name"]),
            "game_id_1": _opt_int(r.get("game_id_1")),
            "game_id_2": _opt_int(r.get("game_id_2")),
            "game_id_3": _opt_int(r.get("game_id_3")),
            "score_a": float(r["score_a"]),
            "score_b": float(r["score_b"]),
            "result": str(r["result"]),
        })
    return teams, team_matches


def _fmt_pts(x):
    return str(int(x)) if abs(x - round(x)) < 1e-9 else f"{x:.1f}"


def _convolve_team_probs(boards):
    pred_boards = [b for b in boards if b.get("p_first") is not None]
    if not pred_boards:
        return None, None, None, []
    dist = {0.0: 1.0}
    for b in pred_boards:
        pf = float(b["p_first"])
        pd_val = float(b["p_draw"])
        ps = float(b["p_second"])
        total = pf + pd_val + ps
        if total <= 0:
            continue
        pf, pd_val, ps = pf / total, pd_val / total, ps / total
        if b["team_a_side"] == "first":
            pw, pd_b, pl = pf, pd_val, ps
        else:
            pw, pd_b, pl = ps, pd_val, pf
        nxt = {}
        for pts, pr in dist.items():
            nxt[pts + 1.0] = nxt.get(pts + 1.0, 0.0) + pr * pw
            nxt[pts + 0.5] = nxt.get(pts + 0.5, 0.0) + pr * pd_b
            nxt[pts] = nxt.get(pts, 0.0) + pr * pl
        dist = nxt
    max_pts = float(len(pred_boards))
    half = max_pts / 2.0
    p_win = round(sum(v for k, v in dist.items() if k > half + 1e-9) * 100.0, 1)
    p_draw = round(sum(v for k, v in dist.items() if abs(k - half) <= 1e-9) * 100.0, 1)
    p_loss = round(sum(v for k, v in dist.items() if k < half - 1e-9) * 100.0, 1)
    score_probs = []
    steps = int(round(max_pts * 2))
    for s in range(steps, -1, -1):
        sa = s / 2.0
        sb = max_pts - sa
        pr = sum(v for k, v in dist.items() if abs(k - sa) <= 1e-9)
        score_probs.append({
            "score": f"{_fmt_pts(sa)}-{_fmt_pts(sb)}",
            "prob": round(pr * 100.0, 1),
        })
    return p_win, p_draw, p_loss, score_probs


def build(games, players, tours, members, teams=None, team_matches=None):
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
            "swap": g.get("swap"),
            "5a": g.get("5a"),
            "moves": g.get("moves"),
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

    # 每个赛事单独一份：赛事页点进去只读自己那一段，不用拉全量对局
    pid_of = {p["name"]: p["player_id"] for p in players}
    match_preds = compute_match_predictions(games_out, pid_of)
    tour_details = {}
    for row in tours_out:
        tid = row["tournament_id"]
        rows = by_tour[tid]
        tour_details[tid] = {
            "tournament_id": tid,
            "name": row["name"],
            "start_date": row["start_date"],
            "end_date": row["end_date"],
            "players": row["players"],
            "game_count": row["games"],
            "games": [{
                "game_id": g["game_id"],
                "date": g["date"],
                "round": g["round"],
                "board": g["board"],
                "rule": g["rule"],
                "first": g["first"],
                "first_id": pid_of.get(g["first"]),
                "second": g["second"],
                "second_id": pid_of.get(g["second"]),
                "result": g["result"],
                "p_first": match_preds.get(g["game_id"], (None, None, None))[0],
                "p_draw": match_preds.get(g["game_id"], (None, None, None))[1],
                "p_second": match_preds.get(g["game_id"], (None, None, None))[2],
            } for g in sorted(rows, key=lambda r: (r["date"], r["round"], r["board"]))],
        }

    if team_matches:
        team_by_key = {(t["tournament_id"], t["team_id"]): t for t in (teams or [])}
        player_team_of = {}
        for t in (teams or []):
            for bkey in ("board1_id", "board2_id", "board3_id"):
                player_team_of[(t["tournament_id"], t[bkey])] = t["team_id"]
        tm_by_tour = {}
        for tm in team_matches:
            tm_by_tour.setdefault(tm["tournament_id"], []).append(tm)
        for tid, tm_list in tm_by_tour.items():
            if tid not in tour_details:
                continue
            g_by_id = {g["game_id"]: g for g in tour_details[tid]["games"]}
            out_tms = []
            for tm in sorted(tm_list, key=lambda x: (x["round"], x["match_board"])):
                ta = team_by_key.get((tid, tm["team_a_id"]))
                tb = team_by_key.get((tid, tm["team_b_id"]))
                boards = []
                for b_no, gid_key in ((1, "game_id_1"), (2, "game_id_2"), (3, "game_id_3")):
                    gid = tm.get(gid_key)
                    if gid is not None and gid in g_by_id:
                        g = g_by_id[gid]
                        t_first = player_team_of.get((tid, g["first_id"]))
                        side = "first" if t_first == tm["team_a_id"] else "second"
                        boards.append({
                            "board_no": b_no,
                            "game_id": g["game_id"],
                            "first": g["first"],
                            "first_id": g["first_id"],
                            "second": g["second"],
                            "second_id": g["second_id"],
                            "result": g["result"],
                            "team_a_side": side,
                            "p_first": g["p_first"],
                            "p_draw": g["p_draw"],
                            "p_second": g["p_second"],
                        })
                    else:
                        pa_id = ta[f"board{b_no}_id"] if ta else None
                        pb_id = tb[f"board{b_no}_id"] if tb else None
                        boards.append({
                            "board_no": b_no,
                            "game_id": None,
                            "first": name.get(pa_id, ""),
                            "first_id": pa_id,
                            "second": name.get(pb_id, ""),
                            "second_id": pb_id,
                            "result": "--",
                            "team_a_side": "first",
                            "p_first": None,
                            "p_draw": None,
                            "p_second": None,
                        })
                p_win, p_draw, p_loss, score_probs = _convolve_team_probs(boards)
                out_tms.append({
                    "team_match_id": tm["team_match_id"],
                    "date": tm["date"],
                    "round": tm["round"],
                    "match_board": tm["match_board"],
                    "rule": tm["rule"],
                    "team_a_id": tm["team_a_id"],
                    "team_b_id": tm["team_b_id"],
                    "team_a_name": tm["team_a_name"],
                    "team_b_name": tm["team_b_name"],
                    "score_a": _fmt_pts(tm["score_a"]),
                    "score_b": _fmt_pts(tm["score_b"]),
                    "result": tm["result"],
                    "p_win": p_win,
                    "p_draw": p_draw,
                    "p_loss": p_loss,
                    "score_probs": score_probs,
                    "boards": boards,
                })
            tour_details[tid]["team_matches"] = out_tms

    game_details = {}
    for g in games_out:
        pf, pd_val, ps = match_preds.get(g["game_id"], (None, None, None))
        game_details[g["game_id"]] = {
            "game_id": g["game_id"],
            "tournament_id": g["tournament_id"],
            "tournament": g["tournament"],
            "date": g["date"],
            "round": g["round"],
            "board": g["board"],
            "rule": g["rule"],
            "first": g["first"],
            "first_id": pid_of.get(g["first"]),
            "second": g["second"],
            "second_id": pid_of.get(g["second"]),
            "result": g["result"],
            "swap": g.get("swap"),
            "5a": g.get("5a"),
            "moves": g.get("moves"),
            "p_first": pf,
            "p_draw": pd_val,
            "p_second": ps,
        }

    ratings, series = compute_ratings(games_out)

    games_by_player = {}
    for g in games_out:
        games_by_player.setdefault(g["first"], []).append(g)
        if g["second"] != g["first"]:
            games_by_player.setdefault(g["second"], []).append(g)

    players_out = []
    for p in players:
        if str(p["name"]).strip() in (BYE_NAME, "+"):
            continue
        mine = games_by_player.get(p["name"], [])
        tours_of_mine = mine_tours.get(p["player_id"], set())
        # 只有加赛记录（已被跳过）或根本没上场的棋手不进榜单
        if not mine:
            continue
        rating, rd = ratings.get(p["name"], (1500.0, 350.0))
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

    # 名次：只比等级分（按显示的两位小数），完全相同即并列，并列之后名次顺延
    players_out.sort(key=lambda r: -r["rating"])
    rank = 0
    previous = None
    seen = 0
    for row in players_out:
        del row["_rating"]
        seen += 1
        if row["rating"] != previous:
            rank = seen
            previous = row["rating"]
        row["rank"] = rank

    return games_out, tours_out, players_out, series, tour_details, game_details


# 对局结果在详情页上的中文写法与配色类名
# 真正下过的对局；轮空、弃权、双弃单独分类，不计胜负也不计入等级分
PLAYER_RESULT = {
    "1": ("胜", "win"),
    "0": ("负", "loss"),
    "0.5": ("和", "draw"),
}


def own_result(is_first, result):
    """库里 result 记的是假先方视角（1 假先胜、0 假先负），换成本人视角。"""
    if is_first:
        return result
    return {"1": "0", "0": "1"}.get(result, result)


def classify_result(is_first, result, opponent):
    """把一局归到 胜/负/和/轮空/本人弃权/对手弃权/双弃。

    "-+" 表示假先方弃权、假后方得 +，"+-" 反之，"--" 为双方弃权。
    """
    own = own_result(is_first, result)
    if own in PLAYER_RESULT:
        return ("played",) + PLAYER_RESULT[own]
    if opponent == BYE_NAME:
        # 轮空不算胜，结果列留空（对手列已经写着「轮空」）
        return ("bye", "", "skip")
    if result == "--":
        return ("double", "双弃", "skip")
    if (is_first and result == "-+") or ((not is_first) and result == "+-"):
        return ("self", "弃权", "skip")
    return ("opp", "对手弃权", "skip")


def build_details(games_out, players_out, series):
    """每位棋手一份详情：基本信息 + 等级分曲线 + 按赛事分组的对局明细。"""
    player_id = {p["name"]: p["player_id"] for p in players_out}
    games_by_player = {}
    for g in games_out:
        games_by_player.setdefault(g["first"], []).append(g)
        if g["second"] != g["first"]:
            games_by_player.setdefault(g["second"], []).append(g)
    details = {}

    for p in players_out:
        name = p["name"]
        pid = p["player_id"]
        mine = games_by_player.get(name, [])

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
                rating_at(series, opponent, g["date"])[0]
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
                "game_id": g["game_id"],
                "date": g["date"],
                "round": g["round"],
                "board": g["board"],
                "rule": g["rule"],
                "color": "假先" if is_first else "假后",
                "result": label,
                "score": score_text(result),
                "class": klass,
                "kind": kind,
                "opponent": opponent,
                "opponent_id": player_id.get(opponent),
                "opponent_rating": opp_rating,
            })

        groups = sorted(groups.values(), key=lambda r: r["end_date"], reverse=True)
        for group in groups:
            group["games"].sort(key=lambda r: (r["round"], r["board"]))
            group["rating"] = _display(rating_at(series, name, group["end_date"])[0])

        # 曲线按比赛内每个比赛日记录节点，不再把同个比赛压缩成一天
        curve = []
        for group in sorted(groups, key=lambda r: r["end_date"]):
            dates = sorted({g["date"] for g in group["games"] if g.get("date")})
            if not dates:
                dates = [group["end_date"]]
            for d in dates:
                value, rd = rating_at(series, name, d)
                curve.append([d, _display(value), _display(rd), group["tournament_id"]])
        curve.sort(key=lambda pt: (pt[0], pt[3]))

        # 得分率：和棋半分；轮空、对手弃权按 1 分算；本人弃权、双弃算 0 分
        scored = wins + 0.5 * draws + byes + opp_skips
        total = wins + draws + losses + byes + opp_skips + self_skips + double_skips
        score_rate = round(scored / total * 100, 1) if total else None

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
            "score_rate": score_rate,
            "byes": byes,
            "self_skips": self_skips,
            "opp_skips": opp_skips,
            "double_skips": double_skips,
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
    ap.add_argument("--predictions-only", action="store_true",
                    help="仅更新 data/tournament/*.json 中的对局胜平负预测")
    args = ap.parse_args()

    if not os.path.isdir(args.parquet):
        print("找不到 parquet 目录：%s" % args.parquet, file=sys.stderr)
        return 1

    games, players, tours, members = read_parquet(args.parquet)
    if args.predictions_only:
        name = {p["player_id"]: p["name"] for p in players}
        pid_of = {p["name"]: p["player_id"] for p in players}
        games_out = []
        for g in games:
            second = "" if g["second_id"] is None else name.get(g["second_id"], "")
            result = normalize_result(g["result"])
            if second in ("+", ""):
                second = BYE_NAME
            if second == BYE_NAME:
                result = "+-"
            games_out.append({
                "game_id": g["game_id"],
                "date": g["date"],
                "rule": g["rule"],
                "first": name.get(g["first_id"], ""),
                "second": second,
                "result": result,
                "tournament_id": g["tournament_id"],
                "round": g["round"],
                "board": g["board"],
            })
        match_preds = compute_match_predictions(games_out, pid_of)
        by_key = {
            (g["tournament_id"], g["date"], g["round"], g["board"], g["first"], g["second"]):
            match_preds.get(g["game_id"], (None, None, None))
            for g in games_out
        }
        tour_dir = os.path.join(DATA, "tournament")
        updated = 0
        for fname in sorted(os.listdir(tour_dir)):
            if not fname.endswith(".json"):
                continue
            fpath = os.path.join(tour_dir, fname)
            with open(fpath, "r", encoding="utf-8") as fh:
                detail = json.load(fh)
            tid = detail["tournament_id"]
            for g in detail.get("games", []):
                pf, pd_val, ps = by_key.get(
                    (tid, g["date"], g["round"], g["board"], g["first"], g["second"]),
                    (None, None, None),
                )
                g["p_first"] = pf
                g["p_draw"] = pd_val
                g["p_second"] = ps
            dump(detail, os.path.join("tournament", fname))
            updated += 1
        print("updated tournament pages with predictions:", updated)
        return 0

    teams, team_matches = load_team_db(DB)
    games_out, tours_out, players_out, series, tour_details, game_details = build(
        games, players, tours, members, teams=teams, team_matches=team_matches
    )
    os.makedirs(DATA, exist_ok=True)
    dump(tours_out, "tournaments.json")
    dump(players_out, "players.json")

    # 对局页已去掉：不再生成全量 data/games.json，改为每个赛事一份
    stale_games = os.path.join(DATA, "games.json")
    if os.path.exists(stale_games):
        os.remove(stale_games)

    tour_dir = os.path.join(DATA, "tournament")
    os.makedirs(tour_dir, exist_ok=True)
    keep_tours = set()
    for tid, detail in tour_details.items():
        dump(detail, os.path.join("tournament", "%d.json" % tid))
        keep_tours.add("%d.json" % tid)
    for old in os.listdir(tour_dir):
        if old.endswith(".json") and old not in keep_tours:
            os.remove(os.path.join(tour_dir, old))

    # 棋手详情：data/player/<player_id>.json，一人一份，详情页只读自己那份
    details = build_details(games_out, players_out, series)
    player_dir = os.path.join(DATA, "player")
    os.makedirs(player_dir, exist_ok=True)
    keep = set()
    for pid, detail in details.items():
        dump(detail, os.path.join("player", "%d.json" % pid))
        keep.add("%d.json" % pid)
    for old in os.listdir(player_dir):
        if old.endswith(".json") and old not in keep:
            os.remove(os.path.join(player_dir, old))

    game_dir = os.path.join(DATA, "game")
    os.makedirs(game_dir, exist_ok=True)
    keep_games = set()
    for gid, detail in game_details.items():
        dump(detail, os.path.join("game", "%d.json" % gid))
        keep_games.add("%d.json" % gid)
    for old in os.listdir(game_dir):
        if old.endswith(".json") and old not in keep_games:
            os.remove(os.path.join(game_dir, old))

    print("games", len(games_out), "tournaments", len(tours_out),
          "players", len(players_out), "player pages", len(details),
          "tournament pages", len(tour_details), "game pages", len(game_details))
    return 0


if __name__ == "__main__":
    sys.exit(main())
