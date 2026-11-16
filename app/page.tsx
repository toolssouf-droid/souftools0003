import React from "react";
import LandingPage, { generateMetadata as generateLocaleMetadata } from "./[locale]/page";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return generateLocaleMetadata({
    params: Promise.resolve({ locale: "ar" }),
  });
}

export default async function RootPage() {
  return <LandingPage params={Promise.resolve({ locale: "ar" })} />;
}
