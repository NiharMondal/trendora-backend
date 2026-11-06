 
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from "@/lib/prisma-client";
import CustomError from "@/utils/customError";

interface PaginationMeta {
    currentPage: number;
    totalPages: number;
    totalData: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

interface PaginationConfig {
    page?: number;
    limit?: number;
    maxLimit?: number;
}

interface SortConfig {
    defaultField?: string;
    defaultOrder?: "asc" | "desc";
    /**
     * Restrict sorting further than the model allows. Leave unset to permit
     * every scalar column of `model`, which is the usual case.
     */
    allowedFields?: string[];
    /**
     * Expose a to-one relation's column under a flat name the caller can sort
     * by, e.g. `{ email: "auth.email" }` lets `?sortBy=email:asc` become
     * `orderBy: { auth: { email: "asc" } }`.
     *
     * Needed where a model's API shape is flatter than its schema: `User` is
     * split across `User` and `Auth`, so `email` is a column the client can
     * see but `sortableFieldsFor("User")` will never contain. Aliases are
     * declared in code, never derived from the query string, so this widens
     * what is sortable without widening what a caller can inject.
     */
    sortAliases?: Record<string, string>;
}

/**
 * Every builder must name its Prisma model.
 *
 * `sortBy` arrives from the query string and is written straight into Prisma's
 * `orderBy`. Without knowing the model there is nothing to validate it against,
 * so a typo'd column reached the database and came back as a 500. The model
 * name is the one thing the builder cannot infer — the generic
 * (`Prisma.ProductWhereInput`) is erased at runtime — so it is **required**,
 * which makes it impossible to add a new list endpoint that silently skips the
 * check.
 */
interface ModelConfig {
    /** Prisma model name exactly as declared in schema.prisma, e.g. "Product". */
    model: Prisma.ModelName;
}

/**
 * Sortable columns per model, read from the generated schema and cached.
 *
 * Derived rather than hand-listed on purpose: a hand-maintained allowlist goes
 * stale the first time someone adds a column, and the failure mode is a field
 * that legitimately exists being rejected. Scalars and enums are sortable;
 * relations and lists are not.
 */
const sortableFieldCache = new Map<string, Set<string>>();

const sortableFieldsFor = (model: string): Set<string> => {
    const cached = sortableFieldCache.get(model);
    if (cached) return cached;

    const definition = Prisma.dmmf.datamodel.models.find(
        (candidate) => candidate.name === model,
    );

    const fields = new Set(
        (definition?.fields ?? [])
            .filter(
                (field) =>
                    (field.kind === "scalar" || field.kind === "enum") &&
                    !field.isList,
            )
            .map((field) => field.name),
    );

    sortableFieldCache.set(model, fields);
    return fields;
};

interface QueryBuilderResult {
    where: any;
    skip: number;
    take: number;
    orderBy?: any;
    include?: Record<string, any>;
    select?: Record<string, any>;
}

/**
 * Enhanced Prisma Query Builder with builder pattern and type safety
 * @template TWhereInput - Prisma where input type
 * @template TModel - Prisma model type for count operations
 */
class PrismaQueryBuilder<TWhereInput = any, TModel = any> {
    private whereConditions: TWhereInput[] = [];
    private defaultFilter: Partial<TWhereInput> | null = null;
    private isDefaultFilterApplied = false;

    private paginationConfig: Required<PaginationConfig> = {
        page: 1,
        limit: 10,
        maxLimit: 100,
    };

    private sortConfig: Required<SortConfig> = {
        defaultField: "createdAt",
        defaultOrder: "desc",
        allowedFields: [],
        sortAliases: {},
    };

    // `any` because a relation alias nests: { auth: { email: "asc" } }.
    private orderByCondition: Record<string, any> = {};
    private includeFields: Record<string, any> = {};
    private selectFields: Record<string, boolean> = {};

    private readonly model: Prisma.ModelName;

    constructor(
        private readonly query: Record<string, any>,
        config: Partial<PaginationConfig & SortConfig> & ModelConfig,
    ) {
        this.model = config.model;
        this.paginationConfig = { ...this.paginationConfig, ...config };
        this.sortConfig = {
            ...this.sortConfig,
            defaultField: config.defaultField || this.sortConfig.defaultField,
            defaultOrder: config.defaultOrder || this.sortConfig.defaultOrder,
            allowedFields:
                config.allowedFields || this.sortConfig.allowedFields,
            sortAliases: config.sortAliases || this.sortConfig.sortAliases,
        };
    }

    /**
     * Set default filter that applies to all queries
     * @example withDefaultFilter({ isDeleted: false, status: 'ACTIVE' })
     */
    withDefaultFilter(filter: Partial<TWhereInput>): this {
        this.defaultFilter = filter;
        return this;
    }

    /**
     * Add custom where condition
     * @example addWhere({ userId: '123' })
     */
    addWhere(condition: TWhereInput): this {
        this.whereConditions.push(condition);
        return this;
    }

    /**
     * Add multiple OR conditions
     * @example addOrConditions([{ status: 'ACTIVE' }, { status: 'PENDING' }])
     */
    addOrConditions(conditions: Partial<TWhereInput>[]): this {
        if (conditions.length > 0) {
            this.whereConditions.push({
                OR: conditions,
            } as unknown as TWhereInput);
        }
        return this;
    }

    /**
     * Merge include fields (supports nested includes)
     * @example include({ user: true, comments: { include: { author: true } } })
     */
    include(fields: Record<string, any>): this {
        this.includeFields = this.deepMerge(this.includeFields, fields);
        return this;
    }

    /**
     * Merge select fields
     * @example select({ id: true, name: true })
     */
    select(fields: Record<string, boolean>): this {
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
     */
    search(
        fields: (keyof TWhereInput)[],
        relationPaths: string[] = [],
    ): this {
        const searchValue = this.getQueryParam("search");

        if (!searchValue || (fields.length === 0 && relationPaths.length === 0)) {
            return this;
        }

        const match = {
            contains: String(searchValue),
            mode: "insensitive",
        };

        const conditions: any[] = fields.map((field) => ({ [field]: match }));

        for (const path of relationPaths) {
            const [relation, column] = path.split(".");

            if (!relation || !column) {
                throw new Error(
                    `search(): relation path "${path}" must be "relation.column"`,
                );
            }

            conditions.push({ [relation]: { is: { [column]: match } } });
        }

        this.whereConditions.push({
            OR: conditions,
        } as unknown as TWhereInput);

        return this;
    }

    /**
     * Apply filters from query params (excludes reserved keywords)
     * Supports comma-separated values for IN queries
     * @example filter() // Converts ?status=ACTIVE,PENDING to { status: { in: ['ACTIVE', 'PENDING'] } }
     */
    filter(): this {
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
            .reduce(
                (acc, [key, value]) => {
                    acc[key] = value;
                    return acc;
                },
                {} as Record<string, any>,
            );

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
            } as any);
        }

        return this;
    }

    /**
     * Filter by numeric range
     * @example range('price', '100,500') // price between 100 and 500
     */
    range(field: keyof TWhereInput, rangeValue?: string): this {
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
        } as any);

        return this;
    }

    /**
     * Filter by date range
     * @example dateRange('createdAt', '2024-01-01,2024-12-31')
     */
    dateRange(field: keyof TWhereInput, rangeValue?: string): this {
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
        } as any);

        return this;
    }

    /**
     * Apply pagination with validation
     */
    paginate(): this {
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
    sort(defaultField?: string, defaultOrder?: "asc" | "desc"): this {
        const field = defaultField || this.sortConfig.defaultField;
        const order = defaultOrder || this.sortConfig.defaultOrder;

        const sortBy =
            this.getQueryParam("sortBy") || this.getQueryParam("sort");

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
                throw new CustomError(
                    400,
                    `Cannot sort by "${sortField}". Sortable fields: ${[...allowed]
                        .sort()
                        .join(", ")}`,
                );
            }

            const direction = sortOrder === "desc" ? "desc" : "asc";
            const alias = aliases[sortField];

            if (alias) {
                const [relation, column] = alias.split(".");
                this.orderByCondition = {
                    [relation]: { [column]: direction },
                } as any;
            } else {
                this.orderByCondition = { [sortField]: direction };
            }
        } else {
            this.orderByCondition = { [field]: order };
        }

        return this;
    }

    /**
     * Apply default filter once before building
     */
    private applyDefaultFilter(): void {
        if (this.defaultFilter && !this.isDefaultFilterApplied) {
            this.whereConditions.push(this.defaultFilter as TWhereInput);
            this.isDefaultFilterApplied = true;
        }
    }

    /**
     * Build final Prisma query arguments
     */
    build(): QueryBuilderResult {
        this.applyDefaultFilter();

        const skip =
            (this.paginationConfig.page - 1) * this.paginationConfig.limit;

        const args: QueryBuilderResult = {
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
    private buildWhereClause(): any {
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
    async getMeta(prismaModel: {
        count: (args: any) => Promise<number>;
    }): Promise<PaginationMeta> {
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
    async execute(prismaModel: {
        findMany: (args: any) => Promise<TModel[]>;
        count: (args: any) => Promise<number>;
    }): Promise<{ data: TModel[]; meta: PaginationMeta }> {
        const [data, meta] = await Promise.all([
            prismaModel.findMany(this.build()),
            this.getMeta(prismaModel),
        ]);

        return { data, meta };
    }

    // ==================== Helper Methods ====================

    private getQueryParam(key: string): any {
        return this.query[key];
    }

    private validatePage(page: any): number {
        const parsed = Number(page);
        return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }

    private validateLimit(limit: any): number {
        const parsed = Number(limit);

        if (isNaN(parsed) || parsed < 1) {
            return this.paginationConfig.limit;
        }

        return Math.min(parsed, this.paginationConfig.maxLimit);
    }

    private isCommaSeparated(value: any): boolean {
        return typeof value === "string" && value.includes(",");
    }

    private parseCommaSeparated(value: string): string[] {
        return decodeURIComponent(value)
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
    }

    private isNumeric(value: any): boolean {
        return !isNaN(Number(value)) && value !== "" && value !== null;
    }

    /**
     * Deep merge objects (useful for nested includes)
     */
    private deepMerge(target: any, source: any): any {
        const output = { ...target };

        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach((key) => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        output[key] = source[key];
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    output[key] = source[key];
                }
            });
        }

        return output;
    }

    private isObject(item: any): boolean {
        return item && typeof item === "object" && !Array.isArray(item);
    }

    /**
     * Reset builder to initial state (useful for reusing instance)
     */
    reset(): this {
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
    clone(): PrismaQueryBuilder<TWhereInput, TModel> {
        const cloned = new PrismaQueryBuilder<TWhereInput, TModel>(
            { ...this.query },
            { ...this.paginationConfig, ...this.sortConfig, model: this.model },
        );

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

export default PrismaQueryBuilder;
export type {
    PaginationMeta,
    PaginationConfig,
    SortConfig,
    QueryBuilderResult,
};
