/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

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
    allowedFields?: string[];
}

interface QueryBuilderResult {
    where: any;
    skip: number;
    take: number;
    orderBy: any;
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
    };

    private orderByCondition: Record<string, "asc" | "desc"> = {};
    private includeFields: Record<string, any> = {};
    private selectFields: Record<string, boolean> = {};

    constructor(
        private readonly query: Record<string, any>,
        config?: Partial<PaginationConfig & SortConfig>,
    ) {
        if (config) {
            this.paginationConfig = { ...this.paginationConfig, ...config };
            this.sortConfig = {
                ...this.sortConfig,
                defaultField:
                    config.defaultField || this.sortConfig.defaultField,
                defaultOrder:
                    config.defaultOrder || this.sortConfig.defaultOrder,
                allowedFields:
                    config.allowedFields || this.sortConfig.allowedFields,
            };
        }
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
     * Search across multiple fields with case-insensitive matching
     * @example search(['name', 'email', 'description'])
     */
    search(fields: (keyof TWhereInput)[]): this {
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
            })) as any,
        } as unknown as TWhereInput);

        return this;
    }

    /**
     * Apply filters from query params (excludes reserved keywords)
     * Supports comma-separated values for IN queries
     * @example filter() // Converts ?status=ACTIVE,PENDING to { status: { in: ['ACTIVE', 'PENDING'] } }
     */
    filter(): this {
        const RESERVED_KEYS = ["search", "page", "limit", "sortBy", "sort"];

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

            // Validate against allowed fields if configured
            if (
                this.sortConfig.allowedFields.length > 0 &&
                !this.sortConfig.allowedFields.includes(sortField)
            ) {
                // console.warn(
                //     `Sort field "${sortField}" not allowed. Using default: ${field}`
                // );
                this.orderByCondition = { [field]: order };
                return this;
            }

            this.orderByCondition = {
                [sortField]: sortOrder === "desc" ? "desc" : "asc",
            };
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
            orderBy: this.orderByCondition,
        };

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
            { ...this.paginationConfig, ...this.sortConfig },
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
