"""从本地导出的 Parquet/PostgreSQL 重算 WHR 等级分、历史曲线、对局预测与模型评估，并回传至服务器 API。"""

import argparse
import gzip
import json
import math
import os
import sys
import urllib.request
from datetime import date as _date, timedelta
from pathlib import Path

import pandas as pd
import whr

THIS_DIR = Path(__file__).resolve().parent
PREDICT_DIR = THIS_DIR / "renju_predict"

BYE_NAME = "轮空"
WHR_W2 = 19.3
WHR_VIRTUAL_GAMES = 2
WHR_BIAS = 1900.0
WHR_PRIOR_STD = 110.0
EPOCH = _date(1970, 1, 1)
WINNER = {"1": "B", "0": "W", "0.5": "D"}
PLAYER_RESULT = {"1": ("胜", "win"), "0": ("负", "loss"), "0.5": ("和", "draw")}


def normalize_result(value):
    s = str(value).strip()
    if s in ("1.0", "1"):
        return "1"
    if s in ("0.0", "0"):
        return "0"
    if s in ("0.5", "0.50"):
        return "0.5"
    return s


def _display(value):
    return round(float(value), 2)


def _day_of(date_text):
    return (_date.fromisoformat(str(date_text)[:10]) - EPOCH).days


def compute_ratings(games_out):
    trainable = []
    for g in games_out:
        fid = g.get("first_id")
        sid = g.get("second_id")
        if g["second"] == BYE_NAME or sid is None or fid == sid:
            continue
        winner = WINNER.get(str(g["result"]))
        if winner is None:
            continue
        trainable.append([str(fid), str(sid), winner, _day_of(g["date"])])
    trainable.sort(key=lambda r: r[3])
    if not trainable:
        return {}, {}

    base = whr.Base(config={"w2": WHR_W2, "virtual_games": WHR_VIRTUAL_GAMES})
    base.create_games(trainable)
    base.iterate_until_converge(verbose=False)

    final_day = max(row[3] for row in trainable)
    series = {}
    for pid_key, rows in base.get_ordered_ratings():
        series[int(pid_key)] = [
            ((EPOCH + timedelta(days=int(day))).isoformat(), elo + WHR_BIAS, float(std))
            for day, elo, std in rows
        ]

    final = {}
    for pid_key, points in series.items():
        last_date, last_rating, last_rd = points[-1]
        gap = max(final_day - _day_of(last_date), 0)
        final[pid_key] = (last_rating, math.sqrt(WHR_W2 * gap + last_rd * last_rd))
    return final, series


def rating_at(series, pid, target_date):
    rows = series.get(pid) or []
    hit = None
    for row_date, value, rd in rows:
        if row_date <= target_date:
            hit = (value, rd)
        else:
            break
    return hit or (WHR_BIAS, WHR_PRIOR_STD)


def compute_match_predictions(games_out, pid_of, models_root: Path):
    if not models_root.is_dir():
        return {}
    if str(PREDICT_DIR) not in sys.path:
        sys.path.insert(0, str(PREDICT_DIR))
    from whr_tracker import WHRTracker, day_of
    from predict import load_cutoff_bundle, predict_from_ratings, compute_h2h_draw_delta

    available_models = []
    for entry in os.listdir(models_root):
        mdir = models_root / entry
        if mdir.is_dir() and (mdir / "model.json").is_file():
            booster, metadata = load_cutoff_bundle(mdir)
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
    tracker = WHRTracker()
    pair_stats = {}
    preds = {}

    earliest_cutoff = min(c for c, _, _, _ in available_models)
    i = 0
    n = len(ordered)
    in_eval = False
    cur_eval_date = None
    while i < n:
        key = (ordered[i]["date"], ordered[i]["tournament_id"], ordered[i]["round"])
        p_date_str = ordered[i]["date"]
        if not in_eval and p_date_str >= earliest_cutoff:
            tracker.iterate_and_sync(min_iters=10, max_iters=50, tol_elo=0.05)
            in_eval = True
        day_int = day_of(p_date_str)
        j = i
        while j < n and (ordered[j]["date"], ordered[j]["tournament_id"], ordered[j]["round"]) == key:
            j += 1

        period_updates = []
        period_pairs = []
        for g in ordered[i:j]:
            fid = g.get("first_id") if g.get("first_id") is not None else pid_of.get(g["first"])
            sid = g.get("second_id") if g.get("second_id") is not None else pid_of.get(g["second"])
            is_bye = g["first"] == BYE_NAME or g["second"] == BYE_NAME or fid is None or sid is None
            booster, metadata = pick_model(g["date"])
            if is_bye or booster is None or g["rule"] not in metadata["rule_map"]:
                preds[g["game_id"]] = (None, None, None)
            else:
                p1 = tracker.get(fid, day_int)
                p2 = tracker.get(sid, day_int)
                pk = (fid, sid) if fid < sid else (sid, fid)
                n_h2h, d_h2h = pair_stats.get(pk, (0, 0))
                h2h_dd = compute_h2h_draw_delta(n_h2h, d_h2h)
                p = predict_from_ratings(booster, metadata, g["rule"], p1.rating, p2.rating, p1.std, p2.std, h2h_dd)
                preds[g["game_id"]] = (
                    round(p["假先胜率"] * 100, 1),
                    round(p["和棋率"] * 100, 1),
                    round(p["假后胜率"] * 100, 1),
                )

            if not is_bye and str(g["result"]) in score_map:
                period_updates.append((fid, sid, score_map[str(g["result"])]))
                pk = (fid, sid) if fid < sid else (sid, fid)
                period_pairs.append((pk, str(g["result"]) == "0.5"))

        if period_updates:
            tracker.add_games_only(period_updates, day_int)
            if in_eval and p_date_str != cur_eval_date:
                cur_eval_date = p_date_str
                tracker.iterate_and_sync(min_iters=1, max_iters=3, tol_elo=0.2)
        for pk, is_d in period_pairs:
            st = pair_stats.setdefault(pk, [0, 0])
            st[0] += 1
            if is_d:
                st[1] += 1
        i = j

    return preds


def own_result(is_first, result):
    if is_first:
        return result
    return {"1": "0", "0": "1"}.get(result, result)


def classify_result(is_first, result, opponent):
    own = own_result(is_first, result)
    if own in PLAYER_RESULT:
        return ("played",) + PLAYER_RESULT[own]
    if opponent == BYE_NAME:
        return ("bye", "", "skip")
    if result == "--":
        return ("double", "双弃", "skip")
    if (is_first and result == "-+") or ((not is_first) and result == "+-"):
        return ("self", "弃权", "skip")
    return ("opp", "对手弃权", "skip")


def build_model_eval(game_details):
    thresholds = [("all", 0.0), ("p50", 50.0), ("p60", 60.0), ("p70", 70.0), ("p80", 80.0)]
    valid = []
    ll_sum = 0.0
    brier_sum = 0.0
    class_defs = [("first", "1"), ("draw", "0.5"), ("second", "0")]
    cal_bins = {
        cname: [{"lo": i * 10, "hi": (i + 1) * 10, "sum_p": 0.0, "sum_y": 0, "n": 0} for i in range(10)]
        for cname, _ in class_defs
    }

    for g in game_details:
        if g.get("p_first") is None or g.get("result") not in ("1", "0", "0.5"):
            continue
        pf = g["p_first"] / 100.0
        pd_ = g["p_draw"] / 100.0
        ps = g["p_second"] / 100.0
        tot_p = pf + pd_ + ps
        if tot_p > 0:
            pf, pd_, ps = pf / tot_p, pd_ / tot_p, ps / tot_p
        res = g["result"]
        y1 = 1.0 if res == "1" else 0.0
        yd = 1.0 if res == "0.5" else 0.0
        y0 = 1.0 if res == "0" else 0.0
        p_true = pf if res == "1" else (pd_ if res == "0.5" else ps)
        ll_sum -= math.log(max(1e-12, min(1.0, p_true)))
        brier_sum += (pf - y1) ** 2 + (pd_ - yd) ** 2 + (ps - y0) ** 2

        p_by_cls = {"first": pf, "draw": pd_, "second": ps}
        for cname, res_val in class_defs:
            pc = p_by_cls[cname]
            bi = min(9, max(0, int(pc * 10)))
            cal_bins[cname][bi]["sum_p"] += pc
            cal_bins[cname][bi]["sum_y"] += 1 if res == res_val else 0
            cal_bins[cname][bi]["n"] += 1

        probs = {"1": g["p_first"], "0.5": g["p_draw"], "0": g["p_second"]}
        pred_cls = max(probs, key=probs.get)
        conf = probs[pred_cls]
        ok = 1 if pred_cls == res else 0
        valid.append((g["date"], g["tournament_id"], g["round"], g["board"], g["game_id"], conf, ok))
    valid.sort()

    cum_ok = {k: 0 for k, _ in thresholds}
    cum_tot = {k: 0 for k, _ in thresholds}
    points = []
    i = 0
    n = len(valid)
    while i < n:
        cur_date = valid[i][0]
        j = i
        while j < n and valid[j][0] == cur_date:
            conf = valid[j][5]
            ok = valid[j][6]
            for k, th in thresholds:
                if conf >= th:
                    cum_tot[k] += 1
                    cum_ok[k] += ok
            j += 1
        if cum_tot["p80"] >= 5:
            pt = {"date": cur_date}
            for k, _ in thresholds:
                tot = cum_tot[k]
                ok = cum_ok[k]
                pt[k] = round(ok * 100.0 / tot, 2) if tot > 0 else None
                pt[k + "_n"] = tot
                pt[k + "_ok"] = ok
            points.append(pt)
        i = j

    summary = {}
    for k, _ in thresholds:
        tot = cum_tot[k]
        ok = cum_ok[k]
        summary[k] = {
            "accuracy": round(ok * 100.0 / tot, 2) if tot > 0 else None,
            "correct": ok,
            "total": tot,
        }
    n_valid = len(valid)
    ece_by_class = {}
    calibration = {}
    for cname, _ in class_defs:
        cb = cal_bins[cname]
        ece_by_class[cname] = (
            round(sum(abs(b["sum_y"] - b["sum_p"]) for b in cb) / n_valid * 100.0, 2)
            if n_valid > 0 else None
        )
        calibration[cname] = [
            {
                "bin": f"{b['lo']}-{b['hi']}%",
                "lo": b["lo"],
                "hi": b["hi"],
                "n": b["n"],
                "pred": round(b["sum_p"] / b["n"] * 100.0, 2) if b["n"] > 0 else None,
                "actual": round(b["sum_y"] / b["n"] * 100.0, 2) if b["n"] > 0 else None,
            }
            for b in cb
        ]
    return {
        "thresholds": [{"key": k, "min_prob": th} for k, th in thresholds],
        "summary": summary,
        "metrics": {
            "total": n_valid,
            "log_loss": round(ll_sum / n_valid, 4) if n_valid > 0 else None,
            "brier": round(brier_sum / n_valid, 4) if n_valid > 0 else None,
            "ece_first": ece_by_class["first"],
            "ece_draw": ece_by_class["draw"],
            "ece_second": ece_by_class["second"],
        },
        "calibration": calibration,
        "points": points,
    }


def export_parquet_from_pg(dsn: str, db_dir: Path):
    import psycopg2

    db_dir.mkdir(parents=True, exist_ok=True)
    conn = psycopg2.connect(dsn)
    try:
        for tbl in ("tournament", "player", "tournament_player", "match", "team", "team_match"):
            df = pd.read_sql_query(f"SELECT * FROM {tbl}", conn)
            if "date" in df.columns:
                df["date"] = df["date"].astype(str)
            df.to_parquet(db_dir / f"{tbl}.parquet", index=False)
            print(f"exported {tbl}: {len(df)} rows")
    finally:
        conn.close()


def run_recalc(db_dir: Path, models_dir: Path):
    g_df = pd.read_parquet(db_dir / "match.parquet")
    p_df = pd.read_parquet(db_dir / "player.parquet")
    t_df = pd.read_parquet(db_dir / "tournament.parquet")
    m_df = pd.read_parquet(db_dir / "tournament_player.parquet")

    g_df["second_id"] = g_df["second_id"].astype("Int64")
    games = [{k: (None if pd.isna(v) else v) for k, v in row.items()} for row in g_df.to_dict("records")]
    players = [{k: (None if pd.isna(v) else v) for k, v in row.items()} for row in p_df.to_dict("records")]
    tours = [{k: (None if pd.isna(v) else v) for k, v in row.items()} for row in t_df.to_dict("records")]
    members = [{k: (None if pd.isna(v) else v) for k, v in row.items()} for row in m_df.to_dict("records")]

    name = {p["player_id"]: p["name"] for p in players}
    tour_name = {t["tournament_id"]: t["name"] for t in tours}
    pid_of = {p["name"]: p["player_id"] for p in players}

    games_out = []
    for g in games:
        second = "" if g["second_id"] is None else name.get(int(g["second_id"]), "")
        result = normalize_result(g["result"])
        if second in ("+", ""):
            second = BYE_NAME
        if second == BYE_NAME:
            result = "+-"
        games_out.append({
            "game_id": int(g["game_id"]),
            "date": str(g["date"])[:10],
            "rule": str(g["rule"]),
            "first": name.get(int(g["first_id"]), ""),
            "first_id": int(g["first_id"]),
            "second": second,
            "second_id": None if second == BYE_NAME else int(g["second_id"]),
            "result": result,
            "tournament_id": int(g["tournament_id"]),
            "tournament": tour_name.get(int(g["tournament_id"]), ""),
            "round": int(g["round"]),
            "board": int(g["board"]),
        })

    games_out.sort(key=lambda r: (-int(r["date"].replace("-", "") or 0), r["tournament_id"], -r["round"], r["board"]))

    mine_tours = {}
    for m in members:
        mine_tours.setdefault(int(m["player_id"]), set()).add(int(m["tournament_id"]))

    print("Computing WHR ratings...")
    ratings, series = compute_ratings(games_out)

    print("Computing match predictions...")
    match_preds = compute_match_predictions(games_out, pid_of, models_dir)
    match_preds_list = []
    game_details = []
    for g in games_out:
        pf, pd_val, ps = match_preds.get(g["game_id"], (None, None, None))
        match_preds_list.append({
            "game_id": g["game_id"],
            "p_first": pf,
            "p_draw": pd_val,
            "p_second": ps,
        })
        game_details.append({
            "game_id": g["game_id"],
            "tournament_id": g["tournament_id"],
            "date": g["date"],
            "round": g["round"],
            "board": g["board"],
            "result": g["result"],
            "p_first": pf,
            "p_draw": pd_val,
            "p_second": ps,
        })

    games_by_player = {}
    for g in games_out:
        fid = g.get("first_id")
        sid = g.get("second_id")
        if fid is not None:
            games_by_player.setdefault(fid, []).append(g)
        if sid is not None and sid != fid:
            games_by_player.setdefault(sid, []).append(g)

    players_out = []
    for p in players:
        if str(p["name"]).strip() in (BYE_NAME, "+"):
            continue
        pid = int(p["player_id"])
        mine = games_by_player.get(pid, [])
        if not mine:
            continue
        rating, std = ratings.get(pid, (WHR_BIAS, WHR_PRIOR_STD))
        players_out.append({
            "player_id": pid,
            "rank": 0,
            "rating": _display(rating),
            "std": _display(std),
            "tournaments": len(mine_tours.get(pid, set())),
            "games": len(mine),
        })

    players_out.sort(key=lambda r: -r["rating"])
    rank = 0
    previous = None
    seen = 0
    for row in players_out:
        seen += 1
        if row["rating"] != previous:
            rank = seen
            previous = row["rating"]
        row["rank"] = rank

    player_stats_rows = []
    for p in players_out:
        pid = p["player_id"]
        mine = games_by_player.get(pid, [])
        wins = draws = losses = byes = self_skips = opp_skips = double_skips = 0
        tour_dates = {}
        for g in mine:
            is_first = g.get("first_id") == pid
            opponent = g["second"] if is_first else g["first"]
            result = str(g["result"])
            kind, _label, klass = classify_result(is_first, result, opponent)
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
            tid = g["tournament_id"]
            if g.get("date"):
                tour_dates.setdefault(tid, set()).add(g["date"])

        curve = []
        for tid, dates in tour_dates.items():
            for d in sorted(dates):
                value, rd = rating_at(series, pid, d)
                curve.append([d, _display(value), _display(rd), tid])
        curve.sort(key=lambda pt: (pt[0], pt[3]))

        scored = wins + 0.5 * draws + byes + opp_skips
        total = wins + draws + losses + byes + opp_skips + self_skips + double_skips
        score_rate = round(scored / total * 100, 1) if total else None

        player_stats_rows.append({
            "player_id": pid,
            "rank": p["rank"],
            "rating": p["rating"],
            "std": p["std"],
            "tournaments": p["tournaments"],
            "games": p["games"],
            "wins": wins,
            "draws": draws,
            "losses": losses,
            "score_rate": score_rate,
            "byes": byes,
            "self_skips": self_skips,
            "opp_skips": opp_skips,
            "double_skips": double_skips,
            "history_json": curve,
        })

    model_eval = build_model_eval(game_details)
    return {
        "player_stats": player_stats_rows,
        "match_preds": match_preds_list,
        "model_eval": model_eval,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pg-dsn", default="")
    parser.add_argument("--export-only", action="store_true")
    parser.add_argument("--db-dir", type=Path, required=True)
    parser.add_argument("--models-dir", type=Path, default=PREDICT_DIR / "models")
    parser.add_argument("--api-url", default="")
    args = parser.parse_args()

    if args.pg_dsn:
        export_parquet_from_pg(args.pg_dsn, args.db_dir)
        if args.export_only:
            return

    payload = run_recalc(args.db_dir, args.models_dir)
    print(
        f"Computed player_stats={len(payload['player_stats'])}, "
        f"match_preds={len(payload['match_preds'])}, "
        f"eval_total={payload['model_eval']['metrics']['total']}"
    )

    if args.api_url:
        token = os.environ.get("RENJU_ADMIN_TOKEN", "").strip()
        if not token:
            raise SystemExit("RENJU_ADMIN_TOKEN environment variable is required when --api-url is set")
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        gz = gzip.compress(raw)
        print(f"Uploading {len(gz)} bytes (gzipped from {len(raw)} bytes) to {args.api_url}...")
        req = urllib.request.Request(
            args.api_url,
            data=gz,
            method="POST",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Content-Encoding": "gzip",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            print("Server response:", resp.status, resp.read().decode("utf-8"))


if __name__ == "__main__":
    main()
