# Search Page — Current Flow

This document describes the current, in-use Search page and how it works end-to-end: frontend components, API calls, filters, data handling, and UX behavior. It documents only the active flow in the codebase (no legacy/unused bits).

## 1. Page & Components

- Path: `/search`
- Frontend component: `frontend/src/app/[locale]/(main)/search/page.tsx`
- Supporting components:
  - `DisplayPosts` — renders the list/grid of results
  - `CustomDropdown` and `FilterModal` — filter UI
  - `HydrationSafeWrapper` — safe SSR/client hydration handling

## 2. Purpose & UX

- Purpose: Let users browse available pending items by filtering item type and branch and view item details with images.
- Primary UX features:
  - Desktop: top filter bar with Item Type and Branch filters + results summary and clear filters action.
  - Mobile: floating filter button that opens a FilterModal.
  - Results show count and a list/grid of items; when no items exist a helpful empty state with a CTA to clear filters is shown.

## 3. Active API Calls (what the page currently uses)

All requests use `process.env.NEXT_PUBLIC_HOST_NAME` as the base host.

- GET `/api/item-types/public` — fetch all item types to populate the Item Type dropdown.
- GET `/api/branches/` — fetch branches to populate Branch dropdown.
- GET `/api/items` — fetch items for the chosen filters. Query params used by the page:
  - `item_type_id` (optional)
  - `branch_id` (optional)
  - `skip=0`, `limit=100` (pagination defaults used by page)
  - `status=pending` (the page focuses on pending items)
  - `show_all=true` (page requests all pending items regardless of branch-based access to make the browsing experience consistent)
- GET `/api/images/items/{itemId}/images` — fetch images for each item shown (images are fetched after items load)

Notes:
- The page tolerates both array responses and paginated objects (handles `[]` or `{ items: [...] }`).
- It sets `show_all=true` so authenticated viewers see all pending items without branch restriction; this behavior is intentional and matches current production flow.

## 4. Client-side Flow & Data Handling

1. On mount: fetch item types, branches, and initial items (no filters) via `fetchItemByItemType()`.
2. Items request uses `status=pending` and `show_all=true` plus optional `item_type_id` and `branch_id` when filters are applied.
3. After item results arrive, `fetchImagesForItems()` runs and populates an `itemImages` map keyed by item ID.
4. UI updates: loading state, error handling, and the results count are handled ergonomically across mobile and desktop.

## 5. Accessibility & Internationalization

- Uses `next-intl` translations (e.g., `useTranslations('search')`) for locale-specific strings.
- Filter dropdowns and inputs use accessible HTML controls (selects, labels). Mobile filter uses a modal with focusable elements.

## 6. Performance Considerations

- Images are fetched per-item after the initial items request: this can cause many parallel requests. Consider batching or providing the API with an option to include a single representative image in the items response to reduce requests.
- Current limit is `100` which is safe for moderate result sets; consider server-side pagination or infinite scroll if result sizes grow.

## 7. Behavior Edge Cases

- Empty responses: page shows a friendly empty state with a CTA to clear filters.
- Non-200 / network errors: page sets a user-visible error message and clears the items list.
- Response shape variance: code already detects array vs paginated object and normalizes to an items array.

## 8. Implementation Notes & Suggestions

- Keep `status=pending` explicitly if the product requirement is to show pending items only; otherwise consider making the status configurable in the UI.
- Consider adding a server-side `items/summary` or include `thumbnail_url` in `GET /api/items` to avoid N+1 image fetches.
- If multi-branch access control matters, confirm `show_all=true` is acceptable for all roles, otherwise remove or conditionally set it based on permissions.

---

If you'd like, I can:
- Add a small Mermaid diagram to visualize the current search request flow, or
- Implement a minimal change to include `thumbnail_url` with items in the backend `ItemService` and update the frontend to use it (I can add tests). 

Tell me which you'd prefer next. ✅