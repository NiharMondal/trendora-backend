import { Prisma } from "@/lib/prisma-client";
import { prisma } from "@/config/db";
import PrismaQueryBuilder from "@/lib/PrismaQueryBuilder";
import { deleteFromCloudinary, moveFromTemp } from "@/utils/cloudinary";
import CustomError from "@/utils/customError";
import { TUserUpdateSchema } from "./user.validation";

/**
 * Credentials live on `Auth`, not `User` — one row each, split so a password
 * hash is never in the same table as the profile. The API does not repeat that
 * split: `email` and `role` are flattened onto the user, because they are
 * attributes of the person, not of a credentials record, and the admin table
 * consumes them as `row.email` / `row.role`.
 *
 * Flattening here rather than nesting under `auth` also means the response
 * cannot grow a `password` field by accident — only the two columns named
 * below ever leave this function.
 */
type TUserWithAuth = Prisma.UserGetPayload<{
	include: { auth: { select: { email: true; role: true } } };
}>;

const flattenAuth = ({ auth, ...user }: TUserWithAuth) => ({
	...user,
	// Nullable because `User.auth` is optional in the schema. A user with no
	// Auth row cannot sign in at all, so this is a data problem rather than a
	// normal state — but it must not blank the whole row.
	email: auth?.email ?? null,
	role: auth?.role ?? null,
});

/**
 * Admin-only list of every user. Paginated because it grows without bound —
 * this is the one endpoint whose result set is the whole user base.
 *
 * Soft-deleted users are excluded; they were previously returned.
 */
const getAllFromDB = async (query: Record<string, unknown>) => {
	const builder = new PrismaQueryBuilder<Prisma.UserWhereInput>(query, {
		model: "User",
		// `email` and `role` are columns of `Auth`, so the DMMF-derived
		// allowlist would reject them even though the client can see both.
		sortAliases: { email: "auth.email", role: "auth.role" },
	});

	const prismaArgs = builder
		.withDefaultFilter({ isDeleted: false })
		// Email is the identifier an admin actually has to hand when someone
		// writes in about their account — searching only name and phone made
		// the box near-useless for support.
		.search(["name", "phone"], ["auth.email"])
		.filter()
		.paginate()
		.sort()
		.include({ auth: { select: { email: true, role: true } } })
		.build();

	const [users, meta] = await Promise.all([
		prisma.user.findMany(prismaArgs) as Promise<TUserWithAuth[]>,
		builder.getMeta(prisma.user),
	]);

	return { meta, users: users.map(flattenAuth) };
};

const myProfile = async(userId: string)=> {
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		throw new CustomError(404, "User not found")
	}

	if (user && user?.isDeleted) {
		throw new CustomError(404, "User has been deleted")
	}
	return user;

}

const updateData = async (payload: TUserUpdateSchema, userId: string) => {

	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		throw new CustomError(404, "User not found")
	}

	if (user && user?.isDeleted) {
		throw new CustomError(404, "User has been deleted")
	}

	const transformData = {
		name: payload?.name,
		phone: payload?.phone,
		avatar: payload.avatar?.url,
		avatarPublicId: payload.avatar?.publicId
	};

	if(payload?.avatar?.publicId){
		const tempPublicId = payload?.avatar?.publicId;
		if(tempPublicId.includes("/temp")){
			// 1. Delete old avatar from Cloudinary if exists
			if(user.avatarPublicId){
				await deleteFromCloudinary(user.avatarPublicId);
			}

			// 2. Move new image from temp -> final folder
			const {publicId, url}  = await moveFromTemp(tempPublicId);
			transformData.avatar = url;
			transformData.avatarPublicId = publicId;
		}
	}
	const data = await prisma.user.update({
		where: { id: userId },
		data: transformData
	});

	return data;
}
export const userServices = { getAllFromDB, myProfile, updateData };
