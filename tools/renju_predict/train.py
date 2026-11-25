"""Train LightGBM match-outcome models for multiple date cutoffs using Glicko-2 features."""

from __future__ import annotations

import argparse
import json
from datetime import date as _date
from pathlib import Path
from typing import Dict, List, Tuple

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, log_loss
from sklearn.model_selection import StratifiedKFold

from glicko2 import DEFAULT_RD, DEFAULT_RATING, DEFAULT_VOLATILITY, Glicko2Tracker

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
FEATURE_NAMES = ["rule", "first_rating", "second_rating", "rating_diff", "first_rd", "second_rd"]
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


def build_features_and_ratings(
    df: pd.DataFrame,
) -> Tuple[pd.DataFrame, np.ndarray, Glicko2Tracker]:
    """Compute pre-match Glicko-2 features chronologically without leakage."""
    tracker = Glicko2Tracker()
    rows: List[Dict[str, float | int]] = []
    targets: List[int] = []

    for _, period_df in df.groupby(["date", "tournament_id", "round"], sort=True):
        period_games: List[Tuple[int, int, float]] = []
        for r in period_df.itertuples(index=False):
            rule_code = RULE_MAP.get(str(r.rule))
            if rule_code is None:
                raise ValueError(f"Unknown rule: {r.rule!r}")
            p1 = tracker.get(r.first_id)
            p2 = tracker.get(r.second_id)
            rows.append(
                {
                    "rule": rule_code,
                    "first_rating": p1.rating,
                    "second_rating": p2.rating,
                    "rating_diff": p1.rating - p2.rating,
                    "first_rd": p1.rd,
                    "second_rd": p2.rd,
                }
            )
            targets.append(RESULT_TO_CLASS[str(r.result)])
            period_games.append((r.first_id, r.second_id, RESULT_SCORE[str(r.result)]))

        tracker.apply_period(period_games)

    X = pd.DataFrame(rows, columns=FEATURE_NAMES)
    X["rule"] = X["rule"].astype("category")
    y = np.array(targets, dtype=np.int64)
    return X, y, tracker


def make_lgbm() -> lgb.LGBMClassifier:
    return lgb.LGBMClassifier(
        objective="multiclass",
        num_class=3,
        n_estimators=250,
        learning_rate=0.03,
        num_leaves=23,
        max_depth=5,
        min_child_samples=40,
        subsample=0.8,
        subsample_freq=1,
        colsample_bytree=0.8,
        reg_alpha=0.5,
        reg_lambda=3.0,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )


def train_cutoff(
    cutoff_key: str,
    cutoff_date: str,
    all_games: pd.DataFrame,
    player_names: Dict[int, str],
    models_dir: Path,
) -> Dict[str, object]:
    sub = all_games[all_games["date"] < cutoff_date].copy()
    if sub.empty:
        raise RuntimeError(f"No games found before {cutoff_date}")

    X, y, tracker = build_features_and_ratings(sub)

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    oof_probs = np.zeros((len(y), 3), dtype=np.float64)
    for train_idx, val_idx in skf.split(X, y):
        clf = make_lgbm()
        clf.fit(
            X.iloc[train_idx],
            y[train_idx],
            categorical_feature=["rule"],
        )
        oof_probs[val_idx] = clf.predict_proba(X.iloc[val_idx])

    cv_logloss = float(log_loss(y, oof_probs, labels=[0, 1, 2]))
    cv_acc = float(accuracy_score(y, np.argmax(oof_probs, axis=1)))

    final_clf = make_lgbm()
    final_clf.fit(X, y, categorical_feature=["rule"])

    out_dir = models_dir / cutoff_key
    out_dir.mkdir(parents=True, exist_ok=True)
    final_clf.booster_.save_model(str(out_dir / "model.txt"))

    ratings_payload = {
        "default": {
            "rating": DEFAULT_RATING,
            "rd": DEFAULT_RD,
            "vol": DEFAULT_VOLATILITY,
        },
        "players": {
            str(pid): {
                "name": player_names.get(pid, str(pid)),
                "rating": round(pr.rating, 4),
                "rd": round(pr.rd, 4),
                "vol": round(pr.vol, 6),
            }
            for pid, pr in sorted(tracker.ratings.items())
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
        "num_rated_players": int(len(tracker.ratings)),
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
    parser = argparse.ArgumentParser(description="Train LightGBM models with Glicko-2 features.")
    parser.add_argument("--db-dir", type=Path, default=DEFAULT_DB_DIR)
    parser.add_argument("--models-dir", type=Path, default=DEFAULT_MODELS_DIR)
    parser.add_argument(
        "--today",
        type=str,
        default=_date.today().isoformat(),
        help="Cutoff date (exclusive) for the latest model (YYYY-MM-DD).",
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

    summary = []
    for key, cutoff_date in cutoffs:
        meta = train_cutoff(key, cutoff_date, all_games, player_names, args.models_dir)
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
