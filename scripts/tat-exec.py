#!/usr/bin/env python3
"""Tencent Cloud TAT - Execute commands on remote instances via direct HTTP API."""

import os
import sys
import time
import base64
import hashlib
import hmac
import json
import datetime
import urllib.request

SECRET_ID = os.environ.get("TAT_SECRET_ID", "")
SECRET_KEY = os.environ.get("TAT_SECRET_KEY", "")
REGION = os.environ.get("TAT_REGION", "na-siliconvalley")
INSTANCE_ID = os.environ.get("TAT_INSTANCE_ID", "lhins-mmiwlnzl")
SERVICE = "tat"
VERSION = "2020-10-28"


def _sign(key, msg):
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(key, date):
    return _sign(_sign(_sign(("TC3" + key).encode("utf-8"), date), SERVICE), "tc3_request")


def _api_call(action, payload):
    ts = int(time.time())
    date = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).strftime("%Y-%m-%d")
    scope = f"{date}/{SERVICE}/tc3_request"
    ct = "application/json; charset=utf-8"
    body = json.dumps(payload)
    canonical = f"content-type:{ct}\nhost:tat.tencentcloudapi.com\nx-tc-action:{action.lower()}\n"
    signed_headers = "content-type;host;x-tc-action"
    hashed = hashlib.sha256(body.encode()).hexdigest()
    req_str = f"POST\n/\n\n{canonical}\n{signed_headers}\n{hashed}"
    sts = f"TC3-HMAC-SHA256\n{ts}\n{scope}\n{hashlib.sha256(req_str.encode()).hexdigest()}"
    sig = hmac.new(_signing_key(SECRET_KEY, date), sts.encode(), hashlib.sha256).hexdigest()
    auth = f"TC3-HMAC-SHA256 Credential={SECRET_ID}/{scope}, SignedHeaders={signed_headers}, Signature={sig}"
    headers = {
        "Host": "tat.tencentcloudapi.com",
        "Content-Type": ct,
        "X-TC-Action": action,
        "X-TC-Version": VERSION,
        "X-TC-Timestamp": str(ts),
        "X-TC-Region": REGION,
        "Authorization": auth,
    }
    req = urllib.request.Request("https://tat.tencentcloudapi.com", data=body.encode(), headers=headers, method="POST")
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read().decode())


def run_command(command: str, timeout: int = 120) -> str:
    # CreateCommand
    r1 = _api_call("CreateCommand", {
        "CommandName": f"exec-{int(time.time())}",
        "Content": base64.b64encode(command.encode()).decode(),
        "CommandType": "SHELL",
        "Timeout": timeout,
    })
    cmd_id = r1["Response"]["CommandId"]

    # InvokeCommand
    r2 = _api_call("InvokeCommand", {
        "CommandId": cmd_id,
        "InstanceIds": [INSTANCE_ID],
        "Timeout": timeout,
    })
    inv_id = r2["Response"]["InvocationId"]

    # Poll DescribeInvocationTasks (no filter, match by InvocationId)
    for _ in range(timeout // 3 + 10):
        time.sleep(3)
        r3 = _api_call("DescribeInvocationTasks", {"Limit": 30})
        for t in r3["Response"].get("InvocationTaskSet", []):
            if t.get("InvocationId") == inv_id and t.get("TaskStatus") in ("SUCCESS", "FAILED"):
                out = t.get("TaskResult", {}).get("Output", "")
                if out:
                    return base64.b64decode(out).decode("utf-8", errors="replace")
                err = t.get("TaskResult", {}).get("ErrorInfo", "") or t.get("ErrorInfo", "")
                return f"[{t['TaskStatus']}] {err or 'no output'}"

    return "TIMEOUT"


if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = " ".join(sys.argv[1:])
    else:
        cmd = "echo 'hello from TAT' && uname -a"

    print(f"Executing on {INSTANCE_ID}: {cmd}")
    print("-" * 60)
    result = run_command(cmd)
    print(result)
