import { Suspense } from "react";
import IssuesByDistrict from "./IssuesByDistrict";

// The list loads client-side; the district filter is read from the URL in
// <IssuesByDistrict>, so this page prerenders as static HTML.
export default function IssuesPage() {
  return (
    <Suspense fallback={null}>
      <IssuesByDistrict />
    </Suspense>
  );
}
