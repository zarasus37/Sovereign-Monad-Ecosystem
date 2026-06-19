from fastapi import FastAPI, Response
from pydantic import BaseModel
import os, json, uuid
import redis.asyncio as aioredis

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUE_NAME = os.getenv("SGE_QUEUE_NAME", "sge:queue")
RESULT_PREFIX = os.getenv("SGE_RESULT_PREFIX", "sge:results:")

app = FastAPI()

class ForagePayload(BaseModel):
    target: str
    depth: str = "recursive"
    meta: dict = {}


@app.post("/intake/forage", status_code=202)
async def forage(payload: ForagePayload, response: Response):
    job_id = str(uuid.uuid4())
    task = {"id": job_id, "payload": payload.dict()}
    r = aioredis.from_url(REDIS_URL)
    await r.lpush(QUEUE_NAME, json.dumps(task))
    response.headers["Location"] = f"/intake/forage/{job_id}/status"
    await r.set(RESULT_PREFIX + job_id, json.dumps({"status": "pending"}))
    return {"id": job_id, "status": "pending"}


@app.get("/intake/forage/{job_id}/status")
async def status(job_id: str):
    r = aioredis.from_url(REDIS_URL)
    val = await r.get(RESULT_PREFIX + job_id)
    if not val:
        return {"id": job_id, "status": "unknown"}
    return json.loads(val)
