const { buildFilters } = require("../../../utils/filters");
const { buildSort } = require("../../../utils/sort");
const { buildAggregation } = require("../../../utils/buildAggregation"); 
const { parseSmartQuery } = require("../../../helpers/parseSmartQuery");
const { loadSchema } = require("../../../database");
const { ObjectId } = require("mongodb");

const readItems = (collection, modelName, options = {}) => async (req, res) => {
  const {
    page = 1,
    limit = 24,
    lastId,
    keyword,
    sort,
    distinct,
    groupBy,
    order = "asc",
    language,
    random = false,
    populate,
    exclude,
    fields,
    facet = false,
    addFields,
    variantFilters,
    joins,
    useSmartQuery = false,
    ...filters
  } = req.query;

  try {
    const currentSchema = await loadSchema(modelName);
    if (!currentSchema) {
      return res.badRequest({ message: "Schema not found" });
    }

    const schemaFields = currentSchema.fields.map(f => f.name);
    const validSearchableFields = currentSchema.fields
      .filter(f => f.type.toLowerCase() === "string")
      .map(f => f.name)
      .filter(f => !(options.excludedFields || []).includes(f));

    const validSortableFields = currentSchema.fields
      .filter(f => ["number", "date", "boolean"].includes(f.type.toLowerCase()))
      .map(f => f.name)
      .filter(f => !(options.excludedFields || []).includes(f));


    // Parse variantFilters
    let parsedVariantFilters = {};
    try {
      if (variantFilters) {
        parsedVariantFilters = JSON.parse(variantFilters);
      }
    } catch {
      return res.badRequest({ message: "Invalid variantFilters JSON" });
    }

    // Build filters query
    const filterQuery = buildFilters(
      { ...filters, ...parsedVariantFilters },
      validSearchableFields,
      schemaFields,
      keyword,
      language,
    );

    // Add lastId if provided (pagination with _id)
    if (lastId) {
      try {
        filterQuery._id = { $lt: new ObjectId(lastId) };
      } catch {
        return res.badRequest({ message: "Invalid lastId format" });
      }
    }

    // Build aggregation pipeline
    const aggregationPipeline = [];

    // Apply filters
    if (Object.keys(filterQuery).length > 0) {
      aggregationPipeline.push({ $match: filterQuery });
    }

    // Count total before limit
    const countPipeline = [...aggregationPipeline, { $count: "total" }];
    const countResult = await collection.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Apply sorting
    if (!random) {
      const sortQuery = buildSort(sort, order, validSortableFields);
      if (sortQuery && Object.keys(sortQuery).length > 0) {
        aggregationPipeline.push({ $sort: sortQuery });
      }
    } else {
      aggregationPipeline.push({ $sample: { size: Number(limit) } });
    }

    // Pagination using skip/limit only if not using lastId or random
    if (!lastId && !random) {
      const skip = (Number(page) - 1) * Number(limit);
      aggregationPipeline.push({ $skip: skip });
      aggregationPipeline.push({ $limit: Number(limit) });
    } else if (!random) {
      aggregationPipeline.push({ $limit: Number(limit) });
    }

    const items = await collection.aggregate(aggregationPipeline);

    return res.success({
      items,
      total,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("readItems error:", error);
    return res.internalServerError({ message: error.message });
  }
};

module.exports = readItems;
