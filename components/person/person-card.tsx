"use client";

import { PersonCardPresenter } from "@/components/cards";
import { type Person } from "@/tmdb/models";

export const PersonCard: React.FC<Person> = (person) => {
  return (
    <PersonCardPresenter
      id={person.id}
      media_type="person"
      name={person.name}
      title={person.name}
      href={`/person/${person.id}`}
      profile_path={person.profile_path}
      known_for_department={person.known_for_department}
      deathday={person.deathday}
    />
  );
};
