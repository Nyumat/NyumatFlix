import { z } from "zod";

// Schema for filter parameters
const FilterParamsSchema = z.record(z.string()).optional();

// Schema for custom fetcher parameters
const CustomParamsSchema = z.record(z.unknown()).optional();

// Schema for individual filter definition
const FilterDefinitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  mediaType: z.enum(["movie", "tv"]),
  params: FilterParamsSchema,
  customFetcher: z.string().optional(),
  customParams: CustomParamsSchema,
});

// Schema for filter categories
const FilterCategorySchema = z.record(z.array(FilterDefinitionSchema));

// Main schema for the entire filters.json structure
export const FiltersSchema = z.object({
  movie: z.object({
    category: z.array(FilterDefinitionSchema).optional(),
    genre: z.array(FilterDefinitionSchema).optional(),
    year: z.array(FilterDefinitionSchema).optional(),
    studio: z.array(FilterDefinitionSchema).optional(),
    director: z.array(FilterDefinitionSchema).optional(),
    special: z.array(FilterDefinitionSchema).optional(),
  }),
  tv: z.object({
    category: z.array(FilterDefinitionSchema).optional(),
    genre: z.array(FilterDefinitionSchema).optional(),
    year: z.array(FilterDefinitionSchema).optional(),
    studio: z.array(FilterDefinitionSchema).optional(),
    director: z.array(FilterDefinitionSchema).optional(),
    special: z.array(FilterDefinitionSchema).optional(),
  }),
});

export type FiltersConfig = z.infer<typeof FiltersSchema>;
export type FilterDefinition = z.infer<typeof FilterDefinitionSchema>;
