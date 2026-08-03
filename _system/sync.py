# -*- coding: utf-8 -*-
"""
sync.py — 구글 시트에서 최신 내용을 통째로 받아온다.

시트를 [파일 > 공유 > 웹에 게시 > 전체 문서 > Microsoft Excel(.xlsx) > 게시] 해두면
주소 하나로 모든 탭을 한꺼번에 받을 수 있다.
그래서 프로그램(탭)을 새로 만들어도 설정을 다시 손댈 일이 없다.

받은 파일은 곧바로 탭별 CSV 로 풀어둔다. (xlsx-to-tabs.py 와 같은 결과)

    python _system/sync.py
"""
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
CONFIG = BASE / "sheet.config.json"
DOWNLOAD = BASE / "data" / "_받아온시트.xlsx"

XLSX_MAGIC = b"PK\x03\x04"


def load_url():
    if not CONFIG.exists():
        sys.exit(f"설정 파일이 없습니다: {CONFIG}")
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    url = (cfg.get("게시주소") or "").strip()
    if not url:
        print("아직 게시 주소가 없습니다.\n")
        print("  1) 구글 시트에서  파일 > 공유 > 웹에 게시")
        print("  2) '전체 문서' 를 고르고, 형식을 'Microsoft Excel(.xlsx)' 로 선택")
        print("  3) 게시를 누르면 나오는 주소를")
        print(f"     {CONFIG.name} 의 \"게시주소\" 칸에 붙여넣으세요.")
        sys.exit(1)
    return url


def main():
    url = load_url()
    print(f"받는 중 … {url[:70]}{'…' if len(url) > 70 else ''}")

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "identeach-sync"})
        with urllib.request.urlopen(req, timeout=60) as res:
            data = res.read()
    except Exception as e:
        sys.exit(f"받기 실패: {e}")

    # 게시 주소가 잘못되면 엑셀이 아니라 로그인 화면(HTML)이 온다
    if not data.startswith(XLSX_MAGIC):
        head = data[:200].decode("utf-8", "replace")
        sys.exit(
            "엑셀 파일이 아니라 웹페이지가 왔습니다.\n"
            "'웹에 게시' 에서 형식을 Microsoft Excel(.xlsx) 로 골랐는지 확인하세요.\n"
            f"받은 내용 앞부분: {head[:120]}"
        )

    DOWNLOAD.parent.mkdir(parents=True, exist_ok=True)
    DOWNLOAD.write_bytes(data)
    print(f"받음: {len(data):,} bytes\n")

    # 곧바로 탭별 CSV 로 풀기
    r = subprocess.run(
        [sys.executable, "-X", "utf8", str(BASE / "xlsx-to-tabs.py"), str(DOWNLOAD)],
        cwd=str(BASE.parent),
    )
    if r.returncode != 0:
        sys.exit("탭을 푸는 데 실패했습니다.")

    print("\n다음: node _system/form-to-data.js  그리고  node _system/build.js")


if __name__ == "__main__":
    main()
