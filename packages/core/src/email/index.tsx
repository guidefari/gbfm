import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { render } from "@react-email/components";
import { Resource } from "sst";
import { PasswordResetEmail } from "./password-reset";
import { sendSimpleEmail } from "./simple";
import { WelcomeEmail } from "./welcome";

export namespace Email {
	export const Client = new SESv2Client({});

	export interface Attachment {
		filename: string;
		content: string;
		contentType?: string;
	}

	interface SendEmailProps {
		from: string;
		to: string | string[];
		subject: string;
		body: string;
		attachments?: Attachment[];
	}

	interface SendTemplateEmailProps {
		from: string;
		to: string | string[];
		subject: string;
		html: string;
		text?: string;
		attachments?: Attachment[];
	}

	export function getToAddresses(to: string | string[]): string[] {
		return Array.isArray(to) ? to : [to];
	}

	export function getFromAddress(from: string): string {
		return `${from}@${Resource.Email.sender}`;
	}

	function buildRawMessage({
		from,
		to,
		subject,
		html,
		text,
		attachments,
	}: SendTemplateEmailProps & { from: string; to: string[] }): string {
		const boundary = `boundary-${Date.now().toString(16)}`;
		let content = [
			`From: goosebumps.fm <${from}>`,
			`To: ${to.join(", ")}`,
			`Subject: ${subject}`,
			"MIME-Version: 1.0",
			`Content-Type: multipart/alternative; boundary="${boundary}"`,
			"",
			`--${boundary}`,
			"Content-Type: text/plain; charset=UTF-8",
			"",
			text || stripHtml(html),
			"",
			`--${boundary}`,
			"Content-Type: text/html; charset=UTF-8",
			"",
			html,
			"",
		];

		if (attachments && attachments.length > 0) {
			const mixedBoundary = `mixed-${Date.now().toString(16)}`;
			content = [
				`From: goosebumps.fm <${from}>`,
				`To: ${to.join(", ")}`,
				`Subject: ${subject}`,
				"MIME-Version: 1.0",
				`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
				"",
				`--${mixedBoundary}`,
				`Content-Type: multipart/alternative; boundary="${boundary}"`,
				"",
				...content.slice(4),
				`--${boundary}--`,
			];

			for (const attachment of attachments) {
				const contentType =
					attachment.contentType ||
					(attachment.filename.endsWith(".csv")
						? "text/csv"
						: "application/octet-stream");
				content = content.concat([
					`--${mixedBoundary}`,
					`Content-Type: ${contentType}; name="${attachment.filename}"`,
					"Content-Transfer-Encoding: base64",
					`Content-Disposition: attachment; filename="${attachment.filename}"`,
					"",
					Buffer.from(attachment.content).toString("base64"),
					"",
				]);
			}

			content.push(`--${mixedBoundary}--`);
		} else {
			content.push(`--${boundary}--`);
		}

		return content.join("\r\n");
	}

	function stripHtml(html: string): string {
		return html
			.replace(/<[^>]*>/g, "")
			.replace(/\s+/g, " ")
			.trim();
	}

	export async function send({
		from,
		to,
		subject,
		body,
		attachments,
	}: SendEmailProps): Promise<void> {
		const fromAddress = getFromAddress(from);
		const toAddresses = getToAddresses(to);

		if (attachments && attachments.length > 0) {
			const rawMessage = buildRawMessage({
				from: fromAddress,
				to: toAddresses,
				subject,
				html: `<html><body>${body}</body></html>`,
				text: body,
				attachments,
			});

			await Client.send(
				new SendEmailCommand({
					Destination: { ToAddresses: toAddresses },
					FromEmailAddress: `goosebumps.fm <${fromAddress}>`,
					Content: {
						Raw: { Data: Buffer.from(rawMessage) },
					},
				}),
			);
			return;
		}

		await Client.send(
			new SendEmailCommand({
				Destination: { ToAddresses: toAddresses },
				FromEmailAddress: `goosebumps.fm <${fromAddress}>`,
				Content: {
					Simple: {
						Subject: { Data: subject },
						Body: { Text: { Data: body } },
					},
				},
			}),
		);
	}

	export async function sendTemplate({
		from,
		to,
		subject,
		html,
		text,
		attachments,
	}: SendTemplateEmailProps): Promise<void> {
		const fromAddress = getFromAddress(from);
		const toAddresses = getToAddresses(to);

		const rawMessage = buildRawMessage({
			from: fromAddress,
			to: toAddresses,
			subject,
			html,
			text,
			attachments,
		});

		await Client.send(
			new SendEmailCommand({
				Destination: { ToAddresses: toAddresses },
				FromEmailAddress: `goosebumps.fm <${fromAddress}>`,
				Content: {
					Raw: { Data: Buffer.from(rawMessage) },
				},
			}),
		);
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
			<WelcomeEmail username={username} loginUrl={loginUrl} />,
		);

		console.log(html);

		await sendSimpleEmail({
			source: getFromAddress("welcome"),
			to: [to],
			subject: `Welcome to goosebumps.fm, ${username}! 🎵`,
			html: await render(
				<WelcomeEmail username={username} loginUrl={loginUrl} />,
			),
		});
	}

	export async function sendPasswordResetEmail({
		to,
		resetUrl,
		expiresIn,
	}: {
		to: string;
		resetUrl: string;
		expiresIn?: string;
	}): Promise<void> {
		const html = await render(
			<PasswordResetEmail resetUrl={resetUrl} expiresIn={expiresIn} />,
		);

		await sendTemplate({
			from: "noreply",
			to,
			subject: "Reset your goosebumps.fm password",
			html,
		});
	}
}
