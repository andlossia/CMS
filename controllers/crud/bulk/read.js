const { buildFilters } = require("../../../utils/filters");
const { buildSort } = require("../../../utils/sort");
const { buildAggregation } = require("../../../utils/buildAggregation");
const { loadSchema } = require("../../../database");
const { parseSmartQuery } = require("../../../helpers/parseSmartQuery");
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

    const schemaFields = currentSchema.fields.map((field) => field.name);
    const fieldTypesMap = Object.fromEntries(
      currentSchema.fields.map((field) => [field.name, field.type.toLowerCase()])
    );

    const dynamicSearchableFields = currentSchema.fields
      .filter((f) => f.type.toLowerCase() === "string")
      .map((f) => f.name);

    const dynamicSortableFields = currentSchema.fields
      .filter((f) => ["number", "date", "boolean"].includes(f.type.toLowerCase()))
      .map((f) => f.name);

    const excludedFields = options.excludedFields || [];
    const maxKeywordLength = options.maxKeywordLength || 100;

    const validSearchableFields = dynamicSearchableFields.filter(
      (field) => !excludedFields.includes(field)
    );
    const validSortableFields = dynamicSortableFields.filter(
      (field) => !excludedFields.includes(field)
    );

    let parsedFilters = {};
    if (useSmartQuery && keyword?.trim()) {
      try {
        parsedFilters = await parseSmartQuery(keyword.trim(), schemaFields);
      } catch (e) {
        console.warn("⚠️ Failed to parse smart query:", e.message);
      }
    }

    const finalFilters = {
      ...filters,
      ...parsedFilters,
      ...(variantFilters ? JSON.parse(variantFilters) : {}),
    };

    const mockModel = {
      schema: {
        paths: Object.fromEntries(
          Object.entries(fieldTypesMap).map(([field, type]) => {
            let instance = "String";
            if (["number", "decimal", "float", "double"].includes(type))
              instance = "Number";
            else if (["boolean", "bool"].includes(type)) instance = "Boolean";
            else if (["date"].includes(type)) instance = "Date";
            return [field, { instance }];
          })
        ),
      },
    };

    const query = buildFilters(
      finalFilters,
      validSearchableFields,
      schemaFields,
      keyword,
      language,
      maxKeywordLength,
      mockModel
    );

    if (lastId) {
      try {
        query._id = { $lt: new ObjectId(lastId) };
      } catch {
        return res.badRequest({ message: "Invalid lastId format" });
      }
    }

    const sortQuery = random ? null : buildSort(sort, order, validSortableFields);

let finalFields = fields;
if (!fields && populate) {
  const populateList = Array.isArray(populate) ? populate : populate.split(",");
  const autoFields = [];

  populateList.forEach(entry => {
    const [path, selected] = entry.trim().split(":");
    if (selected) {
      selected.split("|").forEach(field => {
        autoFields.push(`${path}.${field}`);
      });
    }
  });

  if (autoFields.length > 0) {
    finalFields = autoFields.join(",");
  }
}


const aggregationPipeline = [
  { $match: query },
  ...buildAggregation(populate, currentSchema.fields, exclude),
];


const unwindedFields = aggregationPipeline
  .filter(stage => stage.$unwind && typeof stage.$unwind.path === 'string')
  .map(stage => stage.$unwind.path.replace(/^\$/, '').split('.')[0]);

const uniqueUnwinded = [...new Set(unwindedFields)];

if (uniqueUnwinded.length > 0) {
  const groupStage = {
    $group: {
      _id: "$_id",
      doc: { $first: "$$ROOT" },
    },
  };

  uniqueUnwinded.forEach(field => {
    groupStage.$group[field] = { $push: `$${field}` };
  });

  aggregationPipeline.push(groupStage);
  aggregationPipeline.push({
  $replaceRoot: { newRoot: "$doc" },
});

}


// 📌 Add custom lookups
if (joins) {
  const joinList = Array.isArray(joins) ? joins : joins.split(",");
  for (const join of joinList) {
    const [from, localField, foreignField = "_id"] = join
      .split(":")
      .flatMap(p => p.split("="));
    if (from && localField) {
      aggregationPipeline.push({
        $lookup: {
          from: from.trim(),
          localField: localField.trim(),
          foreignField: foreignField.trim(),
          as: from.trim(),
        },
      });
    }
  }
}

// 📌 Add computed fields
if (addFields) {
  try {
    const parsedFields = typeof addFields === "string" ? JSON.parse(addFields) : addFields;
    aggregationPipeline.push({ $addFields: parsedFields });
  } catch (err) {
    console.warn("Invalid addFields JSON:", err);
  }
}

// 📌 Projection
if (fields && fields.trim()) {
  const projection = fields.split(",").reduce((acc, f) => {
    const trimmed = f.trim();
    if (trimmed) acc[trimmed] = 1;
    return acc;
  }, {});

  aggregationPipeline.push({ $project: projection });
}


// 📌 Sorting
if (sortQuery && Object.keys(sortQuery).length > 0) {
  aggregationPipeline.push({ $sort: sortQuery });
}

// 📌 Paging
const skipValue = (Number(page) - 1) * Number(limit);
if (skipValue > 0) aggregationPipeline.push({ $skip: skipValue });
aggregationPipeline.push({ $limit: Number(limit) });

let result;

if (facet === "true") {
  result = await collection.aggregate([
    {
      $facet: {
        items: aggregationPipeline,
        total: [{ $match: query }, { $count: "count" }],
      },
    },
  ]);

  result = result[0] || { items: [], total: [] };
  const total = result.total[0]?.count || 0;

  

  result = {
    items: result.items,
    total,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
} else {
  const items = await collection.aggregate(aggregationPipeline);
  const total = await collection.countDocuments(query);
  result = {
    items,
    total,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
}


    res.success({ schema: modelName, result });
  } catch (error) {
    console.error("❌ Error in readItems:", error);
    res.internalServerError({ message: `Error fetching ${modelName}s`, error: error.message });
  }
};

module.exports = readItems;