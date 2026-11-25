"""Apply plain-text database edits (.txt) to db/*.parquet.

Supports:
1. Tournament blocks (add new tournament, or replace existing tournament when 赛事ID is given):
   赛事: <name>
   赛事ID: <optional int>
   规则: <default rule>
   [棋手]
   <no> <name>
   [第<round>轮 <YYYY-MM-DD>]
   <board> <first> <res> <second> [5a=...] [swap=...] [moves=...]
   <board> <first> + 轮空

2. Line commands:
   SET game <game_id> key=value ...
   DEL game <game_id>
   RENAME player <player_id> <new_name>
   MERGE player <old_player_id> -> <target_player_id>
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd

DEFAULT_DB_DIR = Path(__file__).resolve().parent.parent / "db"

RESULT_ALIASES = {
    "1": "1",
    "1-0": "1",
    "1:0": "1",
    "胜": "1",
    "0": "0",
    "0-1": "0",
    "0:1": "0",
    "负": "0",
    "0.5": "0.5",
    "½": "0.5",
    ".5": "0.5",
    "0.5-0.5": "0.5",
    "0.5:0.5": "0.5",
    "½-½": "0.5",
    "和": "0.5",
    "平": "0.5",
    "+-": "+-",
    "+:-": "+-",
    "-+": "-+",
    "-:+": "-+",
    "--": "--",
    "-:-": "--",
}


def parse_result(tok: str) -> str:
    t = tok.strip()
    if t in RESULT_ALIASES:
        return RESULT_ALIASES[t]
    raise ValueError(f"无法识别的对局结果: {tok!r}")


def parse_match_line(line: str, default_rule: str) -> Dict[str, object]:
    # Extract optional key=value tail tokens (5a=..., swap=..., rule=..., moves=...)
    kv: Dict[str, str] = {}
    rest = line.strip()
    m_moves = re.search(r"\s+moves=([a-z0-9\s]+)$", rest, re.IGNORECASE)
    if m_moves:
        kv["moves"] = m_moves.group(1).strip()
        rest = rest[: m_moves.start()].strip()

    while True:
        m_kv = re.search(r"\s+(5a|swap|rule)=([^\s]+)$", rest, re.IGNORECASE)
        if not m_kv:
            break
        kv[m_kv.group(1).lower()] = m_kv.group(2).strip()
        rest = rest[: m_kv.start()].strip()

    rule = kv.get("rule", default_rule)

    # Bye line: "<board> <player> + 轮空" or "<board> <player> 轮空"
    m_bye = re.match(r"^(\d+)\s+(.+?)\s+(?:\+\s+)?轮空$", rest)
    if m_bye:
        return {
            "board": int(m_bye.group(1)),
            "first": m_bye.group(2).strip(),
            "second": None,
            "result": "+-",
            "rule": rule,
            "swap": None,
            "5a": None,
            "moves": None,
        }

    # Format A: "<board> <first> <left_res> - <right_res> <second>"
    m_dash = re.match(
        r"^(\d+)\s+(.+?)\s+(1|0|0\.5|½|\.5|\+|-)\s*[-:]\s*(1|0|0\.5|½|\.5|\+|-)\s+(.+?)$",
        rest,
    )
    if m_dash:
        board = int(m_dash.group(1))
        first = m_dash.group(2).strip()
        l_res = m_dash.group(3).strip()
        r_res = m_dash.group(4).strip()
        second = m_dash.group(5).strip()
        if l_res == "+" and r_res == "-":
            res = "+-"
        elif l_res == "-" and r_res == "+":
            res = "-+"
        elif l_res == "-" and r_res == "-":
            res = "--"
        elif l_res in ("0.5", "½", ".5") and r_res in ("0.5", "½", ".5"):
            res = "0.5"
        elif l_res == "1" and r_res == "0":
            res = "1"
        elif l_res == "0" and r_res == "1":
            res = "0"
        else:
            raise ValueError(f"比分左右不匹配: {line!r}")
        if second == "轮空":
            return {
                "board": board, "first": first, "second": None, "result": "+-",
                "rule": rule, "swap": None, "5a": None, "moves": None,
            }
        return {
            "board": board, "first": first, "second": second, "result": res,
            "rule": rule, "swap": kv.get("swap"), "5a": kv.get("5a"), "moves": kv.get("moves"),
        }

    # Format B: "<board> <first> <res_token> <second>"
    m_tok = re.match(r"^(\d+)\s+(.+?)\s+(\S+)\s+(.+?)$", rest)
    if m_tok:
        board = int(m_tok.group(1))
        first = m_tok.group(2).strip()
        res = parse_result(m_tok.group(3))
        second = m_tok.group(4).strip()
        if second == "轮空":
            return {
                "board": board, "first": first, "second": None, "result": "+-",
                "rule": rule, "swap": None, "5a": None, "moves": None,
            }
        return {
            "board": board, "first": first, "second": second, "result": res,
            "rule": rule, "swap": kv.get("swap"), "5a": kv.get("5a"), "moves": kv.get("moves"),
        }

    raise ValueError(f"无法解析对局行: {line!r}")


def apply_txt_content(text: str, db_dir: Path) -> List[str]:
    t_df = pd.read_parquet(db_dir / "tournament.parquet")
    p_df = pd.read_parquet(db_dir / "player.parquet")
    tp_df = pd.read_parquet(db_dir / "tournament_player.parquet")
    m_df = pd.read_parquet(db_dir / "match.parquet")

    name_to_pid: Dict[str, int] = {str(r.name).strip(): int(r.player_id) for r in p_df.itertuples(index=False)}
    next_pid = int(p_df["player_id"].max()) + 1 if not p_df.empty else 1

    def get_or_create_pid(name: str) -> int:
        nonlocal next_pid, p_df
        nm = name.strip()
        if nm in name_to_pid:
            return name_to_pid[nm]
        pid = next_pid
        next_pid += 1
        name_to_pid[nm] = pid
        p_df = pd.concat([p_df, pd.DataFrame([{"player_id": pid, "name": nm}])], ignore_index=True)
        return pid

    logs: List[str] = []
    lines = text.splitlines()

    # Collect standalone commands and tournament block
    t_name: Optional[str] = None
    t_id: Optional[int] = None
    default_rule: str = "塔拉山口-10"
    section: Optional[str] = None  # "players" | "round"
    cur_round: int = 0
    cur_date: str = ""
    roster: List[Tuple[int, str]] = []
    parsed_matches: List[Dict[str, object]] = []
    commands: List[str] = []

    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if re.match(r"^(SET|DEL|RENAME|MERGE)\s+", line, re.IGNORECASE):
            commands.append(line)
            continue
        if line.startswith("赛事ID:") or line.startswith("赛事ID："):
            val = line.split(":", 1)[1] if ":" in line else line.split("：", 1)[1]
            t_id = int(val.strip()) if val.strip() else None
            continue
        if line.startswith("赛事:") or line.startswith("赛事："):
            t_name = (line.split(":", 1)[1] if ":" in line else line.split("：", 1)[1]).strip()
            continue
        if line.startswith("规则:") or line.startswith("规则："):
            default_rule = (line.split(":", 1)[1] if ":" in line else line.split("：", 1)[1]).strip()
            continue
        if line == "[棋手]":
            section = "players"
            continue
        m_rnd = re.match(r"^\[第(\d+)轮\s+(\d{4}-\d{2}-\d{2})\]$", line)
        if m_rnd:
            section = "round"
            cur_round = int(m_rnd.group(1))
            cur_date = m_rnd.group(2)
            continue

        if section == "players":
            m_pl = re.match(r"^(\d+)\s+(.+)$", line)
            if not m_pl:
                raise ValueError(f"无法解析棋手行: {line!r}")
            roster.append((int(m_pl.group(1)), m_pl.group(2).strip()))
        elif section == "round":
            rec = parse_match_line(line, default_rule)
            rec["round"] = cur_round
            rec["date"] = cur_date
            parsed_matches.append(rec)
        else:
            raise ValueError(f"未知区块或语法: {line!r}")

    # Apply tournament block if present
    if t_name or parsed_matches:
        if not t_name and t_id is None:
            raise ValueError("缺少 `赛事: <名称>`")
        if t_id is not None:
            if t_id in set(t_df["tournament_id"].astype(int)):
                if t_name:
                    t_df.loc[t_df["tournament_id"] == t_id, "name"] = t_name
                tp_df = tp_df[tp_df["tournament_id"] != t_id].copy()
                m_df = m_df[m_df["tournament_id"] != t_id].copy()
                action_label = f"覆盖更新赛事 tid={t_id}"
            else:
                raise ValueError(f"指定的赛事ID={t_id} 不存在")
        else:
            t_id = int(t_df["tournament_id"].max()) + 1 if not t_df.empty else 1
            t_df = pd.concat([t_df, pd.DataFrame([{"tournament_id": t_id, "name": t_name}])], ignore_index=True)
            action_label = f"新建赛事 tid={t_id}"

        # Build roster if omitted
        if not roster:
            seen_names: List[str] = []
            for rec in parsed_matches:
                for nm in (rec["first"], rec["second"]):
                    if nm and nm not in seen_names:
                        seen_names.append(str(nm))
            roster = [(idx + 1, nm) for idx, nm in enumerate(seen_names)]

        new_tp_rows = []
        for pno, nm in roster:
            pid = get_or_create_pid(nm)
            new_tp_rows.append({"tournament_id": t_id, "player_id": pid, "player_no": pno})
        if new_tp_rows:
            tp_df = pd.concat([tp_df, pd.DataFrame(new_tp_rows)], ignore_index=True)

        next_gid = int(m_df["game_id"].max()) + 1 if not m_df.empty else 1
        next_id = int(m_df["id"].max()) + 1 if not m_df.empty else 1
        new_m_rows = []
        for rec in parsed_matches:
            fid = get_or_create_pid(str(rec["first"]))
            sid = get_or_create_pid(str(rec["second"])) if rec["second"] else pd.NA
            new_m_rows.append({
                "id": next_id,
                "game_id": next_gid,
                "date": rec["date"],
                "rule": rec["rule"],
                "first_id": fid,
                "second_id": sid,
                "result": rec["result"],
                "tournament_id": t_id,
                "round": rec["round"],
                "board": rec["board"],
                "game_no": float("nan"),
                "swap": rec["swap"],
                "5a": rec["5a"],
                "moves": rec["moves"],
            })
            next_id += 1
            next_gid += 1

        if new_m_rows:
            m_new_df = pd.DataFrame(new_m_rows)
            m_new_df["second_id"] = m_new_df["second_id"].astype("Int64")
            m_df = pd.concat([m_df, m_new_df], ignore_index=True)

        logs.append(f"{action_label} ({t_name or ''}): {len(new_tp_rows)} 名棋手, {len(new_m_rows)} 盘对局")

    # Apply line commands
    for cmd in commands:
        m_del = re.match(r"^DEL\s+game\s+(\d+)$", cmd, re.IGNORECASE)
        if m_del:
            gid = int(m_del.group(1))
            before = len(m_df)
            m_df = m_df[m_df["game_id"] != gid].copy()
            logs.append(f"DEL game {gid}: 删除 {before - len(m_df)} 条")
            continue

        m_set = re.match(r"^SET\s+game\s+(\d+)\s+(.+)$", cmd, re.IGNORECASE)
        if m_set:
            gid = int(m_set.group(1))
            kvs = re.findall(r"(\w+)=([^\s]+)", m_set.group(2))
            mask = m_df["game_id"] == gid
            if not mask.any():
                raise ValueError(f"SET game {gid}: 未找到该对局")
            for k, v in kvs:
                val = None if v in ("None", "null", "NULL") else v
                if k in ("round", "board"):
                    m_df.loc[mask, k] = int(v)
                elif k == "result":
                    m_df.loc[mask, k] = parse_result(v)
                elif k in ("date", "rule", "swap", "5a"):
                    m_df.loc[mask, k] = val
                else:
                    raise ValueError(f"不支持的字段: {k}")
            logs.append(f"SET game {gid}: 更新 {kvs}")
            continue

        m_ren = re.match(r"^RENAME\s+player\s+(\d+)\s+(.+)$", cmd, re.IGNORECASE)
        if m_ren:
            pid = int(m_ren.group(1))
            new_nm = m_ren.group(2).strip()
            if not (p_df["player_id"] == pid).any():
                raise ValueError(f"RENAME player {pid}: 未找到")
            p_df.loc[p_df["player_id"] == pid, "name"] = new_nm
            logs.append(f"RENAME player {pid} -> {new_nm}")
            continue

        m_mrg = re.match(r"^MERGE\s+player\s+(\d+)\s*->\s*(\d+)$", cmd, re.IGNORECASE)
        if m_mrg:
            old_pid, tgt_pid = int(m_mrg.group(1)), int(m_mrg.group(2))
            if not (p_df["player_id"] == tgt_pid).any():
                raise ValueError(f"MERGE target player {tgt_pid}: 未找到")
            m_df.loc[m_df["first_id"] == old_pid, "first_id"] = tgt_pid
            m_df.loc[m_df["second_id"] == old_pid, "second_id"] = tgt_pid
            tp_df.loc[tp_df["player_id"] == old_pid, "player_id"] = tgt_pid
            p_df = p_df[p_df["player_id"] != old_pid].copy()
            logs.append(f"MERGE player {old_pid} -> {tgt_pid}")
            continue

        raise ValueError(f"无法识别指令: {cmd!r}")

    # Re-index match game_id consecutively 1..N sorted by (tournament_id, round, board, game_id)
    m_df = m_df.sort_values(["tournament_id", "round", "board", "game_id"]).reset_index(drop=True)
    m_df["game_id"] = range(1, len(m_df) + 1)
    m_df["second_id"] = m_df["second_id"].astype("Int64")
    tp_df["player_no"] = tp_df["player_no"].astype("Int64")

    t_df.to_parquet(db_dir / "tournament.parquet", index=False)
    p_df.to_parquet(db_dir / "player.parquet", index=False)
    tp_df.to_parquet(db_dir / "tournament_player.parquet", index=False)
    m_df.to_parquet(db_dir / "match.parquet", index=False)
    return logs


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply .txt edit files to db/*.parquet")
    parser.add_argument("files", nargs="*", type=Path, help=".txt edit files to apply")
    parser.add_argument("--dir", type=Path, help="Directory of pending .txt files")
    parser.add_argument("--archive-dir", type=Path, help="Move processed .txt files here")
    parser.add_argument("--db-dir", type=Path, default=DEFAULT_DB_DIR)
    args = parser.parse_args()

    targets: List[Path] = list(args.files)
    if args.dir and args.dir.is_dir():
        targets.extend(sorted(args.dir.glob("*.txt")))

    if not targets:
        print("没有待处理的 .txt 编辑文件")
        return

    for fpath in targets:
        text = fpath.read_text(encoding="utf-8")
        logs = apply_txt_content(text, args.db_dir)
        print(f"[OK] {fpath.name}: " + "; ".join(logs))
        if args.archive_dir:
            args.archive_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(fpath), str(args.archive_dir / fpath.name))


if __name__ == "__main__":
    main()
