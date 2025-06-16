import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { render } from "@react-email/components";
import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Preview,
} from "@react-email/components";
import { Resource } from "sst";

export interface SimpleSendEmailOptions {
	source: string;
	to: string[];
	subject: string;
	html: string;
}

export async function sendSimpleEmail({
	source,
	to,
	subject,
	html,
}: SimpleSendEmailOptions): Promise<void> {
	const ses = new SESv2Client({});

	await ses.send(
		new SendEmailCommand({
			FromEmailAddress: source,
			Destination: {
				ToAddresses: to,
			},
			Content: {
				// Raw: {
				// 	Data: Buffer.from(emailHtml),
				// },
				Simple: {
					Body: { Html: { Data: html } },
					Subject: { Data: subject },
				},
			},
		}),
	);
}

export function getToAddresses(to: string | string[]): string[] {
	return Array.isArray(to) ? to : [to];
}

export function getFromAddress(from: string): string {
	return `${from}@${Resource.Email.sender}`;
}

export async function sendWelcomeEmail({
	to,
	username,
	loginUrl,
}: {
	to: string;
	username: string;
	loginUrl?: string;
}): Promise<void> {
	const html = await render(
		<Html>
			<Head />
			<Preview>Welcome to goosebumps.fm, {username}! 🎵</Preview>
			<Body>
				<Container>
					<Heading>Welcome to goosebumps.fm, {username}! 🎵</Heading>
				</Container>
			</Body>
		</Html>,
	);

	console.log(new Date().toISOString());
	console.log(html);
	console.log("================");

	await sendSimpleEmail({
		source: getFromAddress("welcome"),
		to: [to],
		subject: `Welcome to goosebumps.fm, ${username}! 🎵`,
		html,
	});
}
