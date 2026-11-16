#!/usr/bin/env python3
"""Copy production R2 media into the shared preview bucket, then verify.

Usage: python3 copy-media.py [--dry-run]
Needs a logged-in `cf` CLI. Exits 1 if any object fails or still differs.
"""
import json
import shutil
import subprocess
import sys
import tempfile

SRC = "imeankenshin-media"
DST = "imeankenshin-media-preview"
PAGE = 1000


def cf(*args, stdout=subprocess.PIPE):
    return subprocess.run(["cf", "r2", "objects", *args], stdout=stdout, check=True)


def list_bucket(bucket):
    objects, after = [], None
    while True:
        args = ["list", "--bucket-name", bucket, "--per-page", str(PAGE)]
        if after:
            args += ["--start-after", after]
        page = json.loads(cf(*args).stdout or b"[]")
        objects += page
        if len(page) < PAGE:
            return {o["key"]: o for o in objects}
        after = page[-1]["key"]


def same(a, b):
    # Multipart ETags ("...-N") change on re-upload, so fall back to size.
    if "-" in a["etag"]:
        return b is not None and a["size"] == b["size"]
    return b is not None and (a["etag"], a["size"]) == (b["etag"], b["size"])


def main():
    dry = "--dry-run" in sys.argv
    src, dst = list_bucket(SRC), list_bucket(DST)
    todo = [o for k, o in src.items() if not same(o, dst.get(k))]
    extra = sorted(set(dst) - set(src))
    print(f"source {len(src)} ({sum(o['size'] for o in src.values())} B), "
          f"preview {len(dst)}, to copy {len(todo)} ({sum(o['size'] for o in todo)} B)")
    if extra:
        print(f"preview-only (left in place) {len(extra)}: {extra}")
    if dry:
        return 0

    tmp = tempfile.mkdtemp()
    try:
        for i, o in enumerate(todo):
            path, key = f"{tmp}/{i}", o["key"]
            ct = o.get("http_metadata", {}).get("contentType", "application/octet-stream")
            with open(path, "wb") as f:
                cf("get", key, "--bucket-name", SRC, stdout=f)
            with open(path, "rb") as f:
                got = len(f.read())
            if got != o["size"]:
                print(f"SIZE MISMATCH {key} {got}/{o['size']}")
                continue
            cf("put", key, "--bucket-name", DST, "--content-type", ct, "--file", path, "-q")
            print(f"OK {key}")
    finally:
        shutil.rmtree(tmp)

    dst = list_bucket(DST)
    bad = [k for k, o in src.items() if not same(o, dst.get(k))]
    print(f"preview now {len(dst)}, mismatch {len(bad)} {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
