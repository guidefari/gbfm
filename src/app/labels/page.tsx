import { Labels } from "@/components/FrontPage/Tabs/Labels";
import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
	title: "Curated Record Labels",
	description: "Some record labels we have enjoyed over the years",
};

const LabelsPage = () => {
	return <Labels />;
};

export default LabelsPage;
