import { processDiscoveryEmbeddingBatch } from '@/lib/discovery/embeddingWorker';

const limit = Number(process.argv[2] || process.env.DISCOVERY_EMBEDDING_BATCH_LIMIT || 20);

processDiscoveryEmbeddingBatch(limit)
  .then((result) => {
    console.log(JSON.stringify(result));
  })
  .catch((error) => {
    console.error('[DISCOVERY EMBEDDING BATCH]', error);
    process.exitCode = 1;
  });
