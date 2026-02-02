/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface PaginationMeta {
    currentPage: number;
    totalPages: number;
    totalData: number;
}

class PrismaQueryBuilder<TWhereInput> {
    private whereConditions: TWhereInput[] = [];
    private defaultFilter: Partial<TWhereInput> = {};
    private page = 1;
    private limit = 10;
    private orderByCondition: Record<string, "asc" | "desc"> = {};
    private skip = 0;
    private includeFields: Record<string, any> = {};
    private selectFields: Record<string, boolean> = {};

    constructor(private query: Record<string, any>) {}

    /** Add a default filter (e.g., isDeleted: false) */
    withDefaultFilter(filter: Partial<TWhereInput>) {
        this.defaultFilter = filter;
        return this;
    }

    /** Add Prisma include fields */
    include(fields: Record<string, any>) {
        this.includeFields = fields;
        return this;
    }

    /** Add Prisma select fields */
    select(fields: Record<string, boolean>) {
        this.selectFields = fields;
        return this;
    }

    /** Search in given fields (case-insensitive) */
    search(fields: (keyof TWhereInput)[]) {
        if (this.query.search) {
            const searchValue = this.query.search;
            this.whereConditions.push({
                OR: fields.map((field) => ({
                    [field]: {
                        contains: searchValue,
                        mode: "insensitive",
                    },
                })) as any,
            } as unknown as TWhereInput);
        }
        return this;
    }

    /** Filter exact matches or multiple values */
    filter() {
        const excluded = ["search", "page", "limit", "sortBy"];
        const others = { ...this.query };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        excluded.forEach((key: string) => delete others[key]);

        if (Object.keys(others).length > 0) {
            this.whereConditions.push({
                AND: Object.entries(others).map(([key, value]) => {
                    if (String(value).includes(",")) {
                        return {
                            [key]: {
                                in: decodeURIComponent(value).split(","),
                            },
                        };
                    }
                    return { [key]: value };
                }),
            } as any);
        }
        return this;
    }

    /** Numeric range filtering */
    range(field: keyof TWhereInput, page?: string) {
        if (page) {
            const [min, max] = page.split(",");
            this.whereConditions.push({
                [field]: {
                    gte: Number(min),
                    lte: Number(max),
                },
            } as any);
        }
        return this;
    }

    /** Pagination */
    paginate() {
        this.page = Number(this.query.page) || 1;
        this.limit = Number(this.query.limit) || 10;
        this.skip = (this.page - 1) * this.limit;
        return this;
    }

    /** Sorting */
    sort(defaultField = "createdAt", defaultOrder: "asc" | "desc" = "asc") {
        if (this.query.sortBy) {
            const [field, order] = String(this.query?.sortBy).split(":");
            this.orderByCondition = {
                [field]: order === "desc" ? "desc" : "asc",
            };
        } else {
            this.orderByCondition = { [defaultField]: defaultOrder };
        }
        return this;
    }

    /** Build final Prisma args */
    build() {
        if (Object.keys(this.defaultFilter).length > 0) {
            this.whereConditions.push(this.defaultFilter as TWhereInput);
        }

        const args: any = {
            where: { AND: this.whereConditions },
            skip: this.skip,
            take: this.limit,
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

    /** Meta info */
    async getMeta(prismaModel: any): Promise<PaginationMeta> {
        if (Object.keys(this.defaultFilter).length > 0) {
            this.whereConditions.push(this.defaultFilter as TWhereInput);
        }
        const totalData = await prismaModel.count({
            where: { AND: this.whereConditions } as any,
        });
        const totalPages = Math.ceil(totalData / this.limit);
        return {
            currentPage: this.page,
            totalPages,
            totalData,
        };
    }
}

export default PrismaQueryBuilder;
