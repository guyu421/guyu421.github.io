"""Standard TrueSkill rating tracker."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, Tuple

import trueskill

DEFAULT_MU = trueskill.MU          # 25.0
DEFAULT_SIGMA = trueskill.SIGMA    # 25.0 / 3.0 (~8.3333)
DEFAULT_BETA = trueskill.BETA      # 25.0 / 6.0 (~4.1667)
DEFAULT_TAU = trueskill.TAU        # 25.0 / 300.0 (~0.0833)
DEFAULT_DRAW_PROBABILITY = trueskill.DRAW_PROBABILITY  # 0.10


@dataclass
class PlayerRating:
    rating: float = DEFAULT_MU
    rd: float = DEFAULT_SIGMA

    def to_ts(self) -> trueskill.Rating:
        return trueskill.Rating(mu=self.rating, sigma=self.rd)


class TrueSkillTracker:
    """Maintains chronological standard TrueSkill ratings across rating periods."""

    def __init__(
        self,
        mu: float = DEFAULT_MU,
        sigma: float = DEFAULT_SIGMA,
        beta: float = DEFAULT_BETA,
        tau: float = DEFAULT_TAU,
        draw_probability: float = DEFAULT_DRAW_PROBABILITY,
    ) -> None:
        self.env = trueskill.TrueSkill(
            mu=mu,
            sigma=sigma,
            beta=beta,
            tau=tau,
            draw_probability=draw_probability,
        )
        self.ratings: Dict[object, PlayerRating] = {}

    def get(self, player_id: object) -> PlayerRating:
        pr = self.ratings.get(player_id)
        if pr is None:
            pr = PlayerRating(rating=self.env.mu, rd=self.env.sigma)
            self.ratings[player_id] = pr
        return pr

    def apply_period(self, games: Iterable[Tuple[object, object, float]]) -> None:
        """Update ratings for all games in one rating period using pre-period ratings."""
        game_list = list(games)
        if not game_list:
            return

        # Snapshot pre-period ratings so all games within the same round use the same prior.
        pre: Dict[object, trueskill.Rating] = {}
        for p1, p2, _ in game_list:
            if p1 not in pre:
                pre[p1] = self.get(p1).to_ts()
            if p2 not in pre:
                pre[p2] = self.get(p2).to_ts()

        deltas_mu: Dict[object, float] = {}
        new_sigmas: Dict[object, float] = {}
        counts: Dict[object, int] = {}

        for p1, p2, score in game_list:
            r1 = pre[p1]
            r2 = pre[p2]
            if score == 0.5:
                nr1, nr2 = self.env.rate_1vs1(r1, r2, drawn=True)
            elif score > 0.5:
                nr1, nr2 = self.env.rate_1vs1(r1, r2, drawn=False)
            else:
                nr2, nr1 = self.env.rate_1vs1(r2, r1, drawn=False)

            deltas_mu[p1] = deltas_mu.get(p1, 0.0) + (nr1.mu - r1.mu)
            deltas_mu[p2] = deltas_mu.get(p2, 0.0) + (nr2.mu - r2.mu)
            new_sigmas[p1] = nr1.sigma
            new_sigmas[p2] = nr2.sigma
            counts[p1] = counts.get(p1, 0) + 1
            counts[p2] = counts.get(p2, 0) + 1

        for pid, dmu in deltas_mu.items():
            base = pre[pid]
            self.ratings[pid] = PlayerRating(
                rating=base.mu + dmu,
                rd=new_sigmas[pid],
            )
