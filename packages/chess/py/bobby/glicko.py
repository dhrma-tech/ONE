"""Glicko-2 (Glickman, 2013 example)."""
from __future__ import annotations

import math

SCALE = 173.7178
TAU = 0.5
EPS = 1e-6
RD_MAX = 350.0
RD_MIN = 40.0


def _g(phi: float) -> float:
    return 1.0 / math.sqrt(1.0 + 3.0 * phi * phi / math.pi ** 2)


def _e(mu: float, mu_j: float, phi_j: float) -> float:
    return 1.0 / (1.0 + math.exp(-_g(phi_j) * (mu - mu_j)))


def _new_sigma(sigma: float, phi: float, v: float, delta: float, tau: float) -> float:
    a = math.log(sigma * sigma)

    def f(x: float) -> float:
        ex = math.exp(x)
        return ex * (delta ** 2 - phi ** 2 - v - ex) / (2 * (phi ** 2 + v + ex) ** 2) - (x - a) / tau ** 2

    A = a
    if delta ** 2 > phi ** 2 + v:
        B = math.log(delta ** 2 - phi ** 2 - v)
    else:
        k = 1
        while f(a - k * tau) < 0:
            k += 1
        B = a - k * tau
    fa, fb = f(A), f(B)
    while abs(B - A) > EPS:
        C = A + (A - B) * fa / (fb - fa)
        fc = f(C)
        if fc * fb <= 0:
            A, fa = B, fb
        else:
            fa /= 2
        B, fb = C, fc
    return math.exp(A / 2)


def update(rating: float, rd: float, vol: float, results: list[tuple[float, float, float]], tau: float = TAU) -> tuple[float, float, float]:
    """One rating period. results: [(opp_rating, opp_rd, score)]. Returns (rating, rd, vol)."""
    mu, phi = (rating - 1500) / SCALE, rd / SCALE
    if not results:
        return rating, min(RD_MAX, math.sqrt(phi ** 2 + vol ** 2) * SCALE), vol
    terms = [((r - 1500) / SCALE, d / SCALE, s) for r, d, s in results]
    v = 1.0 / sum(_g(pj) ** 2 * _e(mu, mj, pj) * (1 - _e(mu, mj, pj)) for mj, pj, _ in terms)
    delta = v * sum(_g(pj) * (s - _e(mu, mj, pj)) for mj, pj, s in terms)
    sigma = _new_sigma(vol, phi, v, delta, tau)
    phi_star = math.sqrt(phi ** 2 + sigma ** 2)
    phi_new = 1.0 / math.sqrt(1.0 / phi_star ** 2 + 1.0 / v)
    mu_new = mu + phi_new ** 2 * sum(_g(pj) * (s - _e(mu, mj, pj)) for mj, pj, s in terms)
    return mu_new * SCALE + 1500, phi_new * SCALE, sigma


def inflate_rd(rd: float, vol: float, periods: int) -> float:
    """RD growth over idle rating periods."""
    phi = rd / SCALE
    return min(RD_MAX, math.sqrt(phi ** 2 + max(0, periods) * vol ** 2) * SCALE)
