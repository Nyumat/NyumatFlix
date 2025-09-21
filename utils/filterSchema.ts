import { z } from "zod";

const FilterParamsSchema = z.record(z.string()).optional();
const CustomParamsSchema = z.record(z.unknown()).optional();
const FilterDefinitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  mediaType: z.enum(["movie", "tv"]),
  params: FilterParamsSchema,
  customFetcher: z.string().optional(),
  customParams: CustomParamsSchema,
});

const RowConfigurationSchema = z.object({
  category: z.string(),
  mediaType: z.enum(["movie", "tv"]),
  international: z.boolean().optional(),
});

const PageRowRecommendationsSchema = z.object({
  home: z.array(z.string()),
  movies: z.array(z.string()),
  tv: z.array(z.string()),
});

export const FiltersSchema = z.object({
  rowConfigurations: z.record(RowConfigurationSchema),
  internationalRowFilters: z.record(z.string()),
  pageRowRecommendations: PageRowRecommendationsSchema,
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
export type RowConfiguration = z.infer<typeof RowConfigurationSchema>;
export type PageRowRecommendations = z.infer<
  typeof PageRowRecommendationsSchema
>;
