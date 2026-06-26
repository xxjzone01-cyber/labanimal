#!/usr/bin/env python3
"""Tencent Cloud TAT (Tencent Automation Tools) - Execute commands on remote instances.

Flow: CreateCommand -> InvokeCommand -> DescribeInvocationTasks (poll)
"""

import os
import sys
import time
import base64
from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.tat.v20201028 import tat_client, models as tat_models

# Config (from environment variables)
SECRET_ID = os.environ.get("TAT_SECRET_ID", "")
SECRET_KEY = os.environ.get("TAT_SECRET_KEY", "")
REGION = os.environ.get("TAT_REGION", "na-siliconvalley")
INSTANCE_ID = os.environ.get("TAT_INSTANCE_ID", "lhins-mmiwlnzl")


def get_client():
    cred = credential.Credential(SECRET_ID, SECRET_KEY)
    httpProfile = HttpProfile()
    httpProfile.endpoint = "tat.tencentcloudapi.com"
    clientProfile = ClientProfile()
    clientProfile.httpProfile = httpProfile
    return tat_client.TatClient(cred, REGION, clientProfile)


def run_command(command: str, timeout: int = 60) -> str:
    """Execute a shell command on the remote instance and return output."""
    client = get_client()

    # Step 1: Create command
    create_req = tat_models.CreateCommandRequest()
    create_req.CommandName = f"labanimal-{int(time.time())}"
    create_req.Content = base64.b64encode(command.encode()).decode()
    create_req.CommandType = "SHELL"
    create_req.Timeout = timeout
    create_req.WorkingDirectory = "/root"

    try:
        create_resp = client.CreateCommand(create_req)
        command_id = create_resp.CommandId
    except Exception as e:
        return f"ERROR creating command: {e}"

    # Step 2: Invoke command on instance
    invoke_req = tat_models.InvokeCommandRequest()
    invoke_req.CommandId = command_id
    invoke_req.InstanceIds = [INSTANCE_ID]
    invoke_req.Timeout = timeout

    try:
        invoke_resp = client.InvokeCommand(invoke_req)
        invocation_id = invoke_resp.InvocationId
    except Exception as e:
        return f"ERROR invoking command: {e}"

    # Step 3: Poll for result
    for _ in range(timeout + 15):
        time.sleep(2)
        try:
            poll_req = tat_models.DescribeInvocationTasksRequest()
            poll_req.InvokeIds = [invocation_id]
            poll_resp = client.DescribeInvocationTasks(poll_req)

            if poll_resp.InvocationTaskSet:
                task = poll_resp.InvocationTaskSet[0]
                if task.TaskStatus in ("SUCCESS", "FAILED"):
                    # Get detailed output
                    detail_req = tat_models.DescribeInvocationTaskRequest()
                    detail_req.InvokeId = invocation_id
                    detail_req.TaskId = task.TaskId
                    detail_resp = client.DescribeInvocationTask(detail_req)

                    output = ""
                    if hasattr(detail_resp, 'Task') and detail_resp.Task:
                        task_detail = detail_resp.Task
                        # Try multiple output fields
                        for field in ['Output', 'OutputUrl', 'ErrorMessage']:
                            val = getattr(task_detail, field, '')
                            if val:
                                try:
                                    decoded = base64.b64decode(val).decode('utf-8', errors='replace')
                                    if decoded.strip():
                                        output += decoded
                                except Exception:
                                    output += val

                        if not output:
                            # Try DescribeCommandOutput
                            try:
                                out_req = tat_models.DescribeCommandOutputRequest()
                                out_req.InvokeId = invocation_id
                                out_resp = client.DescribeCommandOutput(out_req)
                                if out_resp.CommandDocumentSet:
                                    for doc in out_req.CommandDocumentSet:
                                        if hasattr(doc, 'Output'):
                                            output += doc.Output
                            except Exception:
                                pass

                    status_icon = "OK" if task.TaskStatus == "SUCCESS" else "FAIL"
                    if output.strip():
                        return output
                    return f"[{status_icon}] Command executed but no stdout captured"

        except Exception as e:
            pass  # Keep polling

    return "TIMEOUT: Command did not complete within timeout"


if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = " ".join(sys.argv[1:])
    else:
        cmd = "echo 'hello from TAT' && uname -a"

    print(f"Executing on {INSTANCE_ID}: {cmd}")
    print("-" * 60)
    result = run_command(cmd)
    print(result)
