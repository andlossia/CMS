const { pipeline } = require("@xenova/transformers");

let extractorPromise = null;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractorPromise;
}

async function parseSmartQuery(queryText, schema, collection, options = {}) {
  if (!queryText || typeof queryText !== "string") {
    throw new Error("Query must be a valid string");
  }

  if (!schema?.name?.collection) {
    throw new Error("Schema must contain name.collection for index name");
  }

  const indexName = schema.name.collection;

  console.log("🧠 Vector Search | Query text:", queryText, "| index:", indexName);

  try {
  
    const extractor = await getExtractor();
    const output = await extractor(queryText, { pooling: "mean", normalize: true });
    const vector = Array.from(output.data);
    const hasEmbedding = await collection.findOne({ embedding: { $exists: true } });

    if (!hasEmbedding) {
      console.warn("⚠️ No embeddings found. Generating embeddings now...");
      await generateEmbeddings(collection, schema, options);
    }

    return {
      $search: {
        index: indexName,
        knnBeta: {
          vector,
          path: "embedding",
          k: 10
        }
      }
    };

  } catch (err) {
    console.warn("🛑 Fallback to text search:", err.message);

    return {
      $search: {
        index: indexName,
        text: {
          query: queryText,
          path: { wildcard: "*" }
        }
      }
    };
  }
}

async function generateEmbeddings(collection, schema, options = {}) {
  const { dryRun = false } = options;

  const textFields = schema.fields
    .filter(f => f.type.toLowerCase() === 'string')
    .map(f => f.name);

  const total = await collection.countDocuments();
  const missing = await collection.countDocuments({ embedding: { $exists: false } });

  console.log(`📌 Embedding '${collection.collectionName}': ${missing}/${total} documents missing — [${textFields.join(', ')}]`);

  const cursor = collection.find({ embedding: { $exists: false } });
  const embedder = await loadEmbedder();

  let updated = 0;

  for await (const doc of cursor) {
    const text = textFields
      .map((field) => doc[field])
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!text) {
      console.warn(`⚠️ Skipping _id=${doc._id} — no text`);
      continue;
    }

    try {
      const result = await embedder(text, { pooling: "mean", normalize: true });
      const vector = Array.from(result.data);

      if (!dryRun) {
        await collection.updateOne({ _id: doc._id }, { $set: { embedding: vector } });
        console.log(`✅ Embedded _id=${doc._id}`);
      } else {
        console.log(`(DRY RUN) Would embed _id=${doc._id}`);
      }

      updated++;
    } catch (err) {
      console.error(`❌ Failed embedding _id=${doc._id}:`, err.message);
    }
  }

  console.log(`🎯 Embedding generation done. Updated ${updated} document(s).`);
}


module.exports = {
  parseSmartQuery,
  generateEmbeddings
};
