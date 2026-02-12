/**
 * Pagination Utility for MongoDB Queries
 * Provides consistent pagination across all API routes
 */

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Parse pagination parameters from request query
 * @param {Object} query - Express request query object
 * @returns {Object} - Parsed pagination parameters
 */
const parsePaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit) || DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * limit;
  
  return {
    page,
    limit,
    skip,
    hasNextPage: page * limit,
    hasPrevPage: page > 1
  };
};

/**
 * Build pagination response with metadata
 * @param {Array} data - Results array
 * @param {number} total - Total count of documents
 * @param {Object} params - Pagination parameters
 * @returns {Object} - Paginated response
 */
const buildPaginatedResponse = (data, total, params) => {
  const { page, limit, hasNextPage, hasPrevPage } = params;
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null
    }
  };
};

/**
 * Apply pagination to a Mongoose query
 * @param {Object} query - Mongoose query
 * @param {Object} params - Pagination parameters
 * @returns {Object} - Query with pagination applied
 */
const paginateQuery = (query, params) => {
  return query.skip(params.skip).limit(params.limit);
};

/**
 * Create a paginated route handler
 * @param {Function} queryBuilder - Function that builds the query
 * @returns {Function} - Express route handler
 */
const createPaginatedHandler = (queryBuilder) => {
  return async (req, res, next) => {
    try {
      const params = parsePaginationParams(req.query);
      
      // Get total count
      const totalQuery = await queryBuilder(req, { ...params, countOnly: true });
      const total = await totalQuery.countDocuments();
      
      // Get paginated data
      const dataQuery = await queryBuilder(req, { ...params, countOnly: false });
      paginateQuery(dataQuery, params);
      const data = await dataQuery;
      
      const response = buildPaginatedResponse(data, total, params);
      res.json(response);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Cursor-based pagination for infinite scroll
 * @param {Object} query - Mongoose query
 * @param {string} cursorField - Field to use as cursor (e.g., '_id' or 'createdAt')
 * @param {Object} params - Pagination parameters including cursor
 */
const cursorPaginate = async (query, cursorField, params) => {
  const { cursor, limit = DEFAULT_PAGE_SIZE } = params;
  
  if (cursor) {
    query.where(cursorField).lt(cursor);
  }
  
  return query.limit(limit + 1).sort({ [cursorField]: -1 });
};

module.exports = {
  parsePaginationParams,
  buildPaginatedResponse,
  paginateQuery,
  createPaginatedHandler,
  cursorPaginate,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
};
