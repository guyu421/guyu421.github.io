#include <math.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
#define EXPORT __declspec(dllexport)
#else
#define EXPORT
#endif

static const double LN10_OVER_400 = 0.005756462732485114; // ln(10)/400
static const double ELO_PER_NAT = 173.71779276130073;     // 400/ln(10)

typedef struct {
    int n_players;
    int cap_players;
    int n_games;
    int cap_games;

    // Game arrays
    int *g_p1;
    int *g_p2;
    double *g_score1; // 1.0, 0.5, 0.0
    int *g_day;
    int *g_pd1;       // index into player 1's day array
    int *g_pd2;       // index into player 2's day array

    // Per-player day arrays (CSR-like or dynamic per player)
    int *p_ndays;
    int *p_capdays;
    int **p_days;
    double **p_r;
    double **p_std;

    // Per-player-day game lists (for fast O(1) lookup)
    // Stored as flat linked list over games: next_g1[g], next_g2[g]
    int *g_next1;
    int *g_next2;
    int **pd_head1; // games where player is p1
    int **pd_head2; // games where player is p2

    double w2_nat;
    double virtual_games;
} WHRState;

EXPORT WHRState* whr_create(double w2, double virtual_games) {
    WHRState *st = (WHRState*)calloc(1, sizeof(WHRState));
    st->w2_nat = w2 * LN10_OVER_400 * LN10_OVER_400;
    st->virtual_games = virtual_games;
    st->cap_players = 512;
    st->p_ndays = (int*)calloc(st->cap_players, sizeof(int));
    st->p_capdays = (int*)calloc(st->cap_players, sizeof(int));
    st->p_days = (int**)calloc(st->cap_players, sizeof(int*));
    st->p_r = (double**)calloc(st->cap_players, sizeof(double*));
    st->p_std = (double**)calloc(st->cap_players, sizeof(double*));
    st->pd_head1 = (int**)calloc(st->cap_players, sizeof(int*));
    st->pd_head2 = (int**)calloc(st->cap_players, sizeof(int*));

    st->cap_games = 4096;
    st->g_p1 = (int*)malloc(st->cap_games * sizeof(int));
    st->g_p2 = (int*)malloc(st->cap_games * sizeof(int));
    st->g_score1 = (double*)malloc(st->cap_games * sizeof(double));
    st->g_day = (int*)malloc(st->cap_games * sizeof(int));
    st->g_pd1 = (int*)malloc(st->cap_games * sizeof(int));
    st->g_pd2 = (int*)malloc(st->cap_games * sizeof(int));
    st->g_next1 = (int*)malloc(st->cap_games * sizeof(int));
    st->g_next2 = (int*)malloc(st->cap_games * sizeof(int));
    return st;
}

EXPORT void whr_free(WHRState *st) {
    if (!st) return;
    for (int i = 0; i < st->n_players; ++i) {
        free(st->p_days[i]);
        free(st->p_r[i]);
        free(st->p_std[i]);
        free(st->pd_head1[i]);
        free(st->pd_head2[i]);
    }
    free(st->p_ndays); free(st->p_capdays);
    free(st->p_days); free(st->p_r); free(st->p_std);
    free(st->pd_head1); free(st->pd_head2);
    free(st->g_p1); free(st->g_p2); free(st->g_score1);
    free(st->g_day); free(st->g_pd1); free(st->g_pd2);
    free(st->g_next1); free(st->g_next2);
    free(st);
}

static void ensure_player(WHRState *st, int pid) {
    if (pid < st->cap_players) {
        if (pid >= st->n_players) st->n_players = pid + 1;
        return;
    }
    int new_cap = st->cap_players * 2;
    while (new_cap <= pid) new_cap *= 2;
    st->p_ndays = (int*)realloc(st->p_ndays, new_cap * sizeof(int));
    st->p_capdays = (int*)realloc(st->p_capdays, new_cap * sizeof(int));
    st->p_days = (int**)realloc(st->p_days, new_cap * sizeof(int*));
    st->p_r = (double**)realloc(st->p_r, new_cap * sizeof(double*));
    st->p_std = (double**)realloc(st->p_std, new_cap * sizeof(double*));
    st->pd_head1 = (int**)realloc(st->pd_head1, new_cap * sizeof(int*));
    st->pd_head2 = (int**)realloc(st->pd_head2, new_cap * sizeof(int*));
    for (int i = st->cap_players; i < new_cap; ++i) {
        st->p_ndays[i] = 0; st->p_capdays[i] = 0;
        st->p_days[i] = NULL; st->p_r[i] = NULL; st->p_std[i] = NULL;
        st->pd_head1[i] = NULL; st->pd_head2[i] = NULL;
    }
    st->cap_players = new_cap;
    st->n_players = pid + 1;
}

static int get_or_add_pday(WHRState *st, int pid, int day) {
    ensure_player(st, pid);
    int n = st->p_ndays[pid];
    if (n > 0 && st->p_days[pid][n - 1] == day) {
        return n - 1;
    }
    // Check if day already exists (in case out-of-order)
    for (int i = n - 1; i >= 0; --i) {
        if (st->p_days[pid][i] == day) return i;
        if (st->p_days[pid][i] < day) break;
    }
    if (n >= st->p_capdays[pid]) {
        int nc = st->p_capdays[pid] == 0 ? 16 : st->p_capdays[pid] * 2;
        st->p_days[pid] = (int*)realloc(st->p_days[pid], nc * sizeof(int));
        st->p_r[pid] = (double*)realloc(st->p_r[pid], nc * sizeof(double));
        st->p_std[pid] = (double*)realloc(st->p_std[pid], nc * sizeof(double));
        st->pd_head1[pid] = (int*)realloc(st->pd_head1[pid], nc * sizeof(int));
        st->pd_head2[pid] = (int*)realloc(st->pd_head2[pid], nc * sizeof(int));
        st->p_capdays[pid] = nc;
    }
    // Warm start from previous day's rating
    double init_r = (n > 0) ? st->p_r[pid][n - 1] : 0.0;
    st->p_days[pid][n] = day;
    st->p_r[pid][n] = init_r;
    st->p_std[pid][n] = 350.0;
    st->pd_head1[pid][n] = -1;
    st->pd_head2[pid][n] = -1;
    st->p_ndays[pid] = n + 1;
    return n;
}

EXPORT void whr_add_games(WHRState *st, int count, const int *p1, const int *p2, const double *score1, int day) {
    if (st->n_games + count > st->cap_games) {
        int nc = st->cap_games * 2;
        while (nc < st->n_games + count) nc *= 2;
        st->g_p1 = (int*)realloc(st->g_p1, nc * sizeof(int));
        st->g_p2 = (int*)realloc(st->g_p2, nc * sizeof(int));
        st->g_score1 = (double*)realloc(st->g_score1, nc * sizeof(double));
        st->g_day = (int*)realloc(st->g_day, nc * sizeof(int));
        st->g_pd1 = (int*)realloc(st->g_pd1, nc * sizeof(int));
        st->g_pd2 = (int*)realloc(st->g_pd2, nc * sizeof(int));
        st->g_next1 = (int*)realloc(st->g_next1, nc * sizeof(int));
        st->g_next2 = (int*)realloc(st->g_next2, nc * sizeof(int));
        st->cap_games = nc;
    }
    for (int i = 0; i < count; ++i) {
        int a = p1[i], b = p2[i];
        if (a == b) continue;
        int d1 = get_or_add_pday(st, a, day);
        int d2 = get_or_add_pday(st, b, day);
        int g = st->n_games++;
        st->g_p1[g] = a;
        st->g_p2[g] = b;
        st->g_score1[g] = score1[i];
        st->g_day[g] = day;
        st->g_pd1[g] = d1;
        st->g_pd2[g] = d2;
        st->g_next1[g] = st->pd_head1[a][d1];
        st->pd_head1[a][d1] = g;
        st->g_next2[g] = st->pd_head2[b][d2];
        st->pd_head2[b][d2] = g;
    }
}

static void build_player_hessian_grad(
    WHRState *st, int pid, double *grad, double *diag, double *off
) {
    int K = st->p_ndays[pid];
    int *days = st->p_days[pid];
    double *r = st->p_r[pid];

    for (int t = 0; t < K; ++t) {
        double rt = r[t];
        double gt = 0.0;
        double ht = 0.0;
        // Games where pid is p1
        for (int g = st->pd_head1[pid][t]; g != -1; g = st->g_next1[g]) {
            double r_opp = st->p_r[st->g_p2[g]][st->g_pd2[g]];
            double diff = rt - r_opp;
            double p = 1.0 / (1.0 + exp(-diff));
            gt += st->g_score1[g] - p;
            ht -= p * (1.0 - p);
        }
        // Games where pid is p2
        for (int g = st->pd_head2[pid][t]; g != -1; g = st->g_next2[g]) {
            double r_opp = st->p_r[st->g_p1[g]][st->g_pd1[g]];
            double diff = rt - r_opp;
            double p = 1.0 / (1.0 + exp(-diff));
            gt += (1.0 - st->g_score1[g]) - p;
            ht -= p * (1.0 - p);
        }
        // Virtual games on t == 0 (draws against r=0, equivalent to virtual_games/2 wins + virtual_games/2 losses, or virtual_games * (0.5 - p)?)
        if (t == 0 && st->virtual_games > 0.0) {
            double p0 = 1.0 / (1.0 + exp(-rt));
            gt += st->virtual_games * (0.5 - p0);
            ht -= st->virtual_games * p0 * (1.0 - p0);
        }
        grad[t] = gt;
        diag[t] = ht;
    }
    for (int t = 0; t < K - 1; ++t) {
        double dt = (double)(days[t + 1] - days[t]);
        if (dt < 1.0) dt = 1.0;
        double inv_s2 = 1.0 / (st->w2_nat * dt);
        double d = r[t] - r[t + 1];
        grad[t] -= d * inv_s2;
        grad[t + 1] += d * inv_s2;
        diag[t] -= inv_s2;
        diag[t + 1] -= inv_s2;
        off[t] = inv_s2;
    }
}

static double newton_step_player(
    WHRState *st, int pid, double *grad, double *diag, double *off,
    double *c_prime, double *d_prime, double *delta
) {
    int K = st->p_ndays[pid];
    if (K == 0) return 0.0;
    build_player_hessian_grad(st, pid, grad, diag, off);
    // Solve (-H) * delta = grad, where A = -H has positive diagonal a_i = -diag[i] and negative off-diagonal b_i = -off[i]
    // Thomas algorithm
    double a0 = -diag[0];
    if (a0 < 1e-12) a0 = 1e-12;
    if (K == 1) {
        double d = grad[0] / a0;
        if (d > 2.0) d = 2.0;
        if (d < -2.0) d = -2.0;
        st->p_r[pid][0] += d;
        return fabs(d);
    }
    c_prime[0] = (-off[0]) / a0;
    d_prime[0] = grad[0] / a0;
    for (int i = 1; i < K; ++i) {
        double b_prev = -off[i - 1];
        double a_i = -diag[i];
        double denom = a_i - b_prev * c_prime[i - 1];
        if (denom < 1e-12) denom = 1e-12;
        c_prime[i] = (i < K - 1) ? ((-off[i]) / denom) : 0.0;
        d_prime[i] = (grad[i] - b_prev * d_prime[i - 1]) / denom;
    }
    delta[K - 1] = d_prime[K - 1];
    for (int i = K - 2; i >= 0; --i) {
        delta[i] = d_prime[i] - c_prime[i] * delta[i + 1];
    }
    double max_chg = 0.0;
    for (int i = 0; i < K; ++i) {
        double d = delta[i];
        if (d > 2.0) d = 2.0;
        if (d < -2.0) d = -2.0;
        st->p_r[pid][i] += d;
        if (fabs(d) > max_chg) max_chg = fabs(d);
    }
    return max_chg;
}

static void update_player_uncertainty(
    WHRState *st, int pid, double *grad, double *diag, double *off,
    double *lu_d, double *ul_d
) {
    int K = st->p_ndays[pid];
    if (K == 0) return;
    build_player_hessian_grad(st, pid, grad, diag, off);
    // Compute diagonal of (-H)^{-1} in O(K) via forward LU and backward UL!
    // Forward: lu_d[0] = a_0, lu_d[i] = a_i - b_{i-1}^2 / lu_d[i-1]
    lu_d[0] = -diag[0];
    if (lu_d[0] < 1e-12) lu_d[0] = 1e-12;
    for (int i = 1; i < K; ++i) {
        double b = -off[i - 1];
        double v = -diag[i] - (b * b) / lu_d[i - 1];
        lu_d[i] = (v > 1e-12) ? v : 1e-12;
    }
    // Backward: ul_d[K-1] = a_{K-1}, ul_d[i] = a_i - b_i^2 / ul_d[i+1]
    ul_d[K - 1] = -diag[K - 1];
    if (ul_d[K - 1] < 1e-12) ul_d[K - 1] = 1e-12;
    for (int i = K - 2; i >= 0; --i) {
        double b = -off[i];
        double v = -diag[i] - (b * b) / ul_d[i + 1];
        ul_d[i] = (v > 1e-12) ? v : 1e-12;
    }
    // ((-H)^{-1})_{i,i} = 1 / (lu_d[i] + ul_d[i] - a_i)
    for (int i = 0; i < K; ++i) {
        double denom = lu_d[i] + ul_d[i] - (-diag[i]);
        double var = (denom > 1e-12) ? (1.0 / denom) : 1.0;
        st->p_std[pid][i] = sqrt(var) * ELO_PER_NAT;
    }
}

EXPORT int whr_iterate(WHRState *st, int min_iters, int max_iters, double tol_elo) {
    int max_k = 16;
    for (int p = 0; p < st->n_players; ++p) {
        if (st->p_ndays[p] > max_k) max_k = st->p_ndays[p];
    }
    double *buf = (double*)malloc(max_k * 6 * sizeof(double));
    double *grad = buf;
    double *diag = buf + max_k;
    double *off = buf + max_k * 2;
    double *c_prime = buf + max_k * 3;
    double *d_prime = buf + max_k * 4;
    double *delta = buf + max_k * 5;

    int iters = 0;
    double tol_nat = tol_elo / ELO_PER_NAT;
    for (int it = 0; it < max_iters; ++it) {
        double max_chg = 0.0;
        for (int p = 0; p < st->n_players; ++p) {
            if (st->p_ndays[p] == 0) continue;
            double chg = newton_step_player(st, p, grad, diag, off, c_prime, d_prime, delta);
            if (chg > max_chg) max_chg = chg;
        }
        iters++;
        if (iters >= min_iters && max_chg < tol_nat) break;
    }

    for (int p = 0; p < st->n_players; ++p) {
        if (st->p_ndays[p] > 0) {
            update_player_uncertainty(st, p, grad, diag, off, c_prime, d_prime);
        }
    }
    free(buf);
    return iters;
}

EXPORT void whr_get_latest(WHRState *st, int *out_pids, int *out_days, double *out_elos, double *out_stds, int *out_count) {
    int cnt = 0;
    for (int p = 0; p < st->n_players; ++p) {
        int k = st->p_ndays[p];
        if (k > 0) {
            out_pids[cnt] = p;
            out_days[cnt] = st->p_days[p][k - 1];
            out_elos[cnt] = st->p_r[p][k - 1] * ELO_PER_NAT;
            out_stds[cnt] = st->p_std[p][k - 1];
            cnt++;
        }
    }
    *out_count = cnt;
}
