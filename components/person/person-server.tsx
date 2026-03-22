import React from "react";
import { notFound } from "next/navigation";
import { tmdb } from "@/tmdb/api";
import { PersonListType } from "@/tmdb/api";
import {
  fetchPopularPeopleByDepartment,
  type PeopleDepartmentValue,
  type PeopleGenderFilter,
} from "@/lib/person-popular";

import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { ListPagination } from "@/components/shared/list-pagination";
import { PersonCard } from "./person-card";

interface PersonListProps {
  list: PersonListType;
  page: string;
  title?: string;
  description?: string;
  department?: PeopleDepartmentValue;
  genderFilter?: PeopleGenderFilter;
}

export const PersonList: React.FC<PersonListProps> = async ({
  list,
  page,
  title,
  description,
  department,
  genderFilter,
}) => {
  const {
    results: people,
    total_pages: totalPages,
    page: currentPage,
  } = department !== undefined
    ? await fetchPopularPeopleByDepartment(department, page, {
        gender: genderFilter,
      })
    : await tmdb.person.list({
        list,
        page,
      });

  if (!people?.length) {
    return notFound();
  }

  const peopleWithDeathday = await Promise.all(
    people.map(async (p) => {
      const detail = await tmdb.person.detail({ id: p.id });
      return { ...p, deathday: detail.deathday ?? null };
    }),
  );

  return (
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      <ContentContainer className="relative z-10 flex w-full flex-col items-center">
        <div className="container max-w-7xl space-y-8 px-2 pb-12 sm:px-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              {title}
            </h1>
            <p className="mx-auto mt-2 max-w-3xl text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="grid-list">
            {peopleWithDeathday.map((person) => (
              <PersonCard key={person.id} {...person} />
            ))}
          </div>

          <ListPagination currentPage={currentPage} totalPages={totalPages} />
        </div>
      </ContentContainer>
    </div>
  );
};
