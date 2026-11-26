"""Import missing 2023-03-18+ Renju tournaments and backfill missing game records from a RenjuNet .rif file."""

from __future__ import annotations

import argparse
import re
import unicodedata
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd

RULE_EN_TO_ZH: Dict[str, str] = {
    "Yamaguchi": "山口",
    "Taraguchi-10": "塔拉山口-10",
    "Soosyrv-8": "索索夫-8",
    "Classic": "五手两打",
    "Taraguchi": "塔拉山口",
    "Soosyrv": "索索夫",
    "Taraguchi-7": "塔拉山口-7",
    "Tarannikov": "塔拉尼科夫",
    "Sakata": "坂田",
    "Yamasyrv-8": "山索夫-8",
    "Rejection": "拒绝",
    "Soosyrv-10": "索索夫-10",
    "Yamasyrv-5": "山索夫-5",
    "LianHuan": "连换",
    "LianHuan-5": "连换-5",
    "Soosyrv-5": "索索夫-5",
    "Yamasyrv-7": "山索夫-7",
    "Jonsson": "琼森",
    "Experimental": "实验规则",
    "Super Sakata": "超级坂田",
    "Swap-5 free": "五手自由交换",
    "Soosyrv-8 (with indulgence)": "索索夫-8(含让步)",
    "Soosyrv-7": "索索夫-7",
    "Super Taraguchi-10": "超级塔拉山口-10",
}

PLAYER_ALIASES: Dict[str, str] = {
    "梁浩博": "梁皓博",
}

TOURNAMENT_PHRASES: List[Tuple[str, str]] = [
    ("World Renju Youth Cup", "世界青少年五子棋杯赛"),
    ("Youth World Championship", "世界青少年五子棋锦标赛"),
    ("Youth World qualifying tournament", "世界青少年五子棋锦标赛选拔赛"),
    ("World Team Championship", "世界五子棋团体锦标赛"),
    ("World Championship AT", "世界五子棋锦标赛A组"),
    ("World Championship BT", "世界五子棋锦标赛B组"),
    ("World Championship QT", "世界五子棋锦标赛资格赛"),
    ("World Championship", "世界五子棋锦标赛"),
    ("European Championship", "欧洲五子棋锦标赛"),
    ("European Team Championship", "欧洲五子棋团体锦标赛"),
    ("Chinese National Championship", "全国五子棋锦标赛"),
    ("Chinese National Team Championship", "全国五子棋团体锦标赛"),
    ("Chinese National Amateur King Tournament", "全国五子棋业余棋王争霸赛"),
    ("Chinese National King Tournament", "全国五子棋棋王赛"),
    ("Chinese National Queen Tournament", "全国五子棋棋后赛"),
    ("Chinese National Open", "全国五子棋公开赛"),
    ("All Japan Championship", "全日本五子棋锦标赛"),
    ("Taiwan Meijinsen Qualification", "台湾名人战预选赛"),
    ("Taiwan Meijinsen Tournament", "台湾名人战"),
    ("Taiwan Meijinsen Match", "台湾名人挑战赛"),
    ("Taiwan Meijinsen", "台湾名人战"),
    ("Youth Russian Championship", "俄罗斯青少年五子棋锦标赛"),
    ("Russian Championship", "俄罗斯五子棋锦标赛"),
    ("Russian Team Championship", "俄罗斯五子棋团体锦标赛"),
    ("Russian Cup", "俄罗斯五子棋杯"),
    ("St.Petersburg Championship", "圣彼得堡五子棋锦标赛"),
    ("St. Petersburg Championship", "圣彼得堡五子棋锦标赛"),
    ("St.Petersburg Cup", "圣彼得堡五子棋杯"),
    ("St. Petersburg Cup", "圣彼得堡五子棋杯"),
    ("Moscow Championship", "莫斯科五子棋锦标赛"),
    ("Moscow Open", "莫斯科五子棋公开赛"),
    ("Estonian Championship", "爱沙尼亚五子棋锦标赛"),
    ("Estonian Team Championship", "爱沙尼亚五子棋团体锦标赛"),
    ("Swedish Championship", "瑞典五子棋锦标赛"),
    ("Finnish Championship", "芬兰五子棋锦标赛"),
    ("Polish Championship", "波兰五子棋锦标赛"),
    ("Czech Championship", "捷克五子棋锦标赛"),
    ("Korea Omok Championship", "韩国五子棋锦标赛"),
    ("Korea Omok Master", "韩国五子棋名人战"),
    ("Beijing Renju Championship", "北京市五子棋锦标赛"),
    ("Guangzhou Renju Open Tournament", "广州五子棋公开赛"),
    ("Zhenjiang Renju Open Tournament", "镇江五子棋公开赛"),
    ("Zhenjiang Renju Open", "镇江五子棋公开赛"),
    ("Bay Area (Shenzhen) Renju Elite Tournament", "大湾区(深圳)五子棋精英赛"),
    ("Tianyuan Cup", "天元杯"),
    ("Lucky Cup", "幸运杯"),
    ("Xiaoyao Cup", "逍遥杯"),
    ("Anji Tourism Cup", "安吉旅游杯"),
    ("Chinese New Year", "新春"),
    ("Lantern Festival", "元宵"),
    ("Meijinsen Tournament", "日本名人战"),
    ("Meijinsen Qualification", "日本名人战预选赛"),
    ("Meijinsen", "日本名人战"),
    ("Souryusen Tournament", "日本双龙战"),
    ("Souryusen", "日本双龙战"),
    ("Seiunsen Tournament", "日本青云战"),
    ("Seiunsen", "日本青云战"),
    ("Touryumonsen Tournament", "日本登龙门战"),
    ("Touryumonsen", "日本登龙门战"),
    ("Kanto Renju Emperor Tournament", "关东连珠帝王战"),
    ("Kanto Championship", "关东五子棋锦标赛"),
    ("Kansai Championship", "关西五子棋锦标赛"),
    ("Tohoku Championship", "东北五子棋锦标赛"),
    ("Tohoku Championshp", "东北五子棋锦标赛"),
    ("Kyushu Championship", "九州五子棋锦标赛"),
    ("Tokai Area Qualification", "东海地区预选赛"),
    ("Kansai Hokuriku area", "关西北陆地区"),
    ("Hamamatsu area", "滨松地区"),
    ("Northern Area", "北区"),
    ("Southern Area", "南区"),
    ("Men Group Preliminary", "男子组预赛"),
    ("Women Group Preliminary", "女子组预赛"),
    ("Men Group Final", "男子组决赛"),
    ("Women Group Final", "女子组决赛"),
    ("Men Preliminary", "男子预赛"),
    ("Women Preliminary", "女子预赛"),
    ("Men Final", "男子决赛"),
    ("Women Final", "女子决赛"),
    ("University Group", "大学生组"),
    ("College group", "大学生组"),
    ("Young Group", "少年组"),
    ("Young Gr.", "少年组"),
    ("Highest group", "最高组"),
    ("Blitz Game", "超快棋赛"),
    ("Blitz", "快棋赛"),
    ("1st round", "第一轮"),
    ("2nd round", "第二轮"),
    ("3rd round", "第三轮"),
    ("Final Match", "决赛"),
    ("final match", "决赛"),
    ("Final", "决赛"),
    ("Qualification", "预选赛"),
    ("Preliminary", "预赛"),
    ("Invitational Tournament", "邀请赛"),
    ("invitational tournament", "邀请赛"),
    ("Open Tournament", "公开赛"),
    ("Renju Championship", "五子棋锦标赛"),
    ("Renju Tournament", "五子棋赛"),
    ("Omok Tournament", "五子棋赛"),
    ("Championship", "锦标赛"),
    ("Tournament", "公开赛"),
    ("Tourmament", "公开赛"),
    ("(online)", "(线上)"),
]


def translate_tournament_name(name: str) -> str:
    s = name.replace("2925", "2025").strip()
    s = re.sub(r"\bThe\s+", "", s)
    # Replace ordinals like 17th, 1st, 2nd, 3rd -> 第17届
    s = re.sub(r"\b(\d+)(?:st|nd|rd|th)\b", r"第\1届", s)
    # Replace standalone 4-digit year at start or end
    for en, zh in TOURNAMENT_PHRASES:
        s = s.replace(en, zh)
    s = re.sub(r"\bGroup\s+([A-Za-z0-9]+)\b", r"\1组", s)
    s = re.sub(r"\bgroup\s+([A-Za-z0-9]+)\b", r"\1组", s)
    s = re.sub(r"\b([A-Za-z0-9]+)\s+Group\b", r"\1组", s)
    s = re.sub(r"\bRenju\b", "五子棋", s)
    s = re.sub(r"\bOmok\b", "五子棋", s)
    s = re.sub(r"\s*,\s*", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def norm_ascii(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii")
    return " ".join(s.lower().strip().split())


def parse_round_int(rnd_str: str) -> int:
    s = (rnd_str or "").strip()
    if s.isdigit():
        return int(s)
    m = re.search(r"(\d+)", s)
    if m:
        return int(m.group(1))
    return 1


def fix_date_str(d: str) -> str:
    s = (d or "").strip()[:10]
    if s.startswith("2925"):
        s = "2025" + s[4:]
    return s


def interp_date(start_str: str, end_str: str, rnd: int, max_rnd: int) -> str:
    st = fix_date_str(start_str)
    en = fix_date_str(end_str) or st
    try:
        d0 = datetime.strptime(st, "%Y-%m-%d").date()
        d1 = datetime.strptime(en, "%Y-%m-%d").date()
    except ValueError:
        return st
    if d1 <= d0 or max_rnd <= 1:
        return st
    span = (d1 - d0).days
    offset = int(round((rnd - 1) * span / max(1, max_rnd - 1)))
    offset = max(0, min(span, offset))
    return (d0 + timedelta(days=offset)).isoformat()


def run_import(rif_path: Path, db_dir: Path, min_start_date: str = "2023-03-18") -> None:
    db_t = pd.read_parquet(db_dir / "tournament.parquet")
    db_p = pd.read_parquet(db_dir / "player.parquet")
    db_tp = pd.read_parquet(db_dir / "tournament_player.parquet")
    db_m = pd.read_parquet(db_dir / "match.parquet")

    # Build DB player lookup maps
    db_name_to_pids: Dict[str, List[int]] = defaultdict(list)
    db_ascii_to_pids: Dict[str, List[int]] = defaultdict(list)
    for r in db_p.itertuples(index=False):
        pid = int(r.player_id)
        nm = str(r.name).strip()
        db_name_to_pids[nm].append(pid)
        anm = norm_ascii(nm)
        if anm:
            db_ascii_to_pids[anm].append(pid)
            db_ascii_to_pids[anm.replace("-", " ")].append(pid)

    next_pid = int(db_p["player_id"].max()) + 1 if not db_p.empty else 1

    # Stream RIF file
    rules: Dict[str, str] = {}
    rif_t: Dict[str, Dict[str, str]] = {}
    rif_p: Dict[str, Dict[str, str]] = {}
    rif_games_by_t: Dict[str, List[Tuple[Dict[str, str], str]]] = defaultdict(list)
    rif_players_by_t: Dict[str, set] = defaultdict(set)

    for _event, elem in ET.iterparse(str(rif_path), events=("end",)):
        tag = elem.tag
        if tag == "rule":
            rules[elem.attrib["id"]] = elem.attrib["name"]
            elem.clear()
        elif tag == "player":
            rif_p[elem.attrib["id"]] = elem.attrib
            elem.clear()
        elif tag == "tournament":
            rif_t[elem.attrib["id"]] = elem.attrib
            elem.clear()
        elif tag == "game":
            tid = elem.attrib.get("tournament", "")
            t = rif_t.get(tid, {})
            st = fix_date_str(t.get("start", ""))
            r_en = rules.get(elem.attrib.get("rule") or t.get("rule", ""), "")
            if st >= min_start_date and r_en in RULE_EN_TO_ZH:
                mv = (elem.findtext("move") or "").strip()
                rif_games_by_t[tid].append((dict(elem.attrib), mv))
                rif_players_by_t[tid].add(elem.attrib["black"])
                rif_players_by_t[tid].add(elem.attrib["white"])
            elem.clear()

    # Map RIF player_id -> DB player_id (or None if new)
    rif_to_db_pid: Dict[str, int] = {}
    new_players: List[Dict[str, object]] = []

    def resolve_or_create_pid(rpid: str) -> int:
        nonlocal next_pid
        if rpid in rif_to_db_pid:
            return rif_to_db_pid[rpid]
        pa = rif_p[rpid]
        nn = (pa.get("native_name") or "").strip()
        nn = PLAYER_ALIASES.get(nn, nn)
        # 1. Exact native_name match in DB
        if nn and len(db_name_to_pids.get(nn, [])) == 1:
            pid = db_name_to_pids[nn][0]
            rif_to_db_pid[rpid] = pid
            return pid
        # 2. ASCII name match in DB
        fn = norm_ascii(pa.get("name", ""))
        sn = norm_ascii(pa.get("surname", ""))
        for key in (f"{fn} {sn}", f"{sn} {fn}", f"{fn}-{sn}", f"{sn}-{fn}"):
            key = key.strip()
            if key and len(db_ascii_to_pids.get(key, [])) == 1:
                pid = db_ascii_to_pids[key][0]
                rif_to_db_pid[rpid] = pid
                return pid
        # 3. Create new player
        country = pa.get("country", "")
        if country in ("4", "5", "8") and nn:
            disp_name = nn
        else:
            disp_name = f"{pa.get('name', '').strip()} {pa.get('surname', '').strip()}".strip() or nn or f"Player_{rpid}"
        # If disp_name already exists in DB (homonym), still create a distinct player_id if not matched above
        pid = next_pid
        next_pid += 1
        rif_to_db_pid[rpid] = pid
        new_players.append({"player_id": pid, "name": disp_name})
        return pid

    # Pre-match existing RIF players so tournament matching works
    for rpid, pa in rif_p.items():
        nn = PLAYER_ALIASES.get((pa.get("native_name") or "").strip(), (pa.get("native_name") or "").strip())
        if nn and len(db_name_to_pids.get(nn, [])) == 1:
            rif_to_db_pid[rpid] = db_name_to_pids[nn][0]
        else:
            fn = norm_ascii(pa.get("name", ""))
            sn = norm_ascii(pa.get("surname", ""))
            for key in (f"{fn} {sn}", f"{sn} {fn}", f"{fn}-{sn}", f"{sn}-{fn}"):
                key = key.strip()
                if key and len(db_ascii_to_pids.get(key, [])) == 1:
                    rif_to_db_pid[rpid] = db_ascii_to_pids[key][0]
                    break

    # Match existing DB tournaments to RIF tournaments
    db_t_dates = (
        db_m.groupby("tournament_id")
        .agg(min_d=("date", "min"), max_d=("date", "max"))
        .reset_index()
        .merge(db_t, on="tournament_id")
    )
    matched_rif_tids: Dict[str, int] = {}
    for row in db_t_dates.itertuples(index=False):
        db_tid = int(row.tournament_id)
        dmin, dmax = str(row.min_d)[:10], str(row.max_d)[:10]
        db_pids = set(db_tp[db_tp["tournament_id"] == db_tid]["player_id"].astype(int))
        best = []
        for rtid in rif_games_by_t:
            if rtid in matched_rif_tids:
                continue
            rt = rif_t[rtid]
            st = fix_date_str(rt.get("start", ""))
            en = fix_date_str(rt.get("end", "")) or st
            if st <= dmax and en >= dmin:
                rp_mapped = {rif_to_db_pid[x] for x in rif_players_by_t[rtid] if x in rif_to_db_pid}
                ov = len(db_pids & rp_mapped)
                if ov >= 2:
                    best.append((ov, rtid))
        if best:
            best.sort(reverse=True)
            matched_rif_tids[best[0][1]] = db_tid

    # 1. Backfill missing moves/swap/5a in existing DB tournaments
    filled_moves = 0
    filled_swap = 0
    filled_5a = 0
    for rtid, db_tid in matched_rif_tids.items():
        sub_idx = db_m.index[db_m["tournament_id"] == db_tid].tolist()
        # Index by (round, frozenset({fid, sid})) and fallback frozenset({fid, sid})
        by_rnd_pair: Dict[Tuple[int, frozenset], List[int]] = defaultdict(list)
        by_pair: Dict[frozenset, List[int]] = defaultdict(list)
        for idx in sub_idx:
            sid = db_m.at[idx, "second_id"]
            if pd.isna(sid):
                continue
            fid = int(db_m.at[idx, "first_id"])
            sid_i = int(sid)
            rnd_i = int(db_m.at[idx, "round"])
            pair = frozenset((fid, sid_i))
            by_rnd_pair[(rnd_i, pair)].append(idx)
            by_pair[pair].append(idx)

        used_indices = set()
        for ga, mv in rif_games_by_t[rtid]:
            b_pid = rif_to_db_pid.get(ga["black"])
            w_pid = rif_to_db_pid.get(ga["white"])
            if b_pid is None or w_pid is None:
                continue
            pair = frozenset((b_pid, w_pid))
            rnd_i = parse_round_int(ga.get("round", "1"))
            cands = [i for i in by_rnd_pair.get((rnd_i, pair), []) if i not in used_indices]
            if not cands:
                cands = [i for i in by_pair.get(pair, []) if i not in used_indices]
            if not cands:
                continue
            idx = cands[0]
            used_indices.add(idx)

            cur_mv = db_m.at[idx, "moves"]
            if mv and (pd.isna(cur_mv) or not str(cur_mv).strip()):
                db_m.at[idx, "moves"] = mv
                filled_moves += 1

            sw_pm = (ga.get("swap") or "").strip().replace("R", "+")
            cur_sw = db_m.at[idx, "swap"]
            if sw_pm and (pd.isna(cur_sw) or not str(cur_sw).strip()):
                db_m.at[idx, "swap"] = sw_pm
                filled_swap += 1

            alt = (ga.get("alt") or "").strip()
            cur_5a = db_m.at[idx, "5a"]
            if alt and (pd.isna(cur_5a) or not str(cur_5a).strip()):
                db_m.at[idx, "5a"] = alt
                filled_5a += 1

    # 2. Add missing RIF tournaments (>= min_start_date)
    next_tid = int(db_t["tournament_id"].max()) + 1 if not db_t.empty else 1
    next_gid = int(db_m["game_id"].max()) + 1 if not db_m.empty else 1
    next_id = int(db_m["id"].max()) + 1 if not db_m.empty else 1

    new_t_rows: List[Dict[str, object]] = []
    new_tp_rows: List[Dict[str, object]] = []
    new_m_rows: List[Dict[str, object]] = []

    missing_rtids = [rtid for rtid in rif_games_by_t if rtid not in matched_rif_tids]
    missing_rtids.sort(key=lambda rtid: (fix_date_str(rif_t[rtid].get("start", "")), int(rtid)))

    for rtid in missing_rtids:
        rt = rif_t[rtid]
        gs = rif_games_by_t[rtid]
        if not gs:
            continue
        db_tid = next_tid
        next_tid += 1
        zh_tname = translate_tournament_name(rt.get("name", f"Tournament {rtid}"))
        new_t_rows.append({"tournament_id": db_tid, "name": zh_tname})

        st = fix_date_str(rt.get("start", ""))
        en = fix_date_str(rt.get("end", "")) or st
        parsed_rounds = [parse_round_int(ga.get("round", "1")) for ga, _ in gs]
        max_rnd = max(parsed_rounds) if parsed_rounds else 1

        seen_pids: List[int] = []
        for (ga, mv), rnd_i in zip(gs, parsed_rounds):
            b_pid = resolve_or_create_pid(ga["black"])
            w_pid = resolve_or_create_pid(ga["white"])
            if b_pid not in seen_pids:
                seen_pids.append(b_pid)
            if w_pid not in seen_pids:
                seen_pids.append(w_pid)

            sw_pm = (ga.get("swap") or "").strip().replace("R", "+")
            plus_cnt = sw_pm.count("+")
            bresult = ga.get("bresult", "0.5")
            if plus_cnt % 2 == 0:
                fid, sid, res = b_pid, w_pid, bresult
            else:
                fid, sid = w_pid, b_pid
                res = {"1": "0", "0": "1", "0.5": "0.5"}.get(bresult, bresult)

            r_en = rules.get(ga.get("rule") or rt.get("rule", ""), "")
            r_zh = RULE_EN_TO_ZH[r_en]
            alt = (ga.get("alt") or "").strip()

            new_m_rows.append({
                "id": next_id,
                "game_id": next_gid,
                "date": interp_date(st, en, rnd_i, max_rnd),
                "rule": r_zh,
                "first_id": fid,
                "second_id": sid,
                "result": res,
                "tournament_id": db_tid,
                "round": rnd_i,
                "board": 0,
                "game_no": float("nan"),
                "swap": sw_pm if sw_pm else None,
                "5a": alt if alt else None,
                "moves": mv if mv else None,
            })
            next_id += 1
            next_gid += 1

        for pid in seen_pids:
            new_tp_rows.append({"tournament_id": db_tid, "player_id": pid, "player_no": pd.NA})

    if new_t_rows:
        db_t = pd.concat([db_t, pd.DataFrame(new_t_rows)], ignore_index=True)
    if new_players:
        db_p = pd.concat([db_p, pd.DataFrame(new_players)], ignore_index=True)
    if new_tp_rows:
        db_tp = pd.concat([db_tp, pd.DataFrame(new_tp_rows)], ignore_index=True)
    if new_m_rows:
        db_m = pd.concat([db_m, pd.DataFrame(new_m_rows)], ignore_index=True)

    # Re-index match game_id consecutively 1..N sorted by (tournament_id, round, board, game_id)
    db_m = db_m.sort_values(["tournament_id", "round", "board", "game_id"]).reset_index(drop=True)
    db_m["game_id"] = range(1, len(db_m) + 1)
    db_m["id"] = range(1, len(db_m) + 1)
    db_tp["player_no"] = db_tp["player_no"].astype("Int64")

    db_t.to_parquet(db_dir / "tournament.parquet", index=False)
    db_p.to_parquet(db_dir / "player.parquet", index=False)
    db_tp.to_parquet(db_dir / "tournament_player.parquet", index=False)
    db_m.to_parquet(db_dir / "match.parquet", index=False)

    print(
        f"Done! matched_tournaments={len(matched_rif_tids)}, "
        f"backfilled_moves={filled_moves}, backfilled_swap={filled_swap}, backfilled_5a={filled_5a}, "
        f"added_tournaments={len(new_t_rows)}, added_players={len(new_players)}, added_games={len(new_m_rows)}, "
        f"total_tournaments={len(db_t)}, total_players={len(db_p)}, total_games={len(db_m)}"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rif", type=Path, required=True)
    parser.add_argument("--db-dir", type=Path, required=True)
    parser.add_argument("--min-date", type=str, default="2023-03-18")
    args = parser.parse_args()
    run_import(args.rif, args.db_dir, args.min_date)


if __name__ == "__main__":
    main()
