"""Train LightGBM match-outcome models for multiple date cutoffs using Glicko-2 features."""

from __future__ import annotations

import argparse
import json
from datetime import date as _date
from pathlib import Path
from typing import Dict, List, Tuple

from catboost import CatBoostClassifier
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import StratifiedKFold

from whr_tracker import WHR_BIAS, WHR_PRIOR_STD, WHRTracker, day_of

HERE = Path(__file__).resolve().parent
WORKSPACE = HERE.parent
DEFAULT_DB_DIR = WORKSPACE / "merged-renju" / "db"
DEFAULT_MODELS_DIR = HERE / "models"

RULE_MAP: Dict[str, int] = {
    "山口": 0,
    "塔拉山口-10": 1,
    "索索夫-8": 2,
    "五手两打": 3,
    "塔拉山口": 4,
    "索索夫": 5,
    "塔拉山口-7": 6,
    "塔拉尼科夫": 7,
    "坂田": 8,
    "山索夫-8": 9,
    "拒绝": 10,
    "索索夫-10": 11,
    "山索夫-5": 12,
    "连换": 13,
    "连换-5": 14,
    "索索夫-5": 15,
    "山索夫-7": 16,
    "琼森": 17,
    "实验规则": 18,
    "超级坂田": 19,
    "五手自由交换": 20,
    "索索夫-8(含让步)": 21,
    "索索夫-7": 22,
}

# Class index -> label
RESULT_TO_CLASS: Dict[str, int] = {
    "0": 0,    # 假后胜
    "0.5": 1,  # 和棋
    "1": 2,    # 假先胜
}
CLASS_LABELS = ["假后胜", "和棋", "假先胜"]
FEATURE_NAMES = ["rule", "first_rating", "second_rating", "rating_diff", "first_std", "second_std"]
RESULT_SCORE = {"1": 1.0, "0.5": 0.5, "0": 0.0}


def load_data(db_dir: Path) -> Tuple[pd.DataFrame, Dict[int, str]]:
    games = pd.read_parquet(db_dir / "match.parquet")
    players = pd.read_parquet(db_dir / "player.parquet")
    player_names = {int(r.player_id): str(r.name) for r in players.itertuples(index=False)}

    valid = games[
        games["result"].isin(["1", "0", "0.5"]) & games["second_id"].notna()
    ].copy()
    valid["date"] = valid["date"].astype(str).str.slice(0, 10)
    valid["first_id"] = valid["first_id"].astype(int)
    valid["second_id"] = valid["second_id"].astype(int)
    valid = valid.sort_values(
        ["date", "tournament_id", "round", "board", "game_id"]
    ).reset_index(drop=True)
    return valid, player_names


def build_all_cutoffs_features(
    df: pd.DataFrame,
    cutoffs: List[Tuple[str, str]],
) -> Tuple[pd.DataFrame, np.ndarray, pd.Series, Dict[str, Dict[int, object]]]:
    """Compute pre-match WHR features once chronologically and snapshot ratings at each cutoff."""
    tracker = WHRTracker()
    rows: List[Dict[str, float | int]] = []
    targets: List[int] = []
    dates: List[str] = []
    snapshots: Dict[str, Dict[int, object]] = {}
    sorted_cutoffs = sorted(cutoffs, key=lambda x: x[1])
    c_idx = 0

    for (p_date, _tid, _rnd), period_df in df.groupby(["date", "tournament_id", "round"], sort=True):
        p_date_str = str(p_date)
        while c_idx < len(sorted_cutoffs) and p_date_str >= sorted_cutoffs[c_idx][1]:
            snapshots[sorted_cutoffs[c_idx][0]] = dict(tracker.ratings)
            c_idx += 1

        day_int = day_of(p_date_str)
        period_games: List[Tuple[int, int, float]] = []
        for r in period_df.itertuples(index=False):
            rule_code = RULE_MAP.get(str(r.rule))
            if rule_code is None:
                raise ValueError(f"Unknown rule: {r.rule!r}")
            p1 = tracker.get(r.first_id, day_int)
            p2 = tracker.get(r.second_id, day_int)
            rows.append(
                {
                    "rule": rule_code,
                    "first_rating": p1.rating,
                    "second_rating": p2.rating,
                    "rating_diff": p1.rating - p2.rating,
                    "first_std": p1.std,
                    "second_std": p2.std,
                }
            )
            targets.append(RESULT_TO_CLASS[str(r.result)])
            dates.append(p_date_str)
            period_games.append((r.first_id, r.second_id, RESULT_SCORE[str(r.result)]))

        tracker.apply_period(period_games, day_int)

    while c_idx < len(sorted_cutoffs):
        snapshots[sorted_cutoffs[c_idx][0]] = dict(tracker.ratings)
        c_idx += 1

    X = pd.DataFrame(rows, columns=FEATURE_NAMES)
    X["rule"] = X["rule"].astype(int)
    y = np.array(targets, dtype=np.int64)
    return X, y, pd.Series(dates), snapshots


def make_model() -> CatBoostClassifier:
    return CatBoostClassifier(
        loss_function="MultiClass",
        iterations=500,
        learning_rate=0.03,
        depth=5,
        l2_leaf_reg=5.0,
        random_seed=42,
        thread_count=-1,
        verbose=0,
    )


def train_cutoff(
    cutoff_key: str,
    cutoff_date: str,
    all_games: pd.DataFrame,
    X_all: pd.DataFrame,
    y_all: np.ndarray,
    dates_all: pd.Series,
    ratings_snapshot: Dict[int, object],
    player_names: Dict[int, str],
    models_dir: Path,
) -> Dict[str, object]:
    mask_df = all_games["date"] < cutoff_date
    sub = all_games[mask_df]
    if sub.empty:
        raise RuntimeError(f"No games found before {cutoff_date}")

    mask_x = dates_all < cutoff_date
    X = X_all[mask_x].reset_index(drop=True)
    y = y_all[mask_x.to_numpy()]

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    oof_probs = np.zeros((len(y), 3), dtype=np.float64)
    for train_idx, val_idx in skf.split(X, y):
        clf = make_model()
        clf.fit(
            X.iloc[train_idx],
            y[train_idx],
            cat_features=["rule"],
        )
        oof_probs[val_idx] = clf.predict_proba(X.iloc[val_idx])

    cv_logloss = float(log_loss(y, oof_probs, labels=[0, 1, 2]))
    cv_acc = float(accuracy_score(y, np.argmax(oof_probs, axis=1)))

    final_clf = make_model()
    final_clf.fit(X, y, cat_features=["rule"])

    out_dir = models_dir / cutoff_key
    out_dir.mkdir(parents=True, exist_ok=True)
    stale_lgb = out_dir / "model.txt"
    if stale_lgb.exists():
        stale_lgb.unlink()
    final_clf.save_model(str(out_dir / "model.cbm"))

    ratings_payload = {
        "default": {
            "rating": WHR_BIAS,
            "std": WHR_PRIOR_STD,
        },
        "players": {
            str(pid): {
                "name": player_names.get(pid, str(pid)),
                "rating": round(pr.rating, 4),
                "std": round(pr.std, 4),
            }
            for pid, pr in sorted(ratings_snapshot.items())
        },
    }
    (out_dir / "ratings.json").write_text(
        json.dumps(ratings_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    class_counts = {
        CLASS_LABELS[i]: int((y == i).sum()) for i in range(len(CLASS_LABELS))
    }
    metadata = {
        "cutoff_key": cutoff_key,
        "cutoff_date_exclusive": cutoff_date,
        "max_game_date": str(sub["date"].max()),
        "num_games": int(len(sub)),
        "num_rated_players": int(len(ratings_snapshot)),
        "features": FEATURE_NAMES,
        "rule_map": RULE_MAP,
        "class_labels": CLASS_LABELS,
        "class_counts": class_counts,
        "rule_counts": {str(k): int(v) for k, v in sub["rule"].value_counts().items()},
        "cv_5fold_logloss": round(cv_logloss, 5),
        "cv_5fold_accuracy": round(cv_acc, 5),
    }
    (out_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Train CatBoost models with chronological WHR features.")
    parser.add_argument("--db-dir", type=Path, default=DEFAULT_DB_DIR)
    parser.add_argument("--models-dir", type=Path, default=DEFAULT_MODELS_DIR)
    parser.add_argument(
        "--today",
        type=str,
        default=_date.today().isoformat(),
        help="Cutoff date (exclusive) for the latest model (YYYY-MM-DD).",
    )
    parser.add_argument(
        "--cutoffs",
        type=str,
        default="",
        help="Optional comma-separated cutoff keys to retrain (e.g. 20260630,20260930,20261124).",
    )
    args = parser.parse_args()

    all_games, player_names = load_data(args.db_dir)
    cutoffs = [
        ("20241231", "2025-01-01"),
        ("20250331", "2025-04-01"),
        ("20250630", "2025-07-01"),
        ("20250930", "2025-10-01"),
        ("20251231", "2026-01-01"),
        ("20260331", "2026-04-01"),
        ("20260630", "2026-07-01"),
        ("20260930", "2026-10-01"),
        ("20261124", "2026-11-25"),
    ]
    target_keys = {k.strip() for k in args.cutoffs.split(",") if k.strip()} if args.cutoffs else {k for k, _ in cutoffs}

    X_all, y_all, dates_all, snapshots = build_all_cutoffs_features(all_games, cutoffs)

    summary = []
    for key, cutoff_date in cutoffs:
        if key not in target_keys:
            meta_path = args.models_dir / key / "metadata.json"
            if meta_path.is_file():
                summary.append(json.loads(meta_path.read_text(encoding="utf-8")))
            continue
        meta = train_cutoff(
            key, cutoff_date, all_games, X_all, y_all, dates_all,
            snapshots[key], player_names, args.models_dir,
        )
        summary.append(meta)
        print(
            f"[{key}] (< {cutoff_date}) games={meta['num_games']}, "
            f"players={meta['num_rated_players']}, "
            f"5-fold logloss={meta['cv_5fold_logloss']:.4f}, "
            f"acc={meta['cv_5fold_accuracy']:.4f}"
        )

    (args.models_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
