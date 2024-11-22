import { createFileRoute } from "@tanstack/react-router";
import todo from "@/mdx/todo.mdx";

import { CustomMDXComponents } from "@/components/mdx-components";

export const Route = createFileRoute("/todo")({
	component: () => todo({ components: CustomMDXComponents }),
});
