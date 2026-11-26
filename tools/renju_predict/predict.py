"""Predict match outcome probabilities (假先胜, 和棋, 假后胜) for a specific match."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Dict, List, Tuple

import lightgbm as lgb
import numpy as np
import pandas as pd

from whr_tracker import WHR_PRIOR_STD, WHRTracker, day_of

HERE = Path(__file__).resolve().parent
WORKSPACE = HERE.parent
DEFAULT_DB_DIR = WORKSPACE / "all-renju" / "db"
DEFAULT_MODELS_DIR = HERE / "models"
CUTOFF_ORDER = [
    "20230331",
    "20230630",
    "20230930",
    "20231231",
    "20240331",
    "20240630",
    "20240930",
    "20241231",
    "20250331",
    "20250630",
    "20250930",
    "20251231",
    "20260331",
    "20260630",
    "20260930",
    "20261123",
]
RESULT_SCORE = {"1": 1.0, "0.5": 0.5, "0": 0.0}
H2H_DRAW_PRIOR_P0 = 0.125
H2H_DRAW_SMOOTH_K = 2.0


def compute_h2h_draw_delta(n_games: int, n_draws: int) -> float:
    if n_games <= 0:
        return 0.0
    return (n_draws - n_games * H2H_DRAW_PRIOR_P0) / (H2H_DRAW_SMOOTH_K + n_games)


def compute_h2h_draw_delta_before_match(
    games_df: pd.DataFrame,
    target_date: str,
    target_tid: int,
    target_round: int,
    first_id: int,
    second_id: int,
) -> float:
    valid = games_df[
        games_df["result"].isin(["1", "0", "0.5"]) & games_df["second_id"].notna()
    ].copy()
    valid["first_id"] = valid["first_id"].astype(int)
    valid["second_id"] = valid["second_id"].astype(int)
    mask_prior = (valid["date"] < target_date) | (
        (valid["date"] == target_date)
        & (valid["tournament_id"] == target_tid)
        & (valid["round"] < target_round)
    )
    pair_mask = (
        ((valid["first_id"] == first_id) & (valid["second_id"] == second_id))
        | ((valid["first_id"] == second_id) & (valid["second_id"] == first_id))
    )
    sub = valid[mask_prior & pair_mask]
    if sub.empty:
        return 0.0
    return compute_h2h_draw_delta(len(sub), int((sub["result"] == "0.5").sum()))


def load_cutoff_bundle(model_dir: Path) -> Tuple[Dict, Dict]:
    model = json.loads((model_dir / "model.json").read_text(encoding="utf-8"))
    if model.get("type") == "lightgbm":
        model["_booster"] = lgb.Booster(model_str=model["model_str"])
    metadata = json.loads((model_dir / "metadata.json").read_text(encoding="utf-8"))
    return model, metadata


def load_db(db_dir: Path) -> Tuple[pd.DataFrame, Dict[int, str], Dict[str, int]]:
    games = pd.read_parquet(db_dir / "match.parquet")
    players = pd.read_parquet(db_dir / "player.parquet")
    id_to_name = {int(r.player_id): str(r.name) for r in players.itertuples(index=False)}
    name_to_id = {str(r.name).strip(): int(r.player_id) for r in players.itertuples(index=False)}
    games["date"] = games["date"].astype(str).str.slice(0, 10)
    return games, id_to_name, name_to_id


def resolve_player_id(identifier: str, id_to_name: Dict[int, str], name_to_id: Dict[str, int]) -> Tuple[int, str]:
    ident = str(identifier).strip()
    if ident.isdigit() and int(ident) in id_to_name:
        pid = int(ident)
        return pid, f"{id_to_name[pid]} (ID:{pid})"
    if ident in name_to_id:
        pid = name_to_id[ident]
        return pid, f"{ident} (ID:{pid})"
    raise ValueError(f"Unknown player: {identifier!r}")


def compute_glicko2_before_match(
    games_df: pd.DataFrame,
    target_date: str,
    target_tid: int,
    target_round: int,
) -> Glicko2Tracker:
    """Compute Glicko-2 ratings strictly from valid games before (target_date, target_tid, target_round).

    Excludes byes and forfeits (only result in {'1', '0', '0.5'} and second_id not null).
    """
    valid = games_df[
        games_df["result"].isin(["1", "0", "0.5"]) & games_df["second_id"].notna()
    ].copy()
    valid["first_id"] = valid["first_id"].astype(int)
    valid["second_id"] = valid["second_id"].astype(int)

    mask = (valid["date"] < target_date) | (
        (valid["date"] == target_date)
        & (valid["tournament_id"] == target_tid)
        & (valid["round"] < target_round)
    )
    prior = valid[mask].sort_values(
        ["date", "tournament_id", "round", "board", "game_id"]
    )

    tracker = WHRTracker()
    for (p_date, _tid, _rnd), period_df in prior.groupby(["date", "tournament_id", "round"], sort=True):
        period_games = [
            (r.first_id, r.second_id, RESULT_SCORE[str(r.result)])
            for r in period_df.itertuples(index=False)
        ]
        tracker.apply_period(period_games, day_of(str(p_date)))
    return tracker


def predict_from_ratings(
    model: Dict,
    metadata: Dict,
    rule: str,
    r1: float,
    r2: float,
    std1: float = WHR_PRIOR_STD,
    std2: float = WHR_PRIOR_STD,
    h2h_draw_delta: float = 0.0,
) -> Dict[str, float]:
    rule_map: Dict[str, int] = metadata["rule_map"]
    if rule not in rule_map:
        raise ValueError(f"Unsupported rule {rule!r}. Choose from: {list(rule_map.keys())}")

    rcode = rule_map[rule]
    if model.get("type") == "lightgbm":
        x_arr = np.array([[rcode, r1, r2, r1 - r2, std1, std2]], dtype=np.float64)
        probs = model["_booster"].predict(x_arr)[0]
    else:
        feat_map = {
            "elo_diff": (r1 - r2) / 400.0,
            "rating_sum": (r1 + r2 - 3800.0) / 400.0,
            "std_sum": (std1 + std2) / 100.0,
            "std_diff": (std1 - std2) / 100.0,
            "h2h_draw_delta": float(h2h_draw_delta),
        }
        x = np.array(
            [
                1.0 if (c == f"rule_{rcode}") else feat_map.get(c, 0.0)
                for c in model["feature_cols"]
            ],
            dtype=np.float64,
        )
        coef = np.asarray(model["coef"], dtype=np.float64)
        intercept = np.asarray(model["intercept"], dtype=np.float64)
        logits = coef @ x + intercept
        logits -= np.max(logits)
        exp_l = np.exp(logits)
        probs = exp_l / np.sum(exp_l)
    labels = metadata["class_labels"]
    prob_map = {labels[i]: float(probs[i]) for i in range(len(labels))}
    return {
        "假先胜率": prob_map["假先胜"],
        "和棋率": prob_map["和棋"],
        "假后胜率": prob_map["假后胜"],
    }


def predict_specific_match(
    games_df: pd.DataFrame,
    id_to_name: Dict[int, str],
    target_date: str,
    target_tid: int,
    target_round: int,
    first_id: int,
    second_id: int,
    rule: str,
    cutoff_keys: List[str],
    models_dir: Path = DEFAULT_MODELS_DIR,
) -> List[Dict[str, object]]:
    tracker = compute_glicko2_before_match(games_df, target_date, target_tid, target_round)
    p1 = tracker.get(first_id, day_of(target_date))
    p2 = tracker.get(second_id, day_of(target_date))
    r1, r2 = p1.rating, p2.rating
    std1, std2 = p1.std, p2.std
    diff = r1 - r2
    h2h_draw_delta = compute_h2h_draw_delta_before_match(
        games_df, target_date, target_tid, target_round, first_id, second_id
    )

    results: List[Dict[str, object]] = []
    for cutoff_key in cutoff_keys:
        model_dir = models_dir / cutoff_key
        booster, metadata = load_cutoff_bundle(model_dir)
        probs = predict_from_ratings(booster, metadata, rule, r1, r2, std1, std2, h2h_draw_delta)
        results.append(
            {
                "cutoff": cutoff_key,
                "date": target_date,
                "tournament_id": target_tid,
                "round": target_round,
                "rule": rule,
                "first": f"{id_to_name.get(first_id, first_id)} (ID:{first_id})",
                "second": f"{id_to_name.get(second_id, second_id)} (ID:{second_id})",
                "first_rating": round(r1, 2),
                "second_rating": round(r2, 2),
                "rating_diff": round(diff, 2),
                "first_std": round(std1, 2),
                "second_std": round(std2, 2),
                "假先胜率": round(probs["假先胜率"], 6),
                "和棋率": round(probs["和棋率"], 6),
                "假后胜率": round(probs["假后胜率"], 6),
            }
        )
    return results


def format_result(res: Dict[str, object]) -> str:
    return (
        f"[模型 {res['cutoff']}] 对局: {res['date']} 赛事#{res['tournament_id']} 第{res['round']}轮 | 规则: {res['rule']}\n"
        f"  对阵: 假先 {res['first']} vs 假后 {res['second']}\n"
        f"  赛前Glicko-2: 假先={res['first_rating']:.2f}, 假后={res['second_rating']:.2f}, 分差={res['rating_diff']:+.2f}\n"
        f"  预测: 假先胜率={res['假先胜率']*100:.1f}% | 和棋率={res['和棋率']*100:.1f}% | 假后胜率={res['假后胜率']*100:.1f}%"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict a specific Renju match outcome.")
    parser.add_argument("--game-id", type=str, help="直接指定数据库中的 game_id")
    parser.add_argument("--date", type=str, help="对局日期 YYYY-MM-DD")
    parser.add_argument("--tournament-id", type=int, default=0, help="赛事 ID")
    parser.add_argument("--round", type=int, default=1, help="轮次")
    parser.add_argument("--first", type=str, help="假先棋手姓名或 player_id")
    parser.add_argument("--second", type=str, help="假后棋手姓名或 player_id")
    parser.add_argument("--rule", type=str, choices=["山口", "塔拉山口-10"], help="比赛规则")
    parser.add_argument(
        "--cutoff",
        type=str,
        default="20261123",
        choices=CUTOFF_ORDER + ["all"],
        help="使用的现有模型 (默认: 20261123)",
    )
    parser.add_argument("--db-dir", type=Path, default=DEFAULT_DB_DIR)
    parser.add_argument("--models-dir", type=Path, default=DEFAULT_MODELS_DIR)
    parser.add_argument("--json", action="store_true", help="以 JSON 格式输出")
    args = parser.parse_args()

    games_df, id_to_name, name_to_id = load_db(args.db_dir)

    if args.game_id is not None:
        row = games_df[games_df["game_id"].astype(str) == str(args.game_id)]
        if row.empty:
            raise ValueError(f"game_id={args.game_id} not found")
        g = row.iloc[0]
        if pd.isna(g["second_id"]):
            raise ValueError(f"game_id={args.game_id} is a bye (轮空)")
        target_date = str(g["date"])
        target_tid = int(g["tournament_id"])
        target_round = int(g["round"])
        first_id = int(g["first_id"])
        second_id = int(g["second_id"])
        rule = str(g["rule"])
    else:
        target_date = args.date or input("请输入对局日期 (YYYY-MM-DD): ").strip()
        target_tid = args.tournament_id
        target_round = args.round
        first_in = args.first or input("请输入假先棋手姓名或ID: ").strip()
        second_in = args.second or input("请输入假后棋手姓名或ID: ").strip()
        rule = args.rule or input("请输入规则 (山口 / 塔拉山口-10): ").strip()
        first_id, _ = resolve_player_id(first_in, id_to_name, name_to_id)
        second_id, _ = resolve_player_id(second_in, id_to_name, name_to_id)

    cutoffs = CUTOFF_ORDER if args.cutoff == "all" else [args.cutoff]
    results = predict_specific_match(
        games_df=games_df,
        id_to_name=id_to_name,
        target_date=target_date,
        target_tid=target_tid,
        target_round=target_round,
        first_id=first_id,
        second_id=second_id,
        rule=rule,
        cutoff_keys=cutoffs,
        models_dir=args.models_dir,
    )

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        for res in results:
            print(format_result(res))


if __name__ == "__main__":
    main()
