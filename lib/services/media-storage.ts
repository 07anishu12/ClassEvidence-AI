import { resolve, sep } from "node:path";

/** In-repository media must remain in the ignored private tree, outside web/build assets. */
export function privateMediaRoot(configured: string): string {
  const root = resolve(configured);
  const workspace = resolve(".");
  const privateTree = resolve(".private");
  if ((root === workspace || root.startsWith(workspace + sep)) &&
      root !== privateTree && !root.startsWith(privateTree + sep)) {
    throw new Error("private_storage_invalid");
  }
  return root;
}
