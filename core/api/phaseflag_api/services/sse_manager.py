"""Server-Sent Events (SSE) manager for real-time flag updates."""

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)


class SSEManager:
    """Fan-out manager for Server-Sent Events connections."""

    def __init__(self) -> None:
        self._clients: set[asyncio.Queue[str]] = set()
        self._event_counter: int = 0

    @property
    def client_count(self) -> int:
        return len(self._clients)

    def connect(self) -> asyncio.Queue[str]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        self._clients.add(queue)
        logger.info("SSE client connected (total: %d)", self.client_count)
        return queue

    def disconnect(self, queue: asyncio.Queue[str]) -> None:
        self._clients.discard(queue)
        logger.info("SSE client disconnected (total: %d)", self.client_count)

    async def broadcast(self, event_type: str, data: dict[str, Any]) -> None:
        if not self._clients:
            return

        self._event_counter += 1
        message = self._format_sse(
            event=event_type, data=data, event_id=str(self._event_counter),
        )

        disconnected: list[asyncio.Queue[str]] = []
        for queue in self._clients:
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                disconnected.append(queue)
                logger.warning("SSE client queue full, disconnecting")

        for queue in disconnected:
            self._clients.discard(queue)

    def _format_sse(self, event: str, data: dict[str, Any], event_id: str | None = None) -> str:
        lines: list[str] = []
        if event_id:
            lines.append(f"id: {event_id}")
        lines.append(f"event: {event}")
        lines.append(f"data: {json.dumps(data)}")
        lines.append("")
        return "\n".join(lines) + "\n"

    def format_connected_event(self, version: str) -> str:
        return self._format_sse(
            event="connected",
            data={
                "version": version,
                "timestamp": datetime.now(UTC).isoformat(),
                "message": "Connected to Phase Flag SSE stream",
            },
        )


sse_manager = SSEManager()
