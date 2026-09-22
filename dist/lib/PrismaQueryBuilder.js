"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const prisma_client_1 = require("./prisma-client.js");
const customError_1 = __importDefault(require("../utils/customError.js"));
/**
 * Sortable columns per model, read from the generated schema and cached.
 *
 * Derived rather than hand-listed on purpose: a hand-maintained allowlist goes
 * stale the first time someone adds a column, and the failure mode is a field
 * that legitimately exists being rejected. Scalars and enums are sortable;
 * relations and lists are not.
 */
const sortableFieldCache = new Map();
const sortableFieldsFor = (model) => {
    const cached = sortableFieldCache.get(model);
    if (cached)
        return cached;
    const definition = prisma_client_1.Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === model);
    const fields = new Set((definition?.fields ?? [])
        .filter((field) => (field.kind === "scalar" || field.kind === "enum") &&
        !field.isList)
        .map((field) => field.name));
    sortableFieldCache.set(model, fields);
    return fields;
};
/**
 * Enhanced Prisma Query Builder with builder pattern and type safety
 * @template TWhereInput - Prisma where input type
 * @template TModel - Prisma model type for count operations
 */
class PrismaQueryBuilder {
    constructor(query, config) {
        this.query = query;
        this.whereConditions = [];
        this.defaultFilter = null;
        this.isDefaultFilterApplied = false;
        this.paginationConfig = {
            page: 1,
            limit: 10,
            maxLimit: 100,
        };
        this.sortConfig = {
            defaultField: "createdAt",
            defaultOrder: "desc",
            allowedFields: [],
        };
        this.orderByCondition = {};
        this.includeFields = {};
        this.selectFields = {};
        this.model = config.model;
        this.paginationConfig = { ...this.paginationConfig, ...config };
        this.sortConfig = {
            ...this.sortConfig,
            defaultField: config.defaultField || this.sortConfig.defaultField,
            defaultOrder: config.defaultOrder || this.sortConfig.defaultOrder,
            allowedFields: config.allowedFields || this.sortConfig.allowedFields,
        };
    }
    /**
     * Set default filter that applies to all queries
     * @example withDefaultFilter({ isDeleted: false, status: 'ACTIVE' })
     */
    withDefaultFilter(filter) {
        this.defaultFilter = filter;
        return this;
    }
    /**
     * Add custom where condition
     * @example addWhere({ userId: '123' })
     */
    addWhere(condition) {
        this.whereConditions.push(condition);
        return this;
    }
    /**
     * Add multiple OR conditions
     * @example addOrConditions([{ status: 'ACTIVE' }, { status: 'PENDING' }])
     */
    addOrConditions(conditions) {
        if (conditions.length > 0) {
            this.whereConditions.push({
                OR: conditions,
            });
        }
        return this;
    }
    /**
     * Merge include fields (supports nested includes)
     * @example include({ user: true, comments: { include: { author: true } } })
     */
    include(fields) {
        this.includeFields = this.deepMerge(this.includeFields, fields);
        return this;
    }
    /**
     * Merge select fields
     * @example select({ id: true, name: true })
     */
    select(fields) {
        this.selectFields = { ...this.selectFields, ...fields };
        return this;
    }
    /**
     * Search across multiple fields with case-insensitive matching
     * @example search(['name', 'email', 'description'])
     */
    search(fields) {
        const searchValue = this.getQueryParam("search");
        if (!searchValue || fields.length === 0) {
            return this;
        }
        this.whereConditions.push({
            OR: fields.map((field) => ({
                [field]: {
                    contains: String(searchValue),
                    mode: "insensitive",
                },
            })),
        });
        return this;
    }
    /**
     * Apply filters from query params (excludes reserved keywords)
     * Supports comma-separated values for IN queries
     * @example filter() // Converts ?status=ACTIVE,PENDING to { status: { in: ['ACTIVE', 'PENDING'] } }
     */
    filter() {
        const RESERVED_KEYS = [
            "search",
            "page",
            "limit",
            "sortBy",
            "sort",
            "orderBy",
            "order",
        ];
        const filterParams = Object.entries(this.query)
            .filter(([key]) => !RESERVED_KEYS.includes(key))
            .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {});
        if (Object.keys(filterParams).length === 0) {
            return this;
        }
        const conditions = Object.entries(filterParams).map(([key, value]) => {
            // Handle comma-separated values for IN queries
            if (this.isCommaSeparated(value)) {
                return {
                    [key]: {
                        in: this.parseCommaSeparated(value),
                    },
                };
            }
            // Handle boolean conversion
            if (value === "true" || value === "false") {
                return { [key]: value === "true" };
            }
            // Handle numeric values
            if (this.isNumeric(value)) {
                return { [key]: Number(value) };
            }
            return { [key]: value };
        });
        if (conditions.length > 0) {
            this.whereConditions.push({
                AND: conditions,
            });
        }
        return this;
    }
    /**
     * Filter by numeric range
     * @example range('price', '100,500') // price between 100 and 500
     */
    range(field, rangeValue) {
        if (!rangeValue) {
            return this;
        }
        const [min, max] = rangeValue.split(",").map(Number);
        if (isNaN(min) || isNaN(max)) {
            // console.warn(`Invalid range values for ${String(field)}: ${rangeValue}`);
            return this;
        }
        this.whereConditions.push({
            [field]: {
                gte: min,
                lte: max,
            },
        });
        return this;
    }
    /**
     * Filter by date range
     * @example dateRange('createdAt', '2024-01-01,2024-12-31')
     */
    dateRange(field, rangeValue) {
        if (!rangeValue) {
            return this;
        }
        const [startDate, endDate] = rangeValue.split(",");
        if (!startDate || !endDate) {
            // console.warn(`Invalid date range for ${String(field)}: ${rangeValue}`);
            return this;
        }
        this.whereConditions.push({
            [field]: {
                gte: new Date(startDate),
                lte: new Date(endDate),
            },
        });
        return this;
    }
    /**
     * Apply pagination with validation
     */
    paginate() {
        const page = this.getQueryParam("page");
        const limit = this.getQueryParam("limit");
        this.paginationConfig.page = this.validatePage(page);
        this.paginationConfig.limit = this.validateLimit(limit);
        return this;
    }
    /**
     * Apply sorting with field validation
     * @example sort('createdAt', 'desc') or uses ?sortBy=name:asc from query
     */
    sort(defaultField, defaultOrder) {
        const field = defaultField || this.sortConfig.defaultField;
        const order = defaultOrder || this.sortConfig.defaultOrder;
        const sortBy = this.getQueryParam("sortBy") || this.getQueryParam("sort");
        if (sortBy) {
            const [sortField, sortOrder] = String(sortBy).split(":");
            // An explicit `allowedFields` narrows further; otherwise every
            // scalar column of the model is sortable.
            const allowed = this.sortConfig.allowedFields.length > 0
                ? new Set(this.sortConfig.allowedFields)
                : sortableFieldsFor(this.model);
            if (!allowed.has(sortField)) {
                // 400, not a silent fallback. Quietly ignoring the caller's
                // sort returns a differently-ordered page with no hint why,
                // which is harder to debug than an error; and before this
                // check the unknown column reached Prisma and came back a 500.
                throw new customError_1.default(400, `Cannot sort by "${sortField}". Sortable fields: ${[...allowed]
                    .sort()
                    .join(", ")}`);
            }
            this.orderByCondition = {
                [sortField]: sortOrder === "desc" ? "desc" : "asc",
            };
        }
        else {
            this.orderByCondition = { [field]: order };
        }
        return this;
    }
    /**
     * Apply default filter once before building
     */
    applyDefaultFilter() {
        if (this.defaultFilter && !this.isDefaultFilterApplied) {
            this.whereConditions.push(this.defaultFilter);
            this.isDefaultFilterApplied = true;
        }
    }
    /**
     * Build final Prisma query arguments
     */
    build() {
        this.applyDefaultFilter();
        const skip = (this.paginationConfig.page - 1) * this.paginationConfig.limit;
        const args = {
            where: this.buildWhereClause(),
            skip,
            take: this.paginationConfig.limit,
        };
        if (Object.keys(this.orderByCondition).length > 0) {
            args.orderBy = this.orderByCondition;
        }
        if (Object.keys(this.includeFields).length > 0) {
            args.include = this.includeFields;
        }
        if (Object.keys(this.selectFields).length > 0) {
            args.select = this.selectFields;
        }
        return args;
    }
    /**
     * Build WHERE clause with optimization
     */
    buildWhereClause() {
        if (this.whereConditions.length === 0) {
            return {};
        }
        if (this.whereConditions.length === 1) {
            return this.whereConditions[0];
        }
        return { AND: this.whereConditions };
    }
    /**
     * Get pagination metadata
     * @param prismaModel - Prisma model with count method
     */
    async getMeta(prismaModel) {
        this.applyDefaultFilter();
        const totalData = await prismaModel.count({
            where: this.buildWhereClause(),
        });
        const totalPages = Math.ceil(totalData / this.paginationConfig.limit);
        const currentPage = this.paginationConfig.page;
        return {
            currentPage,
            totalPages,
            totalData,
            pageSize: this.paginationConfig.limit,
            hasNextPage: currentPage < totalPages,
            hasPreviousPage: currentPage > 1,
        };
    }
    /**
     * Execute query and return data with metadata
     * @param prismaModel - Prisma model with findMany and count methods
     */
    async execute(prismaModel) {
        const [data, meta] = await Promise.all([
            prismaModel.findMany(this.build()),
            this.getMeta(prismaModel),
        ]);
        return { data, meta };
    }
    // ==================== Helper Methods ====================
    getQueryParam(key) {
        return this.query[key];
    }
    validatePage(page) {
        const parsed = Number(page);
        return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }
    validateLimit(limit) {
        const parsed = Number(limit);
        if (isNaN(parsed) || parsed < 1) {
            return this.paginationConfig.limit;
        }
        return Math.min(parsed, this.paginationConfig.maxLimit);
    }
    isCommaSeparated(value) {
        return typeof value === "string" && value.includes(",");
    }
    parseCommaSeparated(value) {
        return decodeURIComponent(value)
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
    }
    isNumeric(value) {
        return !isNaN(Number(value)) && value !== "" && value !== null;
    }
    /**
     * Deep merge objects (useful for nested includes)
     */
    deepMerge(target, source) {
        const output = { ...target };
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach((key) => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        output[key] = source[key];
                    }
                    else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                }
                else {
                    output[key] = source[key];
                }
            });
        }
        return output;
    }
    isObject(item) {
        return item && typeof item === "object" && !Array.isArray(item);
    }
    /**
     * Reset builder to initial state (useful for reusing instance)
     */
    reset() {
        this.whereConditions = [];
        this.defaultFilter = null;
        this.isDefaultFilterApplied = false;
        this.orderByCondition = {};
        this.includeFields = {};
        this.selectFields = {};
        return this;
    }
    /**
     * Clone current builder state
     */
    clone() {
        const cloned = new PrismaQueryBuilder({ ...this.query }, { ...this.paginationConfig, ...this.sortConfig, model: this.model });
        cloned.whereConditions = [...this.whereConditions];
        cloned.defaultFilter = this.defaultFilter
            ? { ...this.defaultFilter }
            : null;
        cloned.orderByCondition = { ...this.orderByCondition };
        cloned.includeFields = { ...this.includeFields };
        cloned.selectFields = { ...this.selectFields };
        return cloned;
    }
}
exports.default = PrismaQueryBuilder;
