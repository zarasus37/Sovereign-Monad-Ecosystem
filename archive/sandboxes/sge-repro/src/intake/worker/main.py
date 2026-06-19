import os, json, time
import redis
from src.intake.worker.structural import compute_structural_read, LOCK_THRESHOLD

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUE_NAME = os.getenv("SGE_QUEUE_NAME", "sge:queue")
RESULT_PREFIX = os.getenv("SGE_RESULT_PREFIX", "sge:results:")


def main():
    r = redis.from_url(REDIS_URL, decode_responses=True)
    while True:
        item = r.brpop(QUEUE_NAME, timeout=5)
        if not item:
            time.sleep(1)
            continue
        _, payload_json = item
        task = json.loads(payload_json)
        job_id = task.get("id")
        payload = task.get("payload", {})
        try:
            score = compute_structural_read(payload)
            status = "LOCK" if score >= LOCK_THRESHOLD else "REJECT"
            r.set(RESULT_PREFIX + job_id, json.dumps({"status": status, "score": score}))
        except Exception as e:
            r.set(RESULT_PREFIX + job_id, json.dumps({"status": "ERROR", "error": str(e)}))


if __name__ == "__main__":
    main()
