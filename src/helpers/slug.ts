import slugify from "slugify";

export const generateSlug = (title: string) => {
	const slug = slugify(title, { lower: true });
	return slug;
};
