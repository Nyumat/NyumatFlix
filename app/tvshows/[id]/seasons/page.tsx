import { pages } from "@/config";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function TVShowSeasonsAliasPage(props: Props) {
  const { id } = await props.params;
  redirect(`${pages.tv.root.link}/${id}/seasons-episodes`);
}
