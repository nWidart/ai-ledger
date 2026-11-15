import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // The openspec/specs/ a reference page was written from (design D12). Not rendered.
        spec: z.array(z.string()).optional(),
      }),
    }),
  }),
};
