"""Standard Glicko-2 rating system implementation (Mark Glickman)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

GLICKO2_SCALE = 173.7178
DEFAULT_RATING = 1500.0
DEFAULT_RD = 350.0
DEFAULT_VOLATILITY = 0.06
DEFAULT_TAU = 0.5
EPSILON = 1e-6


@dataclass
class PlayerRating:
    rating: float = DEFAULT_RATING
    rd: float = DEFAULT_RD
    vol: float = DEFAULT_VOLATILITY

    def to_mu_phi(self) -> Tuple[float, float]:
        return (self.rating - DEFAULT_RATING) / GLICKO2_SCALE, self.rd / GLICKO2_SCALE


def _g(phi: float) -> float:
    return 1.0 / math.sqrt(1.0 + 3.0 * (phi ** 2) / (math.pi ** 2))


def _e(mu: float, mu_j: float, phi_j: float) -> float:
    exponent = -_g(phi_j) * (mu - mu_j)
    # Clamp to avoid overflow on extreme rating differences
    exponent = max(-60.0, min(60.0, exponent))
    return 1.0 / (1.0 + math.exp(exponent))


def _new_volatility(phi: float, sigma: float, delta: float, v: float, tau: float) -> float:
    a = math.log(sigma ** 2)
    phi2 = phi ** 2
    delta2 = delta ** 2

    def f(x: float) -> float:
        ex = math.exp(x)
        denom = 2.0 * ((phi2 + v + ex) ** 2)
        return (ex * (delta2 - phi2 - v - ex)) / denom - (x - a) / (tau ** 2)

    A = a
    if delta2 > phi2 + v:
        B = math.log(delta2 - phi2 - v)
    else:
        k = 1
        while f(a - k * tau) < 0:
            k += 1
        B = a - k * tau

    fA = f(A)
    fB = f(B)

    while abs(B - A) > EPSILON:
        C = A + (A - B) * fA / (fB - fA)
        fC = f(C)
        if fC * fB <= 0:
            A = B
            fA = fB
        else:
            fA = fA / 2.0
        B = C
        fB = fC

    return math.exp(A / 2.0)


def update_player(
    player: PlayerRating,
    opponents: List[Tuple[PlayerRating, float]],
    tau: float = DEFAULT_TAU,
) -> PlayerRating:
    """Update one player's Glicko-2 rating after a rating period.

    Args:
        player: Current PlayerRating before the period.
        opponents: List of (opponent_pre_period_rating, score) where score is 1.0, 0.5, or 0.0.
        tau: System constant constraining volatility change.
    """
    mu, phi = player.to_mu_phi()
    if not opponents:
        phi_star = math.sqrt(phi ** 2 + player.vol ** 2)
        return PlayerRating(
            rating=player.rating,
            rd=min(DEFAULT_RD, GLICKO2_SCALE * phi_star),
            vol=player.vol,
        )

    v_inv = 0.0
    delta_sum = 0.0
    for opp, score in opponents:
        mu_j, phi_j = opp.to_mu_phi()
        g_j = _g(phi_j)
        e_j = _e(mu, mu_j, phi_j)
        v_inv += (g_j ** 2) * e_j * (1.0 - e_j)
        delta_sum += g_j * (score - e_j)

    v = 1.0 / v_inv
    delta = v * delta_sum
    new_vol = _new_volatility(phi, player.vol, delta, v, tau)
    phi_star = math.sqrt(phi ** 2 + new_vol ** 2)
    phi_prime = 1.0 / math.sqrt(1.0 / (phi_star ** 2) + 1.0 / v)
    mu_prime = mu + (phi_prime ** 2) * delta_sum

    return PlayerRating(
        rating=DEFAULT_RATING + GLICKO2_SCALE * mu_prime,
        rd=GLICKO2_SCALE * phi_prime,
        vol=new_vol,
    )


class Glicko2Tracker:
    """Tracks Glicko-2 ratings chronologically across rating periods (by date)."""

    def __init__(self, tau: float = DEFAULT_TAU) -> None:
        self.tau = tau
        self.ratings: Dict[int, PlayerRating] = {}

    def get(self, player_id: int) -> PlayerRating:
        return self.ratings.get(player_id, PlayerRating())

    def apply_period(self, games: Iterable[Tuple[int, int, float]]) -> None:
        """Apply all games in one rating period simultaneously.

        Args:
            games: Iterable of (first_id, second_id, first_score) where first_score in {1.0, 0.5, 0.0}.
        """
        per_player: Dict[int, List[Tuple[PlayerRating, float]]] = {}
        for first_id, second_id, first_score in games:
            r1 = self.get(first_id)
            r2 = self.get(second_id)
            per_player.setdefault(first_id, []).append((r2, first_score))
            per_player.setdefault(second_id, []).append((r1, 1.0 - first_score))

        updated: Dict[int, PlayerRating] = {}
        for pid, opps in per_player.items():
            updated[pid] = update_player(self.get(pid), opps, tau=self.tau)
        self.ratings.update(updated)
