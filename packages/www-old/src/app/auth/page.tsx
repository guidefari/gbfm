// redirect to /auth/signIn

import { redirect } from "next/navigation";

export default function AuthIndex() {
	redirect("/auth/signin");
}
