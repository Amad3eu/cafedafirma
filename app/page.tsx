import { headers } from "next/headers";
import CoffeeApp from "@/components/CoffeeApp";

export default async function Home() {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const siteUrl = `${proto}://${host}`;

  return <CoffeeApp siteUrl={siteUrl} />;
}
