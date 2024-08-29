import { Words } from "@/components/FrontPage/Tabs/Words";
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Words",
	description: "Longer posts",
};

export default function WordsPage() {
	return <Words />;
}
