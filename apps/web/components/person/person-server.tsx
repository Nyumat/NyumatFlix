import React from "react";
import { notFound } from "next/navigation";
import { tmdb } from "@/tmdb/api";
import { PersonListType } from "@/tmdb/api";
import {
  fetchPopularPeopleByDepartment,
  type PeopleDepartmentValue,
  type PeopleGenderFilter,
} from "@/lib/person-popular";
import { enrichPeopleWithDeathday } from "@/lib/server/person-enrichment";

import { IndexHeader } from "@/components/catalog/index-header";
import { IndexPage } from "@/components/catalog/index-page";
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

  const peopleWithDeathday = await enrichPeopleWithDeathday(people);

  return (
    <IndexPage
      header={
        <IndexHeader title={title ?? "People"} description={description} />
      }
    >
      <div className="grid-list">
        {peopleWithDeathday.map((person) => (
          <PersonCard key={person.id} {...person} />
        ))}
      </div>

      <ListPagination currentPage={currentPage} totalPages={totalPages} />
    </IndexPage>
  );
};
