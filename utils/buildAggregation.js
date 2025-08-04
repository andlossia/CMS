const normalizeCollectionName = require("../helpers/normalizeCollectionName");

const buildAggregation = (populateInput, schemaFields = [], excludeInput = []) => {
  const pipeline = [];
  const visitedPaths = new Set();
  const unwoundArrays = new Set();

  const parsePopulateInput = (input) => {
    if (!input) return [];
    const items = Array.isArray(input) ? input : input.split(",");
    return items.map(p => {
      const [path, select] = p.trim().split(":");
      return {
        path,
        select: select ? select.split("|") : null,
      };
    });
  };

  const populatePaths = parsePopulateInput(populateInput);
  const excludePaths = Array.isArray(excludeInput)
    ? excludeInput
    : (excludeInput || "").split(",").map(e => e.trim());

  const isExcluded = (path) =>
    excludePaths.some(ex => path === ex || path.startsWith(`${ex}.`));

  const buildLookups = (parts, currentFields, basePath = '', depth = 0, projectionMap = {}, fullPath = '') => {
    if (depth > 10 || parts.length === 0) return;

    const [head, ...tail] = parts;
    const currentPath = basePath ? `${basePath}.${head}` : head;
    if (visitedPaths.has(currentPath) || isExcluded(currentPath)) return;
    visitedPaths.add(currentPath);

    const field = currentFields.find(f => f.name === head);
    if (!field) return;

    const isArray = field.type === 'array';
    const isObject = field.type === 'object' || Array.isArray(field.fields);
    const isRelation = !!field.relation?.ref;
    const refCollection = field.relation?.ref;

    if (isArray || (isObject && !isRelation)) {
      pipeline.push({
        $unwind: {
          path: `$${currentPath}`,
          preserveNullAndEmptyArrays: true,
        },
      });
      unwoundArrays.add(currentPath);
    }

    if (isRelation && refCollection) {
      const alias = `${currentPath}`;
      const expandedPath = `${currentPath}`;

      pipeline.push({
        $lookup: {
          from: normalizeCollectionName(refCollection),
          localField: currentPath,
          foreignField: '_id',
          as: alias,
        },
      });

      pipeline.push({
        $unwind: {
          path: `$${alias}`,
          preserveNullAndEmptyArrays: true,
        },
      });

      pipeline.push({
        $addFields: {
          [currentPath]: {
            $cond: {
              if: { $gt: [{ $type: `$${alias}` }, "missing"] },
              then: {
                $mergeObjects: [
                  { _id: `$${currentPath}` },
                  `$${alias}`
                ]
              },
              else: { _id: `$${currentPath}` }
            }
          }
        }

      });


      const matchedKey = Object.keys(projectionMap).find(k => fullPath.endsWith(k));
      const selectFields = projectionMap[matchedKey];

      if (selectFields?.length) {
        const partial = {
          $addFields: {
            [expandedPath]: selectFields.reduce((obj, field) => {
              obj[field] = `$${expandedPath}.${field}`;
              return obj;
            }, { _id: `$${expandedPath}._id` }),
          }
        };

        pipeline.push(partial);
      }


    }

    const nextFields = Array.isArray(field.fields) ? field.fields : [];
    if (tail.length > 0 && nextFields.length > 0) {
      buildLookups(tail, nextFields, currentPath, depth + 1, projectionMap, fullPath);
    }
  };

  const projectionMap = Object.fromEntries(
    populatePaths.map(({ path, select }) => [path, select])
  );

  if (populatePaths.find(p => p.path === 'all')) {
    schemaFields.forEach(field => {
      if (!field.relation?.ref || isExcluded(field.name)) return;
      const path = field.name;
      pipeline.push({
        $lookup: {
          from: normalizeCollectionName(field.relation.ref),
          localField: path,
          foreignField: '_id',
          as: path,
        },
      });
      if (field.type !== 'array') {
        pipeline.push({
          $unwind: {
            path: `$${path}`,
            preserveNullAndEmptyArrays: true,
          },
        });
      }
    });
  } else {
    populatePaths.forEach(({ path }) => {
      const parts = path.split(".");
      buildLookups(parts, schemaFields, '', 0, projectionMap, path);
    });
  }

  // 🔁 إعادة التجميع لأي مسار تم فكه سابقًا
  if (unwoundArrays.size > 0) {
    const groupStage = { _id: '$_id' };

    schemaFields.forEach(field => {
      const name = field.name;
      if (unwoundArrays.has(name)) {
        groupStage[name] = { $push: `$${name}` };
      } else {
        groupStage[name] = { $first: `$${name}` };
      }
    });

    pipeline.push({ $group: groupStage });
  }

  return pipeline;
};

module.exports = { buildAggregation };
