#!/usr/bin/env python3
"""PreToolUse hook: git commit 実行前に、コミット対象へ service_role キー等の
危険なシークレットが含まれていないか検査する。

anon key は公開前提(RLSが境界)なので許可する。ブロック対象:
  - "service_role" の平文
  - service_role JWT(ペイロードの base64 断片。3通りのアライメントを網羅)
  - Supabase パーソナルアクセストークン (sbp_...)

exit 0 = 許可 / exit 2 = ブロック(stderr が Claude にフィードバックされる)
"""
import base64
import json
import re
import subprocess
import sys


# 「service_role」という単語への言及が正当なファイル(平文検査のみ除外。
# base64 断片検査=実キー検出は全ファイル対象)
DOC_PATH_RE = re.compile(r"(\.md$|^\.claude/hooks/)")


def staged_and_tracked_content(include_working_tree):
    out = []
    try:
        diff = subprocess.run(
            ["git", "diff", "--cached", "-U0"],
            capture_output=True, text=True, errors="replace", timeout=15,
        )
        out.append(diff.stdout)
        if include_working_tree:  # git commit -a は未ステージの変更もコミットする
            diff_wt = subprocess.run(
                ["git", "diff", "-U0"],
                capture_output=True, text=True, errors="replace", timeout=15,
            )
            out.append(diff_wt.stdout)
    except Exception:
        pass  # 検査に失敗してもコミット自体は止めない
    return "\n".join(out)


def split_diff_by_file(diff_text):
    """diff を (ファイルパス, そのファイルの diff 本文) のリストに分割する。"""
    parts = []
    current_path, current_lines = None, []
    header = re.compile(r'^diff --git a/.* b/(.*)$')
    for line in diff_text.splitlines():
        m = header.match(line)
        if m:
            if current_path is not None:
                parts.append((current_path, "\n".join(current_lines)))
            current_path, current_lines = m.group(1), []
        else:
            current_lines.append(line)
    if current_path is not None:
        parts.append((current_path, "\n".join(current_lines)))
    return parts


def service_role_b64_fragments():
    # JWT ペイロード内の "role":"service_role" は base64 化されている。
    # 先頭からのバイトオフセット (mod 3) により3通りの表現があるため、
    # 各オフセットについて3バイト境界にアラインした完全グループのみを
    # エンコードした断片を生成する(前後のバイトの影響を受けない)。
    secret = b'"role":"service_role"'
    frags = set()
    for r in range(3):
        skip = (3 - r) % 3
        body = secret[skip:]
        body = body[: len(body) // 3 * 3]
        frags.add(base64.b64encode(body).decode())
        frags.add(base64.urlsafe_b64encode(body).decode())
    return frags


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0

    if data.get("tool_name") != "Bash":
        return 0
    command = (data.get("tool_input") or {}).get("command", "")
    if not re.search(r"\bgit\b[^|;&]*\bcommit\b", command):
        return 0

    include_wt = bool(re.search(r"\bcommit\b[^|;&]*\s-\w*a", command)) or "--all" in command
    content = staged_and_tracked_content(include_wt)
    if not content:
        return 0

    b64_frags = sorted(service_role_b64_fragments())
    hits = []
    for path, body in split_diff_by_file(content):
        if not DOC_PATH_RE.search(path):
            lowered = body.lower()
            hits += [f"{p} in {path}" for p in ("service_role", "sbp_") if p in lowered]
        hits += [f"b64(service_role) in {path}" for p in b64_frags if p in body]
    if hits:
        sys.stderr.write(
            "ブロック: コミット対象に service_role キー等のシークレットが含まれている可能性があります"
            f"(検出パターン: {hits})。\n"
            "service_role キーは RLS をバイパスするため、public リポジトリには絶対にコミットできません。\n"
            "該当ファイルをステージから外すか、値を削除してから再コミットしてください。\n"
            "※ anon key は公開前提なのでこの検査の対象外です。\n"
        )
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
