import {
	EditorProvider,
	FloatingMenu,
	BubbleMenu,
	useEditor,
	EditorContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useState } from "react";

const extensions = [StarterKit, Link];

const content = "<p>Hello World!</p>";

export function Editor() {
	const [isEditable, setIsEditable] = useState(true);
	const editor = useEditor({
		extensions,
		content,
	});

	useEffect(() => {
		if (editor) {
			editor.setEditable(isEditable);
		}
	}, [isEditable, editor]);

	return (
		<>
			<EditorContent className="" editor={editor} height={500} />
			<FloatingMenu className="" editor={editor}>
				This is the floating menu
			</FloatingMenu>
			{editor && (
				<BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
					<div className="bubble-menu">
						<button
							type="button"
							onClick={() => editor.chain().focus().toggleBold().run()}
							className={editor.isActive("bold") ? "is-active" : ""}
						>
							Bold
						</button>
						<button
							type="button"
							onClick={() => editor.chain().focus().toggleItalic().run()}
							className={editor.isActive("italic") ? "is-active" : ""}
						>
							Italic
						</button>
						<button
							type="button"
							onClick={() => editor.chain().focus().toggleStrike().run()}
							className={editor.isActive("strike") ? "is-active" : ""}
						>
							Strike
						</button>
						<button
							type="button"
							onClick={() => {
								const url = prompt("Enter the URL");
								if (url) {
									editor.chain().focus().setLink({ href: url }).run();
								}
							}}
							className={editor.isActive("link") ? "is-active" : ""}
						>
							Link
						</button>
					</div>
				</BubbleMenu>
			)}
		</>
	);
}
