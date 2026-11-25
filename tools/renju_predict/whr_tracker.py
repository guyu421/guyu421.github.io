"""Strict chronological no-leakage WHR (wind23/whole_history_rating) tracker."""

from __future__ import annotations

import math
import os
import sys
from dataclasses import dataclass
from datetime import date as _date
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

WORKSPACE = Path(__file__).resolve().parent.parent
# Support both workspace/renju_predict and gh-pages/tools/renju_predict
if not (WORKSPACE / "tmp_src" / "whr_src").is_dir() and (WORKSPACE.parent / "tmp_src" / "whr_src").is_dir():
    WORKSPACE = WORKSPACE.parent
if not (WORKSPACE / "tmp_src" / "whr_src").is_dir() and (WORKSPACE.parent.parent / "tmp_src" / "whr_src").is_dir():
    WORKSPACE = WORKSPACE.parent.parent

WHR_SRC = WORKSPACE / "tmp_src" / "whr_src"
if WHR_SRC.is_dir() and str(WHR_SRC) not in sys.path:
    sys.path.insert(0, str(WHR_SRC))

import whr

WHR_W2 = 19.3
WHR_VIRTUAL_GAMES = 2
WHR_BIAS = 1900.0
WHR_PRIOR_STD = 350.0
EPOCH = _date(1970, 1, 1)


def day_of(date_text: str) -> int:
    y, m, d = (int(x) for x in str(date_text)[:10].split("-"))
    return (_date(y, m, d) - EPOCH).days


@dataclass
class PlayerRating:
    rating: float = WHR_BIAS
    std: float = WHR_PRIOR_STD


class WHRTracker:
    """Incrementally solves warm-started WHR after each rating period using only strictly prior games."""

    def __init__(
        self,
        w2: float = WHR_W2,
        virtual_games: int = WHR_VIRTUAL_GAMES,
        bias: float = WHR_BIAS,
        prior_std: float = WHR_PRIOR_STD,
    ) -> None:
        self.w2 = w2
        self.virtual_games = virtual_games
        self.bias = bias
        self.prior_std = prior_std
        self._base = whr.Base(config={"w2": self.w2, "virtual_games": self.virtual_games})
        self.latest: Dict[object, Tuple[float, float, int]] = {}
        self.ratings: Dict[object, PlayerRating] = {}
        self._id_map: Dict[str, object] = {}

    def get(self, player_id: object, current_day: Optional[int] = None) -> PlayerRating:
        hit = self.latest.get(player_id)
        if hit is None:
            return PlayerRating(rating=self.bias, std=self.prior_std)
        last_r, last_std, last_day = hit
        if current_day is not None and current_day > last_day:
            std = math.sqrt(self.w2 * (current_day - last_day) + last_std * last_std)
        else:
            std = last_std
        return PlayerRating(rating=last_r, std=std)

    def apply_period(self, games: Iterable[Tuple[object, object, float]], day_int: int) -> None:
        new_games: List[List[object]] = []
        for p1, p2, score in games:
            if p1 == p2:
                continue
            if score == 1.0:
                w = "B"
            elif score == 0.0:
                w = "W"
            elif score == 0.5:
                w = "D"
            else:
                continue
            s1, s2 = str(p1), str(p2)
            self._id_map[s1] = p1
            self._id_map[s2] = p2
            new_games.append([s1, s2, w, int(day_int)])

        if not new_games:
            return

        self._base.create_games(new_games)
        self._base.iterate_until_converge(verbose=False)

        self.latest.clear()
        self.ratings.clear()
        for name, rows in self._base.get_ordered_ratings():
            if not rows:
                continue
            last_day, last_elo, last_std = rows[-1]
            pid = self._id_map.get(name, name)
            r = float(last_elo) + self.bias
            std = float(last_std)
            self.latest[pid] = (r, std, int(last_day))
            self.ratings[pid] = PlayerRating(rating=r, std=std)
