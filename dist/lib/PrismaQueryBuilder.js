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
/**
 * Nullable columns per model, cached alongside the sortable ones.
 *
 * Postgres orders NULLs FIRST on a descending sort, so `?sortBy=averageRating:desc`
 * ("top rated") led with every product nobody has reviewed yet. Prisma can ask
 * for NULLs last, but only on an optional field — the `{ sort, nulls }` form is
 * rejected for a required one — so the builder has to know which is which
 * before it can emit it. Read from the schema for the same reason the sortable
 * set is: a hand-maintained list goes stale the first time a column changes.
 */
const nullableFieldCache = new Map();
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
const nullableFieldsFor = (model) => {
    const cached = nullableFieldCache.get(model);
    if (cached)
        return cached;
    const definition = prisma_client_1.Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === model);
    const fields = new Set((definition?.fields ?? [])
        .filter((field) => (field.kind === "scalar" || field.kind === "enum") &&
        !field.isList &&
        !field.isRequired)
        .map((field) => field.name));
    nullableFieldCache.set(model, fields);
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
            sortAliases: {},
        };
        // `any` because a relation alias nests: { auth: { email: "asc" } }.
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
            sortAliases: config.sortAliases || this.sortConfig.sortAliases,
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
     * Search across multiple fields with case-insensitive matching.
     *
     * `relationPaths` reaches one level into a to-one relation using dotted
     * notation — `"auth.email"` becomes
     * `{ auth: { is: { email: { contains } } } }`. It is a second parameter
     * rather than a dotted entry in `fields` so that `fields` keeps its
     * `keyof TWhereInput` typing; a dotted string is not a key of the where
     * input, and widening the array to `string[]` would drop the compile-time
     * check on every existing caller.
     *
     * The `is:` wrapper is the form that works for an OPTIONAL to-one relation
     * (`User.auth` is `Auth?`); the bare shorthand only happens to work today.
     *
     * @example search(['name', 'phone'], ['auth.email'])
     * @example search(['vendorOrderNumber'], ['order.user.auth.email'])
     */
    search(fields, relationPaths = []) {
        const searchValue = this.getQueryParam("search");
        if (!searchValue || (fields.length === 0 && relationPaths.length === 0)) {
            return this;
        }
        const match = {
            contains: String(searchValue),
            mode: "insensitive",
        };
        const conditions = fields.map((field) => ({ [field]: match }));
        for (const path of relationPaths) {
            const segments = path.split(".");
            if (segments.length < 2 || segments.some((segment) => !segment)) {
                throw new Error(`search(): relation path "${path}" must be "relation.column" or deeper`);
            }
            // Every segment but the last is a to-ONE relation, walked with
            // `is`; the last is the column. `order.user.auth.email` becomes
            // { order: { is: { user: { is: { auth: { is: { email } } } } } } }.
            // A to-many relation needs `some` instead and is not supported
            // here — Prisma rejects `is` on a list at runtime.
            const column = segments.pop();
            conditions.push(segments.reduceRight((inner, relation) => ({ [relation]: { is: inner } }), { [column]: match }));
        }
        this.whereConditions.push({
            OR: conditions,
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
            // scalar column of the model is sortable. Declared relation
            // aliases are sortable on top of either.
            const aliases = this.sortConfig.sortAliases;
            const allowed = new Set([
                ...(this.sortConfig.allowedFields.length > 0
                    ? this.sortConfig.allowedFields
                    : sortableFieldsFor(this.model)),
                ...Object.keys(aliases),
            ]);
            if (!allowed.has(sortField)) {
                // 400, not a silent fallback. Quietly ignoring the caller's
                // sort returns a differently-ordered page with no hint why,
                // which is harder to debug than an error; and before this
                // check the unknown column reached Prisma and came back a 500.
                throw new customError_1.default(400, `Cannot sort by "${sortField}". Sortable fields: ${[...allowed]
                    .sort()
                    .join(", ")}`);
            }
            const direction = sortOrder === "desc" ? "desc" : "asc";
            const alias = aliases[sortField];
            if (alias) {
                const [relation, column] = alias.split(".");
                this.orderByCondition = {
                    [relation]: { [column]: direction },
                };
            }
            else if (nullableFieldsFor(this.model).has(sortField)) {
                // "Highest first" must not lead with the rows that have no
                // value at all — see nullableFieldsFor.
                this.orderByCondition = {
                    [sortField]: { sort: direction, nulls: "last" },
                };
            }
            else {
                this.orderByCondition = { [sortField]: direction };
            }
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
