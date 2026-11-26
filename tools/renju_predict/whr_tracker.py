"""Strict chronological no-leakage WHR (whole_history_rating) tracker with C kernel."""

from __future__ import annotations

import ctypes
import math
import os
import sys
from dataclasses import dataclass
from datetime import date as _date
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

WHR_W2 = 19.3
WHR_VIRTUAL_GAMES = 2
WHR_BIAS = 1900.0
WHR_PRIOR_STD = 350.0
EPOCH = _date(1970, 1, 1)

_THIS_DIR = Path(__file__).resolve().parent
_DLL_PATH = _THIS_DIR / ("whr_kernel.dll" if os.name == "nt" else "whr_kernel.so")
_C_LIB = None

if _DLL_PATH.is_file():
    try:
        _lib = ctypes.CDLL(str(_DLL_PATH))
        _lib.whr_create.argtypes = [ctypes.c_double, ctypes.c_double]
        _lib.whr_create.restype = ctypes.c_void_p
        _lib.whr_free.argtypes = [ctypes.c_void_p]
        _lib.whr_add_games.argtypes = [
            ctypes.c_void_p,
            ctypes.c_int,
            ctypes.POINTER(ctypes.c_int),
            ctypes.POINTER(ctypes.c_int),
            ctypes.POINTER(ctypes.c_double),
            ctypes.c_int,
        ]
        _lib.whr_iterate.argtypes = [
            ctypes.c_void_p,
            ctypes.c_int,
            ctypes.c_int,
            ctypes.c_double,
        ]
        _lib.whr_iterate.restype = ctypes.c_int
        _lib.whr_get_latest.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_int),
            ctypes.POINTER(ctypes.c_int),
            ctypes.POINTER(ctypes.c_double),
            ctypes.POINTER(ctypes.c_double),
            ctypes.POINTER(ctypes.c_int),
        ]
        _C_LIB = _lib
    except Exception:
        _C_LIB = None

if _C_LIB is None:
    WORKSPACE = _THIS_DIR.parent
    if not (WORKSPACE / "tmp_src" / "whr_src").is_dir() and (WORKSPACE.parent / "tmp_src" / "whr_src").is_dir():
        WORKSPACE = WORKSPACE.parent
    if not (WORKSPACE / "tmp_src" / "whr_src").is_dir() and (WORKSPACE.parent.parent / "tmp_src" / "whr_src").is_dir():
        WORKSPACE = WORKSPACE.parent.parent
    WHR_SRC = WORKSPACE / "tmp_src" / "whr_src"
    if WHR_SRC.is_dir() and str(WHR_SRC) not in sys.path:
        sys.path.insert(0, str(WHR_SRC))
    import whr


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
        self.latest: Dict[object, Tuple[float, float, int]] = {}
        self.ratings: Dict[object, PlayerRating] = {}

        if _C_LIB is not None:
            self._use_c = True
            self._c_state = _C_LIB.whr_create(float(self.w2), float(self.virtual_games))
            self._pid_to_idx: Dict[object, int] = {}
            self._idx_to_pid: List[object] = []
            self._cap = 512
            self._out_pids = (ctypes.c_int * self._cap)()
            self._out_days = (ctypes.c_int * self._cap)()
            self._out_elos = (ctypes.c_double * self._cap)()
            self._out_stds = (ctypes.c_double * self._cap)()
            self._out_cnt = ctypes.c_int(0)
        else:
            self._use_c = False
            self._base = whr.Base(config={"w2": self.w2, "virtual_games": self.virtual_games})
            self._id_map: Dict[str, object] = {}

    def __del__(self) -> None:
        if getattr(self, "_use_c", False) and getattr(self, "_c_state", None):
            _C_LIB.whr_free(self._c_state)
            self._c_state = None

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

    def _c_idx(self, pid: object) -> int:
        idx = self._pid_to_idx.get(pid)
        if idx is None:
            idx = len(self._idx_to_pid)
            self._pid_to_idx[pid] = idx
            self._idx_to_pid.append(pid)
        return idx

    def add_games_only(self, games: Iterable[Tuple[object, object, float]], day_int: int) -> int:
        if not self._use_c:
            self.apply_period(games, day_int)
            return 0
        p1_list: List[int] = []
        p2_list: List[int] = []
        sc_list: List[float] = []
        for p1, p2, score in games:
            if p1 == p2 or score not in (1.0, 0.5, 0.0):
                continue
            p1_list.append(self._c_idx(p1))
            p2_list.append(self._c_idx(p2))
            sc_list.append(float(score))
        n = len(p1_list)
        if n == 0:
            return 0
        arr_p1 = (ctypes.c_int * n)(*p1_list)
        arr_p2 = (ctypes.c_int * n)(*p2_list)
        arr_sc = (ctypes.c_double * n)(*sc_list)
        _C_LIB.whr_add_games(self._c_state, n, arr_p1, arr_p2, arr_sc, int(day_int))
        return n

    def iterate_and_sync(self, min_iters: int = 1, max_iters: int = 8, tol_elo: float = 0.05) -> None:
        if not self._use_c:
            return
        _C_LIB.whr_iterate(self._c_state, int(min_iters), int(max_iters), float(tol_elo))
        n_players = len(self._idx_to_pid)
        if n_players > self._cap:
            self._cap = max(self._cap * 2, n_players)
            self._out_pids = (ctypes.c_int * self._cap)()
            self._out_days = (ctypes.c_int * self._cap)()
            self._out_elos = (ctypes.c_double * self._cap)()
            self._out_stds = (ctypes.c_double * self._cap)()
        _C_LIB.whr_get_latest(
            self._c_state,
            self._out_pids,
            self._out_days,
            self._out_elos,
            self._out_stds,
            ctypes.byref(self._out_cnt),
        )
        cnt = self._out_cnt.value
        bias = self.bias
        latest = self.latest
        idx_to_pid = self._idx_to_pid
        for k in range(cnt):
            pid = idx_to_pid[self._out_pids[k]]
            latest[pid] = (self._out_elos[k] + bias, self._out_stds[k], self._out_days[k])

    def snapshot_ratings(self) -> Dict[object, PlayerRating]:
        return {
            pid: PlayerRating(rating=r, std=std)
            for pid, (r, std, _d) in self.latest.items()
        }

    def apply_period(self, games: Iterable[Tuple[object, object, float]], day_int: int) -> None:
        if self._use_c:
            if self.add_games_only(games, day_int) == 0:
                return
            self.iterate_and_sync(min_iters=1, max_iters=8, tol_elo=0.05)
            return

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
