"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PrismaQueryBuilder {
    constructor(query) {
        this.query = query;
        this.whereConditions = [];
        this.defaultFilter = {};
        this.page = 1;
        this.limit = 10;
        this.orderByCondition = {};
        this.skip = 0;
    }
    /**
     * Add a default filter (e.g., isDeleted: false)
     */
    withDefaultFilter(filter) {
        this.defaultFilter = filter;
        return this;
    }
    /**
     * Search in given fields (case-insensitive)
     */
    search(fields) {
        if (this.query.search) {
            const searchValue = this.query.search;
            this.whereConditions.push({
                OR: fields.map((field) => ({
                    [field]: {
                        contains: searchValue,
                        mode: "insensitive",
                    },
                })),
            });
        }
        return this;
    }
    /**
     * Filter exact matches or multiple values
     */
    filter() {
        const excluded = ["search", "page", "limit", "sortBy", "orderBy"];
        const others = { ...this.query };
        excluded.forEach((key) => delete others[key]);
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
            });
        }
        return this;
    }
    /**
     * Numeric range filtering
     */
    range(field, minMaxString) {
        if (minMaxString) {
            const [min, max] = minMaxString.split(",");
            this.whereConditions.push({
                [field]: {
                    gte: Number(min),
                    lte: Number(max),
                },
            });
        }
        return this;
    }
    /**
     * Pagination
     */
    paginate() {
        this.page = Number(this.query.page) || 1;
        this.limit = Number(this.query.limit) || 10;
        this.skip = (this.page - 1) * this.limit;
        return this;
    }
    /**
     * Sorting
     */
    sort(defaultField = "createdAt", defaultOrder = "asc") {
        if (this.query.sortBy) {
            this.orderByCondition = {
                [this.query.sortBy]: this.query.orderBy || "asc",
            };
        }
        else {
            this.orderByCondition = { [defaultField]: defaultOrder };
        }
        return this;
    }
    /**
     * Build final Prisma args
     */
    build() {
        // Always push default filter if provided
        if (Object.keys(this.defaultFilter).length > 0) {
            this.whereConditions.push(this.defaultFilter);
        }
        return {
            where: { AND: this.whereConditions },
            skip: this.skip,
            take: this.limit,
            orderBy: this.orderByCondition,
        };
    }
    /**
     * Meta info
     */
    async getMeta(prismaModel) {
        // Include default filter in count as well
        if (Object.keys(this.defaultFilter).length > 0) {
            this.whereConditions.push(this.defaultFilter);
        }
        const totalData = await prismaModel.count({
            where: { AND: this.whereConditions },
        });
        const totalPages = Math.ceil(totalData / this.limit);
        return {
            currentPage: this.page,
            totalPages,
            totalData,
        };
    }
}
exports.default = PrismaQueryBuilder;
