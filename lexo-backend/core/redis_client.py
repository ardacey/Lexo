import os
import redis
import json
import asyncio
from typing import Optional

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url, decode_responses=True)

class RedisMessageBroker:
    def __init__(self):
        self.redis_client = redis_client
        self.pubsub = self.redis_client.pubsub()
        self.listeners = {}
        
    async def publish_to_room(self, room_id: str, message: dict):
        channel = f"room:{room_id}"
        await asyncio.get_event_loop().run_in_executor(
            None, 
            self.redis_client.publish, 
            channel, 
            json.dumps(message)
        )
    
    async def subscribe_to_room(self, room_id: str, callback):
        channel = f"room:{room_id}"
        if channel not in self.listeners:
            self.listeners[channel] = []
        self.listeners[channel].append(callback)
        
        await asyncio.get_event_loop().run_in_executor(
            None,
            self.pubsub.subscribe,
            channel
        )
    
    async def listen_for_messages(self):
        while True:
            try:
                message = await asyncio.get_event_loop().run_in_executor(
                    None,
                    self.pubsub.get_message,
                    1.0
                )
                
                if message and message['type'] == 'message':
                    channel = message['channel']
                    data = json.loads(message['data'])
                    
                    if channel in self.listeners:
                        for callback in self.listeners[channel]:
                            try:
                                await callback(data)
                            except Exception as e:
                                print(f"Error in callback for channel {channel}: {e}")
                                
            except Exception as e:
                print(f"Error in Redis listener: {e}")
                await asyncio.sleep(1)

message_broker = RedisMessageBroker()
