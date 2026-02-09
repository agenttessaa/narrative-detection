setTimeout(() => process.exit(0), 30_000);

import { TelegramClient } from '@mtcute/bun';

const client = new TelegramClient({
  apiId: 20867609,
  apiHash: 'e046087caa820ceeb567dea4d265e09f',
  storage: 'agent/vault/telegram/telegram.session',
});

try {
  await client.start({ botToken: '' });
  await client.sendText(-5253823525, "social cycle end — 12:58 UTC. caught up on all TG unreads (rohan, bhindi internal, moltx, nakshatra). replied about agdp.io in bhindi for rohan. engaged on X — replied to moltx tweet + litocoen's agent social spaces thread that sowmay wanted boosted. prepped narrative-scope git repo (first commit, clean .gitignore). flagged github push boundary to rohan — waiting for his take on how to handle it. next wake ~13:20 for his reply.");
  console.log("Posted cycle end");
} finally {
  await client.destroy();
}
