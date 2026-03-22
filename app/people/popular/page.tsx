import { PersonList } from "@/components/person";
import { pages } from "@/config/pages";
import {
  isPeopleDepartmentValue,
  isPeopleGenderFilter,
  type PeopleDepartmentValue,
  type PeopleGenderFilter,
} from "@/lib/person-popular";
import { normalizeRouteSearchParams } from "@/lib/utils";
import type { Metadata } from "next";

const resolvePopularPeopleMeta = (params: {
  department: PeopleDepartmentValue | undefined;
  genderFilter: PeopleGenderFilter | undefined;
}): { title: string; description: string } => {
  const { department, genderFilter } = params;

  if (department === undefined) {
    return {
      title: pages.people.popular.title,
      description: pages.people.popular.description,
    };
  }

  if (department === "Acting") {
    if (genderFilter === 2) {
      return {
        title: pages.people.popularActors.title,
        description: pages.people.popularActors.description,
      };
    }
    if (genderFilter === 1) {
      return {
        title: pages.people.popularActresses.title,
        description: pages.people.popularActresses.description,
      };
    }
    return {
      title: "Popular performers",
      description:
        "Actors and actresses from TMDB’s popular people list (all genders).",
    };
  }

  if (department === "Directing") {
    return {
      title: pages.people.popularDirectors.title,
      description: pages.people.popularDirectors.description,
    };
  }

  return {
    title: "Popular producers",
    description: "Producers on TMDB’s popular people list.",
  };
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const raw = await searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const rawDept = sp.department;
  const department =
    rawDept !== undefined && isPeopleDepartmentValue(rawDept)
      ? rawDept
      : undefined;
  const genderRaw = sp.gender;
  const genderFilter =
    department === "Acting" && isPeopleGenderFilter(genderRaw)
      ? (Number(genderRaw) as PeopleGenderFilter)
      : undefined;

  const { title, description } = resolvePopularPeopleMeta({
    department,
    genderFilter,
  });

  return {
    title: `${title} | NyumatFlix`,
    description,
    openGraph: {
      title: `${title} | NyumatFlix`,
      description,
      type: "website",
      siteName: "NyumatFlix",
    },
  };
}

export default async function PopularPeople({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const rawDept = sp.department;
  const department =
    rawDept !== undefined && isPeopleDepartmentValue(rawDept)
      ? rawDept
      : undefined;
  const genderRaw = sp.gender;
  const genderFilter =
    department === "Acting" && isPeopleGenderFilter(genderRaw)
      ? (Number(genderRaw) as PeopleGenderFilter)
      : undefined;

  const { title, description } = resolvePopularPeopleMeta({
    department,
    genderFilter,
  });

  return (
    <PersonList
      list="popular"
      page={sp.page ?? "1"}
      title={title}
      description={description}
      department={department}
      genderFilter={genderFilter}
    />
  );
}
