import { Editor } from "@/components/editor"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/post")({
  component: Post,
})

function Post() {
  return <Editor />
}
